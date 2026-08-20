// linkedin-job-runner — idempotently bridges an execution job to the browser queue.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeLinkedInWorkspace, authorizationStatus } from "../_shared/linkedinAuthorization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Row = Record<string, unknown>;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  try {
    const body = await req.json();
    const { workspace_id, job_id } = body as Row;
    if (typeof workspace_id !== "string" || !workspace_id) return jsonError("workspace_id is required", 400);
    if (typeof job_id !== "string" || !job_id) return jsonError("job_id is required", 400);

    const { admin: supabase } = await authorizeLinkedInWorkspace(req, workspace_id, { allowServiceRole: true });
    const { data: jobData, error: jobError } = await supabase.from("linkedin_execution_jobs").select("*").eq("id", job_id).eq("workspace_id", workspace_id).maybeSingle();
    if (jobError) return jsonError(`Failed to load execution job: ${jobError.message}`, 500);
    if (!jobData) return jsonError("Job not found", 404);
    const job = jobData as Row;

    const { data: scheduleGate, error: scheduleGateError } = await supabase.rpc("campaign_outreach_preflight", { p_workspace_id: workspace_id, p_job_id: job_id });
    if (scheduleGateError) return jsonError(`Campaign schedule validation failed: ${scheduleGateError.message}`, 500);
    if (!scheduleGate?.allowed)
      return jsonResponse(
        {
          status: "not_due",
          job_id,
          code: scheduleGate?.code,
          scheduled_at: scheduleGate?.scheduled_at ?? null,
        },
        202,
      );

    const requestedActionType = String(job.action_type ?? "");
    const actionType = requestedActionType === "first_message" ? "send_message" : requestedActionType;
    const idempotencyKey = `execution-job:${job_id}`;

    // Resolve a completed bridge before enrichment. A retry must remain successful
    // even if optional source data changed after the queue item was persisted.
    const existing = await loadExistingQueueItem(supabase, workspace_id, idempotencyKey);
    if (existing.error) return jsonError(existing.error, 500);
    if (existing.item) return equivalent(existing.item, job_id, actionType, job.linkedin_account_id) ? jsonResponse(queueResponse(existing.item, job_id, true)) : jsonError("Idempotency key conflicts with a different browser action", 409);

    const actionParams: Row = {
      job_id,
      contact_id: job.contact_id ?? null,
      campaign_id: job.campaign_id ?? null,
      sequence_id: job.sequence_id ?? null,
      ...((job.action_payload as Row | null) ?? {}),
    };
    if (actionType === "connection_request" && !actionParams.note && actionParams.message) {
      actionParams.note = actionParams.message;
    }

    if (job.contact_id) {
      const { data: contactData, error: contactError } = await supabase.from("contacts").select("first_name,last_name,linkedin_url,company_id").eq("id", job.contact_id).eq("workspace_id", workspace_id).maybeSingle();
      if (contactError) return jsonError(`Failed to load contact: ${contactError.message}`, 500);
      if (!contactData) return jsonError("Contact not found in workspace", 422);
      const contact = contactData as Row;
      actionParams.prospect_name = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
      actionParams.profile_url = contact.linkedin_url ?? null;
      actionParams.company_id = contact.company_id ?? job.company_id ?? null;
    }

    if ((actionType === "connection_request" || actionType === "profile_visit") && !actionParams.profile_url) {
      return jsonError("Contact LinkedIn profile URL is required", 422);
    }
    if ((actionType === "send_message" || actionType === "follow_up_message") && !actionParams.prospect_name) {
      return jsonError("Contact name is required", 422);
    }

    if (job.status === "completed") return jsonError("Completed job has no matching browser queue item", 409);
    if (["failed", "cancelled", "paused"].includes(String(job.status))) {
      return jsonError(`Job is not runnable from status ${job.status}`, 409);
    }

    const { data: transitioned, error: transitionError } = await supabase
      .from("linkedin_execution_jobs")
      .update({
        status: "running",
        started_at: job.started_at ?? new Date().toISOString(),
        error_message: null,
      })
      .eq("id", job_id)
      .eq("workspace_id", workspace_id)
      .in("status", ["queued", "scheduled", "running"])
      .select("id")
      .maybeSingle();
    if (transitionError) return jsonError(`Failed to transition execution job: ${transitionError.message}`, 500);
    if (!transitioned) {
      const raced = await loadExistingQueueItem(supabase, workspace_id, idempotencyKey);
      if (raced.error) return jsonError(raced.error, 500);
      if (raced.item && equivalent(raced.item, job_id, actionType, job.linkedin_account_id)) {
        return jsonResponse(queueResponse(raced.item, job_id, true));
      }
      return jsonError("Execution job state changed before it could be queued", 409);
    }

    if (job.linkedin_account_id) {
      const today = new Date().toISOString().split("T")[0];
      const { data: usage, error: usageError } = await supabase.from("linkedin_daily_usage").select("*").eq("linkedin_account_id", job.linkedin_account_id).eq("usage_date", today).maybeSingle();
      if (usageError) return await failJob(supabase, workspace_id, job_id, `Failed to load daily usage: ${usageError.message}`, 500);
      const used = (usage as Record<string, number> | null) ?? {};
      const limitReached = (requestedActionType === "connection_request" && (used.connections_sent ?? 0) >= 25) || (requestedActionType === "first_message" && (used.messages_sent ?? 0) >= 50);
      if (limitReached) return await failJob(supabase, workspace_id, job_id, "Daily LinkedIn action limit reached", 429);
    }

    const { data: queueData, error: queueError } = await supabase
      .from("browser_execution_queue")
      .insert({
        workspace_id,
        account_id: job.linkedin_account_id ?? null,
        action_type: actionType,
        action_params: actionParams,
        priority: 2,
        priority_label: "high",
        status: "pending",
        idempotency_key: idempotencyKey,
        scheduled_at: job.scheduled_at ?? new Date().toISOString(),
      })
      .select("*")
      .single();

    if (queueError) {
      if (queueError.code === "23505") {
        const winner = await loadExistingQueueItem(supabase, workspace_id, idempotencyKey);
        if (winner.error) return jsonError(winner.error, 500);
        if (winner.item && equivalent(winner.item, job_id, actionType, job.linkedin_account_id)) {
          return jsonResponse(queueResponse(winner.item, job_id, true));
        }
        return jsonError("Idempotency key conflicts with a different browser action", 409);
      }
      return await failJob(supabase, workspace_id, job_id, `Failed to enqueue browser task: ${queueError.message}`, 500);
    }
    const queueItem = queueData as Row;

    const { error: historyError } = await supabase.from("linkedin_action_history").insert({
      workspace_id,
      linkedin_account_id: job.linkedin_account_id ?? null,
      execution_job_id: job_id,
      company_id: job.company_id ?? null,
      contact_id: job.contact_id ?? null,
      action_type: actionType,
      action_result: "pending",
      action_payload: job.action_payload ?? {},
      response_payload: {
        queue_item_id: queueItem.id,
        idempotency_key: idempotencyKey,
      },
    });
    if (historyError) {
      const { error: cancelError } = await supabase
        .from("browser_execution_queue")
        .update({
          status: "cancelled",
          error: `Action history persistence failed: ${historyError.message}`,
          completed_at: new Date().toISOString(),
        })
        .eq("id", queueItem.id)
        .eq("status", "pending");
      if (cancelError) return jsonError(`Action history failed and queue compensation failed: ${cancelError.message}`, 500);
      return await failJob(supabase, workspace_id, job_id, `Failed to persist action history: ${historyError.message}`, 500);
    }

    return jsonResponse(queueResponse(queueItem, job_id, false));
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Job runner failed", authorizationStatus(err));
  }
});

