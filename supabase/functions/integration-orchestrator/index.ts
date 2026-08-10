import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
const PROVIDERS = [
  { key: "salesforce", name: "Salesforce", category: "crm", auth: "oauth2", baseUrl: "https://api.salesforce.com", scopes: ["api","refresh_token","offline_access"], popular: true, enterprise: true },
  { key: "hubspot", name: "HubSpot", category: "crm", auth: "oauth2", baseUrl: "https://api.hubapi.com", scopes: ["crm.objects","crm.schemas"], popular: true },
  { key: "pipedrive", name: "Pipedrive", category: "crm", auth: "oauth2", baseUrl: "https://api.pipedrive.com", scopes: ["deals:read","deals:write"] },
  { key: "zoho_crm", name: "Zoho CRM", category: "crm", auth: "oauth2", baseUrl: "https://www.zohoapis.com", scopes: ["ZohoCRM.modules.ALL"] },
  { key: "ms_dynamics", name: "Microsoft Dynamics 365", category: "crm", auth: "oauth2", baseUrl: "https://graph.microsoft.com", scopes: ["https://dynamics.microsoft.com/.default"], enterprise: true },
  { key: "freshsales", name: "Freshsales", category: "crm", auth: "api_key", baseUrl: "https://api.freshsales.io" },
  { key: "mailchimp", name: "Mailchimp", category: "marketing", auth: "oauth2", baseUrl: "https://api.mailchimp.com", scopes: ["campaigns","lists"], popular: true },
  { key: "activecampaign", name: "ActiveCampaign", category: "marketing", auth: "api_key", baseUrl: "https://api.activecampaign.com" },
  { key: "klaviyo", name: "Klaviyo", category: "marketing", auth: "api_key", baseUrl: "https://a.klaviyo.com" },
  { key: "brevo", name: "Brevo", category: "marketing", auth: "api_key", baseUrl: "https://api.brevo.com" },
  { key: "customer_io", name: "Customer.io", category: "marketing", auth: "api_key", baseUrl: "https://api.customer.io" },
  { key: "marketo", name: "Marketo", category: "marketing", auth: "oauth2", baseUrl: "https://api.marketo.com", enterprise: true },
  { key: "slack", name: "Slack", category: "communication", auth: "oauth2", baseUrl: "https://slack.com/api", scopes: ["chat:write","channels:read"], popular: true },
  { key: "ms_teams", name: "Microsoft Teams", category: "communication", auth: "oauth2", baseUrl: "https://graph.microsoft.com", scopes: ["Team.ReadBasic.All"] },
  { key: "discord", name: "Discord", category: "communication", auth: "bearer", baseUrl: "https://discord.com/api" },
  { key: "whatsapp_business", name: "WhatsApp Business", category: "communication", auth: "bearer", baseUrl: "https://graph.facebook.com" },
  { key: "twilio", name: "Twilio", category: "communication", auth: "basic", baseUrl: "https://api.twilio.com" },
  { key: "zoom", name: "Zoom", category: "communication", auth: "oauth2", baseUrl: "https://api.zoom.us", scopes: ["meeting:write"], popular: true },
  { key: "ms_outlook_calendar", name: "Microsoft Outlook Calendar", category: "calendar", auth: "oauth2", baseUrl: "https://graph.microsoft.com", scopes: ["Calendars.ReadWrite"] },
  { key: "apple_calendar", name: "Apple Calendar", category: "calendar", auth: "custom", baseUrl: "https://caldav.apple.com" },
  { key: "paddle", name: "Paddle", category: "finance", auth: "bearer", baseUrl: "https://api.paddle.com", popular: true },
  { key: "razorpay", name: "Razorpay", category: "finance", auth: "api_key", baseUrl: "https://api.razorpay.com" },
  { key: "quickbooks", name: "QuickBooks", category: "finance", auth: "oauth2", baseUrl: "https://quickbooks.api.intuit.com", scopes: ["com.intuit.quickbooks.accounting"], enterprise: true },
  { key: "xero", name: "Xero", category: "finance", auth: "oauth2", baseUrl: "https://api.xero.com", scopes: ["accounting.transactions"] },
  { key: "freshbooks", name: "FreshBooks", category: "finance", auth: "oauth2", baseUrl: "https://api.freshbooks.com", scopes: ["invoices:read"] },
  { key: "google_drive", name: "Google Drive", category: "storage", auth: "oauth2", baseUrl: "https://www.googleapis.com", scopes: ["drive.file"], popular: true },
  { key: "onedrive", name: "OneDrive", category: "storage", auth: "oauth2", baseUrl: "https://graph.microsoft.com", scopes: ["Files.ReadWrite.All"] },
  { key: "dropbox", name: "Dropbox", category: "storage", auth: "oauth2", baseUrl: "https://api.dropboxapi.com", scopes: ["files.content.write"] },
  { key: "box", name: "Box", category: "storage", auth: "oauth2", baseUrl: "https://api.box.com", scopes: ["box.readwrite"] },
  { key: "postgresql", name: "PostgreSQL", category: "database", auth: "custom", baseUrl: "custom" },
  { key: "mysql", name: "MySQL", category: "database", auth: "custom", baseUrl: "custom" },
  { key: "mongodb", name: "MongoDB", category: "database", auth: "custom", baseUrl: "custom" },
  { key: "snowflake", name: "Snowflake", category: "database", auth: "custom", baseUrl: "https://api.snowflake.com", enterprise: true },
  { key: "bigquery", name: "BigQuery", category: "database", auth: "oauth2", baseUrl: "https://bigquery.googleapis.com", scopes: ["bigquery"], enterprise: true },
  { key: "zapier", name: "Zapier", category: "automation", auth: "api_key", baseUrl: "https://api.zapier.com", popular: true },
  { key: "make", name: "Make", category: "automation", auth: "api_key", baseUrl: "https://api.make.com" },
  { key: "n8n", name: "n8n", category: "automation", auth: "api_key", baseUrl: "https://api.n8n.io" },
  { key: "webhooks", name: "Custom Webhooks", category: "automation", auth: "none", baseUrl: "custom" },
  { key: "openai", name: "OpenAI", category: "ai_provider", auth: "bearer", baseUrl: "https://api.openai.com", popular: true },
  { key: "anthropic", name: "Anthropic", category: "ai_provider", auth: "bearer", baseUrl: "https://api.anthropic.com" },
  { key: "gemini", name: "Google Gemini", category: "ai_provider", auth: "oauth2", baseUrl: "https://generativelanguage.googleapis.com" },
  { key: "azure_openai", name: "Azure OpenAI", category: "ai_provider", auth: "api_key", baseUrl: "https://api.openai.azure.com", enterprise: true },
  { key: "grok", name: "Grok", category: "ai_provider", auth: "bearer", baseUrl: "https://api.x.ai" },
  { key: "mistral", name: "Mistral", category: "ai_provider", auth: "bearer", baseUrl: "https://api.mistral.ai" },
  { key: "deepseek", name: "DeepSeek", category: "ai_provider", auth: "bearer", baseUrl: "https://api.deepseek.com" },
];
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    let created = 0;
    for (const def of PROVIDERS) {
      const existingRes = await fetch(`${supabaseUrl}/rest/v1/integration_providers?provider_key=eq.${def.key}&select=id`, { headers });
      const existing = (await existingRes.json())[0];
      if (existing) continue;
      const providerRes = await fetch(`${supabaseUrl}/rest/v1/integration_providers`, { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify({ provider_key: def.key, provider_name: def.name, provider_category: def.category, auth_type: def.auth, api_base_url: def.baseUrl, default_scopes: def.scopes ?? [], oauth_scopes: def.scopes ?? [], is_popular: def.popular ?? false, is_enterprise: def.enterprise ?? false, is_active: true, sdk_available: def.category === "ai_provider" || def.category === "crm" }) });
      const provider = (await providerRes.json())[0];
      if (!provider) continue;
      await fetch(`${supabaseUrl}/rest/v1/integration_marketplace`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ provider_id: provider.id, app_name: def.name, app_description: `${def.name} integration for ${def.category}`, app_category: def.category, app_features: ["Sync data","Real-time updates","Bi-directional"], app_benefits: ["Automated workflows","No data silos","Unified dashboard"], is_featured: def.popular ?? false, is_verified: true, pricing_type: def.enterprise ? "enterprise" : "freemium", setup_difficulty: def.enterprise ? "medium" : "easy", estimated_setup_minutes: def.enterprise ? 10 : 5, tags: [def.category, def.name.toLowerCase()], is_active: true }) });
      created++;
    }
    return new Response(JSON.stringify({ discovered: true, providers: PROVIDERS.length, created }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
