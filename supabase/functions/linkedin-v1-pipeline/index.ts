import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeLinkedInWorkspace, authorizationStatus } from "../_shared/linkedinAuthorization.ts";
import { nextAcquisitionCadence } from "../_shared/prospectAcquisition.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

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
  subIndustry?: string;
  geography?: string[];
  keywords?: string[];
};

type DiscoveryDiagnostics = {
  searchQueries: number;
  providerResults: number;
  companyCandidates: number;
  companyResearchSucceeded: number;
  companyResearchFailed: number;
  personResults: number;
  canonicalProfileUrls: number;
  rejectedByEvidence: number;
  rejectedByIdentityParsing: number;
  rejectedByDedupe: number;
  finalCandidates: number;
  historicalExcluded: number;
  qualificationStages: Record<string, number>;
  rejectionFunnel: Record<string, number>;
  timingsMs: Record<string, number>;
  providerRequests: Record<string, number>;
  providerStats: Record<string, { started: number; completed: number; aborted: number; failed: number }>;
  slowestCalls: Array<{ provider: string; duration_ms: number }>;
  cheapFiltered: number;
  deeplyResearched: number;
  companyCacheHits: number;
  companyCacheMisses: number;
  uniqueCompaniesResearched: number;
  internalDeadlineMs: number;
  terminatedBy: string;
  wavesStarted: number;
  wavesCompleted: number;
  waves: Array<{ wave: number; queries: string[]; providerResults: number; newCanonicalUrls: number; historicalExcluded: number; cheapRanked: number; deepResearchAttempted: number; newEligibleCandidates: number; duplicateCandidates: number; unusedDeepResearchBudgetAfter: number; deadlineRemainingMs: number }>;
  budgets: { maxWaves: number; searchQueries: number; tavily: number; jina: number; openai: number; canonicalCandidates: number; deepResearchCandidates: number };
};

