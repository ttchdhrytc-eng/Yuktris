import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeLinkedInWorkspace, authorizationStatus } from "../_shared/linkedinAuthorization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Json = Record<string, unknown>;
type ICP = {
  name?: string;
  description?: string;
  industry?: string;
  companySize?: string;
  jobTitles?: string[];
  painPoints?: string[];
};

type Prospect = {
  companyName: string;
  companyWebsite: string;
  companyDescription: string;
  contactFirstName: string;
  contactLastName: string;
  contactTitle: string;
  linkedinUrl: string;
  evidence: string;
  confidenceScore: number;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json() as Json;
    const workspaceId = requireString(body.workspace_id, "workspace_id");
    const action = typeof body.action === "string" ? body.action : "launch";
    const { admin } = await authorizeLinkedInWorkspace(req, workspaceId, { allowServiceRole: true });

    if (action === "preview_discovery") {
      const icp = (body.icp ?? {}) as ICP;
      const maxProspects = clampNumber(body.max_prospects, 1, 5, 3);
      const prospects = await discoverVerifiedProspects(icp, maxProspects);
      return json({
        status: "preview",
        persisted: false,
        execution_jobs_created: 0,
        prospects: prospects.map((prospect) => ({
          company_name: prospect.companyName,
          company_website: prospect.companyWebsite,
          contact_name: `${prospect.contactFirstName} ${prospect.contactLastName}`,
          contact_title: prospect.contactTitle,
          linkedin_url: prospect.linkedinUrl,
          evidence: prospect.evidence.slice(0, 600),
          confidence_score: prospect.confidenceScore,
        })),
      });
    }

    if (action === "launch") {
      const icp = (body.icp ?? {}) as ICP;
      const genericCampaignId = optionalString(body.campaign_id);
      const selectedAccountId = optionalString(body.linkedin_account_id);
      const maxProspects = clampNumber(body.max_prospects, 1, 10, 5);

      if (body.require_calendar !== false) {
        const { data: googleAccounts, error: calendarError } = await admin.from("google_accounts")
          .select("id,oauth_tokens!inner(scope,refresh_token)").eq("workspace_id", workspaceId)
          .eq("status", "connected").eq("is_primary", true).limit(1);
        if (calendarError) throw new Error(`Calendar connection validation failed: ${calendarError.message}`);
        const token = (googleAccounts?.[0] as Json | undefined)?.oauth_tokens as Array<Json> | Json | undefined;
        const tokenRow = Array.isArray(token) ? token[0] : token;
        const granted = String(tokenRow?.scope ?? "").split(" ");
        const hasCalendar = granted.includes("https://www.googleapis.com/auth/calendar") || granted.includes("https://www.googleapis.com/auth/calendar.events");
        if (!googleAccounts?.length || !tokenRow?.refresh_token || !hasCalendar) throw new Error("Google Calendar connection required");
      }

      let accountQuery = admin.from("linkedin_accounts")
        .select("id,workspace_id,connection_state,connection_status,status,session_status,health_status,profile_url,expected_profile_url")
        .eq("workspace_id", workspaceId)
        .eq("connection_state", "connected")
        .in("health_status", ["healthy", "degraded"])
        .not("profile_url", "is", null)
        .not("expected_profile_url", "is", null)
        .neq("status", "paused")
        .neq("status", "restricted")
        .order("created_at", { ascending: true });
      if (selectedAccountId) accountQuery = accountQuery.eq("id", selectedAccountId);
      const { data: account, error: accountError } = await accountQuery
        .limit(1)
        .maybeSingle();
      if (accountError) throw new Error(`LinkedIn account lookup failed: ${accountError.message}`);
      if (!account) throw new Error("No connected LinkedIn account is available for this workspace");

      let customerCampaignId: string | null = null;
      const campaignInput = (body.campaign ?? {}) as Json;
      if (typeof campaignInput.name === "string" && campaignInput.name.trim()) {
        const { data: customerCampaign, error: customerCampaignError } = await admin.from("customer_campaigns").insert({
          workspace_id: workspaceId, name: campaignInput.name.trim(), icp: icp,
          linkedin_account_id: account.id, strategy: campaignInput.strategy ?? null,
          daily_limit: clampNumber(campaignInput.daily_limit, 1, 20, 10), operating_days: campaignInput.operating_days ?? null,
          operating_hours: campaignInput.operating_hours ?? null, status: "ready", status_reason: "Validated and preparing verified prospects.",
        }).select("id").single();
        if (customerCampaignError) throw new Error(`Campaign creation failed: ${customerCampaignError.message}`);
        customerCampaignId = customerCampaign.id;
      }

      const prospects = await discoverVerifiedProspects(icp, maxProspects);
      if (prospects.length === 0) {
        throw new Error("No verifiable LinkedIn decision makers were discovered for the selected ICP");
      }

      const createdJobs: string[] = [];
      const createdContacts: string[] = [];
      const skippedExistingContacts: string[] = [];

      for (const prospect of prospects) {
        const company = await findOrCreateCompany(admin, workspaceId, prospect);
        const contact = await findOrCreateContact(admin, workspaceId, company.id, prospect);
        const { data: existingConnectionJob, error: existingJobError } = await admin.from("linkedin_execution_jobs")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("contact_id", contact.id)
          .eq("action_type", "connection_request")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (existingJobError) throw new Error(`Existing connection job lookup failed: ${existingJobError.message}`);
        if (existingConnectionJob) {
          skippedExistingContacts.push(String(contact.id));
          continue;
        }
        const copy = await generateLinkedInCopy(icp, prospect);

        const { data: decision, error: decisionError } = await admin.from("outreach_decisions").insert({
          workspace_id: workspaceId,
          company_id: company.id,
          contact_id: contact.id,
          decision: "linkedin_first",
          decision_reason: `Verified decision maker discovered for ${icp.name ?? "selected ICP"}. ${prospect.evidence.slice(0, 400)}`,
          confidence_score: prospect.confidenceScore,
          status: "active",
        }).select("id").single();
        if (decisionError) throw new Error(`Outreach decision persistence failed: ${decisionError.message}`);

        const { data: outreachCampaign, error: campaignError } = await admin.from("outreach_campaigns").insert({
          workspace_id: workspaceId,
          company_id: company.id,
          contact_id: contact.id,
          campaign_name: `${icp.name ?? "ICP"} - ${prospect.companyName} - LinkedIn`,
          campaign_type: "sequence",
          campaign_status: "processing",
          campaign_score: Math.round(prospect.confidenceScore * 100),
          success_probability: Math.round(prospect.confidenceScore * 25),
        }).select("id").single();
        if (campaignError) throw new Error(`Outreach campaign persistence failed: ${campaignError.message}`);

        const sequenceSteps = [
          { type: "first_message", delay_hours: 0, message: copy.firstMessage },
          { type: "follow_up", delay_hours: 72, message: copy.followUp1 },
          { type: "follow_up", delay_hours: 96, message: copy.followUp2 },
        ];
        const { data: sequence, error: sequenceError } = await admin.from("linkedin_sequences").insert({
          workspace_id: workspaceId,
          campaign_id: outreachCampaign.id,
          sequence_name: `${prospect.contactFirstName} ${prospect.contactLastName} LinkedIn sequence`,
          sequence_steps: sequenceSteps,
          total_steps: sequenceSteps.length,
          status: "active",
        }).select("id").single();
        if (sequenceError) throw new Error(`LinkedIn sequence persistence failed: ${sequenceError.message}`);

        const { data: state, error: stateError } = await admin.from("linkedin_sequence_state").insert({
          workspace_id: workspaceId,
          sequence_id: sequence.id,
          linkedin_account_id: account.id,
          contact_id: contact.id,
          company_id: company.id,
          current_step: 0,
          step_status: "pending",
          started_at: new Date().toISOString(),
          next_action_at: null,
        }).select("id").single();
        if (stateError) throw new Error(`LinkedIn sequence enrollment failed: ${stateError.message}`);

        const { data: job, error: jobError } = await admin.from("linkedin_execution_jobs").insert({
          workspace_id: workspaceId,
          linkedin_account_id: account.id,
          company_id: company.id,
          contact_id: contact.id,
          outreach_decision_id: decision.id,
          campaign_id: outreachCampaign.id,
          sequence_id: sequence.id,
          sequence_step: -1,
          action_type: "connection_request",
          status: "queued",
          priority: 2,
          action_payload: {
            note: copy.connectionNote,
            sequence_state_id: state.id,
            source_campaign_id: customerCampaignId ?? genericCampaignId ?? null,
            profile_url: prospect.linkedinUrl,
          },
        }).select("id").single();
        if (jobError) throw new Error(`LinkedIn connection job persistence failed: ${jobError.message}`);

        createdJobs.push(job.id);
        createdContacts.push(contact.id);
      }

      if (customerCampaignId) {
        await admin.from("customer_campaigns").update({
          status: bridgeFailures.length ? "action_required" : createdJobs.length ? "running" : "action_required",
          status_reason: bridgeFailures.length ? "Some outreach could not be queued. Review the campaign before resuming."
            : createdJobs.length ? "Outreach is running in the background." : "No new eligible prospects were available for outreach.",
          launched_at: new Date().toISOString(),
        }).eq("id", customerCampaignId);
      }

      // Bridge the initial jobs immediately. The Railway worker handles the resulting browser queue.
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const bridgeFailures: Array<{ job_id: string; status: number; error: string }> = [];
      for (const jobId of createdJobs) {
        const response = await fetch(`${supabaseUrl}/functions/v1/linkedin-job-runner`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
          body: JSON.stringify({ workspace_id: workspaceId, job_id: jobId }),
        });
        if (!response.ok) {
          const text = await response.text();
          let error = "Job runner rejected the execution job";
          try {
            const payload = JSON.parse(text) as Json;
            if (typeof payload.error === "string") error = payload.error.slice(0, 500);
          } catch {
            // Keep the bounded generic error; never reflect arbitrary upstream response bodies.
          }
          bridgeFailures.push({ job_id: jobId, status: response.status, error });
        }
      }

      return json({
        status: bridgeFailures.length ? "partially_launched" : "launched",
        prospects_discovered: prospects.length,
        contacts_created_or_updated: createdContacts.length,
        contacts_skipped_existing_connection: skippedExistingContacts.length,
        connection_jobs_created: createdJobs.length,
        connection_jobs_bridged: createdJobs.length - bridgeFailures.length,
        bridge_failures: bridgeFailures,
        job_ids: createdJobs,
      }, bridgeFailures.length ? 502 : 200);
    }

    if (action === "tick") {
      const { error: reconcileError } = await admin.rpc("reconcile_linkedin_v1_pipeline", { p_workspace_id: workspaceId });
      if (reconcileError) throw new Error(`Pipeline reconciliation failed: ${reconcileError.message}`);
      const { error: followupError } = await admin.rpc("schedule_due_linkedin_followups", { p_workspace_id: workspaceId, p_limit: 50 });
      if (followupError) throw new Error(`Follow-up scheduling failed: ${followupError.message}`);
      const { error: replyError } = await admin.rpc("schedule_linkedin_reply_checks", { p_workspace_id: workspaceId, p_limit: 50 });
      if (replyError) throw new Error(`Reply-check scheduling failed: ${replyError.message}`);
      return json({ status: "ticked" });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "LinkedIn V1 pipeline failed" }, authorizationStatus(error));
  }
});

