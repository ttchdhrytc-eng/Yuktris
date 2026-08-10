import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
const ENDPOINTS = [
  { method: "GET", path: "/api/v1/companies", summary: "List all companies" },
  { method: "GET", path: "/api/v1/companies/{id}", summary: "Get company by ID" },
  { method: "POST", path: "/api/v1/companies", summary: "Create a company" },
  { method: "PUT", path: "/api/v1/companies/{id}", summary: "Update a company" },
  { method: "DELETE", path: "/api/v1/companies/{id}", summary: "Delete a company" },
  { method: "GET", path: "/api/v1/contacts", summary: "List all contacts" },
  { method: "GET", path: "/api/v1/prospects", summary: "List all prospects" },
  { method: "POST", path: "/api/v1/prospects", summary: "Create a prospect" },
  { method: "GET", path: "/api/v1/campaigns", summary: "List all campaigns" },
  { method: "POST", path: "/api/v1/campaigns", summary: "Create a campaign" },
  { method: "GET", path: "/api/v1/outreach", summary: "List outreach sequences" },
  { method: "GET", path: "/api/v1/messages", summary: "List all messages" },
  { method: "GET", path: "/api/v1/meetings", summary: "List all meetings" },
  { method: "POST", path: "/api/v1/meetings", summary: "Book a meeting" },
  { method: "GET", path: "/api/v1/proposals", summary: "List all proposals" },
  { method: "POST", path: "/api/v1/proposals", summary: "Create a proposal" },
  { method: "GET", path: "/api/v1/customers", summary: "List all customers" },
  { method: "GET", path: "/api/v1/invoices", summary: "List all invoices" },
  { method: "GET", path: "/api/v1/revenue", summary: "Get revenue summary" },
  { method: "GET", path: "/api/v1/forecasts", summary: "Get revenue forecasts" },
  { method: "GET", path: "/api/v1/ai-ceo", summary: "Get AI CEO dashboard" },
  { method: "POST", path: "/api/v1/ai-ceo/analyze", summary: "Run company analysis" },
  { method: "GET", path: "/api/v1/agents", summary: "List all AI agents" },
  { method: "POST", path: "/api/v1/agents/tasks", summary: "Assign task to agent" },
  { method: "GET", path: "/api/v1/memory", summary: "Query agent memory" },
  { method: "GET", path: "/api/v1/knowledge-graph", summary: "Query knowledge graph" },
  { method: "GET", path: "/api/v1/reports", summary: "List all reports" },
  { method: "GET", path: "/api/v1/notifications", summary: "List notifications" },
];
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const paths: Record<string, unknown> = {};
    for (const ep of ENDPOINTS) {
      const pathKey = ep.path.replace(/\{[^}]+\}/g, "{id}");
      if (!paths[pathKey]) paths[pathKey] = {};
      paths[pathKey][ep.method.toLowerCase()] = { summary: ep.summary, operationId: ep.path.replace(/[^a-zA-Z0-9]/g, "_"), responses: { "200": { description: "OK" }, "400": { description: "Bad Request" }, "401": { description: "Unauthorized" }, "404": { description: "Not Found" }, "429": { description: "Rate Limited" }, "500": { description: "Internal Server Error" } } };
    }
    const openapi = { openapi: "3.0.3", info: { title: "AI Revenue OS API", version: "1.0.0", description: "Enterprise Revenue Operating System REST API" }, servers: [{ url: "https://api.revenueai.com", description: "Production" }], paths, components: { securitySchemes: { ApiKeyAuth: { type: "apiKey", in: "header", name: "Authorization" } } } };
    await fetch(`${supabaseUrl}/rest/v1/api_documentation`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, doc_version: "1.0.0", openapi_spec: openapi, generated_at: new Date().toISOString(), is_published: true }) });
    return new Response(JSON.stringify({ generated: true, endpoints: ENDPOINTS.length, version: "1.0.0" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
