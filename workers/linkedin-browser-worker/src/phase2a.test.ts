import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const migration = read('supabase/migrations/20260810090000_phase2a_linkedin_connection_hardening.sql');
const identityMigration = read('supabase/migrations/20260812150000_linkedin_post_auth_identity_binding.sql');
const loginAccessMigration = read('supabase/migrations/20260812160000_linkedin_authorized_live_login_access.sql');
const continuityMigration = read('supabase/migrations/20260812170000_linkedin_human_auth_continuity.sql');
const linkedin = read('workers/linkedin-browser-worker/src/linkedin.ts');
const worker = read('workers/linkedin-browser-worker/src/worker.ts');
const browserbase = read('workers/linkedin-browser-worker/src/browserbase.ts');
const hook = read('src/hooks/useLinkedInBrowser.ts');
const accountsPage = read('src/pages/LinkedInAccountsPage.tsx');
const onboardingPage = read('src/pages/OnboardingPage.tsx');

const tests: Array<[string, () => void]> = [
  ['normal login requires verified auth before capture', () => {
    assert.match(linkedin, /assessment\.state !== 'authenticated'/);
    assert.match(linkedin, /Cannot capture LinkedIn session/);
  }],
  ['challenge is completed only in Browserbase', () => {
    assert.match(linkedin, /Complete verification in the secure LinkedIn browser/);
    assert.doesNotMatch(accountsPage, /Submit Code|otp_code|captcha_solution/);
    assert.doesNotMatch(hook, /user_response:\s*params\.response/);
  }],
  ['login beyond five minutes keeps a renewable lease', () => {
    assert.match(worker, /setInterval[\s\S]*queue\.renew/);
    assert.match(migration, /lease_expires_at/);
    assert.doesNotMatch(migration, /interval '5 minutes'/);
  }],
  ['duplicate workers cannot finish another attempt', () => {
    assert.match(migration, /worker_id\s*=\s*p_worker_id[\s\S]{0,80}attempt_id\s*=\s*p_attempt_id/);
    assert.match(migration, /queue claim ownership lost/);
  }],
  ['retry scheduling is honored', () => {
    assert.match(migration, /q\.status = 'retry' AND q\.next_retry_at IS NOT NULL AND q\.next_retry_at <= now\(\)/);
  }],
  ['identity mismatch fails closed', () => {
    assert.match(linkedin, /Authenticated LinkedIn profile does not match/);
    assert.match(hook, /p_expected_profile_url/);
  }],
  ['expired sessions are excluded', () => {
    assert.match(migration, /expires_at > now\(\)/);
    assert.match(migration, /Application session expiry reached/);
  }],
  ['Browserbase transient failures are bounded and retryable', () => {
    assert.match(browserbase, /res\.status >= 500/);
    assert.match(browserbase, /Browserbase request timed out/);
    assert.match(browserbase, /attempt < 3/);
  }],
  ['restart recovery respects leases', () => {
    assert.match(migration, /q\.status = 'running' AND q\.lease_expires_at IS NOT NULL AND q\.lease_expires_at <= now\(\)/);
  }],
  ['pre-existing running jobs are reset before lease authority', () => {
    assert.match(migration, /Reset during queue lease migration/);
    assert.match(migration, /WHERE status='running'/);
  }],
  ['legacy waiting RPC is revoked and removed', () => {
    assert.match(migration, /REVOKE EXECUTE ON FUNCTION public\.set_queue_item_waiting\(uuid\)/);
    assert.match(migration, /DROP FUNCTION public\.set_queue_item_waiting\(uuid\)/);
  }],
  ['duplicate connection starts return before mutation and conflicting reuse is rejected', () => {
    const duplicateReturn = identityMigration.indexOf('RETURN QUERY SELECT v_existing_queue.account_id, v_existing_queue.id');
    const firstAccountMutation = identityMigration.indexOf('UPDATE public.linkedin_accounts SET account_name');
    assert.ok(duplicateReturn > 0 && duplicateReturn < firstAccountMutation);
    assert.match(identityMigration, /idempotency key conflicts with a different connection request/);
    assert.match(identityMigration, /pg_advisory_xact_lock/);
  }],
  ['connection can start with pending profile identity', () => {
    assert.doesNotMatch(identityMigration, /IF v_profile IS NULL THEN RAISE EXCEPTION 'A valid LinkedIn profile URL is required'/);
    assert.match(hook, /p_expected_profile_url:\s*null/);
    assert.match(onboardingPage, /LinkedIn email \(optional\)/);
  }],
  ['authenticated identity is discovered, canonicalized, and persisted before session save', () => {
    assert.match(linkedin, /https:\/\/www\.linkedin\.com\/in\/\$\{profileMatch\[1\]\}/);
    const bind = worker.indexOf('await this.bindAuthenticatedIdentity(workspaceId, accountId, result.identity?.profileUrl)');
    const save = worker.indexOf('await this.saveSession(workspaceId, accountId, result.session!)');
    assert.ok(bind > 0 && bind < save);
    assert.match(identityMigration, /SET expected_profile_url=v_profile, profile_url=v_profile/);
  }],
  ['canonical identity cannot switch on reconnect', () => {
    assert.match(identityMigration, /Authenticated LinkedIn profile does not match the account being connected/);
    assert.match(worker, /loadIntendedIdentity/);
    assert.match(linkedin, /Authenticated LinkedIn profile does not match the account being connected/);
  }],
  ['identity binding is workspace isolated and service-role only', () => {
    assert.match(identityMigration, /WHERE id=p_account_id AND workspace_id=p_workspace_id/);
    assert.match(identityMigration, /REVOKE EXECUTE ON FUNCTION public\.bind_linkedin_account_identity\(uuid,uuid,text\) FROM PUBLIC, anon, authenticated/);
    assert.match(identityMigration, /GRANT EXECUTE ON FUNCTION public\.bind_linkedin_account_identity\(uuid,uuid,text\) TO service_role/);
  }],
  ['onboarding waits for persisted authentication before advancing to Gmail', () => {
    assert.match(onboardingPage, /useLinkedInAccounts\(\)/);
    assert.match(onboardingPage, /connection_state === 'connected'/);
    assert.match(onboardingPage, /session_status === 'connected'/);
    assert.match(onboardingPage, /status === 'active'/);
    assert.match(onboardingPage, /linkedinAccount\.profile_url/);
    assert.match(onboardingPage, /Preparing secure browser/);
    const startSuccess = onboardingPage.match(/onSuccess: \(\{ accountId \}\)[\s\S]*?onError:/)?.[0] ?? '';
    assert.doesNotMatch(startSuccess, /setStep\('gmail'\)/);
    assert.match(onboardingPage, /if \(step !== 'linkedin' \|\| !linkedinConnected/);
    assert.match(onboardingPage, /onNext=\{goNext\}/);
  }],
  ['LinkedIn start does not launch or derive Google identity', () => {
    const linkedinStep = onboardingPage.match(/STEP 2: LINKEDIN[\s\S]*?STEP 3: GMAIL/)?.[0] ?? '';
    assert.doesNotMatch(linkedinStep, /connectGoogle\.mutate|linkedinEmail.*google|setStep\('gmail'\).*onSuccess/);
  }],
  ['authorized workspace member can obtain only their active interactive login URL', () => {
    assert.match(loginAccessMigration, /auth\.uid\(\) IS NULL OR NOT public\.is_workspace_member\(p_workspace_id\)/);
    assert.match(loginAccessMigration, /a\.id=p_account_id AND a\.workspace_id=p_workspace_id/);
    assert.match(loginAccessMigration, /i\.workspace_id=p_workspace_id[\s\S]*i\.account_id=p_account_id/);
    assert.match(loginAccessMigration, /browserbase_session_id'=v_session_id/);
    assert.match(loginAccessMigration, /debugger|browserbase_live_url/);
    assert.match(loginAccessMigration, /\^https:\/\//);
    assert.doesNotMatch(loginAccessMigration, /wsEndpoint|connectUrl[^|]/);
  }],
  ['different workspace and expired live sessions cannot obtain login access', () => {
    assert.match(loginAccessMigration, /WHERE a\.id=p_account_id AND a\.workspace_id=p_workspace_id/);
    assert.match(loginAccessMigration, /v_expires_at := v_connected_at \+ interval '10 minutes'/);
    assert.match(loginAccessMigration, /IF now\(\) >= v_expires_at THEN RETURN/);
    assert.match(loginAccessMigration, /REVOKE EXECUTE ON FUNCTION public\.get_linkedin_login_access\(uuid,uuid\) FROM PUBLIC, anon/);
  }],
  ['challenge live access remains workspace-authorized and bounded to thirty minutes', () => {
    assert.match(continuityMigration, /auth\.uid\(\) IS NULL OR NOT public\.is_workspace_member\(p_workspace_id\)/);
    assert.match(continuityMigration, /a\.id=p_account_id AND a\.workspace_id=p_workspace_id/);
    assert.match(continuityMigration, /interval '30 minutes'/);
    assert.match(continuityMigration, /v_connection_state NOT IN \('pending','authenticating','requires_action'\)/);
    assert.match(continuityMigration, /REVOKE EXECUTE ON FUNCTION public\.get_linkedin_login_access\(uuid,uuid\) FROM PUBLIC, anon/);
  }],
  ['onboarding embeds authorized Browserbase login and keeps polling', () => {
    assert.match(onboardingPage, /useLinkedInLoginAccess\(linkedinAccountId\)/);
    assert.match(onboardingPage, /SecureLinkedInAuthModal/);
    assert.doesNotMatch(onboardingPage, /window\.open\(loginUrl/);
    assert.match(hook, /get_linkedin_login_access/);
    assert.match(hook, /refetchInterval: 2000/);
  }],
  ['Browserbase login sessions use a creation-time desktop viewport', () => {
    assert.match(browserbase, /DEFAULT_VIEWPORT = \{ width: 1440, height: 900 \}/);
    assert.match(browserbase, /browserSettings: \{[\s\S]{0,120}viewport/);
    assert.match(browserbase, /Creating Browserbase session[\s\S]*viewport/);
    const browserbaseContext = linkedin.match(/if \(this\.bbSession\)[\s\S]*?else \{\s*this\.context = await this\.browser\.newContext/)?.[0] ?? '';
    assert.doesNotMatch(browserbaseContext, /setViewportSize/);
  }],
  ['onboarding gives passive security-check guidance in the same live session', () => {
    assert.match(onboardingPage, /useAuthInteractions\(linkedinAccountId\)/);
    assert.match(onboardingPage, /LinkedIn security verification required/);
    assert.match(onboardingPage, /Yuktris remains passive and never collects verification codes/);
    assert.match(onboardingPage, /securityCheckRequired/);
    assert.doesNotMatch(onboardingPage, /solveCaptcha|Submit Code|otp_code|captcha_solution/);
  }],
  ['challenge polling pins one page and does not focus or navigate it', () => {
    assert.match(linkedin, /let pinnedChallengePage: Page \| null = null/);
    assert.match(linkedin, /assessAuthentication\(pinnedChallengePage \?\? undefined, pinnedChallengePage === null\)/);
    assert.match(linkedin, /detectChallengeDetailed\(pinnedChallengePage \?\? undefined\)/);
    assert.match(linkedin, /if \(focusSelectedPage\) await selected\.bringToFront/);
    const challengeWait = linkedin.match(/private async waitForAuthenticationWithChallenges[\s\S]*?private async detectChallengeDetailed/)?.[0] ?? '';
    assert.doesNotMatch(challengeWait, /\.goto\(|\.reload\(|\.click\(|\.fill\(|\.type\(|\.press\(/);
  }],
  ['challenge state is real and human window is extended but bounded', () => {
    assert.match(linkedin, /waiting_for_login: \['challenge_detected'/);
    assert.match(linkedin, /challenge_detected: \['waiting_for_user'/);
    assert.match(linkedin, /waiting_for_user: \['waiting_for_login', 'challenge_detected', 'verifying_authentication'/);
    assert.match(linkedin, /HUMAN_CHALLENGE_EXTENSION_MS = 20 \* 60 \* 1000/);
    assert.match(linkedin, /MAX_AUTH_ATTEMPT_LIFETIME_MS = 30 \* 60 \* 1000/);
    assert.match(linkedin, /Math\.min\(now \+ HUMAN_CHALLENGE_EXTENSION_MS, absoluteDeadline\)/);
    assert.match(worker, /step === 'challenge_detected' \|\| step === 'waiting_for_user'[\s\S]*connection_state: 'requires_action'/);
  }],
  ['active human challenge fails rather than replacing its browser session', () => {
    const challengeWait = linkedin.match(/private async waitForAuthenticationWithChallenges[\s\S]*?private async detectChallengeDetailed/)?.[0] ?? '';
    assert.match(challengeWait, /Secure LinkedIn browser session was lost/);
    assert.match(challengeWait, /LinkedIn security-check page was closed/);
    assert.doesNotMatch(challengeWait, /createSession|\.launch\(|newContext\(|newPage\(/);
  }],
  ['successful human login does not create an immediate second provider session', () => {
    const connectFlow = linkedin.match(/async connect\([\s\S]*?async connectWithSession/)?.[0] ?? '';
    assert.doesNotMatch(connectFlow, /const validator = new LinkedInBrowser|Starting session restore test|validator\.launch/);
    assert.match(connectFlow, /const identity = await this\.verifyIdentity\(\)/);
    assert.match(connectFlow, /const session = await this\.captureSession\(\)/);
    const bind = worker.indexOf('await this.bindAuthenticatedIdentity(workspaceId, accountId, result.identity?.profileUrl)');
    const save = worker.indexOf('await this.saveSession(workspaceId, accountId, result.session!)');
    const connected = worker.indexOf("connection_state: 'connected'", save);
    assert.ok(bind > 0 && save > bind && connected > save);
  }],
  ['strict leases gate completion failure and waiting', () => {
    assert.ok((migration.match(/attempt_id\s*=\s*p_attempt_id AND lease_expires_at > now\(\)/g) ?? []).length >= 3);
  }],
  ['retry claim clears stale execution state', () => {
    assert.match(migration, /next_retry_at=NULL, error=NULL,[\s\S]*duration_ms=NULL, result=NULL/);
  }],
  ['session view uses caller RLS and excludes encrypted payloads', () => {
    assert.match(migration, /WITH \(security_invoker = true\)/);
    const viewDefinition = migration.match(/CREATE OR REPLACE VIEW public\.linkedin_session_public_view[\s\S]*?FROM public\.linkedin_sessions/)?.[0] ?? '';
    assert.doesNotMatch(viewDefinition, /cookies_encrypted|storage_state_encrypted|local_storage_encrypted|session_storage_encrypted/);
  }],
  ['authenticated users cannot directly mutate the queue', () => {
    assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON public\.browser_execution_queue FROM authenticated, anon/);
    assert.match(hook, /enqueue_linkedin_connection_test/);
    const testHook = hook.match(/export function useTestLinkedInConnection[\s\S]*?export function useDisconnectLinkedIn/)?.[0] ?? '';
    assert.doesNotMatch(testHook, /from\('browser_execution_queue'\)/);
  }],
  ['authentication responses are blocked before historical cleanup', () => {
    const constraint = migration.indexOf('CHECK (user_response IS NULL) NOT VALID');
    const cleanup = migration.indexOf('UPDATE public.linkedin_auth_interactions SET user_response=NULL');
    assert.ok(constraint > 0 && constraint < cleanup);
    assert.match(migration, /VALIDATE CONSTRAINT linkedin_auth_interactions_no_secrets/);
  }],
  ['worker RPCs reject public roles', () => {
    assert.match(migration, /REVOKE EXECUTE ON FUNCTION public\.claim_queue_task[\s\S]*FROM PUBLIC, anon, authenticated/);
  }],
  ['zero-workspace startup remains healthy and retries registration', () => {
    assert.doesNotMatch(worker, /throw new Error\('No workspaces available for worker registration'\)/);
    assert.match(worker, /await this\.ensureRegistered\(\)/);
    assert.match(worker, /No workspaces available; worker will remain healthy and idle/);
    assert.match(worker, /if \(!\(await this\.ensureRegistered\(\)\)\) return/);
  }],
  ['transactional start enforces workspace membership', () => {
    assert.match(migration, /auth\.uid\(\) IS NULL OR NOT public\.is_workspace_member\(p_workspace_id\)/);
    assert.match(migration, /enqueue_linkedin_connection_test\(uuid,uuid\) FROM PUBLIC, anon/);
    assert.match(hook, /start_linkedin_connection/);
  }],
];

let failed = 0;
for (const [name, test] of tests) {
  try {
    test();
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    failed++;
    process.stderr.write(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}\n`);
  }
}
if (failed) process.exitCode = 1;