async function discoverVerifiedProspects(icp: ICP, maxProspects: number): Promise<Prospect[]> {
  const tavilyKey = Deno.env.get("TAVILY_API_KEY");
  if (!tavilyKey) throw new Error("TAVILY_API_KEY is not configured in Supabase secrets");

  const roles = (icp.jobTitles?.length ? icp.jobTitles : ["CEO", "Founder", "VP Sales", "Head of Sales"]).slice(0, 4);
  const companyQuery = [
    icp.industry ? `${icp.industry} companies` : "B2B companies",
    icp.companySize ? `${icp.companySize} employees` : "",
    icp.description ?? "",
    "official company website -top -best -list -directory -database",
  ].filter(Boolean).join(" ");
  const companyResults = await tavilySearch(tavilyKey, companyQuery, Math.max(10, maxProspects * 3));
  const companyCandidates = companyResults
    .filter((r) => isUsableCompanyUrl(r.url))
    .slice(0, Math.max(8, maxProspects * 2));

  const prospects: Prospect[] = [];
  const seenLinkedIn = new Set<string>();
  for (const candidate of companyCandidates) {
    if (prospects.length >= maxProspects) break;
    const rootUrl = rootWebsite(candidate.url);
    const websiteText = await jinaRead(rootUrl).catch(() => candidate.content ?? "");
    const companyName = cleanCompanyName(candidate.title, new URL(rootUrl).hostname);
    if (!companyName) continue;

    for (const role of roles) {
      if (prospects.length >= maxProspects) break;
      const people = await tavilySearch(tavilyKey, `site:linkedin.com/in \"${companyName}\" \"${role}\"`, 8);
      const match = people.find((r) => {
        const normalized = normalizeLinkedInProfile(r.url);
        if (!normalized || seenLinkedIn.has(normalized)) return false;
        const evidence = `${r.title} ${r.content}`.toLowerCase();
        return evidence.includes(companyName.toLowerCase().split(" ")[0]) && evidence.includes(role.toLowerCase().split(" ")[0]);
      });
      if (!match) continue;
      const linkedinUrl = normalizeLinkedInProfile(match.url);
      if (!linkedinUrl) continue;
      const parsed = parseLinkedInTitle(match.title, role);
      if (!parsed.firstName || !parsed.lastName) continue;
      seenLinkedIn.add(linkedinUrl);
      prospects.push({
        companyName,
        companyWebsite: rootUrl,
        companyDescription: websiteText.slice(0, 3000),
        contactFirstName: parsed.firstName,
        contactLastName: parsed.lastName,
        contactTitle: parsed.title,
        linkedinUrl,
        evidence: `${match.title}. ${match.content ?? ""}`,
        confidenceScore: Math.max(0.5, Math.min(0.99,
          0.5 + (Number(candidate.score ?? 0) * 0.2) + (Number(match.score ?? 0) * 0.3))),
      });
      break;
    }
  }
  return prospects;
}