const newDiscoveryDiagnostics = (): DiscoveryDiagnostics => ({ searchQueries: 0, providerResults: 0, companyCandidates: 0, companyResearchSucceeded: 0, companyResearchFailed: 0, personResults: 0, canonicalProfileUrls: 0, rejectedByEvidence: 0, rejectedByIdentityParsing: 0, rejectedByDedupe: 0, finalCandidates: 0, historicalExcluded: 0, qualificationStages: {}, rejectionFunnel: {}, timingsMs: {}, providerRequests: { tavily: 0, jina: 0, openai: 0 }, providerStats: { tavily: { started: 0, completed: 0, aborted: 0, failed: 0 }, jina: { started: 0, completed: 0, aborted: 0, failed: 0 }, openai: { started: 0, completed: 0, aborted: 0, failed: 0 } }, slowestCalls: [], cheapFiltered: 0, deeplyResearched: 0, companyCacheHits: 0, companyCacheMisses: 0, uniqueCompaniesResearched: 0, internalDeadlineMs: 38000, terminatedBy: "completed", wavesStarted: 0, wavesCompleted: 0, waves: [], budgets: { maxWaves: 3, searchQueries: 6, tavily: 13, jina: 7, openai: 2, canonicalCandidates: 18, deepResearchCandidates: 7 } });

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
  companyFit: string;
  personFit: string;
  location: string | null;
  sourceConfidence: number;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let lifecycleCampaignId: string | null = null;
  let lifecycleAdmin: any = null;
  try {
    const body = (await req.json()) as Json;
    const workspaceId = requireString(body.workspace_id, "workspace_id");
    const action = typeof body.action === "string" ? body.action : "launch";
    const { admin, userId, internalService } = await authorizeLinkedInWorkspace(req, workspaceId, {
      allowServiceRole: true,
    });
    lifecycleAdmin = admin;
    if (["initialize", "launch"].includes(action)) {
      const { error: staleError } = await admin.rpc("reconcile_stale_customer_campaigns", { p_workspace_id: workspaceId });
      if (staleError) throw new Error(`Campaign reconciliation failed: ${staleError.message}`);
    }

    if (action === "preflight") {
      const selectedAccountId = optionalString(body.linkedin_account_id);
      const campaignId = optionalString(body.campaign_id);
      let linkedinQuery = admin.from("linkedin_accounts").select("id,workspace_id,connection_state,health_status,profile_url,expected_profile_url").eq("workspace_id", workspaceId);
      if (selectedAccountId) linkedinQuery = linkedinQuery.eq("id", selectedAccountId);
      const { data: linkedin, error: linkedinError } = await linkedinQuery.limit(1).maybeSingle();
      if (linkedinError) throw pipelineError("linkedin_lookup_failed", `LinkedIn validation failed: ${linkedinError.message}`, 500);
      const { data: campaign, error: campaignError } = campaignId ? await admin.from("customer_campaigns").select("id,workspace_id,status,icp,linkedin_account_id").eq("workspace_id", workspaceId).eq("id", campaignId).maybeSingle() : { data: null, error: null };
      if (campaignError) throw pipelineError("campaign_lookup_failed", `Campaign validation failed: ${campaignError.message}`, 500);
      const google = await googleAuthorization(admin, workspaceId);
      const identityMatches = Boolean(linkedin?.profile_url && linkedin?.expected_profile_url && normalizeLinkedInProfile(linkedin.profile_url) === normalizeLinkedInProfile(linkedin.expected_profile_url));
      const linkedInReady = Boolean(linkedin?.connection_state === "connected" && ["healthy", "degraded"].includes(linkedin?.health_status) && identityMatches);
      const icpReady = !campaignId || Boolean(campaign?.icp && Object.keys(campaign.icp as Json).length);
      return json({
        ok: linkedInReady && icpReady,
        status: linkedInReady && icpReady ? "ready" : "blocked_prerequisite",
        workspace_id: workspaceId,
        campaign_id: campaign?.id ?? null,
        linkedin_account_id: linkedin?.id ?? null,
        checks: {
          linkedin_connected: linkedin?.connection_state === "connected",
          linkedin_health: linkedin?.health_status ?? "missing",
          linkedin_identity: identityMatches,
          persistent_context: Boolean(linkedin?.id),
          campaign_icp: icpReady,
          gmail_authorized: google.gmail,
          calendar_authorized: google.calendar,
          worker_available: Boolean(Deno.env.get("LINKEDIN_JOB_RUNNER_URL")),
        },
        write_performed: false,
      });
    }

    if (action === "reconcile_prerequisites") {
      const { data: campaigns, error: campaignsError } = await admin.from("customer_campaigns").select("id,icp,linkedin_account_id,blocker,status_reason").eq("workspace_id", workspaceId).eq("status", "blocked_prerequisite");
      if (campaignsError) throw pipelineError("campaign_lookup_failed", `Campaign validation failed: ${campaignsError.message}`, 500);
      let reconciled = 0;
      for (const campaign of campaigns ?? []) {
        const googleOnlyBlocker = /google|gmail|calendar/i.test(`${campaign.blocker ?? ""} ${campaign.status_reason ?? ""}`);
        if (!googleOnlyBlocker || !campaign.linkedin_account_id || !campaign.icp || !Object.keys(campaign.icp as Json).length) continue;
        const { data: account } = await admin.from("linkedin_accounts").select("connection_state,health_status,profile_url,expected_profile_url").eq("workspace_id", workspaceId).eq("id", campaign.linkedin_account_id).maybeSingle();
        const identityMatches = Boolean(account?.profile_url && account?.expected_profile_url && normalizeLinkedInProfile(account.profile_url) === normalizeLinkedInProfile(account.expected_profile_url));
        if (account?.connection_state !== "connected" || !["healthy", "degraded"].includes(account?.health_status) || !identityMatches) continue;
        const { error: updateError } = await admin
          .from("customer_campaigns")
          .update({
            status: "ready",
            status_reason: "Prerequisites validated. Launch explicitly when ready.",
            failure_code: null,
            blocker: null,
            updated_at: new Date().toISOString(),
          })
          .eq("workspace_id", workspaceId)
          .eq("id", campaign.id);
        if (updateError) throw pipelineError("campaign_reconciliation_failed", `Campaign reconciliation failed: ${updateError.message}`, 500);
        reconciled += 1;
      }
      return json({
        ok: true,
        status: "reconciled",
        campaigns_reconciled: reconciled,
      });
    }

    if (action === "reconcile_campaign_state") {
      const { data: reconciled, error: reconcileError } = await admin.rpc("reconcile_customer_campaign_execution_state", { p_workspace_id: workspaceId, p_campaign_id: null });
      if (reconcileError) throw pipelineError("campaign_reconciliation_failed", `Campaign reconciliation failed: ${reconcileError.message}`, 500);
      return json({
        ok: true,
        status: "reconciled",
        campaigns_reconciled: reconciled ?? 0,
      });
    }

    if (action === "preview_discovery") {
      const icp = (body.icp ?? {}) as ICP;
      const accountId = requireString(body.linkedin_account_id, "linkedin_account_id");
      const maxProspects = clampNumber(body.max_prospects, 1, 5, 3);
      const diagnostics = newDiscoveryDiagnostics();
      const requestStarted = Date.now();
      const controller = new AbortController();
      const deadline = setTimeout(() => controller.abort("internal_deadline_reached"), diagnostics.internalDeadlineMs);
      let discovered: Prospect[] = [];
      try {
        discovered = await discoverVerifiedProspects(icp, maxProspects, diagnostics, controller.signal, admin, workspaceId, accountId);
      } catch (error) {
        if (!controller.signal.aborted) throw error;
        reject(diagnostics, "internal_deadline_reached");
        diagnostics.terminatedBy = "internal_deadline_reached";
      } finally {
        clearTimeout(deadline);
      }
      const historyStarted = Date.now();
      const prospects = await excludeHistoricallyUnsafeProspects(admin, workspaceId, accountId, discovered, diagnostics);
      diagnostics.timingsMs.historical_exclusion = Date.now() - historyStarted;
      diagnostics.timingsMs.total = Date.now() - requestStarted;
      return json({
        status: "preview",
        source_provider: "Tavily search + Jina Reader",
        persisted: false,
        execution_jobs_created: 0,
        diagnostics,
        reason: prospects.length ? null : discoveryEmptyReason(diagnostics),
        prospects: prospects.map((prospect) => ({
          company_name: prospect.companyName,
          company_website: prospect.companyWebsite,
          contact_name: `${prospect.contactFirstName} ${prospect.contactLastName}`,
          contact_title: prospect.contactTitle,
          linkedin_url: prospect.linkedinUrl,
          evidence: prospect.evidence.slice(0, 600),
          company_fit: prospect.companyFit,
          person_fit: prospect.personFit,
          location: prospect.location,
          source_confidence: prospect.sourceConfidence,
          confidence_score: prospect.confidenceScore,
        })),
      });
    }

    if (action === "inventory_status") {
      const icpId = optionalString(body.icp_id);
      let query = admin.from("icps").select("id,name,offer_context,prospecting_status,minimum_ready_inventory,target_ready_inventory,replenishment_batch_size,next_refresh_at,last_discovery_started_at,last_discovery_completed_at,discovery_consecutive_failures,discovery_error").eq("workspace_id", workspaceId);
      if (icpId) query = query.eq("id", icpId);
      const { data: icps, error } = await query.order("created_at", { ascending: true });
      if (error) throw pipelineError("inventory_status_failed", error.message, 500);
      const states = [];
      for (const icp of icps ?? []) {
        const { data: links, error: linksError } = await admin.from("icp_prospects").select("fit_score,intent_status,readiness,verification_status").eq("workspace_id", workspaceId).eq("icp_id", icp.id);
        if (linksError) throw pipelineError("inventory_status_failed", linksError.message, 500);
        states.push({ ...icp, counts: inventoryCounts(links ?? []) });
      }
      return json({ status: "ok", inventory: states, write_performed: false });
    }

    if (action === "generate_preview_messages") {
      const icp = (body.icp ?? {}) as ICP;
      const prospectData = body.prospect;
      const strategy = optionalString(body.strategy);
      if (!prospectData) throw pipelineError("prospect_required", "Prospect data is required for preview generation", 409);
      const prospect: Prospect = {
        companyName: prospectData.company_name,
        companyWebsite: prospectData.company_website,
        companyDescription: prospectData.evidence ?? "",
        contactFirstName: prospectData.contact_name?.split(" ")[0] ?? "there",
        contactLastName: prospectData.contact_name?.split(" ").slice(1).join(" ") ?? "",
        contactTitle: prospectData.contact_title ?? "",
        linkedinUrl: prospectData.linkedin_url,
        evidence: prospectData.evidence ?? "",
        confidenceScore: prospectData.confidence_score ?? 0.5,
        companyFit: prospectData.company_fit ?? "Verified ICP fit",
        personFit: prospectData.person_fit ?? "Verified role fit",
        location: prospectData.location ?? null,
        sourceConfidence: prospectData.source_confidence ?? 0,
      };
      const copy = await generateLinkedInCopy(icp, prospect, strategy);
      return json({ status: "ok", copy, write_performed: false });
    }

    if (action === "tick_replenishment") {
      const now = new Date().toISOString();
      const { data: activeJob, error: activeError } = await admin
        .from("prospect_replenishment_jobs")
        .select("id")
        .eq("workspace_id", workspaceId)
        .in("status", ["queued", "cooldown"])
        .lte("next_attempt_at", now)
        .order("next_attempt_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (activeError) throw pipelineError("replenishment_scheduler_failed", activeError.message, 500);

      let jobId = activeJob?.id as string | undefined;
      let scheduled = false;
      if (!jobId) {
        const { data: dueRows, error: dueError } = await admin.rpc("due_prospect_replenishment_icp", { p_workspace_id: workspaceId });
        const dueIcp = dueRows?.[0];
        if (dueError) throw pipelineError("replenishment_scheduler_failed", dueError.message, 500);
        if (dueIcp?.id) {
          const { data: handoff, error: enqueueError } = await admin.rpc("enqueue_prospect_replenishment", {
            p_workspace_id: workspaceId, p_icp_id: dueIcp.id, p_reason: "scheduled_refresh",
          });
          if (enqueueError) throw pipelineError("replenishment_enqueue_failed", enqueueError.message, 500);
          jobId = handoff?.job_id ?? undefined;
          scheduled = Boolean(jobId && !handoff?.duplicate_trigger_coalesced);
        }
      }

      if (jobId) {
        const task = processReplenishment(admin, workspaceId, jobId).catch((error) => console.error("[scheduled-replenishment-failed]", { job_id: jobId, message: error instanceof Error ? error.message : "unknown" }));
        if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(task); else await task;
      }
      return json({ status: jobId ? "processing" : "idle", scheduled, job_id: jobId ?? null, executable_jobs_created: 0, write_performed: false });
    }

    if (action === "request_replenishment") {
      const icpId = requireString(body.icp_id, "icp_id");
      const reason = optionalString(body.reason) ?? "explicit_activation";
      const { data: handoff, error: enqueueError } = await admin.rpc("enqueue_prospect_replenishment", {
        p_workspace_id: workspaceId, p_icp_id: icpId, p_reason: materialDiscoveryReason(reason),
      });
      if (enqueueError || !handoff?.job_id) throw pipelineError("replenishment_enqueue_failed", enqueueError?.message ?? "No durable job was returned", 409);
      const job = { id: handoff.job_id };
      const active = handoff.duplicate_trigger_coalesced;
      const task = processReplenishment(admin, workspaceId, job.id).catch((error) => console.error("[replenishment-failed]", { job_id: job.id, message: error instanceof Error ? error.message : "unknown" }));
      if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(task); else await task;
      return json({ status: "queued", job_id: job.id, duplicate_trigger_coalesced: Boolean(active), executable_jobs_created: 0, write_performed: false }, 202);
    }

    if (action === "initialize") {
      const icp = (body.icp ?? {}) as ICP;
      const selectedAccountId = optionalString(body.linkedin_account_id);
      const campaignInput = (body.campaign ?? {}) as Json;
      const sourceCampaignId = optionalString(campaignInput.source_campaign_id);
      const initializationKey = optionalString(campaignInput.initialization_key);
      const savedIcpId = optionalString(campaignInput.icp_id);
      const missing: string[] = [];

      if (!icp.name?.trim() || !icp.industry?.trim() || !icp.companySize?.trim() || !icp.jobTitles?.length || !icp.painPoints?.length) missing.push("meaningful_icp");

      if (body.require_gmail === true || body.require_calendar === true) {
        const google = await googleAuthorization(admin, workspaceId);
        if (!google.connected) missing.push("google_reauthorization");
        if (body.require_gmail === true && !google.gmail) missing.push("gmail_authorization");
        if (body.require_calendar === true && !google.calendar) missing.push("calendar_authorization");
      }

      let linkedinQuery = admin.from("linkedin_accounts").select("id,connection_state,status,health_status,profile_url,expected_profile_url").eq("workspace_id", workspaceId);
      if (selectedAccountId) linkedinQuery = linkedinQuery.eq("id", selectedAccountId);
      const { data: linkedin, error: linkedinError } = await linkedinQuery.limit(1).maybeSingle();
      if (linkedinError) throw new Error(`LinkedIn account validation failed: ${linkedinError.message}`);
      if (!selectedAccountId) missing.push("linkedin_account_selection");
      if (!linkedin || linkedin.connection_state !== "connected") missing.push("linkedin_connection");
      if (linkedin && !["healthy", "degraded"].includes(linkedin.health_status)) missing.push("linkedin_session_health");
      if (linkedin && (!linkedin.profile_url || !linkedin.expected_profile_url || normalizeLinkedInProfile(linkedin.profile_url) !== normalizeLinkedInProfile(linkedin.expected_profile_url))) {
        missing.push("linkedin_identity_validation");
      }

      const status = missing.length ? "blocked_prerequisite" : "ready";
      const message = missing.length ? `Campaign saved. Complete these connections before launch: ${missing.map(requirementLabel).join(", ")}.` : "Campaign saved and prerequisites validated. Launch it explicitly from Campaigns when ready.";
      const row = {
        workspace_id: workspaceId,
        name: typeof campaignInput.name === "string" && campaignInput.name.trim() ? campaignInput.name.trim() : `${icp.name ?? "Campaign"} outreach`,
        icp,
        icp_id: savedIcpId ?? null,
        targeting_mode: campaignInput.targeting_mode === "autonomous_pool" ? "autonomous_pool" : "manual_review",
        linkedin_account_id: linkedin?.id ?? null,
        source_campaign_id: sourceCampaignId ?? null,
        initialization_key: initializationKey ?? null,
        status,
        status_reason: message,
        failure_code: missing.length ? "missing_prerequisite" : null,
        blocker: missing.length ? [...new Set(missing)].map(requirementLabel).join(", ") : null,
      };
      const query = sourceCampaignId ? admin.from("customer_campaigns").upsert(row, { onConflict: "workspace_id,source_campaign_id" }) : initializationKey ? admin.from("customer_campaigns").upsert(row, { onConflict: "workspace_id,initialization_key" }) : admin.from("customer_campaigns").insert(row);
      const { data: campaign, error: campaignError } = await query.select("id").single();
      if (campaignError) throw new Error(`Campaign initialization failed: ${campaignError.message}`);
      return json({
        ok: true,
        status,
        campaign_id: campaign.id,
        missing_requirements: [...new Set(missing)],
        message,
      });
    }

    if (action === "schedule_preview") {
      const operatingDays = requireString(body.operating_days, "operating_days");
      const startTime = requireString(body.start_time, "start_time");
      const endTime = requireString(body.end_time, "end_time");
      const timezone = requireString(body.outreach_timezone, "outreach_timezone");
      const { data: validation, error: validationError } = await admin.rpc("campaign_schedule_validation", {
        p_operating_days: operatingDays, p_start_time: startTime, p_end_time: endTime, p_timezone: timezone,
      });
      if (validationError || !validation?.valid) throw pipelineError(String(validation?.code ?? "invalid_campaign_schedule"), "Choose at least one sending day, valid hours, and an IANA timezone", 409);
      const { data: scheduledAt, error: scheduleError } = await admin.rpc("next_campaign_schedule_at", {
        p_operating_days: operatingDays, p_start_time: startTime, p_end_time: endTime, p_timezone: timezone,
        p_not_before: optionalString(body.not_before) ?? new Date().toISOString(),
      });
      if (scheduleError || !scheduledAt) throw pipelineError("invalid_campaign_schedule", "No valid outreach window was found", 409);
      return json({ valid: true, scheduled_at: scheduledAt, write_performed: false });
    }

    if (action === "update_schedule") {
      const campaignId = requireString(body.campaign_id, "campaign_id");
      const { data: result, error } = await admin.rpc("update_customer_campaign_schedule", {
        p_workspace_id: workspaceId, p_campaign_id: campaignId,
        p_operating_days: requireString(body.operating_days, "operating_days"),
        p_start_time: requireString(body.start_time, "start_time"),
        p_end_time: requireString(body.end_time, "end_time"),
        p_timezone: requireString(body.outreach_timezone, "outreach_timezone"),
      });
      if (error || !result?.valid) throw pipelineError(String(result?.code ?? "schedule_update_failed"), "Campaign schedule could not be updated", 409);
      return json({ ...result, write_performed: false });
    }

    if (action === "pause_campaign" || action === "resume_campaign") {
      const campaignId = requireString(body.campaign_id, "campaign_id");
      const { data: result, error } = await admin.rpc("set_customer_campaign_paused", {
        p_workspace_id: workspaceId, p_campaign_id: campaignId, p_paused: action === "pause_campaign",
      });
      if (error || !result?.ok) throw pipelineError(String(result?.code ?? "campaign_state_change_failed"), "Campaign state could not be changed", 409);
      return json({ ...result, write_performed: false });
    }

    if (action === "associate_existing_prospect") {
      const campaignId = requireString(body.campaign_id, "campaign_id");
      const prospectId = requireString(body.prospect_id, "prospect_id");
      const { data: campaign } = await admin.from("customer_campaigns").select("id").eq("id", campaignId).eq("workspace_id", workspaceId).maybeSingle();
      if (!campaign) throw pipelineError("campaign_not_found", "Campaign was not found in this workspace", 404);
      const { data: prospect } = await admin.from("prospects").select("*").eq("id", prospectId).eq("workspace_id", workspaceId).maybeSingle();
      const target = prospect?.linkedin_url ? normalizeLinkedInProfile(prospect.linkedin_url) : null;
      if (!prospect || !target) throw pipelineError("prospect_identity_required", "Select a genuine workspace prospect with a LinkedIn profile", 409);
      const { data: existing } = await admin.from("contacts").select("id").eq("workspace_id", workspaceId).eq("normalized_linkedin_url", target).maybeSingle();
      let contactId = existing?.id ?? null;
      if (!contactId) {
        const { data: contact, error } = await admin.from("contacts").insert({
          workspace_id: workspaceId, company_id: prospect.company_id, source_prospect_id: prospect.id,
          first_name: prospect.first_name, last_name: prospect.last_name,
          full_name: `${prospect.first_name ?? ""} ${prospect.last_name ?? ""}`.trim() || null,
          job_title: prospect.title, linkedin_url: target, email: prospect.email, phone: prospect.phone,
          status: "saved", confidence_score: 1,
        }).select("id").single();
        if (error) throw pipelineError("identity_reconciliation_failed", error.message, 409);
        contactId = contact.id;
      }
      const { error: mappingError } = await admin.from("customer_campaign_contacts").upsert({
        workspace_id: workspaceId, customer_campaign_id: campaignId, contact_id: contactId,
        prospect_id: prospect.id, source: "existing_workspace_prospect", discovered_at: prospect.created_at,
      }, { onConflict: "customer_campaign_id,prospect_id" });
      if (mappingError) throw pipelineError("campaign_association_failed", mappingError.message, 409);
      return json({ status: "associated", campaign_id: campaignId, prospect_id: prospect.id, contact_id: contactId, job_created: false, write_performed: false });
    }

    if (action === "launch") {
      const icp = (body.icp ?? {}) as ICP;
      const genericCampaignId = optionalString(body.campaign_id);
      const selectedAccountId = optionalString(body.linkedin_account_id);
      const maxProspects = clampNumber(body.max_prospects, 1, 10, 5);

      if (body.require_calendar === true) {
        const google = await googleAuthorization(admin, workspaceId);
        if (!google.calendar) throw pipelineError("calendar_authorization_required", "Connect Google Calendar before enabling automatic meeting booking", 409);
      }
      if (body.require_gmail === true) {
        const google = await googleAuthorization(admin, workspaceId);
        if (!google.gmail) throw pipelineError("gmail_authorization_required", "Authorize Gmail before enabling email outreach", 409);
      }

      let accountQuery = admin.from("linkedin_accounts").select("id,workspace_id,connection_state,connection_status,status,session_status,health_status,profile_url,expected_profile_url").eq("workspace_id", workspaceId).eq("connection_state", "connected").in("health_status", ["healthy", "degraded"]).not("profile_url", "is", null).not("expected_profile_url", "is", null).neq("status", "paused").neq("status", "restricted").order("created_at", { ascending: true });
      if (selectedAccountId) accountQuery = accountQuery.eq("id", selectedAccountId);
      const { data: account, error: accountError } = await accountQuery.limit(1).maybeSingle();
      if (accountError) throw new Error(`LinkedIn account lookup failed: ${accountError.message}`);
      if (!account) throw new Error("No connected LinkedIn account is available for this workspace");

      let customerCampaignId: string | null = null;
      const campaignInput = (body.campaign ?? {}) as Json;
      const targetingMode = campaignInput.targeting_mode === "autonomous_pool" ? "autonomous_pool" : "manual_review";
      const icpId = optionalString(campaignInput.icp_id);
      if (typeof campaignInput.name === "string" && campaignInput.name.trim()) {
        const initializationKey = optionalString(campaignInput.initialization_key);
        const campaignRow = {
          workspace_id: workspaceId,
          name: campaignInput.name.trim(),
          icp: icp,
          icp_id: icpId ?? null,
          targeting_mode: targetingMode,
          pool_feed_limit: Math.min(maxProspects, clampNumber(campaignInput.daily_limit, 1, 20, 10)),
          linkedin_account_id: account.id,
          strategy: campaignInput.strategy ?? null,
          daily_limit: clampNumber(campaignInput.daily_limit, 1, 20, 10),
          operating_days: campaignInput.operating_days ?? null,
          operating_hours: campaignInput.operating_hours ?? null,
          outreach_timezone: optionalString(campaignInput.outreach_timezone),
          initialization_key: initializationKey ?? null,
          status: "initializing",
          status_reason: "Validating and discovering verified prospects.",
          failure_code: null,
          blocker: null,
          connection_note_template: optionalString(campaignInput.connection_note_template),
          first_message_template: optionalString(campaignInput.first_message_template),
          follow_up_1_template: optionalString(campaignInput.follow_up_1_template),
          follow_up_2_template: optionalString(campaignInput.follow_up_2_template),
          delay_after_connection_hours: typeof campaignInput.delay_after_connection_hours === "number" ? campaignInput.delay_after_connection_hours : 0,
          delay_after_first_message_hours: typeof campaignInput.delay_after_first_message_hours === "number" ? campaignInput.delay_after_first_message_hours : 72,
          delay_after_follow_up_1_hours: typeof campaignInput.delay_after_follow_up_1_hours === "number" ? campaignInput.delay_after_follow_up_1_hours : 96,
        };
        if (!campaignRow.outreach_timezone) throw pipelineError("outreach_timezone_required", "Configure outreach timezone before launching LinkedIn outreach", 409);
        const campaignQuery = initializationKey
          ? admin.from("customer_campaigns").upsert(campaignRow, {
              onConflict: "workspace_id,initialization_key",
            })
          : admin.from("customer_campaigns").insert(campaignRow);
        const { data: customerCampaign, error: customerCampaignError } = await campaignQuery.select("id").single();
        if (customerCampaignError) throw new Error(`Campaign creation failed: ${customerCampaignError.message}`);
        customerCampaignId = customerCampaign.id;
        lifecycleCampaignId = customerCampaignId;
        const { data: windowValidation, error: windowError } = await admin.rpc("campaign_window_validation", { p_campaign_id: customerCampaignId, p_not_before: new Date().toISOString() });
        if (windowError || !windowValidation?.valid) throw pipelineError("invalid_campaign_schedule", "Choose at least one sending day, valid hours, and an IANA timezone", 409);
      }

      const reviewedTargets = Array.isArray(body.reviewed_linkedin_urls)
        ? [...new Set(body.reviewed_linkedin_urls.map((value: unknown) => typeof value === "string" ? normalizeLinkedInProfile(value) : null).filter((value): value is string => Boolean(value)))]
        : [];
      let prospects: Prospect[] = [];
      if (targetingMode === "autonomous_pool") {
        if (!customerCampaignId || !icpId) throw pipelineError("autonomous_icp_required", "Autonomous campaigns require a saved ICP", 409);
        const { data: reservations, error: reservationError } = await admin.rpc("reserve_autonomous_campaign_prospects", { p_workspace_id: workspaceId, p_campaign_id: customerCampaignId, p_limit: maxProspects });
        if (reservationError) throw pipelineError("prospect_reservation_failed", reservationError.message, 409);
        const prospectIds = (reservations ?? []).map((row: Json) => row.prospect_id).filter(Boolean);
        if (prospectIds.length) {
          const { data: rows, error: rowsError } = await admin.from("icp_prospects").select("prospect_id,fit_score,fit_evidence,provenance,prospects!inner(id,first_name,last_name,title,normalized_linkedin_url,company_name,company_website,location)").eq("workspace_id", workspaceId).eq("icp_id", icpId).in("prospect_id", prospectIds).eq("verification_status", "verified").eq("readiness", "ready");
          if (rowsError) throw pipelineError("inventory_revalidation_failed", rowsError.message, 409);
          const stored = (rows ?? []).map((row: any): Prospect => ({ companyName: row.prospects.company_name, companyWebsite: row.prospects.company_website, companyDescription: String(row.provenance?.evidence ?? ""), contactFirstName: row.prospects.first_name, contactLastName: row.prospects.last_name, contactTitle: row.prospects.title, linkedinUrl: row.prospects.normalized_linkedin_url, evidence: String(row.provenance?.evidence ?? ""), confidenceScore: Number(row.fit_score) / 100, companyFit: String(row.fit_evidence?.company_fit ?? "Verified ICP fit"), personFit: String(row.fit_evidence?.person_fit ?? "Verified role fit"), location: row.prospects.location, sourceConfidence: Number(row.provenance?.source_confidence ?? 0) }));
          prospects = await excludeHistoricallyUnsafeProspects(admin, workspaceId, account.id, stored, newDiscoveryDiagnostics());
        }
      } else {
        if (reviewedTargets.length === 0) throw pipelineError("reviewed_prospects_required", "Review source-verified prospects before launching the campaign", 409);
        const reviewedTargetSet = new Set(reviewedTargets);
        const safeProspects = await excludeHistoricallyUnsafeProspects(admin, workspaceId, account.id, await discoverVerifiedProspects(icp, maxProspects, newDiscoveryDiagnostics(), undefined, admin, workspaceId, account.id));
        prospects = safeProspects.filter((prospect) => reviewedTargetSet.has(prospect.linkedinUrl));
      }
      if (prospects.length === 0) {
        throw pipelineError("prospect_pool_not_ready", targetingMode === "autonomous_pool" ? "Yuktris is still building this audience. No outreach was created." : "The reviewed prospects could not be revalidated from current source evidence. Discover and review again before launch", 409);
      }

      const createdJobs: string[] = [];
      const createdContacts: string[] = [];
      const skippedExistingContacts: string[] = [];
      let completedExistingJobs = 0;
      let nextScheduledAt: string | null = null;

      for (const prospect of prospects) {
        const company = await findOrCreateCompany(admin, workspaceId, prospect);
        const contact = await findOrCreateContact(admin, workspaceId, company.id, prospect);
        const { data: existingConnectionJob, error: existingJobError } = await admin.from("linkedin_execution_jobs").select("id,status").eq("workspace_id", workspaceId).eq("contact_id", contact.id).eq("action_type", "connection_request").order("created_at", { ascending: true }).limit(1).maybeSingle();
        if (existingJobError) throw new Error(`Existing connection job lookup failed: ${existingJobError.message}`);
        if (existingConnectionJob) {
          skippedExistingContacts.push(String(contact.id));
          if (["queued", "retry", "failed"].includes(existingConnectionJob.status)) createdJobs.push(existingConnectionJob.id);
          if (existingConnectionJob.status === "completed") completedExistingJobs += 1;
          continue;
        }

        const connectionNoteTemplate = optionalString(campaignInput.connection_note_template);
        const firstMessageTemplate = optionalString(campaignInput.first_message_template);
        const followUp1Template = optionalString(campaignInput.follow_up_1_template);
        const followUp2Template = optionalString(campaignInput.follow_up_2_template);
        const delayAfterConnection = typeof campaignInput.delay_after_connection_hours === "number" ? campaignInput.delay_after_connection_hours : 0;
        const delayAfterFirstMessage = typeof campaignInput.delay_after_first_message_hours === "number" ? campaignInput.delay_after_first_message_hours : 72;
        const delayAfterFollowUp1 = typeof campaignInput.delay_after_follow_up_1_hours === "number" ? campaignInput.delay_after_follow_up_1_hours : 96;

        let connectionNote = connectionNoteTemplate;
        let firstMessage = firstMessageTemplate;
        let followUp1 = followUp1Template;
        let followUp2 = followUp2Template;

        if (!connectionNote || !firstMessage || !followUp1 || !followUp2) {
          const copy = await generateLinkedInCopy(icp, prospect, optionalString(campaignInput.strategy));
          connectionNote = connectionNote ?? copy.connectionNote;
          firstMessage = firstMessage ?? copy.firstMessage;
          followUp1 = followUp1 ?? copy.followUp1;
          followUp2 = followUp2 ?? copy.followUp2;
        }

        const { data: decision, error: decisionError } = await admin
          .from("outreach_decisions")
          .insert({
            workspace_id: workspaceId,
            company_id: company.id,
            contact_id: contact.id,
            decision: "linkedin_first",
            decision_reason: `Verified decision maker discovered for ${icp.name ?? "selected ICP"}. ${prospect.evidence.slice(0, 400)}`,
            confidence_score: prospect.confidenceScore,
            status: "active",
          })
          .select("id")
          .single();
        if (decisionError) throw new Error(`Outreach decision persistence failed: ${decisionError.message}`);

        const { data: outreachCampaign, error: campaignError } = await admin
          .from("outreach_campaigns")
          .insert({
            workspace_id: workspaceId,
            company_id: company.id,
            contact_id: contact.id,
            campaign_name: `${icp.name ?? "ICP"} - ${prospect.companyName} - LinkedIn`,
            campaign_type: "sequence",
            campaign_status: "processing",
            campaign_score: Math.round(prospect.confidenceScore * 100),
            success_probability: Math.round(prospect.confidenceScore * 25),
          })
          .select("id")
          .single();
        if (campaignError) throw new Error(`Outreach campaign persistence failed: ${campaignError.message}`);

        const sequenceSteps = [
          { type: "first_message", delay_hours: delayAfterConnection, message: firstMessage },
          { type: "follow_up", delay_hours: delayAfterFirstMessage, message: followUp1 },
          { type: "follow_up", delay_hours: delayAfterFollowUp1, message: followUp2 },
        ];
        const { data: sequence, error: sequenceError } = await admin
          .from("linkedin_sequences")
          .insert({
            workspace_id: workspaceId,
            campaign_id: outreachCampaign.id,
            sequence_name: `${prospect.contactFirstName} ${prospect.contactLastName} LinkedIn sequence`,
            sequence_steps: sequenceSteps,
            total_steps: sequenceSteps.length,
            status: "active",
          })
          .select("id")
          .single();
        if (sequenceError) throw new Error(`LinkedIn sequence persistence failed: ${sequenceError.message}`);

        const { data: state, error: stateError } = await admin
          .from("linkedin_sequence_state")
          .insert({
            workspace_id: workspaceId,
            sequence_id: sequence.id,
            linkedin_account_id: account.id,
            contact_id: contact.id,
            company_id: company.id,
            current_step: 0,
            step_status: "pending",
            started_at: new Date().toISOString(),
            next_action_at: null,
          })
          .select("id")
          .single();
        if (stateError) throw new Error(`LinkedIn sequence enrollment failed: ${stateError.message}`);

        const { data: scheduledAt, error: scheduleError } = await admin.rpc("next_campaign_outreach_at", {
          p_campaign_id: customerCampaignId,
          p_not_before: new Date().toISOString(),
        });
        if (scheduleError || !scheduledAt) throw pipelineError("invalid_campaign_schedule", "Configure valid operating days, hours, and an IANA outreach timezone", 409);
        if (!nextScheduledAt || new Date(scheduledAt).getTime() < new Date(nextScheduledAt).getTime()) nextScheduledAt = scheduledAt;
        const { data: job, error: jobError } = await admin
          .from("linkedin_execution_jobs")
          .insert({
            workspace_id: workspaceId,
            linkedin_account_id: account.id,
            company_id: company.id,
            contact_id: contact.id,
            outreach_decision_id: decision.id,
            campaign_id: outreachCampaign.id,
            sequence_id: sequence.id,
            sequence_step: -1,
            action_type: "connection_request",
            status: "scheduled",
            scheduled_at: scheduledAt,
            priority: 2,
            action_payload: {
              note: connectionNote,
              sequence_state_id: state.id,
              source_campaign_id: customerCampaignId ?? genericCampaignId ?? null,
              profile_url: prospect.linkedinUrl,
            },
          })
          .select("id")
          .single();
        if (jobError) throw new Error(`LinkedIn connection job persistence failed: ${jobError.message}`);

        createdJobs.push(job.id);
        createdContacts.push(contact.id);
        if (targetingMode === "autonomous_pool" && customerCampaignId) {
          const { data: inventoryPerson } = await admin.from("prospects").select("id").eq("workspace_id", workspaceId).eq("normalized_linkedin_url", prospect.linkedinUrl).maybeSingle();
          if (inventoryPerson?.id) {
            await admin.from("campaign_prospect_reservations").update({ status: "consumed", consumed_at: new Date().toISOString() }).eq("workspace_id", workspaceId).eq("campaign_id", customerCampaignId).eq("prospect_id", inventoryPerson.id).eq("status", "reserved");
            await admin.from("icp_prospects").update({ readiness: "contacted", updated_at: new Date().toISOString() }).eq("workspace_id", workspaceId).eq("icp_id", icpId).eq("prospect_id", inventoryPerson.id);
          }
        }
      }

      // Initial jobs remain scheduled until their campaign window. The autonomous
      // worker bridges only due jobs and re-checks the campaign schedule before writes.
      const bridgeFailures: Array<{ job_id: string; status: number; error: string }> = [];

      if (customerCampaignId) {
        const hasRunnableOutreach = createdJobs.length > 0 || completedExistingJobs > 0;
        const finalStatus = bridgeFailures.length || !hasRunnableOutreach ? "failed" : "running";
        const waitingForWindow = Boolean(nextScheduledAt && new Date(nextScheduledAt).getTime() > Date.now() + 5000);
        const finalReason = bridgeFailures.length ? "Some outreach jobs could not be queued. Retry after reviewing the campaign." : hasRunnableOutreach ? (waitingForWindow ? `Waiting for next sending window — ${nextScheduledAt}` : "Outreach is running in the background.") : "No new eligible prospects were available for outreach.";
        const { error: lifecycleError } = await admin
          .from("customer_campaigns")
          .update({
            status: finalStatus,
            status_reason: finalReason,
            failure_code: bridgeFailures.length ? "job_bridge_failed" : hasRunnableOutreach ? null : "no_eligible_prospects",
            blocker: bridgeFailures.length ? "LinkedIn execution queue" : hasRunnableOutreach ? null : "Verified prospects",
            launched_at: hasRunnableOutreach ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", customerCampaignId);
        if (lifecycleError) throw new Error(`Campaign lifecycle finalization failed: ${lifecycleError.message}`);
        lifecycleCampaignId = null;
      }

      if (targetingMode === "autonomous_pool" && icpId) {
        const { data: poolConfig } = await admin.from("icps").select("minimum_ready_inventory").eq("workspace_id", workspaceId).eq("id", icpId).single();
        const { count: ready } = await admin.from("icp_prospects").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("icp_id", icpId).eq("verification_status", "verified").eq("readiness", "ready");
        if ((ready ?? 0) < (poolConfig?.minimum_ready_inventory ?? 5)) {
          const hour = new Date(); hour.setUTCMinutes(0, 0, 0);
          const { data: replenishment } = await admin.from("prospect_replenishment_jobs").insert({ workspace_id: workspaceId, icp_id: icpId, linkedin_account_id: account.id, idempotency_key: `${icpId}:inventory_below_threshold:${hour.toISOString()}`, reason: "inventory_below_threshold" }).select("id").maybeSingle();
          if (replenishment?.id) {
            const task = processReplenishment(admin, workspaceId, replenishment.id);
            if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(task); else await task;
          }
        }
      }

      return json(
        {
          status: bridgeFailures.length ? "partially_launched" : "launched",
          prospects_discovered: prospects.length,
          contacts_created_or_updated: createdContacts.length,
          contacts_skipped_existing_connection: skippedExistingContacts.length,
          connection_jobs_created: createdJobs.length,
          connection_jobs_bridged: createdJobs.length - bridgeFailures.length,
          bridge_failures: bridgeFailures,
          job_ids: createdJobs,
        },
        bridgeFailures.length ? 502 : 200,
      );
    }

    if (action === "tick") {
      const { error: reconcileError } = await admin.rpc("reconcile_linkedin_v1_pipeline", { p_workspace_id: workspaceId });
      if (reconcileError) throw new Error(`Pipeline reconciliation failed: ${reconcileError.message}`);
      const { error: followupError } = await admin.rpc("schedule_due_linkedin_followups", { p_workspace_id: workspaceId, p_limit: 50 });
      if (followupError) throw new Error(`Follow-up scheduling failed: ${followupError.message}`);
      const { error: replyError } = await admin.rpc("schedule_linkedin_reply_checks", { p_workspace_id: workspaceId, p_limit: 50 });
      if (replyError) throw new Error(`Reply-check scheduling failed: ${replyError.message}`);
      const { data: dueDiscovery } = await admin.from("prospect_replenishment_jobs").select("id").eq("workspace_id", workspaceId).in("status", ["queued","cooldown"]).lte("next_attempt_at", new Date().toISOString()).order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (dueDiscovery?.id) {
        const task = processReplenishment(admin, workspaceId, dueDiscovery.id);
        if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(task); else await task;
      }
      return json({ status: "ticked" });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    if (lifecycleAdmin && lifecycleCampaignId) {
      const message = error instanceof Error ? error.message : "Campaign initialization failed";
      await lifecycleAdmin
        .from("customer_campaigns")
        .update({
          status: "failed",
          failure_code: message.includes("No verifiable") ? "discovery_failed" : "initialization_failed",
          blocker: message.slice(0, 500),
          status_reason: "Campaign setup did not complete. Review the error and retry.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", lifecycleCampaignId);
    }
    const message = error instanceof Error ? error.message : "LinkedIn V1 pipeline failed";
    return json(
      {
        ok: false,
        error: message,
        code: errorCode(error),
        campaign_id: lifecycleCampaignId,
      },
      errorStatus(error),
    );
  }
});

function inventoryCounts(rows: Array<{ fit_score: number; intent_status: string; readiness: string; verification_status: string }>) {
  return {
    discovered: rows.length,
    verified: rows.filter((row) => row.verification_status === "verified").length,
    high_fit: rows.filter((row) => row.verification_status === "verified" && row.fit_score >= 80).length,
    intent: rows.filter((row) => row.intent_status === "evidenced").length,
    ready: rows.filter((row) => row.verification_status === "verified" && row.readiness === "ready").length,
  };
}

function materialDiscoveryReason(value: string): string {
  return ["onboarding_confirmed", "icp_activated", "targeting_changed", "inventory_below_threshold", "scheduled_refresh"].includes(value) ? value : "explicit_activation";
}

async function loadCertifiedIcp(admin: any, workspaceId: string, icpId: string): Promise<ICP> {
  const { data: icp, error } = await admin.from("icps").select("id,name,description,company_name,offer_context,icp_company_profile(industry,sub_industry,company_size,country,region),icp_decision_makers(job_title),icp_pain_points(pain_point),sales_navigator_filters(industry,company_size,location,keywords,titles)").eq("workspace_id", workspaceId).eq("id", icpId).maybeSingle();
  if (error || !icp) throw pipelineError("icp_not_found", "ICP configuration could not be loaded", 404);
  const company = Array.isArray(icp.icp_company_profile) ? icp.icp_company_profile[0] : icp.icp_company_profile;
  const filters = Array.isArray(icp.sales_navigator_filters) ? icp.sales_navigator_filters[0] : icp.sales_navigator_filters;
  return {
    name: icp.name,
    description: [icp.description, icp.offer_context?.offer, icp.offer_context?.value_proposition].filter(Boolean).join(" — "),
    industry: company?.industry ?? filters?.industry?.[0] ?? "",
    subIndustry: company?.sub_industry ?? "",
    companySize: company?.company_size ?? filters?.company_size?.[0] ?? "",
    jobTitles: [...new Set([...(icp.icp_decision_makers ?? []).map((row: Json) => row.job_title), ...(filters?.titles ?? [])].filter(Boolean))] as string[],
    painPoints: (icp.icp_pain_points ?? []).map((row: Json) => row.pain_point).filter(Boolean) as string[],
    geography: [...new Set([company?.country, company?.region, ...(filters?.location ?? [])].filter(Boolean))] as string[],
    keywords: filters?.keywords ?? [],
  };
}

async function processReplenishment(admin: any, workspaceId: string, jobId: string): Promise<void> {
  const owner = `edge:${crypto.randomUUID()}`;
  const { data: claim, error: claimError } = await admin.rpc("claim_prospect_replenishment", { p_job_id: jobId, p_workspace_id: workspaceId, p_lease_owner: owner });
  if (claimError || !claim?.claimed) return;
  const icpId = String(claim.icp_id);
  try {
    const { data: config, error: configError } = await admin.from("icps").select("minimum_ready_inventory,target_ready_inventory,replenishment_batch_size,acquisition_phase,initial_acquisition_batches_completed,starter_ready_target,max_initial_acquisition_batches,initial_acquisition_interval_minutes").eq("workspace_id", workspaceId).eq("id", icpId).single();
    if (configError) throw configError;
    const { count: readyCount, error: countError } = await admin.from("icp_prospects").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("icp_id", icpId).eq("verification_status", "verified").eq("readiness", "ready");
    if (countError) throw countError;
    if ((readyCount ?? 0) >= config.minimum_ready_inventory) {
      const next = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await admin.from("prospect_replenishment_jobs").update({ status: "completed", completed_at: new Date().toISOString(), lease_owner: null, lease_expires_at: null, result_metadata: { skipped: "inventory_above_threshold", ready_count: readyCount }, updated_at: new Date().toISOString() }).eq("id", jobId);
      await admin.from("icps").update({ prospecting_status: "up_to_date", acquisition_phase: "maintenance", next_refresh_at: next, last_discovery_completed_at: new Date().toISOString(), discovery_consecutive_failures: 0, discovery_error: null }).eq("id", icpId);
      return;
    }
    await admin.from("icps").update({ prospecting_status: "refreshing", last_discovery_started_at: new Date().toISOString() }).eq("id", icpId);
    const icp = await loadCertifiedIcp(admin, workspaceId, icpId);
    const diagnostics = newDiscoveryDiagnostics();
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort("internal_deadline_reached"), diagnostics.internalDeadlineMs);
    let discovered: Prospect[] = [];
    try { discovered = await discoverVerifiedProspects(icp, Math.min(config.replenishment_batch_size, 5), diagnostics, controller.signal, admin, workspaceId, claim.account_id ?? undefined); }
    catch (error) {
      if (!controller.signal.aborted) throw error;
      reject(diagnostics, "internal_deadline_reached");
      diagnostics.terminatedBy = "internal_deadline_reached";
    }
    finally { clearTimeout(deadline); }
    const safe = await excludeHistoricallyUnsafeProspects(admin, workspaceId, claim.account_id ?? undefined, discovered, diagnostics);
    let persisted = 0;
    for (const prospect of safe) {
      const canonical = normalizeLinkedInProfile(prospect.linkedinUrl);
      if (!canonical) continue;
      const personFields = { linkedin_url: canonical, first_name: prospect.contactFirstName, last_name: prospect.contactLastName, title: prospect.contactTitle, company_name: prospect.companyName, company_website: prospect.companyWebsite, location: prospect.location, identity_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const { data: existingPerson, error: existingPersonError } = await admin.from("prospects").select("id").eq("workspace_id", workspaceId).eq("normalized_linkedin_url", canonical).maybeSingle();
      if (existingPersonError) throw existingPersonError;
      let person = existingPerson;
      if (person) {
        const { error: updateError } = await admin.from("prospects").update(personFields).eq("workspace_id", workspaceId).eq("id", person.id);
        if (updateError) throw updateError;
      } else {
        const { data: insertedPerson, error: insertError } = await admin.from("prospects").insert({ workspace_id: workspaceId, ...personFields, status: "new" }).select("id").single();
        if (insertError) throw insertError;
        person = insertedPerson;
      }
      const score = Math.max(0, Math.min(100, Math.round(prospect.confidenceScore * 100)));
      const { error: linkError } = await admin.from("icp_prospects").upsert({ workspace_id: workspaceId, icp_id: icpId, prospect_id: person.id, fit_score: score, fit_evidence: { company_fit: prospect.companyFit, person_fit: prospect.personFit }, provenance: { evidence: prospect.evidence.slice(0, 2000), official_company_url: prospect.companyWebsite, linkedin_url: canonical, source_confidence: prospect.sourceConfidence }, verification_status: "verified", intent_status: "unknown", intent_evidence: null, readiness: "ready", last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "icp_id,prospect_id" });
      if (linkError) throw linkError;
      persisted += 1;
    }
    const { count: finalReady } = await admin.from("icp_prospects").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("icp_id", icpId).eq("verification_status", "verified").eq("readiness", "ready");
    const cadence = nextAcquisitionCadence(config, finalReady ?? 0);
    const next = new Date(Date.now() + cadence.delayMinutes * 60 * 1000).toISOString();
    await admin.from("prospect_replenishment_jobs").update({ status: "completed", completed_at: new Date().toISOString(), lease_owner: null, lease_expires_at: null, result_metadata: { persisted, ready_count: finalReady, diagnostics, acquisition_phase: cadence.phase, initial_batches_completed: cadence.initialBatchesCompleted }, updated_at: new Date().toISOString() }).eq("id", jobId);
    await admin.from("icps").update({ prospecting_status: (finalReady ?? 0) >= config.minimum_ready_inventory ? "up_to_date" : "queued", acquisition_phase: cadence.phase, initial_acquisition_batches_completed: cadence.initialBatchesCompleted, next_refresh_at: next, last_discovery_completed_at: new Date().toISOString(), discovery_consecutive_failures: 0, discovery_error: null }).eq("id", icpId);
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : typeof error === "string" ? error : JSON.stringify(error) || "Discovery failed";
    const { data: job } = await admin.from("prospect_replenishment_jobs").select("attempt_count,max_attempts").eq("id", jobId).single();
    const retry = (job?.attempt_count ?? 1) < (job?.max_attempts ?? 3);
    const delayMinutes = Math.min(360, 15 * 2 ** Math.max(0, (job?.attempt_count ?? 1) - 1));
    await admin.from("prospect_replenishment_jobs").update({ status: retry ? "cooldown" : "failed", next_attempt_at: new Date(Date.now() + delayMinutes * 60000).toISOString(), lease_owner: null, lease_expires_at: null, error_message: message.slice(0, 1000), completed_at: retry ? null : new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", jobId);
    const { data: icp } = await admin.from("icps").select("discovery_consecutive_failures").eq("id", icpId).single();
    await admin.from("icps").update({ prospecting_status: retry ? "queued" : "needs_attention", discovery_consecutive_failures: (icp?.discovery_consecutive_failures ?? 0) + 1, discovery_error: message.slice(0, 1000), next_refresh_at: new Date(Date.now() + delayMinutes * 60000).toISOString() }).eq("id", icpId);
  }
}

async function discoverVerifiedProspects(icp: ICP, maxProspects: number, diagnostics = newDiscoveryDiagnostics(), signal?: AbortSignal, admin?: any, workspaceId?: string, accountId?: string): Promise<Prospect[]> {
  const startedAt = Date.now();
  const deadlineAt = startedAt + diagnostics.internalDeadlineMs;
  const withinBudget = () => !signal?.aborted && Date.now() < deadlineAt - 2500;
  const tavilyKey = Deno.env.get("TAVILY_API_KEY");
  if (!tavilyKey) throw new Error("TAVILY_API_KEY is not configured in Supabase secrets");

  const roles = (icp.jobTitles?.length ? icp.jobTitles : ["CEO", "Founder", "VP Sales", "Head of Sales"]).filter(Boolean).slice(0, 4);
  const geography = (icp.geography ?? []).filter(Boolean).slice(0, 2);
  const verticals = discoveryVerticalVariants(icp);
  const roleVariants = discoveryRoleVariants(roles);
  const peopleQueries = buildDiscoveryWaves(roles, roleVariants, verticals, geography, icp.companySize)
    .map((wave) => wave.slice(0, 2)).slice(0, diagnostics.budgets.maxWaves);
  const usedQueries = new Set<string>();
  const evaluatedCanonical = new Set<string>();
  const rejectedSemanticKeys = new Set<string>();
  const evidenceByCanonical = new Map<string, { title: string; url: string; content: string; score?: number }>();
  let groundedFallbackBudget = diagnostics.budgets.openai;
  let deepResearchRemaining = diagnostics.budgets.deepResearchCandidates;
  // Invocation-local promises deliberately coalesce concurrent reads. Nothing in
  // this cache is shared across requests, and person evidence never enters it.
  type CompanyResearch = { official: { title: string; url: string; content: string; score?: number }; website: string; description: string; icpFit: boolean };
  const companyResearchCache = new Map<string, Promise<CompanyResearch | null>>();
  const companyCacheMisses = new Set<string>();
  const researchCompany = (companyName: string) => {
    const identityKey = `identity:${normalizedEvidenceTokens(companyName, ["the", "group", "inc", "llc", "ltd"]).join("-")}`;
    const existing = companyResearchCache.get(identityKey);
    if (existing) { diagnostics.companyCacheHits += 1; return existing; }
    companyCacheMisses.add(identityKey);
    const pending = (async (): Promise<CompanyResearch | null> => {
      if (!withinBudget() || diagnostics.providerRequests.tavily >= diagnostics.budgets.tavily) return null;
      diagnostics.searchQueries += 1;
      const results = await tavilySearch(tavilyKey, `\"${companyName}\" official company website`, 5, diagnostics, signal)
        .catch((error) => { if (signal?.aborted) throw error; reject(diagnostics, "provider_timeout"); return []; });
      diagnostics.providerResults += results.length;
      const official = results.find((result) => isOfficialCompanyCandidateUrl(result.url, companyName) && hasEvidenceToken(`${result.title} ${result.content} ${new URL(result.url).hostname}`, companyName, ["the", "group", "solutions", "services", "technologies", "technology", "consulting"]));
      if (!official || !withinBudget()) return null;
      const website = rootWebsite(official.url);
      const domainKey = `domain:${new URL(website).hostname.toLowerCase().replace(/^www\./, "")}`;
      diagnostics.deeplyResearched += 1;
      const description = await readOfficialCompanyEvidence(website, official.url, official.content ?? "", icp, diagnostics, signal, withinBudget);
      if (!description) { diagnostics.companyResearchFailed += 1; reject(diagnostics, "official_company_unreadable"); return null; }
      diagnostics.companyResearchSucceeded += 1;
      let icpFit = matchesIcpCompanyEvidence(`${official.title} ${official.content ?? ""} ${description}`, icp);
      if (!icpFit && groundedFallbackBudget > 0 && withinBudget()) {
        groundedFallbackBudget -= 1;
        icpFit = await groundedCompanyFit(`${official.title}\n${official.content ?? ""}\n${description}`, icp, diagnostics, signal).catch((error) => { if (signal?.aborted) throw error; return false; });
      }
      const value = { official, website, description, icpFit };
      companyResearchCache.set(domainKey, Promise.resolve(value));
      return value;
    })();
    // Store before awaiting so simultaneous candidates share the same provider work.
    companyResearchCache.set(identityKey, pending);
    return pending;
  };

  const prospects: Prospect[] = [];
  const seenLinkedIn = new Set<string>();
  const searchStartedAt = Date.now();
  for (let waveIndex = 0; waveIndex < peopleQueries.length; waveIndex += 1) {
    if (prospects.length >= maxProspects || !withinBudget()) { diagnostics.terminatedBy = prospects.length >= maxProspects ? "requested_target_reached" : "internal_deadline_approached"; break; }
    if (usedQueries.size >= diagnostics.budgets.searchQueries || diagnostics.providerRequests.tavily >= diagnostics.budgets.tavily) { diagnostics.terminatedBy = "provider_or_query_budget_exhausted"; break; }
    const waveQueries = peopleQueries[waveIndex].filter((query) => !usedQueries.has(query)).slice(0, diagnostics.budgets.searchQueries - usedQueries.size);
    if (!waveQueries.length) { diagnostics.terminatedBy = "strategies_exhausted"; break; }
    waveQueries.forEach((query) => usedQueries.add(query));
    diagnostics.wavesStarted += 1;
    const waveRecord = { wave: waveIndex + 1, queries: waveQueries, providerResults: 0, newCanonicalUrls: 0, historicalExcluded: 0, cheapRanked: 0, deepResearchAttempted: 0, newEligibleCandidates: 0, duplicateCandidates: 0, unusedDeepResearchBudgetAfter: deepResearchRemaining, deadlineRemainingMs: 0 };
    diagnostics.waves.push(waveRecord);
    diagnostics.searchQueries += waveQueries.length;
    const waveResults = (await Promise.all(waveQueries.map((query) => tavilySearch(tavilyKey, query, 8, diagnostics, signal).catch((error) => { if (signal?.aborted) throw error; reject(diagnostics, "provider_timeout"); return []; })))).flat();
    waveRecord.providerResults = waveResults.length;
    diagnostics.providerResults += waveResults.length;
    diagnostics.personResults += waveResults.length;
    const newCanonical: string[] = [];
    for (const person of waveResults) {
      const canonical = normalizeLinkedInProfile(person.url);
      if (!canonical) continue;
      const prior = evidenceByCanonical.get(canonical);
      evidenceByCanonical.set(canonical, prior ? { title: [...new Set([prior.title, person.title])].join(" | "), url: canonical, content: [...new Set([prior.content, person.content].filter(Boolean))].join("\n").slice(0, 2400), score: Math.max(Number(prior.score ?? 0), Number(person.score ?? 0)) } : { ...person, url: canonical });
      if (!evaluatedCanonical.has(canonical) && !newCanonical.includes(canonical) && evaluatedCanonical.size + newCanonical.length < diagnostics.budgets.canonicalCandidates) newCanonical.push(canonical);
      else if (evaluatedCanonical.has(canonical)) { diagnostics.rejectedByDedupe += 1; waveRecord.duplicateCandidates += 1; }
    }
    waveRecord.newCanonicalUrls = newCanonical.length;
    diagnostics.canonicalProfileUrls += newCanonical.length;
    diagnostics.rejectionFunnel.canonical_before_historical = (diagnostics.rejectionFunnel.canonical_before_historical ?? 0) + newCanonical.length;
    if (!newCanonical.length) { diagnostics.terminatedBy = "no_materially_new_candidates"; waveRecord.deadlineRemainingMs = Math.max(0, deadlineAt - Date.now()); diagnostics.wavesCompleted += 1; break; }
    let safeCanonical = new Set(newCanonical);
    if (admin && workspaceId) {
      const historyAt = Date.now();
      const placeholders = newCanonical.map((linkedinUrl) => ({ companyName: "", companyWebsite: "", companyDescription: "", contactFirstName: "", contactLastName: "", contactTitle: "", linkedinUrl, evidence: "", confidenceScore: 0, companyFit: "", personFit: "", location: null, sourceConfidence: 0 }));
      safeCanonical = new Set((await excludeHistoricallyUnsafeProspects(admin, workspaceId, accountId, placeholders, diagnostics)).map((item) => item.linkedinUrl));
      diagnostics.timingsMs.historical_exclusion_ms = (diagnostics.timingsMs.historical_exclusion_ms ?? 0) + Date.now() - historyAt;
      waveRecord.historicalExcluded = newCanonical.length - safeCanonical.size;
    }
    newCanonical.forEach((url) => evaluatedCanonical.add(url));
    diagnostics.rejectionFunnel.canonical_after_historical = (diagnostics.rejectionFunnel.canonical_after_historical ?? 0) + safeCanonical.size;
    diagnostics.qualificationStages.provider_linkedin_result = (diagnostics.qualificationStages.provider_linkedin_result ?? 0) + waveResults.length;
    diagnostics.qualificationStages.canonical_url = (diagnostics.qualificationStages.canonical_url ?? 0) + newCanonical.length;
    diagnostics.qualificationStages.historical_safe = (diagnostics.qualificationStages.historical_safe ?? 0) + safeCanonical.size;
    const candidates = newCanonical
      .map((url) => evidenceByCanonical.get(url)!)
      .filter((candidate) => candidate && safeCanonical.has(candidate.url))
      .map((candidate) => ({ candidate, rank: cheapCandidateRank(candidate, roles, geography) }))
      .sort((a, b) => b.rank - a.rank)
      .map(({ candidate }) => candidate);
    waveRecord.cheapRanked = candidates.length;
    const eligibleBefore = prospects.length;
    const reservedForLaterWaves = [4, 2, 0][waveIndex] ?? 0;
    const perWaveDeepResearchLimit = Math.min(deepResearchRemaining, Math.max(0, deepResearchRemaining - reservedForLaterWaves));
    const deepResearchBefore = deepResearchRemaining;
    for (const person of candidates) {
        if (deepResearchBefore - deepResearchRemaining >= perWaveDeepResearchLimit) break;
        if (prospects.length >= maxProspects || !withinBudget() || deepResearchRemaining <= 0) break;
        const linkedinUrl = normalizeLinkedInProfile(person.url);
        if (!linkedinUrl) continue;
        if (!safeCanonical.has(linkedinUrl)) continue;
        pass(diagnostics, "historical_safe_candidate");
        if (seenLinkedIn.has(linkedinUrl)) { diagnostics.rejectedByDedupe += 1; continue; }
        let extracted = deterministicPersonEvidence(person.title, person.content ?? "");
        if ((!extracted || !extracted.company) && groundedFallbackBudget > 0 && withinBudget()) { groundedFallbackBudget -= 1; extracted = await groundedPersonExtraction(person, roles, diagnostics, signal).catch((error) => { if (signal?.aborted) throw error; return null; }); }
        if (!extracted?.firstName || !extracted.lastName) { reject(diagnostics, "missing_person_name"); continue; }
        pass(diagnostics, "person_identity");
        if (!extracted.title) { reject(diagnostics, "missing_current_title"); continue; }
        pass(diagnostics, "current_title");
        if (!extracted.company) { reject(diagnostics, "missing_current_company"); continue; }
        pass(diagnostics, "current_company");
        const parsed = { firstName: extracted.firstName, lastName: extracted.lastName, title: extracted.title };
        const companyName = extracted.company;
        const semanticKey = `${parsed.firstName} ${parsed.lastName}|${companyName}|${parsed.title}`.toLowerCase().replace(/[^a-z0-9|]+/g, " ");
        if (rejectedSemanticKeys.has(semanticKey)) { diagnostics.rejectedByDedupe += 1; waveRecord.duplicateCandidates += 1; continue; }
        if (!matchesIntendedRole(parsed.title, roles) || !isDecisionMakerTitle(parsed.title)) { diagnostics.rejectedByEvidence += 1; reject(diagnostics, isDecisionMakerTitle(parsed.title) ? "role_mismatch" : "insufficient_seniority"); continue; }
        pass(diagnostics, "role_and_seniority");

        deepResearchRemaining -= 1;
        const research = await researchCompany(companyName);
        if (!research) { rejectedSemanticKeys.add(semanticKey); diagnostics.rejectedByEvidence += 1; reject(diagnostics, "official_company_not_found"); continue; }
        pass(diagnostics, "official_company_source");
        const { official, website: companyWebsite, description: companyDescription } = research;
        diagnostics.companyCandidates += 1;
        if (!sameCompanyEvidence(companyName, `${official.title} ${new URL(companyWebsite).hostname}`)) { diagnostics.rejectedByEvidence += 1; reject(diagnostics, "company_person_binding_failure"); continue; }
        pass(diagnostics, "person_company_binding");
        if (!research.icpFit) { diagnostics.rejectedByEvidence += 1; reject(diagnostics, "company_icp_mismatch"); continue; }
        pass(diagnostics, "company_icp_fit");
        const geographyBoost = matchesGeographyEvidence(`${official.title} ${official.content ?? ""} ${companyDescription}`, icp.geography ?? []) ? 0.05 : 0;
        seenLinkedIn.add(linkedinUrl);
        prospects.push({
          companyName,
          companyWebsite,
          companyDescription: companyDescription.slice(0, 3000),
          contactFirstName: parsed.firstName,
          contactLastName: parsed.lastName,
          contactTitle: parsed.title,
          linkedinUrl,
          evidence: `${person.title}. ${person.content ?? ""}`,
          companyFit: `${companyName} has an official source matching the selected ${icp.subIndustry || icp.industry || "company"} ICP.`,
          personFit: `${parsed.firstName} ${parsed.lastName} is source-identified as ${parsed.title} at ${companyName}.`,
          location: extracted.location,
          sourceConfidence: extracted.confidence,
          confidenceScore: Math.max(0.5, Math.min(0.99, 0.5 + Number(person.score ?? 0) * 0.35 + Number(official.score ?? 0) * 0.15 + geographyBoost)),
        });
    }
    waveRecord.newEligibleCandidates = prospects.length - eligibleBefore;
    waveRecord.deepResearchAttempted = deepResearchBefore - deepResearchRemaining;
    waveRecord.unusedDeepResearchBudgetAfter = deepResearchRemaining;
    waveRecord.deadlineRemainingMs = Math.max(0, deadlineAt - Date.now());
    diagnostics.wavesCompleted += 1;
    if (prospects.length >= maxProspects) { diagnostics.terminatedBy = "requested_target_reached"; break; }
    if (!withinBudget()) { diagnostics.terminatedBy = "internal_deadline_approached"; break; }
    if (deepResearchRemaining <= 0) { diagnostics.terminatedBy = "canonical_candidate_budget_exhausted"; break; }
  }
  diagnostics.timingsMs.early_candidate_search_and_history = Date.now() - searchStartedAt;
  const rankedProspects = diversifyProspects(prospects);
  diagnostics.finalCandidates = prospects.length;
  diagnostics.cheapFiltered = evaluatedCanonical.size - diagnostics.historicalExcluded;
  diagnostics.companyCacheMisses = companyCacheMisses.size;
  diagnostics.uniqueCompaniesResearched = companyCacheMisses.size;
  diagnostics.rejectionFunnel.eligible = prospects.length;
  diagnostics.timingsMs.total = Date.now() - startedAt;
  return rankedProspects.slice(0, maxProspects);
}

function discoveryRoleVariants(roles: string[]): string[] {
  const variants: string[] = [];
  for (const role of roles) {
    variants.push(role);
    const normalized = role.toLowerCase();
    if (/vice president|\bvp\b/.test(normalized)) variants.push(role.replace(/vice president(?: of)?/i, "VP"), role.replace(/\bVP\b/i, "Vice President"));
    if (/business development|biz dev/.test(normalized)) variants.push("Head of Business Development", "Business Development Director", "VP Business Development");
    if (/\bsales\b/.test(normalized)) variants.push("Head of Sales", "Sales Director", "Director of Sales", "VP Sales");
    if (/founder|owner|chief executive|\bceo\b/.test(normalized)) variants.push("Founder", "Co-Founder", "CEO");
    if (/revenue|\bcro\b/.test(normalized)) variants.push("Chief Revenue Officer", "CRO");
    if (/managing director|\bmd\b/.test(normalized)) variants.push("Managing Director", "MD");
    if (/head of business development|business development head/.test(normalized)) variants.push("Head of Business Development", "Business Development Head");
  }
  return [...new Set(variants.map((value) => value.trim()).filter(Boolean))];
}

function cheapCandidateRank(candidate: { title: string; content: string; score?: number }, roles: string[], geography: string[]): number {
  const extracted = deterministicPersonEvidence(candidate.title, candidate.content ?? "");
  let rank = Math.max(0, Math.min(1, Number(candidate.score ?? 0))) * 20;
  if (extracted?.firstName && extracted.lastName) rank += 15;
  if (extracted?.title) rank += 15;
  if (extracted?.company) rank += 25;
  if (extracted?.title && matchesIntendedRole(extracted.title, roles)) rank += 15;
  if (extracted?.title && isDecisionMakerTitle(extracted.title)) rank += 10;
  if (geography.length > 0 && matchesGeographyEvidence(`${candidate.title} ${candidate.content ?? ""}`, geography)) rank += 5;
  return rank;
}

function discoveryVerticalVariants(icp: ICP): string[] {
  const saved = [icp.subIndustry, icp.industry, ...(icp.keywords ?? [])].filter(Boolean).join(" ");
  const variants = [icp.subIndustry, icp.industry, ...(icp.keywords ?? [])].filter((value): value is string => Boolean(value?.trim()));
  if (/\b(?:it|information technology|technology|software)\b/i.test(saved)) {
    variants.push("IT services", "IT consulting", "managed IT services", "software development services", "cloud consulting services", "cybersecurity services", "digital transformation services", "systems integration");
  }
  return [...new Set(variants.map((value) => value.trim()).filter(Boolean))].slice(0, 8);
}

function buildDiscoveryWaves(roles: string[], roleVariants: string[], verticals: string[], geography: string[], companySize?: string): string[][] {
  const location = geography.join(" ");
  const vertical = verticals[0] ?? "B2B";
  const primaryVertical = vertical;
  const serviceVerticals = verticals.slice(1).filter(Boolean);

  // Build complementary query strategies - separate recall from precision
  // Wave 1: Precise - exact role + primary industry + geography
  const preciseQueries = roles.slice(0, 2).map((role) => 
    ["site:linkedin.com/in", quoted(role), quoted(primaryVertical), geography.join(" ")].filter(Boolean).join(" ")
  );

  // Wave 2: Role family + broader industry concepts
  const roleFamilies = groupRoleFamily(roleVariants.filter((rv) => !roles.some(r => r.toLowerCase() === rv.toLowerCase())));
  const roleFamilyQueries = roleFamilies.slice(0, 2).flatMap((family) =>
    family.roles.slice(0, 2).map((role) =>
      ["site:linkedin.com/in", quoted(role), quoted(primaryVertical), geography.join(" ")].filter(Boolean).join(" ")
    )
  );

  // Wave 3: Broader industry/service concepts + role family
  const broaderVerticals = serviceVerticals.slice(0, 2).length > 0 
    ? serviceVerticals.slice(0, 2)
    : ["IT services", "technology consulting", "software development", "cloud services"];
  const broaderQueries = broaderVerticals.flatMap((vertical) =>
    roleFamilies.slice(0, 2).flatMap((family) =>
      family.roles.slice(0, 1).map((role) =>
        ["site:linkedin.com/in", quoted(role), quoted(vertical), geography.join(" ")].filter(Boolean).join(" ")
      )
    )
  );

  // Wave 4: Company/service concept + role (for fallback when zero results)
  const conceptQueries = [
    "site:linkedin.com/in " + quoted(roles[0]) + " \"software services\" " + geography.join(" "),
    "site:linkedin.com/in " + quoted(roles[0]) + " \"technology services\" " + geography.join(" "),
    "site:linkedin.com/in " + quoted(roles[0]) + " \"consulting\" " + geography.join(" "),
  ].filter(Boolean);

  return [preciseQueries, expandedRolesQueries(roleVariants, roles, verticals, geography), broaderQueries, conceptQueries].filter((wave) => wave.length > 0);
}

function expandedRolesQueries(roleVariants: string[], roles: string[], verticals: string[], geography: string[]): string[] {
  const vertical = verticals[0] ?? "B2B";
  const location = geography.join(" ");
  const expandedRoles = roleVariants.filter((rv) => !roles.some(r => r.toLowerCase() === rv.toLowerCase())).slice(0, 3);
  return expandedRoles.map((role) =>
    ["site:linkedin.com/in", quoted(role), quoted(verticals[0] ?? "B2B"), geography.join(" ")].filter(Boolean).join(" ")
  );
}

function groupRoleFamily(roleVariants: string[]): { label: string; roles: string[] }[] {
  const families: { label: string; roles: string[] }[] = [];
  const used = new Set<string>();
  
  for (const role of roleVariants) {
    const normalized = role.toLowerCase();
    if (used.has(normalized)) continue;
    
    if (/vice president|\bvp\b|head of|director of/.test(normalized) && /sales|business development|revenue|growth/.test(normalized)) {
      const familyRoles = roleVariants.filter(r => 
        /vice president|\bvp\b|head of|director of/.test(r.toLowerCase()) && 
        /sales|business development|revenue|growth/.test(r.toLowerCase())
      );
      families.push({ label: "sales_bd_leadership", roles: familyRoles });
      familyRoles.forEach(r => used.add(r.toLowerCase()));
    } else if (/founder|ceo|chief executive|owner|principal|partner/.test(normalized)) {
      const familyRoles = roleVariants.filter(r => 
        /founder|ceo|chief executive|owner|principal|partner/.test(r.toLowerCase())
      );
      families.push({ label: "founder_executive", roles: familyRoles });
      familyRoles.forEach(r => used.add(r.toLowerCase()));
    } else if (/cto|chief technology|head of (engineering|technology)|vp engineering|vp technology/.test(normalized)) {
      const familyRoles = roleVariants.filter(r => 
        /cto|chief technology|head of (engineering|technology)|vp engineering|vp technology/.test(r.toLowerCase())
      );
      families.push({ label: "tech_leadership", roles: familyRoles });
      familyRoles.forEach(r => used.add(r.toLowerCase()));
    } else if (!used.has(normalized)) {
      // Unmatched roles go to general leadership
      families.push({ label: "general_leadership", roles: [role] });
      used.add(normalized);
    }
  }
  
  // Add any remaining ungrouped roles
  for (const role of roleVariants) {
    if (!used.has(role.toLowerCase())) {
      families.push({ label: "general_leadership", roles: [role] });
      used.add(role.toLowerCase());
    }
  }
  
  return families;
}

function diversifyProspects(prospects: Prospect[]): Prospect[] {
  const ranked = [...prospects].sort((a, b) => b.confidenceScore - a.confidenceScore);
  const firstByCompany: Prospect[] = [];
  const additional: Prospect[] = [];
  const companies = new Set<string>();
  for (const prospect of ranked) {
    const company = prospect.companyWebsite.toLowerCase();
    if (companies.has(company)) additional.push(prospect);
    else { companies.add(company); firstByCompany.push(prospect); }
  }
  return [...firstByCompany, ...additional];
}

function discoveryEmptyReason(diagnostics: DiscoveryDiagnostics): string {
  if (diagnostics.providerResults === 0) return "The discovery provider returned no search results for this ICP.";
  if (diagnostics.companyCandidates === 0) return "Search results were found, but none were eligible official company sources.";
  if (diagnostics.personResults === 0) return "Company sources were found, but the provider returned no LinkedIn decision-maker results.";
  if (diagnostics.canonicalProfileUrls === 0) return "Decision-maker results were found, but none had canonical LinkedIn profile URLs.";
  if (diagnostics.rejectedByEvidence > 0) return "LinkedIn candidates were found, but company/title evidence was insufficient for safe verification.";
  if (diagnostics.rejectedByDedupe > 0) return "All verified candidates were already present in the discovery set.";
  return "No source-verified prospects passed the complete discovery policy.";
}

function hasEvidenceToken(evidence: string, expected: string, stopWords: string[]): boolean {
  const haystack = evidence.toLowerCase();
  const tokens = expected.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 3 && !stopWords.includes(token));
  return tokens.length > 0 && tokens.some((token) => haystack.includes(token));
}

function reject(diagnostics: DiscoveryDiagnostics, reason: string): void {
  diagnostics.rejectionFunnel[reason] = (diagnostics.rejectionFunnel[reason] ?? 0) + 1;
}

function pass(diagnostics: DiscoveryDiagnostics, gate: string): void {
  diagnostics.qualificationStages[gate] = (diagnostics.qualificationStages[gate] ?? 0) + 1;
}

type PersonEvidence = { firstName: string; lastName: string; title: string; company: string; location: string | null; confidence: number };
function deterministicPersonEvidence(title: string, content: string): PersonEvidence | null {
  const parsed = parseLinkedInTitle(title, "");
  const evidence = `${title} ${content.slice(0, 700)}`;
  const company = companyFromPersonEvidence(title) ?? companyFromPersonEvidence(content.slice(0, 500));
  const location = evidence.match(/(?:Location|based in)[:\s]+([A-Z][A-Za-z .'-]+(?:,\s*[A-Z][A-Za-z .'-]+)?)/i)?.[1]?.trim() ?? null;
  return parsed.firstName && parsed.lastName ? { ...parsed, company: company ?? "", location, confidence: company && parsed.title ? 0.9 : 0.55 } : null;
}

async function groundedPersonExtraction(result: { title: string; url: string; content: string }, roles: string[], diagnostics?: DiscoveryDiagnostics, signal?: AbortSignal): Promise<PersonEvidence | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return null;
  const started = beginProviderCall(diagnostics, "openai");
  const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", signal: combinedSignal(signal, 6000), headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: Deno.env.get("OPENAI_OUTREACH_MODEL") ?? "gpt-4.1-mini", temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Extract only explicitly supported CURRENT person employment facts from supplied search evidence. Never use outside knowledge or infer missing facts. Return JSON {sufficient,first_name,last_name,current_title,current_company,location,supporting_quote,confidence}. If current employment is not explicit, sufficient=false." }, { role: "user", content: JSON.stringify({ canonical_linkedin_url: normalizeLinkedInProfile(result.url), result_title: result.title, result_snippet: result.content.slice(0, 1200), allowed_role_criteria: roles }) }] }) }).then((value) => { completeProviderCall(diagnostics, "openai"); return value; }).catch((error) => { failProviderCall(diagnostics, "openai", signal?.aborted === true); throw error; }).finally(() => recordProviderTiming(diagnostics, "openai", Date.now() - started));
  if (!response.ok) return null;
  try {
    const value = JSON.parse((await response.json()).choices?.[0]?.message?.content ?? "{}");
    if (value.sufficient !== true || Number(value.confidence) < 0.8) return null;
    const fields = [value.first_name, value.last_name, value.current_title, value.current_company];
    if (!fields.every((field) => typeof field === "string" && field.trim())) return null;
    const supplied = `${result.title} ${result.content}`.toLowerCase();
    const supportingQuote = typeof value.supporting_quote === "string" ? value.supporting_quote.trim() : "";
    if (supportingQuote.length < 15 || !supplied.includes(supportingQuote.toLowerCase())) return null;
    if (!fields.every((field) => normalizedEvidenceTokens(String(field)).some((token) => supplied.includes(token)))) return null;
    return { firstName: value.first_name.trim(), lastName: value.last_name.trim(), title: value.current_title.trim(), company: value.current_company.trim(), location: typeof value.location === "string" ? value.location.trim() || null : null, confidence: Math.min(0.99, Number(value.confidence)) };
  } catch { return null; }
}

