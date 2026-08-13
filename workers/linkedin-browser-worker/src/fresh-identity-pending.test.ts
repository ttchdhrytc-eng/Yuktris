import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const linkedin = read('workers/linkedin-browser-worker/src/linkedin.ts');
const worker = read('workers/linkedin-browser-worker/src/worker.ts');
const fresh = linkedin.match(/async connect\([\s\S]*?async connectWithSession/)?.[0] ?? '';
const restored = linkedin.match(/async connectWithSession[\s\S]*?async testConnection/)?.[0] ?? '';
const handler = worker.match(/private async handleConnect[\s\S]*?private async handleTestConnection/)?.[0] ?? '';

test('1 fresh authenticated resolved identity succeeds', () => {
  assert.match(fresh, /verifyIdentityWithRetry[\s\S]*return \{ success: true, identity, session/);
});

test('2 OTP-completed authentication follows the same verified fresh path', () => {
  assert.match(fresh, /waitForAuthenticationWithChallenges[\s\S]*authResult\.authenticated[\s\S]*fresh_authentication_verified/);
});

test('3 unresolved unbound fresh identity is explicit and never a secure-window failure', () => {
  assert.match(fresh, /identityDecision\.state === 'deferred'[\s\S]*if \(!identity\)[\s\S]*errorCode: 'identity_resolution_pending'/);
  assert.doesNotMatch(fresh, /else if \(this\.bbSession\)[\s\S]*browserbase_live_view_failed/);
});

test('4 genuine auth-surface authorization failure retains its provider classification', () => {
  assert.match(linkedin, /recoverAuthSurface[\s\S]*browserbase_live_view_failed/);
});

test('5 restored bound unresolved identity fails closed', () => {
  assert.match(restored, /if \(!identity\)[\s\S]*errorCode: 'identity_resolution_failed'/);
});

test('6 incomplete authentication cannot report connected', () => {
  assert.match(fresh, /if \(!authResult\.authenticated\)[\s\S]*success: false/);
});

test('7 unbound fresh unresolved identity is captured but never bound or connected', () => {
  const unresolved = fresh.match(/if \(!identity\) \{[\s\S]*?errorCode: 'identity_resolution_pending'[\s\S]*?\n      \}/)?.[0] ?? '';
  assert.match(unresolved, /captureSession/);
  assert.doesNotMatch(unresolved, /bindAuthenticatedIdentity|success: true|identity_verified/);
  assert.match(handler, /identity_resolution_pending[\s\S]*saveSession[\s\S]*connection_state: 'requires_action'/);
});