async function tavilySearch(apiKey: string, query: string, maxResults: number): Promise<Array<{ title: string; url: string; content: string; score?: number }>> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, query, max_results: maxResults, search_depth: "advanced", include_answer: false }),
  });
  if (!response.ok) throw new Error(`Tavily search failed (${response.status})`);
  const payload = await response.json();
  return Array.isArray(payload.results) ? payload.results : [];
}

async function jinaRead(url: string): Promise<string> {
  const response = await fetch(`https://r.jina.ai/${url}`, { headers: { Accept: "text/plain" } });
  if (!response.ok) throw new Error(`Jina reader failed (${response.status})`);
  return (await response.text()).slice(0, 12000);
}

async function generateLinkedInCopy(icp: ICP, prospect: Prospect): Promise<{ connectionNote: string; firstMessage: string; followUp1: string; followUp2: string }> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured in Supabase secrets");
  const prompt = `Write a concise LinkedIn outreach sequence for a real B2B prospect. Do not invent facts. Use only the supplied evidence.\n\nICP: ${JSON.stringify(icp)}\nCompany: ${prospect.companyName}\nDecision maker: ${prospect.contactFirstName} ${prospect.contactLastName}, ${prospect.contactTitle}\nWebsite evidence: ${prospect.companyDescription.slice(0, 3500)}\nSearch evidence: ${prospect.evidence}\n\nReturn strict JSON with connectionNote (max 190 chars, no greeting fluff), firstMessage (max 500 chars), followUp1 (max 400 chars), followUp2 (max 350 chars). Keep the CTA low-friction and never claim unverified results.`;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_OUTREACH_MODEL") ?? "gpt-4.1-mini",
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a careful B2B SDR copywriter. Use evidence only and output valid JSON." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI outreach generation failed (${response.status})`);
  const data = await response.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  return {
    connectionNote: String(parsed.connectionNote ?? `Hi ${prospect.contactFirstName}, I came across ${prospect.companyName} and thought it would be useful to connect.`).slice(0, 190),
    firstMessage: String(parsed.firstMessage ?? `Thanks for connecting, ${prospect.contactFirstName}. I had a relevant idea for ${prospect.companyName}. Open to a quick exchange?`).slice(0, 500),
    followUp1: String(parsed.followUp1 ?? `Just following up, ${prospect.contactFirstName}. Happy to share the idea here if useful.`).slice(0, 400),
    followUp2: String(parsed.followUp2 ?? `Last note from me — if this is not a priority, no problem. I can circle back later.`).slice(0, 350),
  };
}