async function groundedCompanyFit(evidence: string, icp: ICP, diagnostics?: DiscoveryDiagnostics, signal?: AbortSignal): Promise<boolean> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key || evidence.trim().length < 80) return false;
  const started = beginProviderCall(diagnostics, "openai");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", signal: combinedSignal(signal, 6000),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: Deno.env.get("OPENAI_OUTREACH_MODEL") ?? "gpt-4.1-mini", temperature: 0, response_format: { type: "json_object" }, messages: [
      { role: "system", content: "Classify only the supplied official-company evidence against the supplied saved ICP. Do not infer facts. Return JSON {matches:boolean,supporting_quote:string,confidence:number}. A generic word such as technology, digital, business, or software alone is insufficient." },
      { role: "user", content: JSON.stringify({ saved_icp: icp, official_company_evidence: evidence.slice(0, 10000) }) },
    ] }),
  }).then((value) => { completeProviderCall(diagnostics, "openai"); return value; }).catch((error) => { failProviderCall(diagnostics, "openai", signal?.aborted === true); throw error; }).finally(() => recordProviderTiming(diagnostics, "openai", Date.now() - started));
  if (!response.ok) return false;
  try {
    const value = JSON.parse((await response.json()).choices?.[0]?.message?.content ?? "{}");
    const quote = typeof value.supporting_quote === "string" ? value.supporting_quote.trim() : "";
    return value.matches === true && Number(value.confidence) >= 0.85 && quote.length >= 20 && evidence.toLowerCase().includes(quote.toLowerCase());
  } catch { return false; }
}

