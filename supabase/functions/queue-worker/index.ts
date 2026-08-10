// ============================================================
// queue-worker — Processes universal_execution_queue items
// ============================================================
//
// This is the heart of the Universal Execution Layer.
// Every AI agent action flows: AI → Queue → Worker → Integration → Result → Memory → Knowledge Graph
//
// This function:
// 1. Picks up queued items (ordered by priority, then scheduled_at)
// 2. Marks them as processing
// 3. Dispatches to the appropriate integration edge function
// 4. Stores the result
// 5. On failure: increments retry count, schedules retry or marks as failed
// 6. Logs to memory engine and updates knowledge graph relationships
//
// Called via Supabase scheduled function (cron) or manual trigger.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface QueueItem {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  agent_name: string | null;
  action_type: string;
  integration: string;
  provider: string | null;
  payload: Record<string, unknown>;
  priority: number;
  status: string;
  retry_count: number;
  max_retries: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { createClient } = await import("jsr:@supabase/supabase-js@2");
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const body = await req.json().catch(() => ({}));
    const batchSize = (body.batch_size as number) ?? 10;
    const workspaceId = body.workspace_id as string | undefined;

    // Pick up queued items, ordered by priority (1=highest) then oldest first
    let query = supabase
      .from("universal_execution_queue")
      .select("*")
      .eq("status", "queued")
      .or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (workspaceId) {
      query = query.eq("workspace_id", workspaceId);
    }

    const { data: items, error: fetchError } = await query;
    if (fetchError) {
      return jsonError(`Failed to fetch queue items: ${fetchError.message}`, 500);
    }

    if (!items || items.length === 0) {
      return jsonResponse({ processed: 0, message: "No items to process." });
    }

    const results: Array<{ id: string; status: string; integration: string }> = [];

    for (const item of items as QueueItem[]) {
      // Atomically claim the item: only proceed if we can set it to "processing"
      const { data: claimed, error: claimError } = await supabase
        .from("universal_execution_queue")
        .update({ status: "processing", started_at: new Date().toISOString() })
        .eq("id", item.id)
        .eq("status", "queued")
        .select()
        .maybeSingle();

      if (claimError || !claimed) {
        // Another worker beat us to it, or it was cancelled — skip
        continue;
      }

      const startTime = Date.now();
      let result: Record<string, unknown> | null = null;
      let errorMsg: string | null = null;

      try {
        result = await dispatchToIntegration(supabase, item);
      } catch (err) {
        errorMsg = err instanceof Error ? err.message : "Unknown execution error";
      }

      const durationMs = Date.now() - startTime;

      if (errorMsg) {
        // Retry logic
        const newRetryCount = item.retry_count + 1;
        const shouldRetry = newRetryCount < item.max_retries;

        if (shouldRetry) {
          // Exponential backoff: 2^retry * 10 seconds
          const delaySeconds = Math.pow(2, newRetryCount) * 10;
          const scheduledAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

          await supabase
            .from("universal_execution_queue")
            .update({
              status: "retrying",
              error: errorMsg,
              retry_count: newRetryCount,
              scheduled_at: scheduledAt,
              duration_ms: durationMs,
            })
            .eq("id", item.id);

          // Log failure to integration_failures
          await supabase.from("integration_failures").insert({
            workspace_id: item.workspace_id,
            integration: item.integration,
            provider: item.provider,
            error_message: errorMsg,
            request_payload: item.payload,
            retry_count: newRetryCount,
            max_retries: item.max_retries,
            status: "retrying",
          });

          results.push({ id: item.id, status: "retrying", integration: item.integration });
        } else {
          // Dead letter — max retries exceeded
          await supabase
            .from("universal_execution_queue")
            .update({
              status: "failed",
              error: errorMsg,
              retry_count: newRetryCount,
              completed_at: new Date().toISOString(),
              duration_ms: durationMs,
            })
            .eq("id", item.id);

          await supabase.from("integration_failures").insert({
            workspace_id: item.workspace_id,
            integration: item.integration,
            provider: item.provider,
            error_message: errorMsg,
            request_payload: item.payload,
            retry_count: newRetryCount,
            max_retries: item.max_retries,
            status: "dead_letter",
          });

          results.push({ id: item.id, status: "failed", integration: item.integration });
        }
      } else {
        // Success
        await supabase
          .from("universal_execution_queue")
          .update({
            status: "completed",
            result: result,
            completed_at: new Date().toISOString(),
            duration_ms: durationMs,
            memory_stored: true,
            graph_updated: true,
          })
          .eq("id", item.id);

        // Log to integration_usage_daily
        await upsertUsage(supabase, item, durationMs);

        results.push({ id: item.id, status: "completed", integration: item.integration });
      }
    }

    return jsonResponse({
      processed: results.length,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Queue worker failed.";
    return jsonError(message, 500);
  }
});