async function findOrCreateCompany(admin: any, workspaceId: string, p: Prospect): Promise<Json> {
  const host = new URL(p.companyWebsite).hostname.replace(/^www\./, "");
  const { data: byWebsite } = await admin.from("companies").select("*").eq("workspace_id", workspaceId).ilike("website", `%${host}%`).limit(1).maybeSingle();
  if (byWebsite) return byWebsite as Json;
  const { data: byName } = await admin.from("companies").select("*").eq("workspace_id", workspaceId).ilike("name", p.companyName).limit(1).maybeSingle();
  if (byName) return byName as Json;
  const { data, error } = await admin.from("companies").insert({
    workspace_id: workspaceId,
    name: p.companyName,
    website: p.companyWebsite,
    description: p.companyDescription.slice(0, 5000),
    confidence_score: p.confidenceScore,
  }).select("*").single();
  if (error) throw new Error(`Company persistence failed: ${error.message}`);
  return data as Json;
}

async function findOrCreateContact(admin: any, workspaceId: string, companyId: unknown, p: Prospect): Promise<Json> {
  const { data: existing } = await admin.from("contacts").select("*")
    .eq("workspace_id", workspaceId).eq("linkedin_url", p.linkedinUrl).limit(1).maybeSingle();
  if (existing) return existing as Json;
  const { data, error } = await admin.from("contacts").insert({
    workspace_id: workspaceId,
    company_id: companyId,
    first_name: p.contactFirstName,
    last_name: p.contactLastName,
    full_name: `${p.contactFirstName} ${p.contactLastName}`,
    linkedin_url: p.linkedinUrl,
    job_title: p.contactTitle,
    status: "discovered",
    confidence_score: p.confidenceScore,
  }).select("*").single();
  if (error) throw new Error(`Contact persistence failed: ${error.message}`);
  return data as Json;
}

