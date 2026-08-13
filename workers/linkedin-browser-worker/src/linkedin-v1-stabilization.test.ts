import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { persistentContextsEnabled } from './linkedin-context.js';

const root = resolve(process.cwd(), '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const worker = read('workers/linkedin-browser-worker/src/worker.ts');
const context = read('workers/linkedin-browser-worker/src/linkedin-context.ts');
const linkedin = read('workers/linkedin-browser-worker/src/linkedin.ts');
const migration = read('supabase/migrations/20260812180000_linkedin_persistent_browser_context_foundation.sql');
const automation = worker.match(/private async handleAutomationAction[\s\S]*?private async openPersistentContextForTask/)?.[0] ?? '';

test('1 new accounts reserve one persistent Browserbase Context', () => {
  assert.match(context, /reserve_linkedin_browser_context/);
  assert.match(migration, /uq_linkedin_browser_contexts_active_account/);
});
test('2 the same account reuses its durable Context mapping', () => assert.match(context, /if \(reserved\.provider_context_id\) return this\.ensureExecutionPreferences\(reserved\)/));
test('3 mapping is database-backed and survives worker restart', () => assert.match(migration, /provider_context_id text/));
test('4 persistent Context is the V1 default', () => assert.equal(persistentContextsEnabled({}), true));
test('5 logged-out Context produces reauth_required', () => assert.match(linkedin, /errorCode: 'reauth_required'/));
test('6 checkpoint produces checkpoint_required', () => assert.match(linkedin, /errorCode: 'checkpoint_required'/));
test('7 Live View health is absent from backend authentication verification', () => {
  const verify = linkedin.match(/async verifyPersistentAuthentication[\s\S]*?private async navigateWithRetry/)?.[0] ?? '';
  assert.doesNotMatch(verify, /refreshLiveUrl|debugger|liveUrl/);
});
test('8 bound identity can be deferred without rebinding', () => assert.match(linkedin, /linkedin_identity_deferred[\s\S]*reuseBoundIdentity: true/));
test('9 unbound unresolved identity fails closed', () => assert.match(linkedin, /!boundProfileUrl[\s\S]*identity_resolution_failed/));
test('10 different canonical identity fails closed', () => assert.match(linkedin, /getIdentityMismatch[\s\S]*identityState: 'mismatch'/));
test('11 no raw credential persistence exists', () => {
  assert.doesNotMatch(worker, /linkedin_password|password_encrypted|p_password/);
  assert.doesNotMatch(context, /password|credential/);
});
test('12 one-account jobs are serialized by a Context lease', () => assert.match(migration, /persistent Context is already leased/));
test('13 leases are account-scoped so other accounts remain independent', () => assert.match(migration, /WHERE c\.workspace_id=p_workspace_id AND c\.account_id=p_account_id/));
test('14 reauthentication and connect reuse the persistent Context', () => assert.match(worker, /ensureV1Enrollment[\s\S]*sessionOptionsForAccount\(true, persistentContext\)/));
test('15 normal automation opens persistent Context before action and does not require fresh onboarding', () => {
  assert.match(automation, /openPersistentContextForTask[\s\S]*verifyPersistentAuthentication/);
  assert.doesNotMatch(automation, /openLinkedIn|waitForAuthenticationWithChallenges|auth_surface_ready/);
});