function matchesIcpCompanyEvidence(evidence: string, icp: ICP): boolean {
  const normalizedEvidence = evidence.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const phrases = [icp.subIndustry, icp.industry, ...(icp.keywords ?? [])]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim())
    .filter((value) => value.split(" ").length >= 2);
  if (phrases.some((phrase) => normalizedEvidence.includes(phrase))) return true;
  const savedIcp = [icp.name, icp.subIndustry, icp.industry, ...(icp.keywords ?? [])].join(" ").toLowerCase();
  if (!/\b(?:it|information technology|software|technology)\b/.test(savedIcp)) return false;
  // Require a service/activity phrase, never a lone generic industry word.
  return [
    /\bmanaged (?:it|technology) services?\b/,
    /\binformation technology (?:consulting|services?|solutions?)\b/,
    /\bit (?:consulting|services?|solutions?|support|infrastructure)\b/,
    /\btechnology (?:consulting|services?|implementation)\b/,
    /\bsoftware (?:development|engineering|consulting|services?)\b/,
    /\bcloud (?:consulting|services?|solutions?|migration|infrastructure)\b/,
    /\bcyber ?security (?:consulting|services?|solutions?)\b/,
    /\b(?:network|systems?|technology) infrastructure services?\b/,
    /\bdigital transformation (?:consulting|services?|solutions?|implementation)?\b/,
    /\b(?:systems?|application) integration services?\b/,
  ].some((pattern) => pattern.test(normalizedEvidence));
}

