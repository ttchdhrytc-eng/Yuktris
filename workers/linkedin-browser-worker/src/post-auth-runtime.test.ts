import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { classifyLinkedInAuthentication, type AuthenticationSignals } from './linkedin.js';

const base: AuthenticationSignals = {
  isCheckpoint: false,
  isLogin: false,
  isAuthenticatedRoute: false,
  loginForm: false,
  checkpointControl: false,
  globalNav: false,
  meControl: false,
  feedContent: false,
  hasSessionCookie: false,
};
const root = resolve(process.cwd(), '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const linkedin = read('workers/linkedin-browser-worker/src/linkedin.ts');
const worker = read('workers/linkedin-browser-worker/src/worker.ts');
const modal = read('src/components/linkedin/SecureLinkedInAuthModal.tsx');
const onboarding = read('src/pages/OnboardingPage.tsx');
const hook = read('src/hooks/useLinkedInBrowser.ts');

const tests: Array<[string, () => void]> = [
  ['device approval landing on feed is authenticated with cookie and no challenge', () => {
    assert.deepEqual(classifyLinkedInAuthentication({ ...base, isAuthenticatedRoute: true, hasSessionCookie: true }), { state: 'authenticated', confidence: 'high' });
  }],
  ['feed route alone never authenticates', () => {
    assert.equal(classifyLinkedInAuthentication({ ...base, isAuthenticatedRoute: true }).state, 'unknown');
  }],
  ['active challenge wins over feed route and cookie', () => {
    assert.equal(classifyLinkedInAuthentication({ ...base, isCheckpoint: true, isAuthenticatedRoute: true, hasSessionCookie: true }).state, 'checkpoint');
  }],
  ['login form wins over an incidental session cookie', () => {
    assert.equal(classifyLinkedInAuthentication({ ...base, isLogin: true, loginForm: true, hasSessionCookie: true }).state, 'unauthenticated');
  }],
  ['identity resolution is bounded and precedes current-attempt event', () => {
    assert.match(linkedin, /IDENTITY_RESOLUTION_ATTEMPTS = 4/);
    const resolveIdentity = linkedin.indexOf('verifyIdentityWithRetry(queueItemId, workspaceId, accountId)');
    const mismatch = linkedin.indexOf('getIdentityMismatch(identity, intendedIdentity)', resolveIdentity);
    const emit = linkedin.indexOf("onProgress('identity_verified'", mismatch);
    assert.ok(resolveIdentity > 0 && mismatch > resolveIdentity && emit > mismatch);
  }],
  ['stale queue identity event cannot cover current attempt', () => {
    assert.match(onboarding, /event\.queue_item_id === linkedinQueueItemId/);
  }],
  ['polling fetches the newest interaction window rather than stale history', () => {
    const query = hook.match(/export function useAuthInteractions[\s\S]*?export function useCancelAuthInteraction/)?.[0] ?? '';
    assert.match(query, /order\('created_at', \{ ascending: false \}\)/);
    assert.match(query, /\.limit\(50\)/);
    assert.match(query, /\.reverse\(\)/);
  }],
  ['current queue identity event covers and unmounts immediately', () => {
    assert.match(modal, /setCovered\(true\)/);
    assert.match(modal, /requestAnimationFrame\(\(\) => \{[\s\S]*setIframeMounted\(false\)/);
    assert.match(modal, /iframeMounted && safeUrl/);
  }],
  ['cancel is available before verification and removed after cover', () => {
    assert.match(modal, /!covered && <div[\s\S]*?<Button[^>]+onClick=\{onCancel\}/);
  }],
  ['persistence failure remains fail closed after identity verification', () => {
    const verified = worker.indexOf('browserbase_session_id: null');
    const save = worker.indexOf('await this.saveSession', verified);
    const saveFailure = worker.indexOf("connection_state: 'failed'", save);
    const connected = worker.indexOf("connection_state: 'connected'", save);
    assert.ok(verified > 0 && save > verified && saveFailure > save && connected > saveFailure);
  }],
  ['previously bound reconnect still applies mismatch protection', () => {
    assert.match(worker, /loadIntendedIdentity\(accountId, workspaceId\)/);
    assert.match(linkedin, /Authenticated LinkedIn profile does not match the account being connected/);
  }],
];

let failures = 0;
for (const [name, test] of tests) {
  try { test(); process.stdout.write(`PASS ${name}\n`); }
  catch (error) { failures++; process.stderr.write(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}\n`); }
}
if (failures) process.exitCode = 1;
