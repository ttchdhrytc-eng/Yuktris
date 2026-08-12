import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeLinkedInWorkspace, authorizationStatus } from "../_shared/linkedinAuthorization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { workspace_id } = await req.json();
    if (typeof workspace_id !== "string" || !workspace_id) return json({ error: "workspace_id is required" }, 400);
    const { admin: supabase } = await authorizeLinkedInWorkspace(req, workspace_id, { allowServiceRole: true });
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json({ error: "Server authentication is not configured" }, 500);

    const { error: scheduleError } = await supabase.rpc("schedule_due_linkedin_followups", { p_workspace_id: workspace_id, p_limit: 50 });
    if (scheduleError) return json({ error: `Follow-up scheduling failed: ${scheduleError.message}` }, 500);
    const { error: replyScheduleError } = await supabase.rpc("schedule_linkedin_reply_checks", { p_workspace_id: workspace_id, p_limit: 50 });
    if (replyScheduleError) return json({ error: `Reply-check scheduling failed: ${replyScheduleError.message}` }, 500);

    const now = new Date().toISOString();
    const jobsRes = await fetch(`${supabaseUrl}/rest/v1/linkedin_execution_jobs?workspace_id=eq.${encodeURIComponent(workspace_id)}&status=in.(queued,scheduled)&or=(scheduled_at.is.null,scheduled_at.lte.${encodeURIComponent(now)})&order=priority.asc,created_at.asc&limit=10&select=*`, {
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    });
    const jobsBody = await readJson(jobsRes);
    if (!jobsRes.ok) return json({ error: `Execution-job query failed (${jobsRes.status})`, detail: jobsBody }, 502);
    if (!Array.isArray(jobsBody)) return json({ error: "Execution-job query returned an unexpected payload" }, 502);

    let processed = 0;
    const failures: Array<{ job_id: unknown; status: number; detail: unknown }> = [];
    for (const job of jobsBody) {
      if (!job || typeof job !== "object" || typeof job.id !== "string") {
        failures.push({ job_id: null, status: 502, detail: "Malformed execution-job row" });
        continue;
      }
      const runRes = await fetch(`${supabaseUrl}/functions/v1/linkedin-job-runner`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id, job_id: job.id }),
      });
      const runBody = await readJson(runRes);
      if (runRes.ok && runBody && typeof runBody === "object" && typeof runBody.queue_item_id === "string") processed++;
      else failures.push({ job_id: job.id, status: runRes.status, detail: runBody });
    }

    const body = { processed, failed: failures.length, total: jobsBody.length, failures };
    return json(body, failures.length ? 502 : 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Queue runner failed" }, authorizationStatus(err));
  }
});

async function readJson(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { non_json_response: text.slice(0, 500) }; }
}

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