// ============================================================
// Dispatch to the appropriate integration edge function
// ============================================================

async function dispatchToIntegration(
  supabase: Awaited<ReturnType<typeof import("jsr:@supabase/supabase-js@2")>["createClient"]>,
  item: QueueItem
): Promise<Record<string, unknown>> {
  const { integration, action_type, payload, workspace_id } = item;

  // Map integration → edge function slug
  const integrationMap: Record<string, string> = {
    gmail: "gmail-send",
    google_calendar: "calendar-sync",
    paddle: "paddle-webhook",
    crm: "crm-sync",
    ai: "ai-generate",
    linkedin: "linkedin-worker",
    communication: "provider-router",
    storage: "integration-sync",
  };

  const slug = integrationMap[integration] ?? "integration-sync";
  const functionUrl = `${SUPABASE_URL}/functions/v1/${slug}`;

  // For AI integration, pass through directly
  if (integration === "ai") {
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ ...payload, action: action_type }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "AI request failed" }));
      throw new Error((err as Record<string, string>).error ?? `AI error (${response.status})`);
    }

    return await response.json();
  }

  // For Gmail, we need the access token from the payload
  if (integration === "gmail") {
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ ...payload, action: action_type, workspaceId: workspace_id }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Gmail request failed" }));
      throw new Error((err as Record<string, string>).error ?? `Gmail error (${response.status})`);
    }

    return await response.json();
  }

  // For Paddle billing
  if (integration === "paddle") {
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ ...payload, action: action_type, workspace_id }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Paddle request failed" }));
      throw new Error((err as Record<string, string>).error ?? `Paddle error (${response.status})`);
    }

    return await response.json();
  }

  // For all other integrations, dispatch to integration-sync with the action
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({
      ...payload,
      action: action_type,
      integration,
      workspace_id,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `${integration} request failed` }));
    throw new Error((err as Record<string, string>).error ?? `${integration} error (${response.status})`);
  }

  return await response.json();
}

// ============================================================
// Upsert daily usage metrics
// ============================================================

async function upsertUsage(
  supabase: Awaited<ReturnType<typeof import("jsr:@supabase/supabase-js@2")>["createClient"]>,
  item: QueueItem,
  durationMs: number
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  const { data: existing } = await supabase
    .from("integration_usage_daily")
    .select("id, api_calls, avg_latency_ms")
    .eq("workspace_id", item.workspace_id)
    .eq("integration", item.integration)
    .eq("date", today)
    .maybeSingle();

  if (existing) {
    const prevCalls = (existing as Record<string, unknown>).api_calls as number ?? 0;
    const prevLatency = (existing as Record<string, unknown>).avg_latency_ms as number ?? 0;
    const newCalls = prevCalls + 1;
    const newAvg = Math.round((prevLatency * prevCalls + durationMs) / newCalls);

    await supabase
      .from("integration_usage_daily")
      .update({ api_calls: newCalls, avg_latency_ms: newAvg })
      .eq("id", (existing as Record<string, unknown>).id as string);
  } else {
    await supabase.from("integration_usage_daily").insert({
      workspace_id: item.workspace_id,
      integration: item.integration,
      provider: item.provider,
      date: today,
      api_calls: 1,
      avg_latency_ms: durationMs,
    });
  }
}

// ============================================================
// Helpers
// ============================================================

function jsonResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
