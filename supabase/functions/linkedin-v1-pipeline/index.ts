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
  rejectionFunnel: Record<string, number>;
  timingsMs: Record<string, number>;
  providerRequests: Record<string, number>;
  slowestCalls: Array<{ provider: string; duration_ms: number }>;
  cheapFiltered: number;
  deeplyResearched: number;
  companyCacheHits: number;
  internalDeadlineMs: number;
};

const newDiscoveryDiagnostics = (): DiscoveryDiagnostics => ({ searchQueries: 0, providerResults: 0, companyCandidates: 0, companyResearchSucceeded: 0, companyResearchFailed: 0, personResults: 0, canonicalProfileUrls: 0, rejectedByEvidence: 0, rejectedByIdentityParsing: 0, rejectedByDedupe: 0, finalCandidates: 0, historicalExcluded: 0, rejectionFunnel: {}, timingsMs: {}, providerRequests: { tavily: 0, jina: 0, openai: 0 }, slowestCalls: [], cheapFiltered: 0, deeplyResearched: 0, companyCacheHits: 0, internalDeadlineMs: 42000 });

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
      const discovered = await discoverVerifiedProspects(icp, maxProspects, diagnostics);
      const historyStarted = Date.now();
      const prospects = await excludeHistoricallyUnsafeProspects(admin, workspaceId, accountId, discovered, diagnostics);
      diagnostics.timingsMs.historical_exclusion = Date.now() - historyStarted;
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

    if (action === "initialize") {
      const icp = (body.icp ?? {}) as ICP;
      const selectedAccountId = optionalString(body.linkedin_account_id);
      const campaignInput = (body.campaign ?? {}) as Json;
      const sourceCampaignId = optionalString(campaignInput.source_campaign_id);
      const initializationKey = optionalString(campaignInput.initialization_key);
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
      if (typeof campaignInput.name === "string" && campaignInput.name.trim()) {
        const initializationKey = optionalString(campaignInput.initialization_key);
        const campaignRow = {
          workspace_id: workspaceId,
          name: campaignInput.name.trim(),
          icp: icp,
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
      if (reviewedTargets.length === 0) {
        throw pipelineError("reviewed_prospects_required", "Review source-verified prospects before launching the campaign", 409);
      }
      const reviewedTargetSet = new Set(reviewedTargets);
      const safeProspects = await excludeHistoricallyUnsafeProspects(admin, workspaceId, account.id, await discoverVerifiedProspects(icp, maxProspects));
      const prospects = safeProspects
        .filter((prospect) => reviewedTargetSet.has(prospect.linkedinUrl));
      if (prospects.length === 0) {
        throw pipelineError("reviewed_prospects_not_revalidated", "The reviewed prospects could not be revalidated from current source evidence. Discover and review again before launch", 409);
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
        const copy = await generateLinkedInCopy(icp, prospect);

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
          { type: "first_message", delay_hours: 0, message: copy.firstMessage },
          { type: "follow_up", delay_hours: 72, message: copy.followUp1 },
          { type: "follow_up", delay_hours: 96, message: copy.followUp2 },
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
              note: copy.connectionNote,
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

async function discoverVerifiedProspects(icp: ICP, maxProspects: number, diagnostics = newDiscoveryDiagnostics()): Promise<Prospect[]> {
  const startedAt = Date.now();
  const deadlineAt = startedAt + diagnostics.internalDeadlineMs;
  const withinBudget = () => Date.now() < deadlineAt - 2500;
  const tavilyKey = Deno.env.get("TAVILY_API_KEY");
  if (!tavilyKey) throw new Error("TAVILY_API_KEY is not configured in Supabase secrets");

  const roles = (icp.jobTitles?.length ? icp.jobTitles : ["CEO", "Founder", "VP Sales", "Head of Sales"]).filter(Boolean).slice(0, 4);
  const geography = (icp.geography ?? []).filter(Boolean).slice(0, 2).join(" ");
  const companyTerms = [icp.subIndustry, ...(icp.keywords ?? []).slice(0, 2)].filter(Boolean).join(" ");
  const companyQueries = [...new Set([
    [quoted(icp.subIndustry || icp.industry || icp.name || "B2B"), geography, "company official website"].filter(Boolean).join(" "),
    [quoted(icp.industry || icp.name || "B2B companies"), icp.companySize ? `${icp.companySize} employees` : "", geography, "official site"].filter(Boolean).join(" "),
    [quoted(icp.name || icp.subIndustry || icp.industry || "B2B"), companyTerms, geography, "official website"].filter(Boolean).join(" "),
  ])].slice(0, 3);
  const companyResults: Array<{ title: string; url: string; content: string; score?: number }> = [];
  const initialSearchAt = Date.now();
  const initialSearches = await Promise.all(companyQueries.map((query) => tavilySearch(tavilyKey, query, Math.max(8, maxProspects * 2), diagnostics).catch(() => { reject(diagnostics, "provider_timeout"); return []; })));
  for (const results of initialSearches) {
    diagnostics.searchQueries += 1;
    diagnostics.providerResults += results.length;
    companyResults.push(...results);
  }
  diagnostics.timingsMs.initial_search = Date.now() - initialSearchAt;
  const companyCandidates = dedupeBy(companyResults.filter((r) => isUsableCompanyUrl(r.url) && isLikelyCompanySourceUrl(r.url)), (result) => rootWebsite(result.url)).slice(0, 4);
  diagnostics.companyCandidates = companyCandidates.length;

  const prospects: Prospect[] = [];
  const seenLinkedIn = new Set<string>();
  // Keep preview comfortably below the Edge request deadline. Deterministic
  // extraction remains primary; only the two strongest unresolved results may
  // use the grounded model fallback.
  let aiExtractionBudget = 2;
  for (const candidate of companyCandidates) {
    if (prospects.length >= maxProspects || !withinBudget()) { if (!withinBudget()) reject(diagnostics, "internal_deadline_reached"); break; }
    const rootUrl = rootWebsite(candidate.url);
    diagnostics.deeplyResearched += 1;
    const websiteText = await jinaRead(rootUrl, diagnostics).then((value) => { diagnostics.companyResearchSucceeded += 1; return value; }).catch(() => { diagnostics.companyResearchFailed += 1; reject(diagnostics, "official_company_unreadable"); return candidate.content ?? ""; });
    if (!matchesIcpCompanyEvidence(`${candidate.title} ${candidate.content ?? ""} ${websiteText}`, icp)) { diagnostics.rejectedByEvidence += 1; reject(diagnostics, "company_icp_mismatch"); continue; }
    const companyName = cleanCompanyName(candidate.title, new URL(rootUrl).hostname);
    if (!companyName) continue;

    for (const role of roles) {
      if (prospects.length >= maxProspects) break;
      diagnostics.searchQueries += 1;
      if (!withinBudget()) { reject(diagnostics, "internal_deadline_reached"); break; }
      const people = await tavilySearch(tavilyKey, `site:linkedin.com/in \"${companyName}\" \"${role}\"`, 6, diagnostics).catch(() => { reject(diagnostics, "provider_timeout"); return []; });
      diagnostics.providerResults += people.length;
      diagnostics.personResults += people.length;
      const matches = people.filter((r) => {
        const normalized = normalizeLinkedInProfile(r.url);
        if (!normalized) return false;
        diagnostics.canonicalProfileUrls += 1;
        if (seenLinkedIn.has(normalized)) { diagnostics.rejectedByDedupe += 1; return false; }
        const evidence = `${r.title} ${r.content}`;
        const sourcedHeadline = parseLinkedInTitle(r.title, "").title;
        const accepted = Boolean(sourcedHeadline) && hasEvidenceToken(evidence, companyName, ["the", "group", "solutions", "services", "technologies", "technology", "consulting"]) && matchesIntendedRole(sourcedHeadline, [role]);
        if (!accepted) { diagnostics.rejectedByEvidence += 1; reject(diagnostics, sourcedHeadline ? "role_mismatch" : "missing_current_title"); }
        return accepted;
      }).sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0));
      const match = matches[0];
      if (!match) continue;
      const linkedinUrl = normalizeLinkedInProfile(match.url);
      if (!linkedinUrl) continue;
      let extracted = deterministicPersonEvidence(match.title, match.content ?? "");
      if ((!extracted || !extracted.company) && aiExtractionBudget-- > 0 && withinBudget()) extracted = await groundedPersonExtraction(match, roles, diagnostics).catch(() => null);
      if (!extracted?.firstName || !extracted.lastName) { reject(diagnostics, "missing_person_name"); continue; }
      if (!extracted.title) { reject(diagnostics, "missing_current_title"); continue; }
      if (!extracted.company) { reject(diagnostics, "missing_current_company"); continue; }
      const parsed = { firstName: extracted.firstName, lastName: extracted.lastName, title: extracted.title };
      const sourcedCompany = extracted.company;
      if (!isDecisionMakerTitle(parsed.title) || !sameCompanyEvidence(sourcedCompany, companyName)) {
        reject(diagnostics, !isDecisionMakerTitle(parsed.title) ? "insufficient_seniority" : "company_person_binding_failure");
        continue;
      }
      if (!matchesIntendedRole(parsed.title, roles)) { reject(diagnostics, "title_role_mismatch"); continue; }
      const geographyBoost = matchesGeographyEvidence(`${candidate.title} ${candidate.content ?? ""} ${websiteText}`, icp.geography ?? []) ? 0.05 : 0;
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
        companyFit: `${companyName} has an official source matching the selected ${icp.subIndustry || icp.industry || "company"} ICP.`,
        personFit: `${parsed.firstName} ${parsed.lastName} is source-identified as ${parsed.title} at ${sourcedCompany}.`,
        location: extracted.location,
        sourceConfidence: extracted.confidence,
        confidenceScore: Math.max(0.5, Math.min(0.99, 0.45 + Number(candidate.score ?? 0) * 0.2 + Number(match.score ?? 0) * 0.35 + geographyBoost)),
      });
      break;
    }
  }
  if (prospects.length < maxProspects) {
    const peopleQueries = roles.slice(0, 3).map((role) => [
      "site:linkedin.com/in",
      `\"${role}\"`,
      `\"${icp.subIndustry || icp.industry || icp.name || "B2B"}\"`,
      geography,
    ].filter(Boolean).join(" "));
    for (const query of peopleQueries) {
      if (prospects.length >= maxProspects || !withinBudget()) break;
      diagnostics.searchQueries += 1;
      const people = await tavilySearch(tavilyKey, query, 8, diagnostics).catch(() => { reject(diagnostics, "provider_timeout"); return []; });
      diagnostics.providerResults += people.length;
      diagnostics.personResults += people.length;
      for (const person of people.sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0)).slice(0, 4)) {
        if (prospects.length >= maxProspects) break;
        const linkedinUrl = normalizeLinkedInProfile(person.url);
        if (!linkedinUrl) continue;
        diagnostics.canonicalProfileUrls += 1;
        if (seenLinkedIn.has(linkedinUrl)) { diagnostics.rejectedByDedupe += 1; continue; }
        let extracted = deterministicPersonEvidence(person.title, person.content ?? "");
        if ((!extracted || !extracted.company) && aiExtractionBudget-- > 0 && withinBudget()) extracted = await groundedPersonExtraction(person, roles, diagnostics).catch(() => null);
        if (!extracted?.firstName || !extracted.lastName) { reject(diagnostics, "missing_person_name"); continue; }
        if (!extracted.title) { reject(diagnostics, "missing_current_title"); continue; }
        if (!extracted.company) { reject(diagnostics, "missing_current_company"); continue; }
        const parsed = { firstName: extracted.firstName, lastName: extracted.lastName, title: extracted.title };
        const companyName = extracted.company;
        if (!matchesIntendedRole(parsed.title, roles) || !isDecisionMakerTitle(parsed.title)) { diagnostics.rejectedByEvidence += 1; reject(diagnostics, isDecisionMakerTitle(parsed.title) ? "role_mismatch" : "insufficient_seniority"); continue; }

        diagnostics.searchQueries += 1;
        const officialResults = await tavilySearch(tavilyKey, `\"${companyName}\" official company website`, 5, diagnostics).catch(() => { reject(diagnostics, "provider_timeout"); return []; });
        diagnostics.providerResults += officialResults.length;
        const official = officialResults.find((result) => isUsableCompanyUrl(result.url) && hasEvidenceToken(`${result.title} ${result.content} ${new URL(result.url).hostname}`, companyName, ["the", "group", "solutions", "services", "technologies", "technology", "consulting"]));
        if (!official) { diagnostics.rejectedByEvidence += 1; reject(diagnostics, "official_company_not_found"); continue; }
        const companyWebsite = rootWebsite(official.url);
        diagnostics.deeplyResearched += 1;
        const companyDescription = await jinaRead(companyWebsite, diagnostics).then((value) => { diagnostics.companyResearchSucceeded += 1; return value; }).catch(() => { diagnostics.companyResearchFailed += 1; reject(diagnostics, "official_company_unreadable"); return official.content ?? ""; });
        if (!matchesIcpCompanyEvidence(`${official.title} ${official.content ?? ""} ${companyDescription}`, icp)) { diagnostics.rejectedByEvidence += 1; reject(diagnostics, "company_icp_mismatch"); continue; }
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
    }
  }
  prospects.sort((a, b) => b.confidenceScore - a.confidenceScore);
  diagnostics.finalCandidates = prospects.length;
  diagnostics.cheapFiltered = diagnostics.canonicalProfileUrls;
  diagnostics.rejectionFunnel.eligible = prospects.length;
  diagnostics.timingsMs.total = Date.now() - startedAt;
  return prospects.slice(0, maxProspects);
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