function normalizedEvidenceTokens(value: string, stopWords: string[] = []): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 3 && !stopWords.includes(token));
}

function sameCompanyEvidence(left: string, right: string): boolean {
  const stopWords = ["the", "group", "solutions", "services", "technologies", "technology", "consulting", "inc", "llc", "ltd"];
  const leftTokens = normalizedEvidenceTokens(left, stopWords);
  const rightTokens = new Set(normalizedEvidenceTokens(right, stopWords));
  if (leftTokens.length > 0 && leftTokens.some((token) => rightTokens.has(token))) return true;
  const acronym = (tokens: string[]) => tokens.map((token) => token[0]).join("");
  const rightTokensList = [...rightTokens];
  return leftTokens.length > 1 && rightTokensList.length > 0 && (rightTokens.has(acronym(leftTokens)) || leftTokens.includes(acronym(rightTokensList)));
}

function isDecisionMakerTitle(title: string): boolean {
  return /\b(owner|founder|co-founder|chief|ceo|president|principal|partner|vice president|vp|director|head|manager)\b/i.test(title);
}

function matchesIntendedRole(title: string, roles: string[]): boolean {
  const normalizedTitle = title.toLowerCase()
    .replace(/\bvice president\b/g, "vp")
    .replace(/\bbiz dev\b/g, "business development")
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  return roles.some((role) => role.split(/\s*(?:\/|,|\bor\b)\s*/i).some((variant) => {
    const normalizedRole = variant.toLowerCase().replace(/\bvice president\b/g, "vp").replace(/\bbiz dev\b/g, "business development");
    const tokens = normalizedEvidenceTokens(normalizedRole, ["of", "and", "the", "head", "manager", "director", "chief", "officer", "vice", "president", "vp", "owner", "founder", "principal", "partner"]);
    return tokens.length > 0 && tokens.every((token) => normalizedTitle.split(" ").includes(token)) && isDecisionMakerTitle(title);
  }));
}

