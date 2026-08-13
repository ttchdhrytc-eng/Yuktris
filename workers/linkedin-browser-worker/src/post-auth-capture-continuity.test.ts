import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { classifyLinkedInAuthentication } from './linkedin.js';

const root = resolve(process.cwd(), '..', '..');
const linkedin = readFileSync(resolve(root, 'workers/linkedin-browser-worker/src/linkedin.ts'), 'utf8');
const fresh = linkedin.match(/async connect\([\s\S]*?async connectWithSession/)?.[0] ?? '';
const capture = linkedin.match(/async captureSession\([\s\S]*?async restoreSession/)?.[0] ?? '';
const restored = linkedin.match(/async connectWithSession[\s\S]*?async testConnection/)?.[0] ?? '';

const base = {
  isCheckpoint: false, isLogin: false, isAuthenticatedRoute: false,
  loginForm: false, checkpointControl: false, globalNav: false,
  meControl: false, feedContent: false, hasSessionCookie: false,
};

test('1 fresh feed proof survives canonical profile navigation into capture', () => {
  assert.match(fresh, /authenticationProof[\s\S]*verifyIdentityWithRetry[\s\S]*captureSession\(authenticationProof, 'verified'\)/);
});

test('2 OTP completion uses the same current-attempt authentication proof', () => {
  assert.match(fresh, /waitForAuthenticationWithChallenges[\s\S]*authResult\.authenticated[\s\S]*authenticationProof/);
});

test('3 authenticated product route plus trusted cookie classifies authenticated', () => {
  assert.deepEqual(classifyLinkedInAuthentication({ ...base, isAuthenticatedRoute: true, hasSessionCookie: true }), { state: 'authenticated', confidence: 'high' });
  assert.match(linkedin, /\^\\\/\(feed\|mynetwork\|jobs\|messaging\|notifications\|in\)/);
});

test('4 Live View transport is not consulted during post-auth capture', () => {
  assert.doesNotMatch(capture, /refreshLiveUrl|getLiveUrls|debugger|liveUrl|recoverAuthSurface/);
});

test('5 actual Playwright disconnect invalidates proof', () => {
  assert.match(capture, /this\.browser\.isConnected\(\)[\s\S]*authentication_proof_continuity_lost/);
});

test('6 missing authenticated cookie fails closed', () => {
  assert.match(capture, /authenticatedCookiePresent[\s\S]*Cannot capture LinkedIn session without an authenticated session cookie/);
});

test('7 identity mismatch precedes capture', () => {
  assert.ok(fresh.indexOf('getIdentityMismatch') < fresh.indexOf("captureSession(authenticationProof, 'verified')"));
});

test('8 unresolved unbound identity cannot connect', () => {
  const unresolved = fresh.match(/if \(!identity\)[\s\S]*?\n      \}/)?.[0] ?? '';
  assert.match(unresolved, /success: false[\s\S]*identity_resolution_pending/);
  assert.doesNotMatch(unresolved, /success: true/);
});

test('9 restored-session fast path has no current-attempt proof change and fails unresolved identity', () => {
  assert.doesNotMatch(restored, /authenticationProof|post_auth_capture/);
  assert.match(restored, /errorCode: 'identity_resolution_failed'/);
});

test('10 normal fresh attempt creates no second Browserbase session', () => {
  assert.doesNotMatch(fresh, /browserbase\.createSession|this\.launch\(/);
});
