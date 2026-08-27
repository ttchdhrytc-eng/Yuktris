import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decideLinkedInNextAction } from './linkedin-ai-handoff.js';
import { LINKEDIN_WRITE_ACTIONS, normalizeLinkedInTarget, targetForWrite } from './linkedin-execution-safety.js';
import { resolveLinkedInSelfIdentity, verifyBoundLinkedInIdentity } from './linkedin.js';

const worker = readFileSync(resolve(process.cwd(), 'src/worker.ts'), 'utf8');
const safety = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260814220000_linkedin_execution_write_safety.sql'), 'utf8');
const replies = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260811100000_linkedin_followup_reply_loop.sql'), 'utf8');
const meeting = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260814221000_linkedin_meeting_event_idempotency.sql'), 'utf8');
const digestFix = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260815100000_fix_linkedin_write_preflight_digest.sql'), 'utf8');
const acceptanceOverride = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260815110000_linkedin_one_time_acceptance_override.sql'), 'utf8');
const writeAcceptancePurpose = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260816090000_controlled_write_acceptance_purpose.sql'), 'utf8');
const authoritativeSchedule = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260821090000_authoritative_campaign_outreach_schedule.sql'), 'utf8');
const effectiveSchedule = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260821213000_linkedin_effective_sending_window.sql'), 'utf8');
const acceptanceGenerations = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260822113000_controlled_acceptance_generations.sql'), 'utf8');
const acceptanceClassificationFix = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260826053000_fix_controlled_acceptance_relationship_classification.sql'), 'utf8');
const acceptanceServiceRoleFix = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260826053100_controlled_acceptance_service_role_compatibility.sql'), 'utf8');
const campaignAuthorityRestore = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260826053300_restore_customer_campaign_schedule_authority.sql'), 'utf8');
const acceptanceAdvanceGuardFix = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260826141500_fix_controlled_acceptance_advance_service_role_guard.sql'), 'utf8');
const retryRunner = readFileSync(resolve(process.cwd(), '../../supabase/functions/linkedin-retry-runner/index.ts'), 'utf8');
const legacySafety = readFileSync(resolve(process.cwd(), '../../src/services/linkedin-operations/LinkedInSafetyService.ts'), 'utf8');
const effectiveScheduleTests = readFileSync(resolve(process.cwd(), '../../supabase/tests/linkedin_effective_sending_window.sql'), 'utf8');
const failedAcceptanceEvidence = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260821213500_preserve_failed_acceptance_terminal_evidence.sql'), 'utf8');
const customerSchedule = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260821220000_customer_controlled_campaign_schedule.sql'), 'utf8');
const terminalCampaignReconciliation = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260821190000_terminal_campaign_execution_reconciliation.sql'), 'utf8');
const conversationEngine = readFileSync(resolve(process.cwd(), '../../supabase/functions/linkedin-conversation-engine/index.ts'), 'utf8');
const acceptanceLifecycle = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260827090000_linkedin_v1_acceptance_lifecycle_certification.sql'), 'utf8');
const campaignReporting = readFileSync(resolve(process.cwd(), '../../src/services/campaign-reporting.ts'), 'utf8');
const linkedinV1Pipeline = readFileSync(resolve(process.cwd(), '../../supabase/functions/linkedin-v1-pipeline/index.ts'), 'utf8');
const activationService = readFileSync(resolve(process.cwd(), '../../src/services/activation/ActivationService.ts'), 'utf8');
const businessIntelligenceService = readFileSync(resolve(process.cwd(), '../../src/services/business-intelligence/BusinessIntelligenceService.ts'), 'utf8');
const icpIntelligenceService = readFileSync(resolve(process.cwd(), '../../src/services/icp-intelligence/ICPIntelligenceService.ts'), 'utf8');
const onboardingPage = readFileSync(resolve(process.cwd(), '../../src/pages/OnboardingPage.tsx'), 'utf8');
const researchStart = readFileSync(resolve(process.cwd(), '../../supabase/functions/research-start/index.ts'), 'utf8');
const researchWorker = readFileSync(resolve(process.cwd(), '../../supabase/functions/research-worker/index.ts'), 'utf8');
const dashboardPage = readFileSync(resolve(process.cwd(), '../../src/pages/DashboardPage.tsx'), 'utf8');
const campaignsPage = readFileSync(resolve(process.cwd(), '../../src/pages/CampaignsPage.tsx'), 'utf8');
const campaignSchedule = readFileSync(resolve(process.cwd(), '../../src/services/campaign-schedule.ts'), 'utf8');
const campaignUiState = readFileSync(resolve(process.cwd(), '../../src/services/campaign-ui-state.ts'), 'utf8');
const campaignMetrics = readFileSync(resolve(process.cwd(), '../../src/services/campaign-metrics.ts'), 'utf8');
const campaignProspectDedup = readFileSync(resolve(process.cwd(), '../../src/services/campaign-prospect-dedup.ts'), 'utf8');
const releaseClosure = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260820233000_campaign_release_closure.sql'), 'utf8');
const sidebar = readFileSync(resolve(process.cwd(), '../../src/components/layout/Sidebar.tsx'), 'utf8');
const app = readFileSync(resolve(process.cwd(), '../../src/App.tsx'), 'utf8');
const errorBoundary = readFileSync(resolve(process.cwd(), '../../src/components/ErrorBoundary.tsx'), 'utf8');
const protectedRoute = readFileSync(resolve(process.cwd(), '../../src/components/ProtectedRoute.tsx'), 'utf8');
const workspaceContext = readFileSync(resolve(process.cwd(), '../../src/contexts/WorkspaceContext.tsx'), 'utf8');
const queryClientSource = readFileSync(resolve(process.cwd(), '../../src/lib/queryClient.ts'), 'utf8');
const conversationReconciliation = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260820120000_linkedin_conversation_reconciliation_idempotency.sql'), 'utf8');
const settingsPage = readFileSync(resolve(process.cwd(), '../../src/pages/SettingsPage.tsx'), 'utf8');
const linkedinHooks = readFileSync(resolve(process.cwd(), '../../src/hooks/useLinkedInBrowser.ts'), 'utf8');
const campaignProspects = readFileSync(resolve(process.cwd(), '../../src/services/campaign-prospects.ts'), 'utf8');
const prospectsPage = readFileSync(resolve(process.cwd(), '../../src/pages/ProspectsPage.tsx'), 'utf8');
const settingsPageV1 = readFileSync(resolve(process.cwd(), '../../src/pages/SettingsPage.tsx'), 'utf8');
const conversationInboxPage = readFileSync(resolve(process.cwd(), '../../src/pages/ConversationInboxPage.tsx'), 'utf8');
const billingPage = readFileSync(resolve(process.cwd(), '../../src/pages/BillingPage.tsx'), 'utf8');