function matchesGeographyEvidence(evidence: string, geography: string[]): boolean {
  if (geography.length === 0) return true;
  const normalized = ` ${evidence.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()} `;
  return geography.some((place) => {
    const expected = place.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
    if (!expected) return false;
    if (normalized.includes(` ${expected} `)) return true;
    if (["united states", "united states of america", "usa", "us"].includes(expected)) return /\b(united states|usa|u s|us)\b/.test(normalized);
    return false;
  });
}

async function excludeHistoricallyUnsafeProspects(
  admin: any,
  workspaceId: string,
  accountId: string | undefined,
  prospects: Prospect[],
  diagnostics = newDiscoveryDiagnostics(),
): Promise<Prospect[]> {
  if (prospects.length === 0) return prospects;
  const targets = new Set(prospects.map((prospect) => prospect.linkedinUrl));
  const unsafe = new Set<string>();
  const checked = async (query: PromiseLike<{ data: any; error: any }>, source: string): Promise<any[]> => {
    const { data, error } = await query;
    if (error) throw pipelineError("historical_exclusion_unavailable", `Could not verify ${source} history; discovery is blocked`, 503);
    return Array.isArray(data) ? data : [];
  };
  const canonical = (value: unknown): string | null => typeof value === "string" ? normalizeLinkedInProfile(value) : null;
  const scopeAccount = (query: any, column: string) => accountId ? query.eq(column, accountId) : query;
  const [contacts, jobs, audits, queues, generations, authorizations] = await Promise.all([
    checked(admin.from("contacts").select("id,normalized_linkedin_url,status").eq("workspace_id", workspaceId).in("normalized_linkedin_url", [...targets]), "contact"),
    checked(scopeAccount(admin.from("linkedin_execution_jobs").select("id,contact_id,action_payload,status").eq("workspace_id", workspaceId), "linkedin_account_id"), "execution job"),
    checked(scopeAccount(admin.from("linkedin_write_audit").select("id,target_identifier,execution_result").eq("workspace_id", workspaceId), "linkedin_account_id"), "write audit"),
    checked(scopeAccount(admin.from("browser_execution_queue").select("id,action_type,action_params,status,result,interaction_crossed").eq("workspace_id", workspaceId), "account_id"), "browser queue"),
    checked(scopeAccount(admin.from("controlled_acceptance_generations").select("id,target_identifier,status").eq("workspace_id", workspaceId), "linkedin_account_id"), "acceptance generation"),
    Deno.env.get("SUPABASE_URL")?.includes("aljpmtuekghwzrnuwkat")
      ? checked(scopeAccount(admin.from("linkedin_production_acceptance_authorizations").select("id,canonical_target_url,status").eq("workspace_id", workspaceId), "linkedin_account_id"), "production acceptance authorization")
      : Promise.resolve([]),
  ]);
  const contactTargets = new Map<string, string>();
  for (const contact of contacts) {
    const target = canonical(contact.normalized_linkedin_url);
    if (target) contactTargets.set(contact.id, target);
    // A persisted contact represents a prior campaign reservation. Reusing it would
    // bypass the canonical campaign/contact and lifetime-write uniqueness controls.
    if (target) unsafe.add(target);
  }
  for (const job of jobs) {
    const target = canonical(job.action_payload?.profile_url ?? job.action_payload?.target_identifier ?? job.action_payload?.linkedin_url) ?? contactTargets.get(job.contact_id);
    if (target && targets.has(target)) unsafe.add(target);
  }
  for (const audit of audits) { const target = canonical(audit.target_identifier); if (target && targets.has(target)) unsafe.add(target); }
  for (const queue of queues) {
    const params = queue.action_params ?? {};
    const target = canonical(params.profile_url ?? params.target_identifier ?? params.linkedin_url);
    if (target && targets.has(target) && queue.action_type !== "linkedin_relationship_check") unsafe.add(target);
  }
  for (const generation of generations) { const target = canonical(generation.target_identifier); if (target && targets.has(target)) unsafe.add(target); }
  for (const authorization of authorizations) {
    const target = canonical(authorization.canonical_target_url);
    if (target && targets.has(target) && !["expired", "revoked", "superseded"].includes(String(authorization.status))) unsafe.add(target);
  }
  diagnostics.historicalExcluded += unsafe.size;
  return prospects.filter((prospect) => !unsafe.has(prospect.linkedinUrl));
}