type PersonEvidence = { firstName: string; lastName: string; title: string; company: string; location: string | null; confidence: number };
function deterministicPersonEvidence(title: string, content: string): PersonEvidence | null {
  const parsed = parseLinkedInTitle(title, "");
  const evidence = `${title} ${content.slice(0, 700)}`;
  const company = companyFromPersonEvidence(title) ?? companyFromPersonEvidence(content.slice(0, 500));
  const location = evidence.match(/(?:Location|based in)[:\s]+([A-Z][A-Za-z .'-]+(?:,\s*[A-Z][A-Za-z .'-]+)?)/i)?.[1]?.trim() ?? null;
  return parsed.firstName && parsed.lastName ? { ...parsed, company: company ?? "", location, confidence: company && parsed.title ? 0.9 : 0.55 } : null;
}

async function groundedPersonExtraction(result: { title: string; url: string; content: string }, roles: string[], diagnostics?: DiscoveryDiagnostics): Promise<PersonEvidence | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return null;
  diagnostics && (diagnostics.providerRequests.openai += 1); const started = Date.now();
  const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", signal: AbortSignal.timeout(6000), headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: Deno.env.get("OPENAI_OUTREACH_MODEL") ?? "gpt-4.1-mini", temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Extract only explicitly supported CURRENT person employment facts from supplied search evidence. Never use outside knowledge or infer missing facts. Return JSON {sufficient,first_name,last_name,current_title,current_company,location,supporting_quote,confidence}. If current employment is not explicit, sufficient=false." }, { role: "user", content: JSON.stringify({ canonical_linkedin_url: normalizeLinkedInProfile(result.url), result_title: result.title, result_snippet: result.content.slice(0, 1200), allowed_role_criteria: roles }) }] }) }).finally(() => recordProviderTiming(diagnostics, "openai", Date.now() - started));
  if (!response.ok) return null;
  try {
    const value = JSON.parse((await response.json()).choices?.[0]?.message?.content ?? "{}");
    if (value.sufficient !== true || Number(value.confidence) < 0.8) return null;
    const fields = [value.first_name, value.last_name, value.current_title, value.current_company];
    if (!fields.every((field) => typeof field === "string" && field.trim())) return null;
    const supplied = `${result.title} ${result.content}`.toLowerCase();
    if (!fields.every((field) => normalizedEvidenceTokens(String(field)).some((token) => supplied.includes(token)))) return null;
    return { firstName: value.first_name.trim(), lastName: value.last_name.trim(), title: value.current_title.trim(), company: value.current_company.trim(), location: typeof value.location === "string" ? value.location.trim() || null : null, confidence: Math.min(0.99, Number(value.confidence)) };
  } catch { return null; }
}

