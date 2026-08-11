import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeLinkedInWorkspace } from "../_shared/linkedinAuthorization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { workspace_id } = await req.json();
    const { admin: supabase } = await authorizeLinkedInWorkspace(req, workspace_id, { allowServiceRole: true });
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Complete the existing scheduler path before draining due execution jobs.
    // The RPC is concurrency-safe and exactly-once per sequence state/step.
    const { error: scheduleError } = await supabase.rpc("schedule_due_linkedin_followups", { p_workspace_id: workspace_id, p_limit: 50 });
    if (scheduleError) throw new Error(`Follow-up scheduling failed: ${scheduleError.message}`);
    const { error: replyScheduleError } = await supabase.rpc("schedule_linkedin_reply_checks", { p_workspace_id: workspace_id, p_limit: 50 });
    if (replyScheduleError) throw new Error(`Reply-check scheduling failed: ${replyScheduleError.message}`);

    // Get jobs ready to execute
    const now = new Date().toISOString();
    const jobsRes = await fetch(
      `${supabaseUrl}/rest/v1/linkedin_execution_jobs?workspace_id=eq.${workspace_id}&status=in.(queued,scheduled)&or=(scheduled_at.is.null,scheduled_at.lte.${now})&order=priority.asc,created_at.asc&limit=10&select=*`,
      { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
    );
    const jobs = await jobsRes.json();

    let processed = 0;
    let failed = 0;

    for (const job of jobs) {
      // Trigger the job runner for each job
      const runRes = await fetch(`${supabaseUrl}/functions/v1/linkedin-job-runner`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id, job_id: job.id }),
      });

      if (runRes.ok) {
        processed++;
      } else {
        failed++;
      }
    }

    return new Response(JSON.stringify({ processed, failed, total: jobs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