function companyFromPersonEvidence(evidence: string): string | null {
  const cleaned = evidence.replace(/\s+/g, " ");
  const atMatch = cleaned.match(/\b(?:at|@)\s+([A-Z][A-Za-z0-9&.'’ -]{1,70}?)(?=\s*[|·,]|\s+-\s+|\.|$)/);
  const parts = cleaned.replace(/\s*[|]\s*LinkedIn.*$/i, "").split(/\s+(?:-|–|—)\s+/u).map((part) => part.trim()).filter(Boolean);
  const sourced = parts.length >= 3 ? parts[parts.length - 1] : atMatch?.[1] ?? null;
  if (!sourced) return null;
  const company = sourced.trim().replace(/[,\s]+(?:Inc\.?|Incorporated|Corp\.?|Corporation|LLC|L\.L\.C\.?|Ltd\.?|Limited|Pvt\.?\s+Ltd\.?)$/i, "").trim();
  return company.length >= 2 && company.length <= 70 ? company : null;
}

function dedupeBy<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => { const identity = key(value); if (seen.has(identity)) return false; seen.add(identity); return true; });
}

function quoted(value: string): string {
  return `"${value.replace(/["\\]/g, " ").trim()}"`;
}

async function tavilySearch(apiKey: string, query: string, maxResults: number, diagnostics?: DiscoveryDiagnostics, signal?: AbortSignal): Promise<Array<{ title: string; url: string; content: string; score?: number }>> {
  const started = beginProviderCall(diagnostics, "tavily");
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    signal: combinedSignal(signal, 7000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: "advanced",
      include_answer: false,
    }),
  }).then((value) => { completeProviderCall(diagnostics, "tavily"); return value; }).catch((error) => { failProviderCall(diagnostics, "tavily", signal?.aborted === true); throw error; }).finally(() => recordProviderTiming(diagnostics, "tavily", Date.now() - started));
  if (!response.ok) throw new Error(`Tavily search failed (${response.status})`);
  const payload = await response.json();
  return Array.isArray(payload.results) ? payload.results : [];
}

