import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const migration = read('supabase/migrations/20260810090000_phase2a_linkedin_connection_hardening.sql');
const linkedin = read('workers/linkedin-browser-worker/src/linkedin.ts');
const worker = read('workers/linkedin-browser-worker/src/worker.ts');
const browserbase = read('workers/linkedin-browser-worker/src/browserbase.ts');
const hook = read('src/hooks/useLinkedInBrowser.ts');
const accountsPage = read('src/pages/LinkedInAccountsPage.tsx');

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
    const duplicateReturn = migration.indexOf('RETURN QUERY SELECT v_existing_queue.account_id, v_existing_queue.id');
    const firstAccountMutation = migration.indexOf('UPDATE public.linkedin_accounts SET account_name');
    assert.ok(duplicateReturn > 0 && duplicateReturn < firstAccountMutation);
    assert.match(migration, /idempotency key conflicts with a different connection request/);
    assert.match(migration, /pg_advisory_xact_lock/);
  }],
  ['profile identity is required, preserved, and conflict protected', () => {
    assert.match(migration, /v_profile := coalesce\(v_existing_profile, v_profile\)/);
    assert.match(migration, /A valid LinkedIn profile URL is required/);
    assert.match(migration, /expected LinkedIn profile conflicts with the connected account/);
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
