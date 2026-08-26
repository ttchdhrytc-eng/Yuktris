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
    await authorizeLinkedInWorkspace(req, workspace_id, { allowServiceRole: true });
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get failed jobs that can be retried
    const jobsRes = await fetch(
      `${supabaseUrl}/rest/v1/linkedin_execution_jobs?workspace_id=eq.${workspace_id}&status=eq.failed&select=*&limit=10`,
      { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
    );
    const jobs = await jobsRes.json();

    let retried = 0;
    let skipped = 0;

    for (const job of jobs) {
      if (job.retry_count >= job.max_retries) {
        skipped++;
        continue;
      }

      // Check if the failure is retryable
      const failuresRes = await fetch(
        `${supabaseUrl}/rest/v1/linkedin_failures?execution_job_id=eq.${job.id}&order=created_at.desc&limit=1&select=*`,
        { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
      );
      const failures = await failuresRes.json();

      if (failures.length > 0) {
        const failure = failures[0];
        const nonRetryable = ["policy_violation", "authentication", "session_expired", "captcha"];
        if (nonRetryable.includes(failure.failure_type)) {
          skipped++;
          continue;
        }
      }

      // Calculate delay with exponential backoff
      const baseDelay = 60000;
      const delayMs = Math.min(baseDelay * Math.pow(2, job.retry_count), 3600000);
      const campaignId = job.action_payload?.source_campaign_id;
      if (typeof campaignId !== "string" || !campaignId) {
        // V1 retries must stay attached to a customer-controlled campaign.
        skipped++;
        continue;
      }
      const notBefore = new Date(Date.now() + delayMs).toISOString();
      const scheduleRes = await fetch(`${supabaseUrl}/rest/v1/rpc/next_campaign_outreach_at`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
        body: JSON.stringify({ p_campaign_id: campaignId, p_not_before: notBefore }),
      });
      if (!scheduleRes.ok) {
        skipped++;
        continue;
      }
      const scheduledAt = await scheduleRes.json();
      if (typeof scheduledAt !== "string" || !scheduledAt) {
        skipped++;
        continue;
      }

      // Update job for retry
      await fetch(`${supabaseUrl}/rest/v1/linkedin_execution_jobs?id=eq.${job.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "retrying",
          scheduled_at: scheduledAt,
          retry_count: job.retry_count + 1,
        }),
      });

      // Record retry
      await fetch(`${supabaseUrl}/rest/v1/linkedin_retry_history`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          workspace_id,
          execution_job_id: job.id,
          retry_attempt: job.retry_count + 1,
          retry_reason: `Auto-retry after failure`,
          retry_delay_ms: delayMs,
          retry_result: "pending",
        }),
      });

      retried++;
    }

    return new Response(JSON.stringify({ retried, skipped, total: jobs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
