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

  let lifecycleCampaignId: string | null = null;
  let lifecycleAdmin: any = null;
  try {
    const body = (await req.json()) as Json;
    const workspaceId = requireString(body.workspace_id, "workspace_id");
    const action = typeof body.action === "string" ? body.action : "launch";
    const { admin } = await authorizeLinkedInWorkspace(req, workspaceId, {
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
      const { data: campaigns, error: campaignsError } = await admin.from("customer_campaigns").select("id").eq("workspace_id", workspaceId).eq("status", "running");
      if (campaignsError) throw pipelineError("campaign_lookup_failed", `Campaign validation failed: ${campaignsError.message}`, 500);
      let reconciled = 0;
      for (const campaign of campaigns ?? []) {
        const { data: jobs, error: jobsError } = await admin.from("linkedin_execution_jobs").select("id,status").eq("workspace_id", workspaceId).contains("action_payload", { source_campaign_id: campaign.id });
        if (jobsError) throw pipelineError("campaign_job_lookup_failed", `Campaign execution validation failed: ${jobsError.message}`, 500);
        if (!jobs?.length || jobs.some((job) => ["queued", "retry", "running", "pending"].includes(job.status))) continue;
        if (jobs.every((job) => job.status === "failed")) {
          const { error: updateError } = await admin
            .from("customer_campaigns")
            .update({
              status: "failed",
              status_reason: "No LinkedIn action was completed. Review the prospect status before retrying.",
              failure_code: "execution_failed",
              blocker: "Campaign prospect requires attention",
              updated_at: new Date().toISOString(),
            })
            .eq("workspace_id", workspaceId)
            .eq("id", campaign.id);
          if (updateError) throw pipelineError("campaign_reconciliation_failed", `Campaign reconciliation failed: ${updateError.message}`, 500);
          reconciled += 1;
        }
      }
      return json({
        ok: true,
        status: "reconciled",
        campaigns_reconciled: reconciled,
      });
    }

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

    if (action === "check_acceptance_eligibility") {
      const campaignId = requireString(body.campaign_id, "campaign_id");
      const contactId = requireString(body.contact_id, "contact_id");
      const { data: campaign } = await admin.from("customer_campaigns").select("linkedin_account_id").eq("id", campaignId).eq("workspace_id", workspaceId).maybeSingle();
      const { data: contact } = await admin.from("contacts").select("linkedin_url").eq("id", contactId).eq("workspace_id", workspaceId).maybeSingle();
      const target = contact?.linkedin_url ? normalizeLinkedInProfile(contact.linkedin_url) : null;
      let eligible = false;
      if (campaign && target) {
        const { data: allowed } = await admin.from("linkedin_safe_write_targets").select("id").eq("workspace_id", workspaceId).eq("linkedin_account_id", campaign.linkedin_account_id).eq("project_ref", "vdiqfiuqckaxdjkadinu").eq("target_identifier", target).eq("enabled", true).contains("allowed_action_types", ["connection_request"]).maybeSingle();
        eligible = Boolean(allowed);
      }
      return json({ eligible, normalized_linkedin_url: target });
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
          status: "selected", confidence_score: 1,
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

    if (action === "prepare_controlled_acceptance") {
      const campaignId = requireString(body.campaign_id, "campaign_id");
      const contactId = requireString(body.contact_id, "contact_id");
      const { data: campaign, error: campaignError } = await admin.from("customer_campaigns").select("id,linkedin_account_id,outreach_timezone,operating_days,operating_hours").eq("id", campaignId).eq("workspace_id", workspaceId).maybeSingle();
      if (campaignError || !campaign) throw pipelineError("campaign_not_found", "Campaign was not found in this workspace", 404);
      if (!campaign.outreach_timezone) throw pipelineError("outreach_timezone_required", "Configure outreach timezone before preparing acceptance", 409);
      const { data: contact, error: contactError } = await admin.from("contacts").select("id,company_id,linkedin_url").eq("id", contactId).eq("workspace_id", workspaceId).maybeSingle();
      if (contactError || !contact?.linkedin_url) throw pipelineError("acceptance_contact_required", "Select a workspace prospect with a LinkedIn profile", 409);
      const { data: association } = await admin.from("customer_campaign_contacts").select("id").eq("customer_campaign_id", campaignId).eq("contact_id", contactId).eq("workspace_id", workspaceId).maybeSingle();
      if (!association) throw pipelineError("campaign_prospect_required", "Associate this workspace prospect with the campaign before preparing acceptance", 409);
      const target = normalizeLinkedInProfile(contact.linkedin_url);
      const { data: allowed } = await admin.from("linkedin_safe_write_targets").select("id").eq("workspace_id", workspaceId).eq("linkedin_account_id", campaign.linkedin_account_id).eq("project_ref", "vdiqfiuqckaxdjkadinu").eq("target_identifier", target).eq("enabled", true).contains("allowed_action_types", ["connection_request"]).maybeSingle();
      if (!allowed) throw pipelineError("unsafe_target", "The selected prospect is not authorized for the staging acceptance write", 409);
      const { data: existingAcceptance } = await admin.from("linkedin_execution_jobs").select("id,status").eq("workspace_id", workspaceId).contains("action_payload", { acceptance_test_mode: true }).limit(1).maybeSingle();
      if (existingAcceptance)
        return json({
          status: "prepared",
          job_id: existingAcceptance.id,
          job_status: existingAcceptance.status,
          exactly_one_write_cap: true,
          write_performed: false,
        });
      const { data: scheduledAt } = await admin.rpc("next_campaign_outreach_at", { p_campaign_id: campaignId, p_not_before: new Date().toISOString() });
      if (!scheduledAt) throw pipelineError("invalid_campaign_schedule", "Configure valid campaign operating days and hours", 409);
      const { data: job, error: jobError } = await admin
        .from("linkedin_execution_jobs")
        .insert({
          workspace_id: workspaceId,
          linkedin_account_id: campaign.linkedin_account_id,
          company_id: contact.company_id,
          contact_id: contact.id,
          action_type: "connection_request",
          status: "scheduled",
          scheduled_at: scheduledAt,
          priority: 1,
          sequence_step: -1,
          action_payload: {
            source_campaign_id: campaignId,
            profile_url: target,
            acceptance_test_mode: true,
          },
        })
        .select("id,status,scheduled_at")
        .single();
      if (jobError) throw pipelineError("acceptance_preparation_failed", `Controlled acceptance could not be prepared: ${jobError.message}`, 500);
      return json({
        status: "prepared",
        job_id: job.id,
        job_status: job.status,
        scheduled_at: job.scheduled_at,
        exactly_one_write_cap: true,
        write_performed: false,
      });
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
      }

      const prospects = await discoverVerifiedProspects(icp, maxProspects);
      if (prospects.length === 0) {
        throw new Error("No verifiable LinkedIn decision makers were discovered for the selected ICP");
      }

      const createdJobs: string[] = [];
      const createdContacts: string[] = [];
      const skippedExistingContacts: string[] = [];
      let completedExistingJobs = 0;

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
        const finalReason = bridgeFailures.length ? "Some outreach jobs could not be queued. Retry after reviewing the campaign." : hasRunnableOutreach ? "Outreach is running in the background." : "No new eligible prospects were available for outreach.";
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

async function discoverVerifiedProspects(icp: ICP, maxProspects: number): Promise<Prospect[]> {
  const tavilyKey = Deno.env.get("TAVILY_API_KEY");
  if (!tavilyKey) throw new Error("TAVILY_API_KEY is not configured in Supabase secrets");

  const roles = (icp.jobTitles?.length ? icp.jobTitles : ["CEO", "Founder", "VP Sales", "Head of Sales"]).slice(0, 4);
  const companyQuery = [icp.industry ? `${icp.industry} companies` : "B2B companies", icp.companySize ? `${icp.companySize} employees` : "", icp.description ?? "", "official company website -top -best -list -directory -database"].filter(Boolean).join(" ");
  const companyResults = await tavilySearch(tavilyKey, companyQuery, Math.max(10, maxProspects * 3));
  const companyCandidates = companyResults.filter((r) => isUsableCompanyUrl(r.url)).slice(0, Math.max(8, maxProspects * 2));

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
        confidenceScore: Math.max(0.5, Math.min(0.99, 0.5 + Number(candidate.score ?? 0) * 0.2 + Number(match.score ?? 0) * 0.3)),
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
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: "advanced",
      include_answer: false,
    }),
  });
  if (!response.ok) throw new Error(`Tavily search failed (${response.status})`);
  const payload = await response.json();
  return Array.isArray(payload.results) ? payload.results : [];
}

async function jinaRead(url: string): Promise<string> {
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: "text/plain" },
  });
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
  const { data: existing } = await admin.from("contacts").select("*").eq("workspace_id", workspaceId).eq("linkedin_url", p.linkedinUrl).limit(1).maybeSingle();
  if (existing) return existing as Json;
  const { data, error } = await admin
    .from("contacts")
    .insert({
      workspace_id: workspaceId,
      company_id: companyId,
      first_name: p.contactFirstName,
      last_name: p.contactLastName,
      full_name: `${p.contactFirstName} ${p.contactLastName}`,
      linkedin_url: p.linkedinUrl,
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
    return !["linkedin.com", "facebook.com", "x.com", "twitter.com", "youtube.com", "wikipedia.org", "crunchbase.com", "glassdoor.com"].some((d) => host === d || host.endsWith(`.${d}`));
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
  if (!candidate) return null;
  return candidate;
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
