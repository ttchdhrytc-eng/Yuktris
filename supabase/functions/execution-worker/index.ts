import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("jsr:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "dequeue": {
        const { worker_type } = body;

        let query = supabase
          .from("execution_jobs")
          .select("*")
          .eq("status", "queued")
          .order("created_at", { ascending: true })
          .limit(20);

        if (worker_type) query = query.eq("worker_type", worker_type);

        const { data: jobs, error } = await query;
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const jobList = (jobs ?? []) as Array<Record<string, unknown>>;
        if (jobList.length === 0) {
          return new Response(JSON.stringify({ job: null }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Sort by priority
        const priorityOrder: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
        jobList.sort((a, b) => (priorityOrder[a.priority as string] ?? 2) - (priorityOrder[b.priority as string] ?? 2));

        const job = jobList[0];

        // Claim the job
        const { error: claimError } = await supabase
          .from("execution_jobs")
          .update({ status: "running", started_at: new Date().toISOString() })
          .eq("id", job.id as string)
          .eq("status", "queued");

        if (claimError) {
          return new Response(JSON.stringify({ job: null }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        await supabase.from("execution_events").insert({
          workflow_id: job.workflow_id as string,
          job_id: job.id as string,
          event_type: "job_started",
          event_data: { job_name: job.job_name },
        });

        return new Response(JSON.stringify({ job }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "complete": {
        const { job_id, result } = body;

        const { error } = await supabase
          .from("execution_jobs")
          .update({ status: "completed", result: result ?? null, completed_at: new Date().toISOString() })
          .eq("id", job_id);

        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        await supabase.from("execution_events").insert({
          job_id,
          event_type: "job_completed",
          event_data: result ?? null,
        });

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "fail": {
        const { job_id, error_message } = body;

        const { data: job } = await supabase.from("execution_jobs").select("attempts, max_attempts").eq("id", job_id).maybeSingle();
        const jobData = job as { attempts: number; max_attempts: number } | null;
        const attempts = (jobData?.attempts ?? 0) + 1;
        const maxAttempts = jobData?.max_attempts ?? 3;

        if (attempts < maxAttempts) {
          await supabase.from("execution_jobs").update({ status: "retrying", attempts, error: error_message }).eq("id", job_id);
        } else {
          await supabase.from("execution_jobs").update({ status: "dead_letter", attempts, error: error_message, completed_at: new Date().toISOString() }).eq("id", job_id);
        }

        await supabase.from("execution_events").insert({ job_id, event_type: "job_failed", event_data: { error: error_message, attempts } });

        return new Response(JSON.stringify({ success: true, status: attempts < maxAttempts ? "retrying" : "dead_letter" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Worker operation failed.";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
