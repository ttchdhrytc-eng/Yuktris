import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Phase 2A security gate: browser session cookies are authentication secrets.
// This endpoint intentionally performs no parsing, encryption, or database writes.
// Browserbase live-browser authentication is the only supported connection path.
Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  return new Response(JSON.stringify({
    error: "Manual cookie import is disabled. Connect through the secure LinkedIn browser.",
  }), {
    status: 410,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