test('all current writes share one preflight before the switch', () => {
  for (const action of ['connection_request', 'send_message', 'follow_up_message', 'like_post', 'follow_company']) assert.ok(LINKEDIN_WRITE_ACTIONS.has(action));
  assert.ok(worker.indexOf('preflightLinkedInWrite(this.client, item)') < worker.indexOf('switch (item.action_type)'));
});
test('targets normalize and reject non-LinkedIn URL identities', () => {
  assert.equal(normalizeLinkedInTarget('https://linkedin.com/in/Test/?trk=x'), 'https://www.linkedin.com/in/Test');
  assert.equal(normalizeLinkedInTarget('https://evil.example/in/test'), null);
  assert.equal(
    targetForWrite('connection_request', {
      profile_url: 'https://www.linkedin.com/in/test/',
    }),
    'https://www.linkedin.com/in/test',
  );
});
test('safety classifications cover required denials', () => {
  for (const code of ['daily_limit_reached', 'cooldown_active', 'outside_working_hours', 'account_paused', 'verification_required', 'linkedin_restricted', 'duplicate_action', 'unsafe_target', 'rate_limited']) assert.match(safety, new RegExp(code));
});
test('denied preflight exits before a write control and successful finalization alone increments counters', () => {
  assert.match(worker, /if \(!preflight\.allowed\)[\s\S]*?return;/);
  assert.match(safety, /IF NOT p_success THEN[\s\S]*?RETURN;[\s\S]*?INSERT INTO public\.linkedin_daily_usage/);
});
test('queue ownership, semantic idempotency and sanitized audit are structural', () => {
  assert.match(safety, /q\.attempt_id=p_attempt_id AND q\.status='running'/);
  assert.match(safety, /semantic_key text NOT NULL UNIQUE/);
  assert.doesNotMatch(safety, /cookie|password|browserbase_url|cdp/i);
});
test('write preflight resolves pgcrypto digest under its hardened search path', () => {
  assert.match(digestFix, /preflight_linkedin_write[\s\S]*search_path = pg_catalog, public, extensions/);
});
test('one-time acceptance override is staging-only, exact-scope, expiring, reservable and consumed on finalization', () => {
  for (const value of ['vdiqfiuqckaxdjkadinu', 'controlled_acceptance', 'connection_request', 'expires_at', 'reserved_task_id', 'reserved_idempotency_key', 'consumed_at', 'disabled_at']) assert.match(acceptanceOverride, new RegExp(value));
  assert.match(acceptanceOverride, /code' <> 'outside_working_hours'[\s\S]*RETURN v_result/);
  assert.match(acceptanceOverride, /daily_connection_limit[\s\S]*daily_total_action_limit[\s\S]*minimum_write_interval_seconds[\s\S]*linkedin_safe_write_targets/);
  assert.match(acceptanceOverride, /finalize_linkedin_write_without_acceptance_override[\s\S]*consumed_at=now\(\),disabled_at=now\(\)/);
  assert.doesNotMatch(acceptanceOverride, /aljpmtuekghwzrnuwkat/);
});
test('controlled write acceptance purpose remains staging-only and working-hours-only', () => {
  assert.match(writeAcceptancePurpose, /purpose='controlled_write_acceptance'/);
  assert.match(writeAcceptancePurpose, /v_result->>'code'<>'outside_working_hours'/);
  assert.match(writeAcceptancePurpose, /p_project_ref<>'vdiqfiuqckaxdjkadinu'/);
  assert.match(writeAcceptancePurpose, /daily_connection_limit[\s\S]*minimum_write_interval_seconds[\s\S]*linkedin_safe_write_targets/);
});

test('campaign schedule is authoritative, timezone-explicit and worker rechecked', () => {
  assert.match(authoritativeSchedule, /outreach_timezone text/);
  assert.match(authoritativeSchedule, /next_campaign_outreach_at/);
  assert.match(authoritativeSchedule, /AT TIME ZONE c\.outreach_timezone/);
  assert.match(authoritativeSchedule, /outside_sending_window/);
  assert.match(authoritativeSchedule, /BEFORE INSERT OR UPDATE OF status,scheduled_at/);
  assert.match(linkedinV1Pipeline, /outreach_timezone_required/);
  assert.match(linkedinV1Pipeline, /status: "scheduled"/);
  assert.match(worker, /linkedin_write_deferred_to_campaign_window/);
});

test('controlled acceptance is exact-target, idempotent and cannot continue a sequence', () => {
  assert.match(linkedinV1Pipeline, /prepare_controlled_acceptance/);
  assert.match(linkedinV1Pipeline, /linkedin_safe_write_targets/);
  assert.match(linkedinV1Pipeline, /acceptance_test_mode: true/);
  assert.match(authoritativeSchedule, /uq_one_controlled_acceptance_job/);
  assert.match(authoritativeSchedule, /controlled_acceptance_complete/);
  assert.match(authoritativeSchedule, /action_payload-'sequence_state_id'/);
});

test('unsafe Artem execution, queue retry and sequence continuation are terminalized', () => {
  assert.match(authoritativeSchedule, /6e55ff97-3ae9-46e5-8cb1-a856866a3f62/);
  assert.match(authoritativeSchedule, /2425c536-349b-4e5c-8990-631b367c841c/);
  assert.match(authoritativeSchedule, /ff327220-2bf2-44d6-b35d-1f3968900f8c/);
  assert.match(authoritativeSchedule, /max_retries=0/);
});
test('staging allowlist is project-bound and production requires campaign or contact authorization', () => {
  assert.match(safety, /p_project_ref='vdiqfiuqckaxdjkadinu'/);
  assert.match(safety, /public\.contacts[\s\S]*public\.campaigns/);
});
test('challenge finalization pauses before future writes', () => assert.match(safety, /status='paused',connection_state='requires_action'/));
test('profile extraction has bounded selector fallbacks', () => {
  assert.match(worker, /main h1[\s\S]*pv-text-details__left-panel h1[\s\S]*meta\[property="og:title"\]/);
});
test('Sales Navigator waits for results and normalizes positive candidate fields', () => {
  assert.match(worker, /data-x-search-result[\s\S]*timeout: 15000/);
  for (const field of ['sales_nav_lead_url', 'headline', 'company', 'location']) assert.match(worker, new RegExp(field));
  for (const field of ['current_path', 'result_list_surface_detected', 'visible_result_card_count', 'sales_lead_link_count', 'profile_link_count', 'pagination_detected', 'virtualized_surface_detected']) assert.match(worker, new RegExp(field));
});
test('connection request verifies the presented canonical target before any Connect control', () => {
  const start = worker.lastIndexOf("case 'connection_request':");
  const branch = worker.slice(start, worker.indexOf("case 'send_message':", start));
  assert.ok(branch.indexOf('presentedTarget !== authorizedTarget') < branch.indexOf('data-yuktris-write-connect'));
  assert.match(branch, /Presented LinkedIn profile does not match the authorized target/);
});
for (const [surface, currentUrl] of [
  ['feed', 'https://www.linkedin.com/feed/'],
  ['messaging', 'https://www.linkedin.com/messaging/'],
  ['Sales Navigator', 'https://www.linkedin.com/sales/search/people'],
  ['target prospect', 'https://www.linkedin.com/in/authorized-target'],
])
  test(`bound sender resolves from authenticated self evidence on ${surface}`, () => {
    const resolved = resolveLinkedInSelfIdentity({
      currentUrl,
      selfNavigationHrefs: ['https://www.linkedin.com/in/tarun-chaudhary06/'],
    });
    assert.equal(resolved?.profileUrl, 'https://www.linkedin.com/in/tarun-chaudhary06');
    assert.equal(verifyBoundLinkedInIdentity(resolved?.profileUrl, 'https://www.linkedin.com/in/tarun-chaudhary06/'), 'match');
    assert.notEqual(resolved?.profileUrl, canonicalTarget(currentUrl));
  });
test('bound identity comparison fails closed for mismatch and unresolved evidence', () => {
  assert.equal(verifyBoundLinkedInIdentity('https://www.linkedin.com/in/different-self', 'https://www.linkedin.com/in/tarun-chaudhary06'), 'mismatch');
  assert.equal(verifyBoundLinkedInIdentity(null, 'https://www.linkedin.com/in/tarun-chaudhary06'), 'unresolved');
});
test('connection/read/write reuse the same authenticated-self resolver before preflight and target interaction', () => {
  assert.doesNotMatch(worker, /verifyIdentity\(/);
  assert.match(worker, /verifyPersistentAuthentication\(intendedIdentity, binding\)[\s\S]*preflightLinkedInWrite\(this\.client, item\)/);
  assert.ok(worker.indexOf('verifyPersistentAuthentication(intendedIdentity, binding)') < worker.indexOf('preflightLinkedInWrite(this.client, item)'));
});
function canonicalTarget(value: string): string | null {
  return value.includes('/in/') ? normalizeLinkedInTarget(value) : null;
}
test('authenticated unresolved identity fails the task without falsely expiring the account', () => {
  assert.match(worker, /if \(checkpoint\) \{[\s\S]*connection_state: 'requires_action'[\s\S]*else if \(authentication\.authState !== 'authenticated'\) \{[\s\S]*connection_state: 'session_expired'[\s\S]*else \{[\s\S]*updateAccount\(accountId,[\s\S]*last_error: authentication\.error/);
});
test('successful persistent authentication reconciles a historical false-expiry state', () => {
  assert.match(worker, /if \(!authentication\.success\)[\s\S]*?return;[\s\S]*?updateAccount\(accountId, \{[\s\S]*?connection_state: 'connected'[\s\S]*?session_status: 'connected'[\s\S]*?last_validated_at:[\s\S]*?last_error: null/);
});
test('reply ingestion maps context and suppresses duplicate external events', () => {
  assert.match(worker, /p_contact_id[\s\S]*p_campaign_id[\s\S]*p_classification/);
  assert.match(replies, /UNIQUE\s*\(linkedin_account_id,\s*external_reply_id\)/);
});
test('automated replies reuse the inbound reply job and persist processing metadata together', () => {
  const queueReplySource = conversationEngine.slice(conversationEngine.indexOf('async function queueReply'), conversationEngine.indexOf('async function markProcessed'));
  assert.match(conversationEngine, /contains\("action_payload", \{ automated_reply: true, inbound_reply_id: inboundReply\.id \}\)/);
  assert.match(conversationEngine, /response_job_id: responseJobId/);
  assert.doesNotMatch(queueReplySource, /linkedin_inbound_replies/);
  assert.match(conversationEngine, /Unable to mark inbound reply processed/);
});
test('conversation maintenance logs only structured Edge Function errors', () => {
  assert.match(worker, /readSafeFunctionError\(conversationResponse\)/);
  assert.doesNotMatch(worker, /response_body: responseBody/);
  assert.match(worker, /Non-JSON Edge Function error response/);
});
test('V1 launch suppresses duplicate connection jobs before creating outreach artifacts', () => {
  const contactLookup = linkedinV1Pipeline.indexOf('const contact = await findOrCreateContact');
  const duplicateLookup = linkedinV1Pipeline.indexOf('Existing connection job lookup failed', contactLookup);
  const copyGeneration = linkedinV1Pipeline.indexOf('const copy = await generateLinkedInCopy', contactLookup);
  const decisionInsert = linkedinV1Pipeline.indexOf('outreach_decisions', contactLookup);
  assert.ok(contactLookup < duplicateLookup && duplicateLookup < copyGeneration && copyGeneration < decisionInsert);
  assert.match(linkedinV1Pipeline, /contacts_skipped_existing_connection/);
});
test('V1 launch selects only healthy identity-bound accounts and persists grounding scores', () => {
  assert.match(linkedinV1Pipeline, /\.in\("health_status", \["healthy", "degraded"\]\)/);
  assert.match(linkedinV1Pipeline, /\.not\("profile_url", "is", null\)[\s\S]*\.not\("expected_profile_url", "is", null\)/);
  assert.match(linkedinV1Pipeline, /candidate\.score[\s\S]*match\.score/);
  assert.match(linkedinV1Pipeline, /confidence_score: prospect\.confidenceScore/);
  assert.match(linkedinV1Pipeline, /campaign_score: Math\.round\(prospect\.confidenceScore \* 100\)/);
});
test('V1 discovery requires company and role evidence and reports bridge failures', () => {
  assert.match(linkedinV1Pipeline, /evidence\.includes\(companyName[\s\S]*&& evidence\.includes\(role/);
  assert.match(linkedinV1Pipeline, /companies to know\|company directory\|database\|market map/);
  assert.match(linkedinV1Pipeline, /const candidate = title[\s\S]*\.split\([\s\S]*\.includes\(normalizedHost\)/);
  assert.match(linkedinV1Pipeline, /official company website -top -best -list -directory -database/);
  assert.match(linkedinV1Pipeline, /next_campaign_outreach_at/);
  assert.doesNotMatch(linkedinV1Pipeline, /for \(const jobId of createdJobs\)/);
});
test('V1 discovery preview is explicitly non-persistent and creates no execution jobs', () => {
  const previewStart = linkedinV1Pipeline.indexOf('if (action === "preview_discovery")');
  const initializeStart = linkedinV1Pipeline.indexOf('if (action === "initialize")');
  const preview = linkedinV1Pipeline.slice(previewStart, initializeStart);
  assert.ok(previewStart > 0 && previewStart < initializeStart);
  assert.match(preview, /persisted: false/);
  assert.match(preview, /execution_jobs_created: 0/);
  assert.doesNotMatch(preview, /\.insert\(|\.update\(|\.from\("linkedin_execution_jobs"\)/);
});
test('onboarding initialization persists configuration without discovery or execution jobs', () => {
  const initializeStart = linkedinV1Pipeline.indexOf('if (action === "initialize")');
  const launchStart = linkedinV1Pipeline.indexOf('if (action === "prepare_controlled_acceptance")');
  const initialize = linkedinV1Pipeline.slice(initializeStart, launchStart);
  assert.match(initialize, /blocked_prerequisite/);
  assert.match(initialize, /missing_requirements/);
  assert.doesNotMatch(initialize, /discoverVerifiedProspects|linkedin_execution_jobs|linkedin-job-runner/);
});
test('onboarding waits for the exact persisted business analysis before ICP generation', () => {
  assert.match(activationService, /await biService\.runResearchAnalysis[\s\S]*analysis_status !== 'completed'[\s\S]*completion_percentage !== 100/);
  assert.match(activationService, /generateFullPipeline\(workspaceId, businessProfile\.name, businessProfile\.analysisId\)/);
  assert.match(icpIntelligenceService, /biService\.loadAnalysis\(businessAnalysisId\)[\s\S]*businessAnalysis\.workspace_id !== workspaceId[\s\S]*completion_percentage !== 100/);
});
test('onboarding retries reuse analysis and persisted complete ICP records', () => {
  assert.match(businessIntelligenceService, /loadLatestAnalysisByWebsite[\s\S]*startResearchRequest\(workspaceId, website, companyName, analysis\.id\)[\s\S]*research_request_id: requestId/);
  assert.match(businessIntelligenceService, /\['queued', 'processing', 'failed'\]\.includes\(existing\.analysis_status\)[\s\S]*refreshAnalysis/);
  assert.match(icpIntelligenceService, /business_analysis_id[\s\S]*status', 'completed'[\s\S]*return \{ icps: existing/);
  assert.match(onboardingPage, /creatingRef\.current = true[\s\S]*disabled=\{loading \|\| !canProceed\(\)\}/);
});
test('onboarding reload derives every meaningful state from persisted backend truth', () => {
  for (const state of ['onboarding_completed', 'setup_ready', 'completed', 'queued', 'processing', 'icp_ready', 'ai_review']) assert.match(onboardingPage, new RegExp(state));
  assert.match(onboardingPage, /loadPersistedOnboarding\(workspace\.id\)/);
  assert.match(onboardingPage, /runBusinessAnalysis\(workspace\.id, persisted\.analysis\.website\)/);
  assert.match(activationService, /loadAllICPs\(workspaceId\)/);
  assert.match(onboardingPage, /workspace\.onboarding_completed[\s\S]*loadPersistedOnboarding/);
});
test('onboarding reload and navigation preserve research and ICP idempotency', () => {
  assert.match(onboardingPage, /restorationRef\.current === workspace\.id/);
  assert.match(onboardingPage, /persisted\.analysisStatus === 'completed'[\s\S]*persisted\.icps\.length/);
  assert.match(businessIntelligenceService, /loadLatestAnalysisByWebsite/);
  assert.match(icpIntelligenceService, /status', 'completed'[\s\S]*return \{ icps: existing/);
});
test('campaign initialization records deterministic success and prerequisite outcomes', () => {
  const initialize = linkedinV1Pipeline.slice(linkedinV1Pipeline.indexOf('if (action === "initialize")'), linkedinV1Pipeline.indexOf('if (action === "launch")'));
  assert.match(initialize, /missing_prerequisite/);
  for (const prerequisite of ['linkedin_connection', 'linkedin_session_health', 'calendar_authorization']) assert.match(initialize, new RegExp(prerequisite));
  assert.match(initialize, /status = missing\.length \? "blocked_prerequisite" : "ready"/);
});
test('Connections and launch validation share workspace-scoped google_accounts OAuth truth', () => {
  assert.match(linkedinV1Pipeline, /googleAuthorization\(admin, workspaceId\)/);
  assert.match(linkedinV1Pipeline, /from\("google_accounts"\)[\s\S]*eq\("workspace_id", workspaceId\)[\s\S]*oauth_tokens/);
  assert.match(linkedinV1Pipeline, /calendar: connected/);
});
test('LinkedIn-only launch does not require Gmail or Calendar and feature-specific validation remains available', () => {
  assert.match(campaignsPage, /require_calendar: false,[\s\S]*require_gmail: false/);
  assert.match(linkedinV1Pipeline, /body\.require_gmail === true/);
  assert.match(linkedinV1Pipeline, /body\.require_calendar === true/);
  assert.match(campaignsPage, /Calendar optional/);
});
test('preflight is read-only, workspace-bound and reports canonical authorization checks', () => {
  const preflight = linkedinV1Pipeline.slice(linkedinV1Pipeline.indexOf('if (action === "preflight")'), linkedinV1Pipeline.indexOf('if (action === "reconcile_prerequisites")'));
  assert.match(preflight, /eq\("workspace_id", workspaceId\)/);
  for (const check of ['linkedin_identity', 'persistent_context', 'campaign_icp', 'gmail_authorized', 'calendar_authorized', 'worker_available', 'write_performed: false']) assert.match(preflight, new RegExp(check));
  assert.doesNotMatch(preflight, /\.insert\(|\.update\(|linkedin-job-runner/);
});
test('non-2xx launch responses expose structured actionable errors', () => {
  assert.match(linkedinV1Pipeline, /ok: false[\s\S]*code: errorCode\(error\)/);
  assert.match(campaignsPage, /context\.clone\(\)\.json\(\)[\s\S]*body\.error/);
  assert.doesNotMatch(campaignsPage, /error\?\.message \?\? 'Campaign could not be launched'/);
});
test('fixture conversations and metrics are excluded from normal customer queries', () => {
  assert.match(campaignMetrics, /isTestFixture[\s\S]*execution fixture/);
  assert.match(linkedinHooks, /filter\(\(row\) => !isTestFixture/);
  assert.match(campaignMetrics, /if \(isTestFixture\(job\)\) continue/);
});
test('dashboard and campaign cards aggregate the same canonical zero-safe metrics', () => {
  assert.match(dashboardPage, /Object\.values\(campaignMetrics\)\.reduce/);
  assert.match(campaignReporting, /get_linkedin_v1_campaign_metrics/);
  assert.match(acceptanceLifecycle, /result_payload->>'write_verified'='true'/);
  assert.match(acceptanceLifecycle, /acceptance_test_mode'[\s\S]*false/);
  assert.match(dashboardPage, /prospectsContacted: Object\.values\(campaignMetrics\)/);
  assert.match(campaignReporting, /prospects: Number[\s\S]*meetingsBooked: Number/);
});
test('customer campaign is the sole authoritative IANA sending schedule', () => {
  assert.match(customerSchedule, /next_campaign_outreach_at/);
  assert.match(customerSchedule, /pg_catalog\.pg_timezone_names/);
  assert.match(customerSchedule, /monday','tuesday','wednesday','thursday','friday','saturday','sunday/);
  const scheduler = customerSchedule.slice(customerSchedule.indexOf('CREATE OR REPLACE FUNCTION public.next_campaign_outreach_at'), customerSchedule.indexOf('CREATE OR REPLACE FUNCTION public.next_campaign_account_outreach_at'));
  assert.doesNotMatch(scheduler, /working_days|working_hours_start|working_hours_end|a\.timezone/);
  for (const value of ['Monday-only', 'Saturday execution', 'Sunday execution', 'Friday-night', 'Saturday-to-Monday', 'DST transition', 'Asia/Kolkata', 'America/New_York']) assert.match(effectiveScheduleTests, new RegExp(value));
});
test('worker preflight rechecks campaign schedule and account preflight retains non-scheduling safety', () => {
  assert.match(customerSchedule, /campaign_outreach_preflight[\s\S]*outside_sending_window/);
  assert.match(worker, /campaign_outreach_preflight[\s\S]*preflightLinkedInWrite\(this\.client, item\)/);
  const currentSafety = customerSchedule.slice(customerSchedule.indexOf('CREATE OR REPLACE FUNCTION public.preflight_linkedin_write_without_acceptance_override'));
  assert.doesNotMatch(currentSafety, /outside_working_hours|working_days|working_hours_start|working_hours_end/);
  for (const preserved of ['daily_limit_reached', 'cooldown_active', 'verification_required', 'duplicate_action', 'unsafe_target', 'rate_limited']) assert.match(currentSafety, new RegExp(preserved));
});
test('schedule editing, pause and resume recalculate only nonterminal future work', () => {
  assert.match(customerSchedule, /update_customer_campaign_schedule[\s\S]*status IN \('queued','scheduled','retry','retrying','paused'\)/);
  assert.match(customerSchedule, /set_customer_campaign_paused[\s\S]*status='paused'[\s\S]*status='running'/);
  assert.match(customerSchedule, /browser_execution_queue[\s\S]*status IN \('pending','waiting','retry'\)/);
  assert.match(worker, /campaign_paused[\s\S]*status: 'waiting'/);
});
test('campaign UI supports browser timezone default, seven days, presets and lifecycle explanations', () => {
  const scheduleUi = campaignsPage + campaignSchedule;
  for (const value of ['resolvedOptions().timeZone', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Weekdays', 'Every day', 'Start time', 'End time', 'Schedule / Edit', 'Waiting for sending window', 'Pause', 'Resume']) assert.match(scheduleUi, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(campaignSchedule, /\\u2013.*friday/);
  assert.match(campaignSchedule, /Asia\/Calcutta.*Asia\/Kolkata/);
  assert.match(campaignsPage, /ScheduleEditorBoundary/);
});
test('campaign polling preserves rendered data and canonical LinkedIn identities render once', () => {
  assert.match(campaignsPage, /placeholderData: \(previous\) => previous/);
  assert.match(campaignsPage, /initialBootstrapLoading/);
  const campaignQuery = campaignsPage.slice(campaignsPage.indexOf("queryKey: ['customer-campaigns'"), campaignsPage.indexOf("queryKey: ['campaign-prospects'"));
  assert.doesNotMatch(campaignQuery, /reconcile_prerequisites|reconcile_campaign_state/);
  assert.match(campaignProspects, /deduplicateCampaignProspects\(resolved\)/);
  assert.match(campaignProspectDedup, /linkedin:.*pathname\.toLowerCase/);
});
test('post-preflight LinkedIn write failures never retry automatically', () => {
  assert.match(worker, /unsafe to retry automatically[\s\S]*!LINKEDIN_WRITE_ACTIONS\.has\(item\.action_type\)/);
  assert.match(customerSchedule, /semantic_key=v_semantic[\s\S]*duplicate_action/);
});
test('controlled acceptance permits only safe human-initiated pre-write retries', () => {
  assert.match(effectiveSchedule, /human_initiated_by/);
  assert.match(effectiveSchedule, /status IN \('queued','scheduled','running','pending','retry','retrying'\)/);
  assert.match(effectiveSchedule, /execution_result='success'/);
  assert.match(effectiveSchedule, /previous_controlled_acceptance_reached_write_phase/);
  assert.match(effectiveSchedule, /DROP INDEX IF EXISTS public\.uq_one_controlled_acceptance_job/);
  assert.match(linkedinV1Pipeline, /controlled_acceptance_eligibility/);
  assert.match(linkedinV1Pipeline, /unsafe_target/);
  const acceptance = linkedinV1Pipeline.slice(linkedinV1Pipeline.indexOf('if (action === "prepare_controlled_acceptance")'), linkedinV1Pipeline.indexOf('if (action === "launch")'));
  assert.doesNotMatch(acceptance, /linkedin_sequences|linkedin_sequence_state|follow_up/);
});
test('failed acceptance evidence stays terminal and unscheduled', () => {
  assert.match(failedAcceptanceEvidence, /51ccbcf6-1361-4da7-9f09-f080d11b8495[\s\S]*status='failed'/);
  assert.match(failedAcceptanceEvidence, /a2f2bf5d-ed02-47d4-ad45-9b1850f7853c[\s\S]*status='failed'/);
  assert.match(failedAcceptanceEvidence, /scheduled_at=NULL/);
  assert.match(failedAcceptanceEvidence, /next_retry_at=NULL/);
  assert.match(failedAcceptanceEvidence, /max_retries=least\(max_retries,retry_count\)/);
  assert.doesNotMatch(failedAcceptanceEvidence, /DELETE|status='pending'|status='queued'/);
});

test('controlled acceptance generation is inline, staging-admin guarded, and failures are contained', () => {
  assert.doesNotMatch(campaignsPage, /window\.confirm\(/);
  assert.match(campaignsPage, /Start new controlled acceptance generation/);
  assert.match(campaignsPage, /read-only relationship check/);
  assert.match(linkedinV1Pipeline, /start_controlled_acceptance_generation[\s\S]*vdiqfiuqckaxdjkadinu/);
  assert.match(acceptanceGenerations, /role IN \('owner','admin'\)/);
});
test('acceptance generations preserve history and isolate idempotency', () => {
  assert.match(acceptanceGenerations, /controlled_acceptance_generation_events_are_append_only/);
  assert.match(acceptanceGenerations, /controlled_acceptance_generation_history_is_immutable/);
  assert.match(acceptanceGenerations, /idempotency_namespace text NOT NULL UNIQUE/);
  assert.match(acceptanceGenerations, /'controlled-acceptance-generation:'\|\|gen_random_uuid\(\)/);
  assert.doesNotMatch(acceptanceGenerations, /DELETE FROM public\.(linkedin_execution_jobs|browser_execution_queue|linkedin_write_audit)/);
});
test('generation relationship gate allows only exact allowlisted eligible target', () => {
  assert.match(acceptanceGenerations, /tarun-chaudhary/);
  assert.match(acceptanceGenerations, /check_connection_acceptance/);
  assert.match(acceptanceGenerations, /max_retries,metadata\)[\s\S]*'pending',0/);
  assert.match(acceptanceGenerations, /status:='pending'[\s\S]*status:='connected'[\s\S]*connect_available/);
  assert.match(acceptanceGenerations, /status<>'eligible'/);
  assert.match(acceptanceGenerations, /max_retries,action_payload\)[\s\S]*'connection_request','scheduled'[\s\S]*,-1,0,/);
  assert.doesNotMatch(acceptanceGenerations, /send_message|follow_up_message/);
});
test('tab visibility and window focus cannot restart Campaigns mutations', () => {
  assert.match(queryClientSource, /refetchOnWindowFocus: false/);
  assert.doesNotMatch(campaignsPage, /visibilitychange|addEventListener\(['"](?:focus|blur)/);
  assert.doesNotMatch(campaignsPage, /window\.location\.(?:reload|assign)/);
  assert.match(campaignsPage, /onClick=\{\(\) => void startControlledAcceptanceGeneration\(/);
  assert.match(campaignsPage, /onClick=\{\(\) => void classifyAcceptanceGeneration\(/);
  for (const action of ['start_controlled_acceptance_generation', 'advance_controlled_acceptance_generation'])
    assert.match(campaignsPage, new RegExp(`action: '${action}'`));
});
test('workspace auth refresh identity is stable and does not remount Campaigns', () => {
  assert.match(workspaceContext, /\}, \[user\?\.id\]\);/);
  assert.doesNotMatch(workspaceContext, /\}, \[user\]\);/);
});
test('Campaigns transient expansion and schedule editor state survive remount', () => {
  assert.match(campaignUiState, /sessionStorage\.getItem/);
  assert.match(campaignUiState, /sessionStorage\.setItem/);
  assert.match(campaignUiState, /yuktris:campaigns-ui:\$\{workspaceId\}/);
  assert.match(campaignsPage, /readCampaignUiState\(workspace\?\.id\)/);
  assert.match(campaignsPage, /writeCampaignUiState\(workspace\?\.id, \{ expandedCampaign, scheduleDraft \}\)/);
});
test('persisted controlled generation restores after refresh without creating another', () => {
  assert.match(campaignsPage, /controlled_acceptance_generations/);
  assert.match(campaignsPage, /\.order\('created_at', \{ ascending: false \}\)/);
  assert.match(campaignsPage, /latestGeneration\(id, p\.contactId\)/);
  const generationQuery = campaignsPage.slice(campaignsPage.indexOf("queryKey: ['controlled-acceptance-generations'"), campaignsPage.indexOf('const latestGeneration'));
  assert.doesNotMatch(generationQuery, /functions\.invoke|\.insert\(|\.update\(/);
});
test('generation and campaign background refreshes retain rendered state', () => {
  for (const key of ['customer-campaigns', 'campaign-prospects', 'controlled-acceptance-generations']) {
    const query = campaignsPage.slice(campaignsPage.indexOf(`queryKey: ['${key}'`));
    assert.match(query.slice(0, 3000), /placeholderData: \(previous\) => previous/);
  }
  assert.match(campaignsPage, /refetchIntervalInBackground: true/);
  assert.match(campaignsPage, /probeStatus === 'completed'/);
  assert.match(campaignsPage, /initialBootstrapLoading = .*isLoading && !.*\.data/);
});
test('Campaigns lifecycle restoration performs no LinkedIn write or duplicate artifact creation', () => {
  const generationQuery = campaignsPage.slice(campaignsPage.indexOf("queryKey: ['controlled-acceptance-generations'"), campaignsPage.indexOf('const latestGeneration'));
  assert.doesNotMatch(generationQuery, /connection_request|linkedin_write_audit|linkedin_execution_jobs|functions\.invoke/);
  assert.match(campaignsPage, /generation && \['relationship_check_pending', 'eligible'\]\.includes/);
  assert.match(campaignsPage, /generation\?\.status === 'write_prepared'/);
});

test('message availability alone never classifies a controlled generation as connected', () => {
  assert.match(acceptanceClassificationFix, /relationship_classification[^;]*already_connected/);
  assert.match(acceptanceClassificationFix, /relationship_classification[^;]*eligible_for_connection_request/);
  assert.doesNotMatch(acceptanceClassificationFix, /message_available/);
});

test('generation RPCs remain service-role-only with current Supabase secret keys', () => {
  assert.match(acceptanceServiceRoleFix, /auth\.role\(\)/);
  for (const rpc of ['start_controlled_acceptance_generation', 'advance_controlled_acceptance_generation', 'finalize_controlled_acceptance_generation']) {
    assert.match(acceptanceServiceRoleFix, new RegExp(rpc));
  }
});
test('controlled continuation crosses the authenticated server trust boundary', () => {
  const continuation = linkedinV1Pipeline.slice(linkedinV1Pipeline.indexOf('if (action === "advance_controlled_acceptance_generation")'), linkedinV1Pipeline.indexOf('if (action === "prepare_controlled_acceptance")'));
  assert.match(continuation, /internalService \|\| !userId/);
  assert.match(continuation, /workspace_members[\s\S]*owner[\s\S]*admin/);
  for (const scope of ['controlled_acceptance_generations', 'customer_campaigns', 'customer_campaign_contacts', 'contacts', 'linkedin_accounts', 'browser_execution_queue', 'linkedin_safe_write_targets']) assert.match(continuation, new RegExp(scope));
  for (const evidence of ['eligible_for_connection_request', 'connect_available', 'tarun-chaudhary06', 'tarun-chaudhary', 'campaign_window_validation']) assert.match(continuation, new RegExp(evidence));
  assert.match(continuation, /admin\.rpc\("advance_controlled_acceptance_generation"/);
  assert.doesNotMatch(continuation, /SUPABASE_SERVICE_ROLE_KEY|createClient/);
});
test('advance RPC keeps service role exclusive and supports current server secrets', () => {
  assert.match(acceptanceAdvanceGuardFix, /auth\.role\(\)/);
  assert.match(acceptanceAdvanceGuardFix, /REVOKE ALL[\s\S]*PUBLIC,anon,authenticated/);
  assert.match(acceptanceAdvanceGuardFix, /GRANT EXECUTE[\s\S]*TO service_role/);
  assert.doesNotMatch(acceptanceAdvanceGuardFix, /GRANT EXECUTE[\s\S]*TO authenticated/);
});
test('controlled continuation is idempotent and never creates a replacement generation', () => {
  const continuation = linkedinV1Pipeline.slice(linkedinV1Pipeline.indexOf('if (action === "advance_controlled_acceptance_generation")'), linkedinV1Pipeline.indexOf('if (action === "prepare_controlled_acceptance")'));
  assert.match(continuation, /status !== "relationship_check_pending"[\s\S]*reused: true/);
  assert.doesNotMatch(continuation, /start_controlled_acceptance_generation|\.insert\(/);
});
test('service role secret remains server-only and absent from Campaigns', () => {
  assert.doesNotMatch(campaignsPage, /SERVICE_ROLE|service_role.*key|SUPABASE_SERVICE_ROLE_KEY/i);
  assert.match(linkedinV1Pipeline, /authorizeLinkedInWorkspace/);
});

test('current scheduling authority ignores account working-hour metadata on every path', () => {
  const compatibilityScheduler = campaignAuthorityRestore.slice(
    campaignAuthorityRestore.indexOf('CREATE OR REPLACE FUNCTION public.next_campaign_account_outreach_at'),
    campaignAuthorityRestore.indexOf('CREATE OR REPLACE FUNCTION public.campaign_window_validation'),
  );
  assert.match(compatibilityScheduler, /next_campaign_outreach_at/);
  assert.doesNotMatch(compatibilityScheduler, /working_days|working_hours_start|working_hours_end|a\.timezone/);
  assert.match(campaignAuthorityRestore, /advance_controlled_acceptance_generation[\s\S]*next_campaign_outreach_at\(g\.campaign_id,now\(\)\)/);
  assert.doesNotMatch(campaignAuthorityRestore, /no_effective_sending_window|outside_working_hours/);
  assert.doesNotMatch(linkedinV1Pipeline, /campaign_account_window_validation/);
  assert.doesNotMatch(legacySafety, /Outside working hours|isWithinWorkingHours/);
});
test('retry scheduling preserves backoff and snaps to the campaign-controlled window', () => {
  assert.match(retryRunner, /source_campaign_id/);
  assert.match(retryRunner, /next_campaign_outreach_at/);
  assert.match(retryRunner, /p_not_before: notBefore/);
  assert.doesNotMatch(retryRunner, /working_days|working_hours_start|working_hours_end|outside_working_hours/);
});
test('successful generation permanently blocks another while unknown is terminal', () => {
  assert.match(acceptanceGenerations, /uq_one_successful_acceptance_generation/);
  assert.match(acceptanceGenerations, /execution_result='success'/);
  assert.match(acceptanceGenerations, /WHEN 'verified_sent' THEN 'succeeded'/);
  assert.match(acceptanceGenerations, /ELSE 'outcome_unknown'/);
});
test('customer Settings exposes only supported V1 tabs', () => {
  const tabBlock = settingsPage.slice(settingsPage.indexOf('const tabs = ['), settingsPage.indexOf('] as const;'));
  for (const label of ['Workspace', 'Users', 'Notifications', 'Billing']) assert.match(tabBlock, new RegExp(`label: '${label}'`));
  for (const label of ['API Keys', 'Integrations', 'AI', 'AI Agents', 'Execution Engine']) assert.doesNotMatch(tabBlock, new RegExp(`label: '${label}'`));
});
test('Google-only blocked campaigns reconcile to ready without auto-launching', () => {
  const reconcile = linkedinV1Pipeline.slice(linkedinV1Pipeline.indexOf('if (action === "reconcile_prerequisites")'), linkedinV1Pipeline.indexOf('if (action === "preview_discovery")'));
  assert.match(reconcile, /google\|gmail\|calendar/);
  assert.match(reconcile, /connection_state !== "connected"[\s\S]*"healthy", "degraded"/);
  assert.match(reconcile, /status: "ready"/);
  assert.doesNotMatch(reconcile, /status: "running"/);
  assert.match(linkedinV1Pipeline, /reconcile_campaign_state/);
});
test('campaign prospects are customer-visible from campaign details and global Prospects', () => {
  for (const field of ['name', 'title', 'company', 'linkedinUrl', 'status', 'lastAction', 'nextAction', 'createdAt']) assert.match(campaignProspects, new RegExp(field));
  assert.match(campaignsPage, /View prospects[\s\S]*View LinkedIn profile[\s\S]*Last action:[\s\S]*Next action:/);
  assert.match(prospectsPage, /Campaign prospects[\s\S]*Outreach status[\s\S]*LinkedIn profile/);
  assert.match(campaignProspects, /isTestFixture/);
  assert.match(campaignProspects, /nextAction: job &&/);
});
test('terminal failed campaign jobs reconcile running lifecycle to failed without scheduling work', () => {
  const reconcile = linkedinV1Pipeline.slice(linkedinV1Pipeline.indexOf('if (action === "reconcile_campaign_state")'), linkedinV1Pipeline.indexOf('if (action === "preview_discovery")'));
  assert.match(reconcile, /reconcile_customer_campaign_execution_state/);
  assert.doesNotMatch(reconcile, /linkedin-job-runner|browser_execution_queue|\.insert\(/);
  assert.match(terminalCampaignReconciliation, /status IN \('queued','scheduled','retry','retrying','running','pending'\)/);
  assert.match(terminalCampaignReconciliation, /step_status='stopped'[\s\S]*stopped_reason='parent_execution_failed'[\s\S]*next_action_at=NULL/);
  assert.match(terminalCampaignReconciliation, /scheduled_at=NULL[\s\S]*max_retries=least\(max_retries,retry_count\)/);
  assert.match(terminalCampaignReconciliation, /failure_code='all_initial_actions_failed'/);
  assert.match(terminalCampaignReconciliation, /AFTER UPDATE OF status/);
});
test('Inbox has an explicit customer empty state', () => {
  assert.match(conversationInboxPage, /No conversations yet\./);
});
test('Upgrade CTAs no longer fail silently or imply checkout completion', () => {
  assert.match(settingsPageV1, /Plan upgrades are not available yet\. No payment will be taken\./);
  assert.match(sidebar, /window\.location\.assign\('\/app\/settings'\)/);
  assert.match(billingPage, /Billing is not available yet/);
  assert.match(billingPage, /No payment will be taken/);
  assert.doesNotMatch(billingPage, /create_checkout|Add Card|\$99|5,000 prospects/);
});
test('hidden internal V1 routes redirect to customer-safe destinations', () => {
  for (const path of ['execution-queue', 'browser', 'api-platform', 'ai-ceo', 'workforce']) {
    assert.match(app, new RegExp(`path="/app/${path}" element=\\{<Navigate to="/app" replace />\\}`));
  }
  assert.match(app, /path="\/app\/integrations" element=\{<Navigate to="\/app\/settings" replace \/>\}/);
  assert.match(app, /path="\/app\/payments" element=\{<Navigate to="\/app\/billing" replace \/>\}/);
  assert.doesNotMatch(app, /path="\/app\/execution-queue" element=\{<ProtectedApp>/);
});
test('campaign launch failure, backend exception and timeout cannot remain initializing', () => {
  assert.match(linkedinV1Pipeline, /lifecycleCampaignId[\s\S]*status: "failed"[\s\S]*initialization_failed/);
  assert.match(linkedinV1Pipeline, /discovery_failed/);
  assert.match(releaseClosure, /status = 'initializing'[\s\S]*interval '10 minutes'/);
  assert.match(releaseClosure, /initialization_timeout/);
});
test('duplicate initialization and retry use one stable campaign identity', () => {
  assert.match(campaignsPage, /initializationKey = useRef\(crypto\.randomUUID\(\)\)/);
  assert.match(linkedinV1Pipeline, /onConflict: "workspace_id,initialization_key"/);
  assert.match(releaseClosure, /UNIQUE INDEX[\s\S]*workspace_id, initialization_key/i);
});
test('stale initialization reconciles prerequisites without blindly marking ready', () => {
  assert.match(releaseClosure, /linkedin_connection_required[\s\S]*linkedin_unhealthy[\s\S]*initialization_timeout/);
  assert.doesNotMatch(releaseClosure, /SET status = 'ready'/);
});
test('persisted ICP loading retains targeting child records', () => {
  assert.match(icpIntelligenceService, /icp_company_profile[\s\S]*icp_decision_makers[\s\S]*icp_pain_points[\s\S]*icp_goals[\s\S]*sales_navigator_filters/);
});
test('business research dispatch is authenticated, asynchronous and idempotent', () => {
  assert.match(researchStart, /auth\.getUser\(\)[\s\S]*workspace_members/);
  assert.match(researchStart, /business_analysis_id=eq\.[\s\S]*resumed: true/);
  assert.match(researchStart, /EdgeRuntime\.waitUntil\(workerRequest\)/);
  assert.doesNotMatch(researchStart, /await fetch\(`\$\{SUPABASE_URL\}\/functions\/v1\/research-worker/);
});
test('research worker owns authoritative business-analysis completion', () => {
  assert.match(researchStart, /business_analysis_id: analysis_id/);
  assert.match(researchWorker, /business_analysis_id[\s\S]*rest\/v1\/business_analysis[\s\S]*analysis_status: "completed"[\s\S]*completion_percentage: 100/);
  assert.match(businessIntelligenceService, /workerCompleted[\s\S]*profileFromPersistedAnalysis/);
});
test('dashboard metrics use canonical customer and execution records', () => {
  assert.match(dashboardPage, /from\('customer_campaigns'\)[\s\S]*fetchCampaignMetrics\(wsId\)/);
  assert.match(acceptanceLifecycle, /get_linkedin_v1_campaign_metrics[\s\S]*linkedin_execution_jobs[\s\S]*linkedin_messages/);
  assert.match(dashboardPage, /Prospects Discovered/);
  assert.doesNotMatch(dashboardPage, /Best Time to Send" value="Tue/);
});
test('customer campaign cards use canonical lifecycle labels and persisted V1 metrics', () => {
  for (const label of ['Prospects', 'Connections Sent', 'Connections Accepted', 'Messages Sent', 'Replies', 'Positive Replies', 'Qualified Leads', 'Meetings Booked']) assert.match(campaignsPage, new RegExp(label));
  for (const status of ['Active', 'Ready', 'Action Required', 'Paused', 'Needs Attention', 'Completed']) assert.match(campaignMetrics, new RegExp(status));
  assert.match(campaignMetrics, /action_payload[\s\S]*source_campaign_id/);
  assert.doesNotMatch(dashboardPage, />—</);
});
test('normal customer navigation excludes internal architecture routes', () => {
  for (const label of ['Dashboard', 'Campaigns', 'ICP / Audience', 'Inbox', 'Meetings', 'Connections', 'Settings']) assert.match(sidebar, new RegExp(`label: '${label.replace('/', '\\/')}'`));
  for (const internal of ['Revenue Strategy', 'Prospect Discovery', 'Outreach Intelligence', 'Integration Health', 'Execution Queue']) assert.doesNotMatch(sidebar, new RegExp(internal));
});
test('authenticated app layout imports every rendered icon and cannot fail on Sidebar Zap', () => {
  assert.match(sidebar, /Plug, Settings, Sparkles, ChevronDown, Rocket,[\s\S]*Zap,[\s\S]*from 'lucide-react'/);
  assert.match(sidebar, /<Zap className=/);
});
test('top-level customer error boundary covers route guard, layout and lazy dashboard', () => {
  assert.match(app, /<ErrorBoundary>[\s\S]*<ProtectedRoute>[\s\S]*<AppLayout>[\s\S]*<Lazy>\{children\}<\/Lazy>/);
  for (const action of ['Retry', 'Return to Dashboard', 'Sign out']) assert.match(errorBoundary, new RegExp(action));
  assert.match(errorBoundary, /Something went wrong loading Yuktris/);
  assert.doesNotMatch(errorBoundary, /\{this\.state\.error\?\.message/);
});
test('auth and workspace bootstrap use explicit loading, ready and recoverable error states', () => {
  assert.match(protectedRoute, /loading \|\| wsLoading[\s\S]*authError \|\| workspaceError[\s\S]*Retry/);
  assert.match(workspaceContext, /try \{[\s\S]*getWorkspaces[\s\S]*catch \(cause\)[\s\S]*finally \{[\s\S]*setLoading\(false\)/);
  assert.doesNotMatch(protectedRoute, /return null/);
});
test('conversation reconciliation derives its projection from authoritative messages', () => {
  assert.match(conversationReconciliation, /reconcile_linkedin_v1_pipeline_state_transitions/);
  assert.match(conversationReconciliation, /count\(\*\)::integer AS total_messages/);
  assert.match(conversationReconciliation, /array_agg\(m\.direction ORDER BY/);
  assert.match(conversationReconciliation, /IS DISTINCT FROM s\.total_messages/);
});

const fixtures: Array<[string, string, string]> = [
  ['What is the pricing?', 'pricing_question', 'SEND_REPLY'],
  ['Not interested, no thanks.', 'not_interested', 'STOP'],
  ['Please send me more information.', 'send_information', 'SEND_REPLY'],
  ['Circle back next quarter.', 'timing_later', 'FOLLOW_UP'],
  ['We already use a current vendor.', 'current_vendor', 'SEND_REPLY'],
  ['Do you have a case study or proof?', 'proof_case_study', 'SEND_REPLY'],
  ['Can you work pay per lead?', 'pay_per_lead', 'SEND_REPLY'],
  ['Speak to my manager instead.', 'decision_maker_redirect', 'SEND_REPLY'],
  ["Let's schedule a meeting.", 'meeting_interest', 'REQUEST_MEETING'],
];
for (const [body, category, action] of fixtures)
  test(`AI handoff classifies ${category}`, () => {
    const result = decideLinkedInNextAction(body);
    assert.equal(result.category, category);
    assert.equal(result.action, action);
  });
test('unknown AI decisions require human review and fixture responses are never executed by worker', () => {
  assert.deepEqual(decideLinkedInNextAction('hello'), {
    action: 'HUMAN_REVIEW',
    category: 'unknown',
    qualification_state: 'unknown',
    response: null,
    requires_human_approval: true,
  });
  assert.doesNotMatch(worker, /decideLinkedInNextAction/);
});
test('meeting event is workspace authorized, idempotent, persistent and notification-consumable', () => {
  assert.match(meeting, /is_workspace_member/);
  assert.match(meeting, /uq_linkedin_meeting_event_idempotency/);
  assert.match(meeting, /notification_type='meeting_booked'/);
  assert.match(meeting, /'fixture',true/);
});
test('send_message and follow_up_message refuse an ambiguous recipient rather than guessing', () => {
  const messagingCase = worker.slice(worker.lastIndexOf("case 'send_message':"), worker.lastIndexOf("case 'like_post':"));
  assert.match(messagingCase, /matchingConversations\.length > 1/);
  assert.match(messagingCase, /refusing to guess the recipient/);
  assert.match(messagingCase, /recipient does not positively match the canonical target/);
  assert.match(messagingCase, /exactOutboundAfter <= exactOutboundBefore/);
  assert.match(messagingCase, /result_code: 'outcome_unknown'[\s\S]*retry_allowed: false/);
  assert.match(messagingCase, /write_verified: true[\s\S]*exact_outbound_message_bubble/);
});
test('acceptance reconciliation normalizes historical and current result shapes fail closed', () => {
  assert.match(acceptanceLifecycle, /p_result->'data'/);
  assert.match(acceptanceLifecycle, /source_shape'[\s\S]*nested_data'[\s\S]*top_level'/);
  assert.match(acceptanceLifecycle, /malformed_evidence/);
  assert.match(acceptanceLifecycle, /security_interruption/);
  assert.doesNotMatch(acceptanceLifecycle, /message_available[^\n]*accepted/);
});
test('acceptance accounting is immutable and exactly once under replay or concurrency', () => {
  assert.match(acceptanceLifecycle, /UNIQUE\(connection_job_id\)/);
  assert.match(acceptanceLifecycle, /UNIQUE\(workspace_id,customer_campaign_id,contact_id,linkedin_account_id\)/);
  assert.match(acceptanceLifecycle, /ON CONFLICT DO NOTHING RETURNING id INTO v_event/);
  assert.match(acceptanceLifecycle, /LinkedIn acceptance events are immutable/);
  assert.match(acceptanceLifecycle, /acceptance_test_mode'[\s\S]*false/);
  assert.match(acceptanceLifecycle, /GRANT EXECUTE ON FUNCTION public\.reconcile_linkedin_acceptance_events\(uuid\) TO service_role/);
});
test('read_replies refuses an ambiguous thread and scrolls to load full history before extraction', () => {
  const readRepliesCase = worker.slice(worker.lastIndexOf("case 'read_replies':"), worker.lastIndexOf('default:'));
  assert.match(readRepliesCase, /matchingConversations\.length > 1/);
  assert.match(readRepliesCase, /refusing to guess the thread/);
  assert.match(readRepliesCase, /scrollTo\(0, 0\)/);
});
test('reply classification and AI handoff normalize hyphenated/underscored phrasing', () => {
  assert.equal(decideLinkedInNextAction('not-interested, please stop').category, 'not_interested');
  assert.match(worker, /classifyLinkedInReply\(body: string\)[\s\S]*?replace\(\/\[-_\]\+\/g, ' '\)/);
});
