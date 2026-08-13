import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const migration = read('supabase/migrations/20260813160000_linkedin_connection_attempt_orchestration.sql');
const phase2a = read('supabase/migrations/20260810090000_phase2a_linkedin_connection_hardening.sql');
const hook = read('src/hooks/useLinkedInBrowser.ts');
const onboarding = read('src/pages/OnboardingPage.tsx');
const accounts = read('src/pages/LinkedInAccountsPage.tsx');
const queue = read('workers/linkedin-browser-worker/src/queue.ts');
const worker = read('workers/linkedin-browser-worker/src/worker.ts');
const linkedin = read('workers/linkedin-browser-worker/src/linkedin.ts');

const tests: Array<[string, () => void]> = [
  ['fresh account transaction creates one pending linkedin_connect row', () => {
    assert.match(migration, /INSERT INTO public\.linkedin_accounts[\s\S]*INSERT INTO public\.browser_execution_queue/);
    assert.match(migration, /'linkedin_connect'[\s\S]*1,'critical','pending'/);
  }],
  ['returning account is locked and creates or attaches exactly one attempt', () => {
    assert.match(migration, /p_existing_account_id[\s\S]*FOR UPDATE/);
    assert.match(migration, /LIMIT 1 FOR UPDATE/);
  }],
  ['terminal completed failed and cancelled rows do not participate in active dedupe', () => {
    assert.match(migration, /q\.status IN \('pending','retry','running','waiting'\)/);
    assert.doesNotMatch(migration.match(/SELECT \* INTO v_existing_queue FROM public\.browser_execution_queue q[\s\S]*?LIMIT 1 FOR UPDATE;/g)?.at(-1) ?? '', /completed|failed|cancelled/);
  }],
  ['expired running lease is reconciled to immediately claimable pending', () => {
    assert.match(migration, /v_existing_queue\.status <> 'waiting'[\s\S]*status='pending'[\s\S]*lease_expires_at=NULL/);
  }],
  ['valid running attempt is reused and not duplicated', () => {
    assert.match(migration, /v_existing_queue\.status='running' AND v_existing_queue\.lease_expires_at > now\(\)[\s\S]*RETURN QUERY SELECT v_account_id, v_existing_queue\.id, v_existing_queue\.status, true/);
  }],
  ['waiting abandoned attempt is cancelled before a fresh attempt', () => {
    assert.match(migration, /status <> 'waiting'[\s\S]*ELSE[\s\S]*Abandoned LinkedIn connection attempt reconciled/);
  }],
  ['RPC returns account queue status and reuse confirmation', () => {
    assert.match(migration, /RETURNS TABLE\(account_id uuid, queue_item_id uuid, queue_status text, attempt_reused boolean\)/);
  }],
  ['frontend requires and verifies the exact queue row', () => {
    assert.match(hook, /!result\?\.account_id \|\| !result\?\.queue_item_id/);
    assert.match(hook, /browser_execution_queue[\s\S]*\.eq\('id', result\.queue_item_id\)[\s\S]*action_type !== 'linkedin_connect'/);
  }],
  ['enqueue has a bounded abort and failure cannot leave checking active', () => {
    assert.match(hook, /Promise\.race[\s\S]*12_000/);
    assert.match(onboarding, /linkedinAttemptTimeoutStage[\s\S]*'worker_claim'[\s\S]*15_000/);
    assert.match(onboarding, /linkedinWaiting = [^\n]*activeLinkedinQueue[^\n]*!linkedinAttemptTimeoutStage/);
  }],
  ['no queue item cannot produce onboarding checking state', () => {
    assert.match(onboarding, /!!linkedinQueueItemId && activeLinkedinQueue/);
    assert.match(onboarding, /Unable to confirm an active LinkedIn connection attempt/);
  }],
  ['stale pending account alone cannot open accounts auth panel', () => {
    assert.match(accounts, /active-linkedin-connection-attempts/);
    assert.match(accounts, /a\.id === activeAttempt\?\.account_id/);
  }],
  ['created pending row satisfies the exact claim predicate and worker RPC', () => {
    assert.match(phase2a, /q\.status = 'pending' AND \(q\.scheduled_at IS NULL OR q\.scheduled_at <= now\(\)\)/);
    assert.match(migration, /'pending',v_key/);
    assert.match(queue, /rpc\('claim_queue_task'/);
  }],
  ['worker emits queue claim timing before connection processing', () => {
    assert.match(worker, /Q3_worker_claimed/);
    assert.match(onboarding, /Q0_connect_clicked/);
    assert.match(hook, /Q1_enqueue_started/);
    assert.match(hook, /Q2_queue_item_confirmed/);
    assert.match(onboarding, /Q4_frontend_connected_observed/);
  }],
  ['healthy Context remains backend-only and interactive fallback remains explicit', () => {
    assert.match(worker, /checkExistingAuthenticatedSession/);
    assert.match(worker, /onProgress\('auth_required'/);
    const healthy = worker.match(/if \(preflight\.result\)[\s\S]*?\} else \{/)?.[0] ?? '';
    assert.doesNotMatch(healthy, /browserbase_live_url|auth_required/);
  }],
  ['CAPTCHA remains passive and explicit invalid credentials are observational', () => {
    const challengeStart = linkedin.indexOf('private async waitForAuthenticationWithChallenges');
    const challengeEnd = linkedin.indexOf('private async detectChallengeDetailed', challengeStart);
    const challenge = linkedin.slice(challengeStart, challengeEnd);
    assert.doesNotMatch(challenge, /\.goto\(|\.reload\(|\.fill\(|\.click\(/);
    assert.match(linkedin, /invalid_credentials/);
  }],
  ['identity mismatch and canonical resolver remain fail closed', () => {
    assert.match(linkedin, /getIdentityMismatch[\s\S]*nonRetryable: true/);
    assert.match(linkedin, /waitUntil: 'commit'/);
  }],
  ['Context persistence and strict ownership remain intact', () => {
    assert.match(worker, /linkedinContexts\.acquire/);
    assert.match(worker, /linkedinContexts\.synchronize/);
    assert.match(phase2a, /p_attempt_id/);
  }],
];

let failures = 0;
for (const [name, test] of tests) {
  try { test(); process.stdout.write(`PASS ${name}\n`); }
  catch (error) { failures++; process.stderr.write(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}\n`); }
}
if (failures) process.exitCode = 1;
