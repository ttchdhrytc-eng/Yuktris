import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(process.cwd(), '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const linkedin = read('workers/linkedin-browser-worker/src/linkedin.ts');
const worker = read('workers/linkedin-browser-worker/src/worker.ts');
const baseline = read('supabase/migrations/20260810080000_production_compatible_baseline.sql');
const restore = linkedin.match(/async connectWithSession[\s\S]*?async testConnection/)?.[0] ?? '';
const handler = worker.match(/private async handleConnect[\s\S]*?private async handleTestConnection/)?.[0] ?? '';

test('1 authenticated bound restore fails closed when self identity is unresolved', () => {
  assert.match(restore, /if \(!identity\)[\s\S]*success: false[\s\S]*identityState: 'unresolved'/);
});
test('2 critical path performs only one fast identity attempt', () => {
  assert.match(restore, /resolveAuthenticatedSelfIdentity\(1,[\s\S]*FAST_REUSE_IDENTITY_TIMEOUT_MS/);
  assert.doesNotMatch(restore, /verifyIdentityWithRetry/);
});
test('3 unresolved bound identity cannot mark connected', () => {
  assert.match(restore, /success: false[\s\S]*identityState: 'unresolved'/);
  assert.match(restore, /errorCode: 'identity_resolution_failed'/);
});
test('4 reliable resolved mismatch remains fail closed', () => assert.match(restore, /identityMismatch[\s\S]*nonRetryable: true[\s\S]*identityState: 'mismatch'/));
test('5 authenticated existing session exposes no Live View', () => {
  const successfulReuse = handler.match(/if \(reuseResult\.success\)[\s\S]*?return;/)?.[0] ?? '';
  assert.doesNotMatch(successfulReuse, /auth_required|browserbase_live_url|auth_surface_ready/);
});
test('6 authenticated existing session opens no credential flow', () => {
  const successfulReuse = handler.match(/if \(reuseResult\.success\)[\s\S]*?return;/)?.[0] ?? '';
  assert.doesNotMatch(successfulReuse, /linkedin\.connect\(|ready_for_login/);
});
test('7 normal connection attempt has one Browserbase session maximum', () => assert.match(handler, /if \(!reuseOpenBrowserForAuthentication\) await withinStartupDeadline\([\s\S]*this\.linkedin\.launch/));
test('8 orchestration states are not written to durable account status', () => {
  for (const state of ['checking_existing_session','identity_resolution_pending','identity_resolution_failed','auth_required','auth_surface_ready','recovering_auth_surface']) {
    assert.doesNotMatch(worker, new RegExp(`status: '${state}'`));
  }
});
test('9 every worker durable account status is schema valid', () => {
  const valid = new Set(['active','paused','restricted','banned','expired','pending_login','connected','disconnected','error']);
  const accountUpdates = [...worker.matchAll(/updateAccount\([\s\S]*?\);/g)].map(match => match[0]);
  const writes = accountUpdates.flatMap(update => [...update.matchAll(/(?<!connection_|session_)status:\s*'([^']+)'/g)].map(match => match[1]));
  for (const value of writes) assert.ok(valid.has(value), `invalid account status candidate: ${value}`);
  assert.match(baseline, /linkedin_accounts_status_check[\s\S]*'error'/);
});
test('10 failed is never written to linkedin_accounts status', () => assert.doesNotMatch(worker, /updateAccount\([^\n]*status: 'failed'/));
test('11 logged-out restore still requires authentication in same browser', () => assert.match(restore, /unauthenticated[\s\S]*requiresAction: true, reuseExistingBrowser: true/));
test('12 checkpoint restore remains passive', () => assert.match(restore, /authState: 'checkpoint'[\s\S]*preserveCurrentPage: true/));
test('13 encrypted session remains required for restored reuse', () => assert.match(handler, /loadSessionForAccount[\s\S]*connectWithSession/));
test('14 persistent Context authenticated reuse remains intact', () => assert.match(handler, /checkExistingAuthenticatedSession[\s\S]*existing_session_authenticated/));
