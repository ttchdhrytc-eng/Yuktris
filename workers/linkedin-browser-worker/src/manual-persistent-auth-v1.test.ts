import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const hook = read('src/hooks/useLinkedInBrowser.ts');
const onboarding = read('src/pages/OnboardingPage.tsx');
const worker = read('workers/linkedin-browser-worker/src/worker.ts');
const linkedin = read('workers/linkedin-browser-worker/src/linkedin.ts');
const context = read('workers/linkedin-browser-worker/src/linkedin-context.ts');
const start = read('supabase/migrations/20260813160000_linkedin_connection_attempt_orchestration.sql');

test('V1 enqueue uses the authorized non-credential connection RPC', () => {
  const mutation = hook.match(/export function useConnectLinkedIn[\s\S]*?export function useLinkedInConnectionAttempt/)?.[0] ?? '';
  assert.match(mutation, /supabase\.rpc\('start_linkedin_connection'/);
  assert.match(mutation, /p_expected_profile_url: null/);
  assert.doesNotMatch(mutation, /linkedin-credentials|username|password|connect_existing/);
});

test('manual auth UI contains no LinkedIn credential fields', () => {
  assert.doesNotMatch(onboarding, /linkedinUsername|linkedinPassword|current-password|useLinkedInCredentialsConfigured/);
  assert.match(onboarding, /Sign in to LinkedIn once in the secure browser/);
  assert.match(onboarding, /linkedinConnectionIntentRef\.current\?\.active \|\| connectLinkedIn\.isPending \|\| activeLinkedinQueue/);
});

test('normal connect and test connection never claim or submit credentials', () => {
  const connect = worker.match(/private async handleConnect[\s\S]*?private async handleTestConnection/)?.[0] ?? '';
  const testConnection = worker.match(/private async handleTestConnection[\s\S]*?private async handle/)?.[0] ?? '';
  assert.doesNotMatch(connect, /claimCredentials|markCredentialResult|credentials/);
  assert.doesNotMatch(testConnection, /claimCredentials|markCredentialResult|credentials/);
  assert.match(connect, /this\.linkedin\.connect\([\s\S]*?preflight\.preserveCurrentPage, false,[\s\S]*?\);/);
  assert.doesNotMatch(connect, /preflight\.preserveCurrentPage, true, credentials/);
});

test('persistent Context is reused and persisted for the account', () => {
  assert.match(worker, /ensureV1Enrollment/);
  assert.match(worker, /ensureProvisioned/);
  assert.match(worker, /linkedinContexts\.acquire/);
  assert.match(context, /contextId: context\.provider_context_id, persistContext: true/);
  assert.match(linkedin, /Browserbase owns the default context\. Reuse it/);
});

test('first connection is not marked connected before a new-session persistence proof', () => {
  const connect = worker.match(/private async handleConnect[\s\S]*?private async handleTestConnection/)?.[0] ?? '';
  const proof = connect.indexOf("linkedin_persistence_proof_started");
  const secondSession = connect.indexOf('openPersistentContextForTask(item)', proof);
  const verification = connect.indexOf('verifyPersistentAuthentication', secondSession);
  const synchronized = connect.indexOf('synchronizePersistentContext(proofContext', verification);
  const connected = connect.indexOf("connection_state: 'connected'", synchronized);
  assert.ok(proof > 0 && secondSession > proof && verification > secondSession && synchronized > verification && connected > synchronized);
  assert.match(connect, /second_session_not_authenticated[\s\S]*queue\.fail/);
});

test('one explicit intent maps to one idempotent queue', () => {
  assert.match(hook, /const idempotencyKey = params\.operationId/);
  assert.doesNotMatch(hook.match(/export function useConnectLinkedIn[\s\S]*?export function useLinkedInConnectionAttempt/)?.[0] ?? '', /crypto\.randomUUID/);
  assert.match(start, /WHERE q\.workspace_id=p_workspace_id AND q\.idempotency_key=v_key FOR UPDATE/);
  assert.match(start, /q\.status IN \('pending','retry','running','waiting'\)/);
});

test('manual auth polling remains passive and CAPTCHA solving remains disabled', () => {
  assert.match(linkedin, /worker_action: assessment\.state === 'checkpoint'[\s\S]*?'observe_only'/);
  assert.match(read('workers/linkedin-browser-worker/src/browserbase.ts'), /solveCaptchas: false/);
});
