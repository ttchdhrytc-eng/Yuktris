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
const conversationEngine = readFileSync(resolve(process.cwd(), '../../supabase/functions/linkedin-conversation-engine/index.ts'), 'utf8');
const linkedinV1Pipeline = readFileSync(resolve(process.cwd(), '../../supabase/functions/linkedin-v1-pipeline/index.ts'), 'utf8');
const activationService = readFileSync(resolve(process.cwd(), '../../src/services/activation/ActivationService.ts'), 'utf8');
const businessIntelligenceService = readFileSync(resolve(process.cwd(), '../../src/services/business-intelligence/BusinessIntelligenceService.ts'), 'utf8');
const icpIntelligenceService = readFileSync(resolve(process.cwd(), '../../src/services/icp-intelligence/ICPIntelligenceService.ts'), 'utf8');
const onboardingPage = readFileSync(resolve(process.cwd(), '../../src/pages/OnboardingPage.tsx'), 'utf8');
const researchStart = readFileSync(resolve(process.cwd(), '../../supabase/functions/research-start/index.ts'), 'utf8');
const researchWorker = readFileSync(resolve(process.cwd(), '../../supabase/functions/research-worker/index.ts'), 'utf8');
const dashboardPage = readFileSync(resolve(process.cwd(), '../../src/pages/DashboardPage.tsx'), 'utf8');
const campaignsPage = readFileSync(resolve(process.cwd(), '../../src/pages/CampaignsPage.tsx'), 'utf8');
const campaignMetrics = readFileSync(resolve(process.cwd(), '../../src/services/campaign-metrics.ts'), 'utf8');
const releaseClosure = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260820233000_campaign_release_closure.sql'), 'utf8');
const sidebar = readFileSync(resolve(process.cwd(), '../../src/components/layout/Sidebar.tsx'), 'utf8');
const conversationReconciliation = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260820120000_linkedin_conversation_reconciliation_idempotency.sql'), 'utf8');