function matchesIcpCompanyEvidence(evidence: string, icp: ICP): boolean {
  const normalizedEvidence = evidence.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const phrases = [icp.subIndustry, icp.industry, ...(icp.keywords ?? [])]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim())
    .filter((value) => value.split(" ").length >= 2);
  return phrases.some((phrase) => normalizedEvidence.includes(phrase));
}

function normalizedEvidenceTokens(value: string, stopWords: string[] = []): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 3 && !stopWords.includes(token));
}

function sameCompanyEvidence(left: string, right: string): boolean {
  const stopWords = ["the", "group", "solutions", "services", "technologies", "technology", "consulting", "inc", "llc", "ltd"];
  const leftTokens = normalizedEvidenceTokens(left, stopWords);
  const rightTokens = new Set(normalizedEvidenceTokens(right, stopWords));
  return leftTokens.length > 0 && leftTokens.some((token) => rightTokens.has(token));
}

function isDecisionMakerTitle(title: string): boolean {
  return /\b(owner|founder|co-founder|chief|ceo|president|principal|partner|vice president|vp|director|head|manager)\b/i.test(title);
}

function matchesIntendedRole(title: string, roles: string[]): boolean {
  const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  return roles.some((role) => role.split(/\s*(?:\/|,|\bor\b)\s*/i).some((variant) => {
    const tokens = normalizedEvidenceTokens(variant, ["of", "and", "the", "head", "manager", "director", "chief", "officer", "vice", "president", "vp", "owner", "founder", "principal", "partner"]);
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
  accountId: string,
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
  const [contacts, jobs, audits, queues, generations, authorizations] = await Promise.all([
    checked(admin.from("contacts").select("id,normalized_linkedin_url,status").eq("workspace_id", workspaceId).in("normalized_linkedin_url", [...targets]), "contact"),
    checked(admin.from("linkedin_execution_jobs").select("id,contact_id,action_payload,status").eq("workspace_id", workspaceId).eq("linkedin_account_id", accountId), "execution job"),
    checked(admin.from("linkedin_write_audit").select("id,target_identifier,execution_result").eq("workspace_id", workspaceId).eq("linkedin_account_id", accountId), "write audit"),
    checked(admin.from("browser_execution_queue").select("id,action_type,action_params,status,result,interaction_crossed").eq("workspace_id", workspaceId).eq("account_id", accountId), "browser queue"),
    checked(admin.from("controlled_acceptance_generations").select("id,target_identifier,status").eq("workspace_id", workspaceId).eq("linkedin_account_id", accountId), "acceptance generation"),
    checked(admin.from("linkedin_production_acceptance_authorizations").select("id,canonical_target_url,status").eq("workspace_id", workspaceId).eq("linkedin_account_id", accountId), "production acceptance authorization"),
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
  const company = sourced.trim().replace(/\s+(?:Inc\.?|LLC|Ltd\.?|Limited)$/i, "").trim();
  return company.length >= 2 && company.length <= 70 ? company : null;
}

function dedupeBy<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => { const identity = key(value); if (seen.has(identity)) return false; seen.add(identity); return true; });
}

function quoted(value: string): string {
  return `"${value.replace(/["\\]/g, " ").trim()}"`;
}

async function tavilySearch(apiKey: string, query: string, maxResults: number, diagnostics?: DiscoveryDiagnostics): Promise<Array<{ title: string; url: string; content: string; score?: number }>> {
  diagnostics && (diagnostics.providerRequests.tavily += 1); const started = Date.now();
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    signal: AbortSignal.timeout(7000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: "advanced",
      include_answer: false,
    }),
  }).finally(() => recordProviderTiming(diagnostics, "tavily", Date.now() - started));
  if (!response.ok) throw new Error(`Tavily search failed (${response.status})`);
  const payload = await response.json();
  return Array.isArray(payload.results) ? payload.results : [];
}

