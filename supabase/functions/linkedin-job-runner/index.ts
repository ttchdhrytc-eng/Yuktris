// linkedin-job-runner — Executes LinkedIn automation jobs by enqueuing browser tasks
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeLinkedInWorkspace } from "../_shared/linkedinAuthorization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = await req.json();
    const { workspace_id, job_id } = body as Record<string, unknown>;

    if (!workspace_id) return jsonError("workspace_id is required", 400);
    if (!job_id) return jsonError("job_id is required", 400);
    const { admin: supabase } = await authorizeLinkedInWorkspace(req, workspace_id, { allowServiceRole: true });

    // Load the job
    const { data: jobs } = await supabase.from("linkedin_execution_jobs").select("*").eq("id", job_id).eq("workspace_id", workspace_id).maybeSingle();
    if (!jobs) return jsonError("Job not found", 404);
    const job = jobs as Record<string, unknown>;

    // Update status to running
    await supabase.from("linkedin_execution_jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", job_id);

    // Check safety rules — daily limits
    if (job.linkedin_account_id) {
      const today = new Date().toISOString().split("T")[0];
      const { data: usage } = await supabase.from("linkedin_daily_usage").select("*").eq("linkedin_account_id", job.linkedin_account_id).eq("usage_date", today).maybeSingle();
      if (usage) {
        const u = usage as Record<string, number>;
        const actionType = job.action_type as string;
        if (actionType === "connection_request" && (u.connections_sent ?? 0) >= 25) {
          await supabase.from("linkedin_execution_jobs").update({ status: "failed", error_message: "Daily connection limit reached", completed_at: new Date().toISOString() }).eq("id", job_id);
          return jsonResponse({ status: "rate_limited" });
        }
        if (actionType === "first_message" && (u.messages_sent ?? 0) >= 50) {
          await supabase.from("linkedin_execution_jobs").update({ status: "failed", error_message: "Daily message limit reached", completed_at: new Date().toISOString() }).eq("id", job_id);
          return jsonResponse({ status: "rate_limited" });
        }
      }
    }

    // Enqueue a real browser task into browser_execution_queue
    const actionType = job.action_type as string;
    const actionParams: Record<string, unknown> = {
      job_id: job_id,
      ...((job.action_params as Record<string, unknown>) ?? {}),
    };

    // Add prospect info if available
    if (job.contact_id) {
      const { data: contact } = await supabase.from("contacts").select("first_name,last_name,linkedin_url,company_name").eq("id", job.contact_id).maybeSingle();
      if (contact) {
        const c = contact as Record<string, unknown>;
        actionParams.prospect_name = [c.first_name, c.last_name].filter(Boolean).join(" ");
        actionParams.profile_url = c.linkedin_url;
      }
    }

    const { data: queueItem, error: queueError } = await supabase.from("browser_execution_queue").insert({
      workspace_id: workspace_id as string,
      account_id: (job.linkedin_account_id as string) ?? null,
      action_type: actionType,
      action_params: actionParams,
      priority: 2,
      priority_label: "high",
      status: "pending",
    }).select("*").maybeSingle();

    if (queueError) {
      await supabase.from("linkedin_execution_jobs").update({ status: "failed", error_message: queueError.message, completed_at: new Date().toISOString() }).eq("id", job_id);
      return jsonError(`Failed to enqueue browser task: ${queueError.message}`, 500);
    }

    // Record in action history
    await supabase.from("linkedin_action_history").insert({
      workspace_id: workspace_id as string,
      linkedin_account_id: (job.linkedin_account_id as string) ?? null,
      execution_job_id: job_id as string,
      company_id: (job.company_id as string) ?? null,
      contact_id: (job.contact_id as string) ?? null,
      action_type: actionType,
      action_result: "queued",
      action_payload: job.action_params ?? {},
      response_payload: { queue_item_id: (queueItem as Record<string, unknown>)?.id ?? null },
    });

    return jsonResponse({ status: "queued", job_id, queue_item_id: (queueItem as Record<string, unknown>)?.id ?? null });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Job runner failed", 500);
  }
});

function jsonResponse(d: Record<string, unknown>): Response { return new Response(JSON.stringify(d), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function jsonError(m: string, s: number): Response { return new Response(JSON.stringify({ error: m }), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