function parseLinkedInTitle(raw: string, fallbackTitle: string): { firstName: string; lastName: string; title: string } {
  const cleaned = raw.replace(/\|\s*LinkedIn.*$/i, "").replace(/\s+-\s+LinkedIn.*$/i, "").trim();
  const parts = cleaned.split(/\s+[–—-]\s+/).map((s) => s.trim()).filter(Boolean);
  const nameWords = (parts[0] ?? "").split(/\s+/).filter(Boolean);
  return {
    firstName: nameWords[0] ?? "",
    lastName: nameWords.length > 1 ? nameWords.slice(1).join(" ") : "",
    title: parts[1] ?? fallbackTitle,
  };
}
function normalizeLinkedInProfile(value: string): string | null {
  try {
    const u = new URL(value);
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname) || !u.pathname.startsWith("/in/")) return null;
    const slug = u.pathname.split("/").filter(Boolean)[1];
    if (!slug) return null;
    return `https://www.linkedin.com/in/${slug}`;
  } catch { return null; }
}
function isUsableCompanyUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return !["linkedin.com", "facebook.com", "x.com", "twitter.com", "youtube.com", "wikipedia.org", "crunchbase.com", "glassdoor.com"].some((d) => host === d || host.endsWith(`.${d}`));
  } catch { return false; }
}
function rootWebsite(value: string): string {
  const u = new URL(value);
  return `${u.protocol}//${u.hostname}`;
}
function cleanCompanyName(title: string, host: string): string | null {
  const hostLabel = host.replace(/^www\./, "").split(".")[0];
  const hostBrand = hostLabel.replace(/^(get|use|try|join|with)(?=[a-z0-9])/i, "");
  const normalizedHost = hostBrand.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalizedHost.length < 3) return null;

  const candidate = title.split(/[|–—]/)
    .map((part) => part.replace(/\s+-\s+.*$/, "").trim())
    .find((part) => {
      if (part.length < 2 || part.length > 100) return false;
      if (/\b(top|best|list of|companies to know|company directory|database|market map)\b/i.test(part) || /^\d+\s/.test(part)) return false;
      return part.toLowerCase().replace(/[^a-z0-9]/g, "").includes(normalizedHost);
    });
  if (!candidate) return null;
  return candidate;
}
function optionalString(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function requireString(value: unknown, name: string): string { const s = optionalString(value); if (!s) throw new Error(`${name} is required`); return s; }
function clampNumber(value: unknown, min: number, max: number, fallback: number): number { const n = typeof value === "number" ? value : Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback; }
function json(data: Json, status = 200): Response { return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