async function jinaRead(url: string, diagnostics?: DiscoveryDiagnostics): Promise<string> {
  diagnostics && (diagnostics.providerRequests.jina += 1); const started = Date.now();
  const response = await fetch(`https://r.jina.ai/${url}`, {
    signal: AbortSignal.timeout(6000),
    headers: { Accept: "text/plain" },
  }).finally(() => recordProviderTiming(diagnostics, "jina", Date.now() - started));
  if (!response.ok) throw new Error(`Jina reader failed (${response.status})`);
  return (await response.text()).slice(0, 12000);
}

async function generateLinkedInCopy(
  icp: ICP,
  prospect: Prospect,
): Promise<{
  connectionNote: string;
  firstMessage: string;
  followUp1: string;
  followUp2: string;
}> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured in Supabase secrets");
  const prompt = `Write a concise LinkedIn outreach sequence for a real B2B prospect. Do not invent facts. Use only the supplied evidence.\n\nICP: ${JSON.stringify(icp)}\nCompany: ${prospect.companyName}\nDecision maker: ${prospect.contactFirstName} ${prospect.contactLastName}, ${prospect.contactTitle}\nWebsite evidence: ${prospect.companyDescription.slice(0, 3500)}\nSearch evidence: ${prospect.evidence}\n\nReturn strict JSON with connectionNote (max 190 chars, no greeting fluff), firstMessage (max 500 chars), followUp1 (max 400 chars), followUp2 (max 350 chars). Keep the CTA low-friction and never claim unverified results.`;
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

function recordProviderTiming(diagnostics: DiscoveryDiagnostics | undefined, provider: string, duration: number): void {
  if (!diagnostics) return;
  diagnostics.slowestCalls.push({ provider, duration_ms: duration });
  diagnostics.slowestCalls.sort((a, b) => b.duration_ms - a.duration_ms);
  diagnostics.slowestCalls = diagnostics.slowestCalls.slice(0, 8);
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
