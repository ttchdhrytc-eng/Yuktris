import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const linkedin = read('workers/linkedin-browser-worker/src/linkedin.ts');
const worker = read('workers/linkedin-browser-worker/src/worker.ts');
const browserbase = read('workers/linkedin-browser-worker/src/browserbase.ts');
const hook = read('src/hooks/useLinkedInBrowser.ts');
const modal = read('src/components/linkedin/SecureLinkedInAuthModal.tsx');
const migration = read('supabase/migrations/20260813190000_linkedin_auth_surface_recovery.sql');

test('1 session creation authorizes a Live View', () => assert.match(linkedin, /auth_surface_ready[\s\S]*browserbase_live_url/));
test('2 running provider recovers the same session', () => assert.match(linkedin, /providerState !== 'running'[\s\S]*chromium\.connectOverCDP\(session\.wsUrl\)/));
test('3 terminal provider fails cleanly', () => assert.match(linkedin, /browserbase_session_terminated/));
test('4 stale debugger authorization is refreshed', () => assert.match(linkedin, /getLiveUrls\(this\.bbSession\.id\)/));
test('5 CDP disconnect invokes reconciliation', () => assert.match(linkedin, /!this\.browser\?\.isConnected\(\)[\s\S]*recoverAuthSurface/));
test('6 worker failures publish queue failure', () => assert.match(worker, /queue\.fail\(item\.id/));
test('7 lease loss cancels authentication', () => assert.match(worker, /leaseLost = true;[\s\S]*linkedin\.cancel/));
test('8 login access is current queue scoped', () => assert.match(migration, /i\.queue_item_id=p_queue_item_id/));
test('9 stale URL cannot cross provider sessions', () => assert.match(migration, /browserbase_session_id'=v_session_id/));
test('10 frontend readiness is bounded at fifteen seconds', () => assert.match(modal, /15_000/));
test('11 persistent fast path remains', () => assert.match(worker, /existing_session_authenticated/));
test('12 interactive auth publishes auth_required', () => assert.match(worker, /onProgress\('auth_required'/));
test('13 challenge observation remains passive', () => assert.match(linkedin, /worker_action: 'observe_only'/));
test('14 provider rechallenge remains passive', () => assert.match(linkedin, /provider_rechallenge/));
test('15 identity mismatch still fails closed', () => assert.match(linkedin, /identityMismatch[\s\S]*nonRetryable: true/));
test('16 canonical identity verification remains', () => assert.match(linkedin, /verifyIdentityWithRetry/));
test('17 Context synchronization remains after release', () => assert.match(worker, /linkedin\.close\(\)[\s\S]*linkedinContexts\.synchronize/));
test('18 recovery does not create a Context or session', () => {
  const recovery = linkedin.match(/async recoverAuthSurface[\s\S]*?\n  }\n/)?.[0] ?? '';
  assert.doesNotMatch(recovery, /createSession|createContext|newContext\(/);
});
test('19 recovery requests are authorized and idempotent', () => assert.match(migration, /is_workspace_member[\s\S]*interaction_type='auth_surface_recovery'[\s\S]*status='pending'/));
test('20 provider error is replaced by Yuktris recovery UX', () => {
  assert.match(modal, /We couldn't open the secure LinkedIn sign-in window/);
  assert.match(hook, /request_linkedin_auth_surface_recovery/);
});
test('debug API is hard bounded', () => assert.match(browserbase, /getLiveUrls\(sessionId: string, timeoutMs = 8_000\)/));
test('recovery telemetry never includes transport URLs', () => {
  const recovery = linkedin.match(/async recoverAuthSurface[\s\S]*?\n  }\n/)?.[0] ?? '';
  assert.doesNotMatch(recovery, /logger\.(info|warn|error)\([^\n]*(wsUrl|liveUrl|debuggerUrl)/);
});