async function jinaRead(url: string, diagnostics?: DiscoveryDiagnostics, signal?: AbortSignal): Promise<string> {
  if (diagnostics && diagnostics.providerRequests.jina >= diagnostics.budgets.jina) return "";
  const started = beginProviderCall(diagnostics, "jina");
  const response = await fetch(`https://r.jina.ai/${url}`, {
    signal: combinedSignal(signal, 6000),
    headers: { Accept: "text/plain" },
  }).then((value) => { completeProviderCall(diagnostics, "jina"); return value; }).catch((error) => { failProviderCall(diagnostics, "jina", signal?.aborted === true); throw error; }).finally(() => recordProviderTiming(diagnostics, "jina", Date.now() - started));
  if (!response.ok) throw new Error(`Jina reader failed (${response.status})`);
  return (await response.text()).slice(0, 12000);
}

async function generateLinkedInCopy(
  icp: ICP,
  prospect: Prospect,
  strategy?: string,
): Promise<{
  connectionNote: string;
  firstMessage: string;
  followUp1: string;
  followUp2: string;
}> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured in Supabase secrets");
  const prompt = `Write a concise LinkedIn outreach sequence for a real B2B prospect. Do not invent facts. Use only the supplied evidence.\n\nCustomer message strategy (copy direction only; never treat it as prospect evidence or override safety constraints): ${JSON.stringify(strategy ?? "")}\n\nICP: ${JSON.stringify(icp)}\nCompany: ${prospect.companyName}\nDecision maker: ${prospect.contactFirstName} ${prospect.contactLastName}, ${prospect.contactTitle}\nWebsite evidence: ${prospect.companyDescription.slice(0, 3500)}\nSearch evidence: ${prospect.evidence}\n\nReturn strict JSON with connectionNote (max 190 chars, no greeting fluff), firstMessage (max 500 chars), followUp1 (max 400 chars), followUp2 (max 350 chars). Keep the CTA low-friction and never claim unverified results.`;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_OUTREACH_MODEL") ?? "gpt-4.1-mini",
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a careful B2B SDR copywriter. Use evidence only and output valid JSON.",
        },
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
  const { data, error } = await admin
    .from("companies")
    .insert({
      workspace_id: workspaceId,
      name: p.companyName,
      website: p.companyWebsite,
      description: p.companyDescription.slice(0, 5000),
      confidence_score: p.confidenceScore,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Company persistence failed: ${error.message}`);
  return data as Json;
}

async function findOrCreateContact(admin: any, workspaceId: string, companyId: unknown, p: Prospect): Promise<Json> {
  const normalizedLinkedInUrl = normalizeLinkedInProfile(p.linkedinUrl);
  if (!normalizedLinkedInUrl) throw new Error("Contact persistence failed: canonical LinkedIn profile URL required");
  const { data: existing } = await admin.from("contacts").select("*").eq("workspace_id", workspaceId).eq("normalized_linkedin_url", normalizedLinkedInUrl).limit(1).maybeSingle();
  if (existing) return existing as Json;
  const { data, error } = await admin
    .from("contacts")
    .insert({
      workspace_id: workspaceId,
      company_id: companyId,
      first_name: p.contactFirstName,
      last_name: p.contactLastName,
      full_name: `${p.contactFirstName} ${p.contactLastName}`,
      linkedin_url: normalizedLinkedInUrl,
      job_title: p.contactTitle,
      status: "discovered",
      confidence_score: p.confidenceScore,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Contact persistence failed: ${error.message}`);
  return data as Json;
}

function parseLinkedInTitle(raw: string, fallbackTitle: string): { firstName: string; lastName: string; title: string } {
  const cleaned = raw
    .replace(/\|\s*LinkedIn.*$/i, "")
    .replace(/\s+-\s+LinkedIn.*$/i, "")
    .trim();
  const parts = cleaned
    .split(/\s+[–—-]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
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
  } catch {
    return null;
  }
}
function isUsableCompanyUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return !["linkedin.com", "facebook.com", "x.com", "twitter.com", "youtube.com", "wikipedia.org", "crunchbase.com", "glassdoor.com", "builtin.com", "clutch.co", "g2.com", "goodfirms.co", "designrush.com", "indeed.com", "zoominfo.com"].some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
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

  const candidate = title
    .split(/[|–—]/)
    .map((part) => part.replace(/\s+-\s+.*$/, "").trim())
    .find((part) => {
      if (part.length < 2 || part.length > 100) return false;
      if (/\b(top|best|list of|companies to know|company directory|database|market map)\b/i.test(part) || /^\d+\s/.test(part)) return false;
      return part
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .includes(normalizedHost);
    });
  return candidate ? candidate.split(":")[0].trim() : null;
}
function isOfficialCompanyCandidateUrl(value: string, companyName: string): boolean {
  if (!isUsableCompanyUrl(value)) return false;
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "").split(".")[0].replace(/[^a-z0-9]/g, "");
    const tokens = normalizedEvidenceTokens(companyName, ["the", "group", "solutions", "services", "technologies", "technology", "consulting", "inc", "llc", "ltd"]);
    const compact = tokens.join("");
    const acronym = tokens.map((token) => token[0]).join("");
    return tokens.some((token) => token.length >= 3 && host.includes(token)) || (compact.length >= 4 && host.includes(compact)) || (acronym.length >= 3 && host === acronym);
  } catch { return false; }
}

async function readOfficialCompanyEvidence(
  rootUrl: string,
  providerUrl: string,
  providerSnippet: string,
  icp: ICP,
  diagnostics: DiscoveryDiagnostics,
  signal: AbortSignal | undefined,
  withinBudget: () => boolean,
): Promise<string> {
  const root = new URL(rootUrl);
  const sameDomain = (value: string) => {
    try { return new URL(value).hostname.toLowerCase().replace(/^www\./, "") === root.hostname.toLowerCase().replace(/^www\./, ""); }
    catch { return false; }
  };
  const read = async (url: string): Promise<string> => {
    if (!withinBudget()) return "";
    return jinaRead(url, diagnostics, signal).catch((error) => { if (signal?.aborted) throw error; return ""; });
  };
  // A Tavily result on the verified company-controlled domain can itself be
  // sufficient evidence. Avoid making discovery depend on Jina when that
  // attributable evidence already proves the saved-ICP fit.
  if (providerSnippet.trim().length >= 300 && matchesIcpCompanyEvidence(providerSnippet, icp)) return providerSnippet;
  const homepage = await read(rootUrl);
  const initial = [providerSnippet, homepage].filter(Boolean).join("\n");
  if (initial.length >= 300 && matchesIcpCompanyEvidence(initial, icp)) return initial;
  const providerPage = sameDomain(providerUrl) && new URL(providerUrl).pathname !== "/" ? providerUrl : null;
  const fallbackUrls = [...new Set([providerPage, `${rootUrl}/about`, `${rootUrl}/services`, `${rootUrl}/solutions`].filter((value): value is string => Boolean(value)))].slice(0, 2);
  const fallback = await Promise.all(fallbackUrls.map(read));
  const combined = [providerSnippet, homepage, ...fallback].filter(Boolean).join("\n");
  return combined.trim().length >= 120 ? combined : "";
}

function recordProviderTiming(diagnostics: DiscoveryDiagnostics | undefined, provider: string, duration: number): void {
  if (!diagnostics) return;
  diagnostics.slowestCalls.push({ provider, duration_ms: duration });
  diagnostics.slowestCalls.sort((a, b) => b.duration_ms - a.duration_ms);
  diagnostics.slowestCalls = diagnostics.slowestCalls.slice(0, 8);
}

function combinedSignal(requestSignal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  return requestSignal ? AbortSignal.any([requestSignal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
}
function beginProviderCall(diagnostics: DiscoveryDiagnostics | undefined, provider: string): number {
  if (diagnostics) { diagnostics.providerRequests[provider] += 1; diagnostics.providerStats[provider].started += 1; }
  return Date.now();
}
function completeProviderCall(diagnostics: DiscoveryDiagnostics | undefined, provider: string): void {
  if (diagnostics) diagnostics.providerStats[provider].completed += 1;
}
function failProviderCall(diagnostics: DiscoveryDiagnostics | undefined, provider: string, aborted: boolean): void {
  if (!diagnostics) return;
  diagnostics.providerStats[provider][aborted ? "aborted" : "failed"] += 1;
}
function isLikelyCompanySourceUrl(value: string): boolean {
  try {
    const path = new URL(value).pathname.toLowerCase();
    if (/\/(blog|resources?|news|articles?|directory|rankings?|listings?)(\/|$)/.test(path)) return false;
    return path.split("/").filter(Boolean).length <= 2;
  } catch {
    return false;
  }
}
function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function requirementLabel(code: string): string {
  return (
    (
      {
        meaningful_icp: "review the ideal customer profile",
        google_reauthorization: "reconnect Google",
        gmail_authorization: "authorize Gmail",
        calendar_authorization: "authorize Google Calendar",
        linkedin_account_selection: "select a LinkedIn account",
        linkedin_connection: "connect LinkedIn",
        linkedin_session_health: "restore the LinkedIn session",
        linkedin_identity_validation: "confirm the LinkedIn profile identity",
      } as Record<string, string>
    )[code] ?? code
  );
}
function requireString(value: unknown, name: string): string {
  const s = optionalString(value);
  if (!s) throw new Error(`${name} is required`);
  return s;
}
function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}
function json(data: Json, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function googleAuthorization(admin: any, workspaceId: string) {
  const { data, error } = await admin.from("google_accounts").select("id,oauth_tokens!inner(scope,refresh_token)").eq("workspace_id", workspaceId).eq("status", "connected").eq("is_primary", true).limit(1);
  if (error) throw pipelineError("google_authorization_lookup_failed", `Google connection validation failed: ${error.message}`, 500);
  const relation = (data?.[0] as Json | undefined)?.oauth_tokens as Array<Json> | Json | undefined;
  const token = Array.isArray(relation) ? relation[0] : relation;
  const scopes = new Set(
    String(token?.scope ?? "")
      .split(/\s+/)
      .filter(Boolean),
  );
  const connected = Boolean(data?.length && token?.refresh_token);
  return {
    connected,
    gmail: connected && [...scopes].some((scope) => scope.includes("gmail.")),
    calendar: connected && (scopes.has("https://www.googleapis.com/auth/calendar") || scopes.has("https://www.googleapis.com/auth/calendar.events")),
  };
}

function pipelineError(code: string, message: string, status: number): Error {
  return Object.assign(new Error(message), { code, status });
}
function errorCode(error: unknown): string {
  return typeof (error as { code?: unknown })?.code === "string" ? String((error as { code: string }).code) : "pipeline_failed";
}
function errorStatus(error: unknown): number {
  const status = (error as { status?: unknown })?.status;
  return typeof status === "number" ? status : authorizationStatus(error);
}