async function loadExistingQueueItem(supabase: any, workspaceId: string, key: string) {
  const { data, error } = await supabase.from("browser_execution_queue").select("*").eq("workspace_id", workspaceId).eq("idempotency_key", key).maybeSingle();
  return {
    item: data as Row | null,
    error: error ? `Failed to check browser queue idempotency: ${error.message}` : null,
  };
}

function equivalent(item: Row, jobId: string, actionType: string, accountId: unknown): boolean {
  const params = (item.action_params as Row | null) ?? {};
  return params.job_id === jobId && item.action_type === actionType && (item.account_id ?? null) === (accountId ?? null);
}

function queueResponse(item: Row, jobId: string, idempotent: boolean): Row {
  return {
    status: "queued",
    job_id: jobId,
    queue_item_id: item.id,
    queue_status: item.status,
    idempotent,
  };
}

async function failJob(supabase: any, workspaceId: string, jobId: string, message: string, status: number) {
  const { error } = await supabase
    .from("linkedin_execution_jobs")
    .update({
      status: "failed",
      error_message: message,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("workspace_id", workspaceId)
    .in("status", ["queued", "scheduled", "running"]);
  return error ? jsonError(`${message}; failed to persist terminal state: ${error.message}`, 500) : jsonError(message, status);
}

function jsonResponse(data: Row, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function jsonError(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}
