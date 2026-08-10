import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
const SDK_TEMPLATES: Record<string, { package: string; registry: string; code: string }> = {
  javascript: { package: "@revenueai/sdk", registry: "npm", code: "const RevenueAI = require('@revenueai/sdk');\nconst client = new RevenueAI('YOUR_API_KEY');" },
  typescript: { package: "@revenueai/sdk-ts", registry: "npm", code: "import { RevenueAI } from '@revenueai/sdk-ts';\nconst client = new RevenueAI('YOUR_API_KEY');" },
  python: { package: "revenueai", registry: "pypi", code: "from revenueai import RevenueAI\nclient = RevenueAI('YOUR_API_KEY')" },
  node: { package: "@revenueai/sdk-node", registry: "npm", code: "const { RevenueAI } = require('@revenueai/sdk-node');\nconst client = new RevenueAI('YOUR_API_KEY');" },
  php: { package: "revenueai/sdk", registry: "packagist", code: "$client = new RevenueAI\\Client('YOUR_API_KEY');" },
  java: { package: "com.revenueai:sdk", registry: "maven", code: "RevenueAIClient client = new RevenueAIClient(\"YOUR_API_KEY\");" },
  go: { package: "github.com/revenueai/sdk-go", registry: "go", code: "client := revenueai.NewClient(\"YOUR_API_KEY\")" },
  csharp: { package: "RevenueAI.SDK", registry: "nuget", code: "var client = new RevenueAIClient(\"YOUR_API_KEY\");" },
};
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, language } = await req.json();
    const template = SDK_TEMPLATES[language];
    if (!template) return new Response(JSON.stringify({ error: `Unsupported language: ${language}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const version = "1.0.0";
    const downloadUrl = `https://api.revenueai.com/sdk/${language}/${version}`;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    await fetch(`${supabaseUrl}/rest/v1/sdk_versions`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, language, version, download_url: downloadUrl, package_name: template.package, package_registry: template.registry, is_stable: true, release_notes: `Initial ${language} SDK release` }) });
    return new Response(JSON.stringify({ generated: true, language, version, package: template.package, registry: template.registry, downloadUrl, codeSample: template.code }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