test('all current writes share one preflight before the switch', () => {
  for (const action of ['connection_request','send_message','follow_up_message','like_post','follow_company']) assert.ok(LINKEDIN_WRITE_ACTIONS.has(action));
  assert.ok(worker.indexOf('preflightLinkedInWrite(this.client, item)') < worker.indexOf('switch (item.action_type)'));
});
test('targets normalize and reject non-LinkedIn URL identities', () => {
  assert.equal(normalizeLinkedInTarget('https://linkedin.com/in/Test/?trk=x'), 'https://www.linkedin.com/in/Test');
  assert.equal(normalizeLinkedInTarget('https://evil.example/in/test'), null);
  assert.equal(targetForWrite('connection_request',{profile_url:'https://www.linkedin.com/in/test/'}),'https://www.linkedin.com/in/test');
});
test('safety classifications cover required denials', () => {
  for (const code of ['daily_limit_reached','cooldown_active','outside_working_hours','account_paused','verification_required','linkedin_restricted','duplicate_action','unsafe_target','rate_limited']) assert.match(safety,new RegExp(code));
});
test('denied preflight exits before a write control and successful finalization alone increments counters', () => {
  assert.match(worker,/if \(!preflight\.allowed\)[\s\S]*?return;/);
  assert.match(safety,/IF NOT p_success THEN[\s\S]*?RETURN;[\s\S]*?INSERT INTO public\.linkedin_daily_usage/);
});
test('queue ownership, semantic idempotency and sanitized audit are structural', () => {
  assert.match(safety,/q\.attempt_id=p_attempt_id AND q\.status='running'/);
  assert.match(safety,/semantic_key text NOT NULL UNIQUE/);
  assert.doesNotMatch(safety,/cookie|password|browserbase_url|cdp/i);
});
test('write preflight resolves pgcrypto digest under its hardened search path', () => {
  assert.match(digestFix,/preflight_linkedin_write[\s\S]*search_path = pg_catalog, public, extensions/);
});
test('one-time acceptance override is staging-only, exact-scope, expiring, reservable and consumed on finalization', () => {
  for (const value of ['vdiqfiuqckaxdjkadinu','controlled_acceptance','connection_request','expires_at','reserved_task_id','reserved_idempotency_key','consumed_at','disabled_at']) assert.match(acceptanceOverride,new RegExp(value));
  assert.match(acceptanceOverride,/code' <> 'outside_working_hours'[\s\S]*RETURN v_result/);
  assert.match(acceptanceOverride,/daily_connection_limit[\s\S]*daily_total_action_limit[\s\S]*minimum_write_interval_seconds[\s\S]*linkedin_safe_write_targets/);
  assert.match(acceptanceOverride,/finalize_linkedin_write_without_acceptance_override[\s\S]*consumed_at=now\(\),disabled_at=now\(\)/);
  assert.doesNotMatch(acceptanceOverride,/aljpmtuekghwzrnuwkat/);
});
test('controlled write acceptance purpose remains staging-only and working-hours-only', () => {
  assert.match(writeAcceptancePurpose,/purpose='controlled_write_acceptance'/);
  assert.match(writeAcceptancePurpose,/v_result->>'code'<>'outside_working_hours'/);
  assert.match(writeAcceptancePurpose,/p_project_ref<>'vdiqfiuqckaxdjkadinu'/);
  assert.match(writeAcceptancePurpose,/daily_connection_limit[\s\S]*minimum_write_interval_seconds[\s\S]*linkedin_safe_write_targets/);
});
test('staging allowlist is project-bound and production requires campaign or contact authorization', () => {
  assert.match(safety,/p_project_ref='vdiqfiuqckaxdjkadinu'/);
  assert.match(safety,/public\.contacts[\s\S]*public\.campaigns/);
});
test('challenge finalization pauses before future writes', () => assert.match(safety,/status='paused',connection_state='requires_action'/));
test('profile extraction has bounded selector fallbacks', () => {
  assert.match(worker,/main h1[\s\S]*pv-text-details__left-panel h1[\s\S]*meta\[property="og:title"\]/);
});
test('Sales Navigator waits for results and normalizes positive candidate fields', () => {
  assert.match(worker,/data-x-search-result[\s\S]*timeout: 15000/);
  for (const field of ['sales_nav_lead_url','headline','company','location']) assert.match(worker,new RegExp(field));
  for (const field of ['current_path','result_list_surface_detected','visible_result_card_count','sales_lead_link_count','profile_link_count','pagination_detected','virtualized_surface_detected']) assert.match(worker,new RegExp(field));
});
test('connection request verifies the presented canonical target before any Connect control', () => {
  const start = worker.lastIndexOf("case 'connection_request':");
  const branch = worker.slice(start, worker.indexOf("case 'send_message':", start));
  assert.ok(branch.indexOf('presentedTarget !== authorizedTarget') < branch.indexOf('button span:has-text("Connect")'));
  assert.match(branch,/Presented LinkedIn profile does not match the authorized target/);
});
for (const [surface,currentUrl] of [
  ['feed','https://www.linkedin.com/feed/'],
  ['messaging','https://www.linkedin.com/messaging/'],
  ['Sales Navigator','https://www.linkedin.com/sales/search/people'],
  ['target prospect','https://www.linkedin.com/in/authorized-target'],
]) test(`bound sender resolves from authenticated self evidence on ${surface}`, () => {
  const resolved = resolveLinkedInSelfIdentity({currentUrl,selfNavigationHrefs:['https://www.linkedin.com/in/tarun-chaudhary06/']});
  assert.equal(resolved?.profileUrl,'https://www.linkedin.com/in/tarun-chaudhary06');
  assert.equal(verifyBoundLinkedInIdentity(resolved?.profileUrl,'https://www.linkedin.com/in/tarun-chaudhary06/'),'match');
  assert.notEqual(resolved?.profileUrl,canonicalTarget(currentUrl));
});
test('bound identity comparison fails closed for mismatch and unresolved evidence', () => {
  assert.equal(verifyBoundLinkedInIdentity('https://www.linkedin.com/in/different-self','https://www.linkedin.com/in/tarun-chaudhary06'),'mismatch');
  assert.equal(verifyBoundLinkedInIdentity(null,'https://www.linkedin.com/in/tarun-chaudhary06'),'unresolved');
});
test('connection/read/write reuse the same authenticated-self resolver before preflight and target interaction', () => {
  assert.doesNotMatch(worker,/verifyIdentity\(/);
  assert.match(worker,/verifyPersistentAuthentication\(intendedIdentity, binding\)[\s\S]*preflightLinkedInWrite\(this\.client, item\)/);
  assert.ok(worker.indexOf('verifyPersistentAuthentication(intendedIdentity, binding)') < worker.indexOf('preflightLinkedInWrite(this.client, item)'));
});
function canonicalTarget(value:string):string|null { return value.includes('/in/') ? normalizeLinkedInTarget(value) : null; }
test('authenticated unresolved identity fails the task without falsely expiring the account', () => {
  assert.match(worker, /if \(checkpoint\) \{[\s\S]*connection_state: 'requires_action'[\s\S]*else if \(authentication\.authState !== 'authenticated'\) \{[\s\S]*connection_state: 'session_expired'[\s\S]*else \{[\s\S]*updateAccount\(accountId, \{ last_error: authentication\.error \}\)/);
});
test('successful persistent authentication reconciles a historical false-expiry state', () => {
  assert.match(worker, /if \(!authentication\.success\)[\s\S]*?return;[\s\S]*?updateAccount\(accountId, \{[\s\S]*?connection_state: 'connected'[\s\S]*?session_status: 'connected'[\s\S]*?last_validated_at:[\s\S]*?last_error: null/);
});
test('reply ingestion maps context and suppresses duplicate external events', () => {
  assert.match(worker,/p_contact_id[\s\S]*p_campaign_id[\s\S]*p_classification/);
  assert.match(replies,/UNIQUE\s*\(linkedin_account_id,\s*external_reply_id\)/);
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
  const decisionInsert = linkedinV1Pipeline.indexOf('.from("outreach_decisions").insert', contactLookup);
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
  assert.match(linkedinV1Pipeline, /title\.split\(\/\[\|–—\]\/[\s\S]*includes\(normalizedHost\)/);
  assert.match(linkedinV1Pipeline, /official company website -top -best -list -directory -database/);
  assert.match(linkedinV1Pipeline, /if \(!response\.ok\)[\s\S]*bridgeFailures\.push/);
  assert.match(linkedinV1Pipeline, /partially_launched[\s\S]*bridge_failures/);
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
  const launchStart = linkedinV1Pipeline.indexOf('if (action === "launch")');
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
  assert.match(dashboardPage, /from\('customer_campaigns'\)[\s\S]*from\('linkedin_execution_jobs'\)[\s\S]*from\('linkedin_messages'\)/);
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
test('conversation reconciliation derives its projection from authoritative messages', () => {
  assert.match(conversationReconciliation, /reconcile_linkedin_v1_pipeline_state_transitions/);
  assert.match(conversationReconciliation, /count\(\*\)::integer AS total_messages/);
  assert.match(conversationReconciliation, /array_agg\(m\.direction ORDER BY/);
  assert.match(conversationReconciliation, /IS DISTINCT FROM s\.total_messages/);
});

const fixtures: Array<[string,string,string]> = [
  ['What is the pricing?', 'pricing_question', 'SEND_REPLY'], ['Not interested, no thanks.', 'not_interested', 'STOP'],
  ['Please send me more information.', 'send_information', 'SEND_REPLY'], ['Circle back next quarter.', 'timing_later', 'FOLLOW_UP'],
  ['We already use a current vendor.', 'current_vendor', 'SEND_REPLY'], ['Do you have a case study or proof?', 'proof_case_study', 'SEND_REPLY'],
  ['Can you work pay per lead?', 'pay_per_lead', 'SEND_REPLY'], ['Speak to my manager instead.', 'decision_maker_redirect', 'SEND_REPLY'],
  ["Let's schedule a meeting.", 'meeting_interest', 'REQUEST_MEETING'],
];
for (const [body,category,action] of fixtures) test(`AI handoff classifies ${category}`, () => {
  const result=decideLinkedInNextAction(body); assert.equal(result.category,category); assert.equal(result.action,action);
});
test('unknown AI decisions require human review and fixture responses are never executed by worker', () => {
  assert.deepEqual(decideLinkedInNextAction('hello'),{action:'HUMAN_REVIEW',category:'unknown',qualification_state:'unknown',response:null,requires_human_approval:true});
  assert.doesNotMatch(worker,/decideLinkedInNextAction/);
});
test('meeting event is workspace authorized, idempotent, persistent and notification-consumable', () => {
  assert.match(meeting,/is_workspace_member/); assert.match(meeting,/uq_linkedin_meeting_event_idempotency/);
  assert.match(meeting,/notification_type='meeting_booked'/); assert.match(meeting,/'fixture',true/);
});
test('send_message and follow_up_message refuse an ambiguous recipient rather than guessing', () => {
  const messagingCase = worker.slice(worker.lastIndexOf("case 'send_message':"), worker.lastIndexOf("case 'like_post':"));
  assert.match(messagingCase, /matchingConversations\.length > 1/);
  assert.match(messagingCase, /refusing to guess the recipient/);
});
test('read_replies refuses an ambiguous thread and scrolls to load full history before extraction', () => {
  const readRepliesCase = worker.slice(worker.lastIndexOf("case 'read_replies':"), worker.lastIndexOf('default:'));
  assert.match(readRepliesCase, /matchingConversations\.length > 1/);
  assert.match(readRepliesCase, /refusing to guess the thread/);
  assert.match(readRepliesCase, /scrollTo\(0, 0\)/);
});
test('reply classification and AI handoff normalize hyphenated/underscored phrasing', () => {
  assert.equal(decideLinkedInNextAction("not-interested, please stop").category, 'not_interested');
  assert.match(worker, /classifyLinkedInReply\(body: string\)[\s\S]*?replace\(\/\[-_\]\+\/g, ' '\)/);
});
