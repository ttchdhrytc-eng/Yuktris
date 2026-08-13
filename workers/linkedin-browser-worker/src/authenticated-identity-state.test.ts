import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(process.cwd(), '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const linkedin = read('workers/linkedin-browser-worker/src/linkedin.ts');
const worker = read('workers/linkedin-browser-worker/src/worker.ts');
const onboarding = read('src/pages/OnboardingPage.tsx');
const migration = read('supabase/migrations/20260813190000_linkedin_auth_surface_recovery.sql');
const restore = linkedin.match(/async connectWithSession[\s\S]*?async testConnection/)?.[0] ?? '';
const handler = worker.match(/private async handleConnect[\s\S]*?private async handleTestConnection/)?.[0] ?? '';

test('1 backend queue state replaces the obsolete receipt watchdog', () => {
  assert.doesNotMatch(onboarding, /linkedinWatchdogPhaseRef|linkedinAttemptTimerRef/);
  assert.match(onboarding, /activeLinkedinQueue/);
});
test('2 claimed attempt cannot be failed by a frontend timer', () => assert.doesNotMatch(onboarding, /linkedinAttemptTimeoutStage|worker did not claim/));
test('3 authenticated and verified restore connects', () => assert.match(restore, /identityState: 'verified'/));
test('4 authenticated unresolved identity is not session expiry', () => {
  assert.match(restore, /authState: 'authenticated', identityState: 'unresolved'/);
  assert.doesNotMatch(restore, /Session expired/);
});
test('5 authenticated unresolved identity creates no second session', () => assert.match(handler, /identity_state: reuseResult\.identityState[\s\S]*linkedin\.close\(\)[\s\S]*queue\.fail[\s\S]*return/));
test('6 authenticated unresolved identity never prompts for credentials', () => assert.doesNotMatch(restore, /auth_required|ready_for_login/));
test('7 logged-out restore requests human authentication', () => assert.match(restore, /unauthenticated[\s\S]*requiresAction: true, reuseExistingBrowser: true/));
test('8 logged-out restore reuses the same Browserbase session', () => assert.match(handler, /reuseOpenBrowserForAuthentication[\s\S]*if \(!reuseOpenBrowserForAuthentication\) await this\.linkedin\.launch/));
test('9 challenge restore preserves one passive page', () => assert.match(restore, /authState: 'checkpoint'[\s\S]*preserveCurrentPage: true/));
test('10 identity mismatch remains fail closed', () => assert.match(restore, /identityState: 'mismatch'/));
test('11 in-me is rejected without changing authenticated state', () => {
  assert.match(linkedin, /match\[1\]\.toLowerCase\(\) === 'me'/);
  assert.match(restore, /errorCode: 'identity_resolution_failed'/);
});
test('12 trustworthy authenticated profile links are accepted', () => {
  assert.match(linkedin, /data-test-global-nav-link="me"/);
  assert.match(linkedin, /link\[rel="canonical"\]/);
});
test('13 stale queue events cannot affect a new attempt', () => assert.match(onboarding, /event\.queue_item_id === linkedinQueueItemId/));
test('14 auth surface access remains current-session and queue scoped', () => {
  assert.match(migration, /i\.queue_item_id=p_queue_item_id/);
  assert.match(migration, /browserbase_session_id'=v_session_id/);
});
test('15 auth surface recovery remains same queue scoped', () => assert.match(migration, /q\.id=p_queue_item_id[\s\S]*interaction_type='auth_surface_recovery'/));
test('16 normal restore fallback has one session creation', () => {
  assert.match(handler, /if \(!reuseOpenBrowserForAuthentication\) await this\.linkedin\.launch/);
  assert.doesNotMatch(handler, /Previous session expired\. Starting fresh login/);
});
test('17 persistent Context fast path is unchanged', () => assert.match(handler, /checkExistingAuthenticatedSession[\s\S]*existing_session_authenticated/));
test('18 encrypted session persistence is unchanged', () => assert.match(handler, /bindAuthenticatedIdentity[\s\S]*saveSession[\s\S]*linkedinContexts\.synchronize/));
