import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const worker = read('workers/linkedin-browser-worker/src/worker.ts');
const linkedin = read('workers/linkedin-browser-worker/src/linkedin.ts');
const onboarding = read('src/pages/OnboardingPage.tsx');
const accounts = read('src/pages/LinkedInAccountsPage.tsx');
const automation = read('src/pages/LinkedInAutomationPage.tsx');

const tests: Array<[string, () => void]> = [
  ['healthy Context is checked before auth UI is exposed', () => {
    const check = worker.indexOf('checkExistingAuthenticatedSession');
    const authRequired = worker.indexOf("onProgress('auth_required'", check);
    const expose = worker.indexOf('browserbase_session_id: bbSessionId', check);
    assert.ok(check > 0 && authRequired > check && expose > check);
    assert.match(worker, /launch\(usePersistentContext \? undefined : onProgress/);
  }],
  ['healthy Context verifies authentication and identity without requiring encrypted capture', () => {
    const check = linkedin.match(/async checkExistingAuthenticatedSession[\s\S]*?\n {2}\}/)?.[0] ?? '';
    assert.match(check, /verifyPersistentAuthentication\(intendedIdentity\)/);
    assert.doesNotMatch(check, /captureSession/);
    const verify = linkedin.match(/async verifyPersistentAuthentication[\s\S]*?private async navigateWithRetry/)?.[0] ?? '';
    assert.match(verify, /navigateWithRetry\(this\.page, LINKEDIN_FEED_URL/);
    assert.match(verify, /verifyIdentity/);
    assert.match(verify, /getIdentityMismatch/);
  }],
  ['healthy Context publishes neither auth_required nor Live View', () => {
    const branch = worker.match(/if \(preflight\.result\)[\s\S]*?\} else \{/)?.[0] ?? '';
    assert.doesNotMatch(branch, /auth_required|browserbase_live_url|browserbase_session_id: bbSessionId/);
    assert.match(branch, /existing_session_authenticated/);
  }],
  ['logged out or expired Context explicitly requests human auth', () => {
    assert.match(linkedin, /errorCode === 'reauth_required'[\s\S]*authRequired: true/);
    assert.match(worker, /onProgress\('auth_required'/);
  }],
  ['checkpoint preserves the current page for passive human completion', () => {
    assert.match(linkedin, /preserveCurrentPage: result\.errorCode === 'checkpoint_required'/);
    assert.match(worker, /preflight\.preserveCurrentPage/);
  }],
  ['identity mismatch cannot connect or request alternate login', () => {
    assert.match(linkedin, /identityMismatch[\s\S]*nonRetryable: true/);
    const verify = linkedin.match(/async verifyPersistentAuthentication[\s\S]*?private async navigateWithRetry/)?.[0] ?? '';
    assert.match(verify, /getIdentityMismatch[\s\S]*identityState: 'mismatch'/);
    assert.doesNotMatch(verify, /captureSession/);
  }],
  ['manual V1 exposes Live View for ordinary auth_required and challenges', () => {
    assert.match(onboarding, /event\.queue_item_id === linkedinQueueItemId[\s\S]*event\.step === 'auth_required'/);
    assert.match(onboarding, /open=\{[\s\S]*linkedinAuthRequired\}/);
    assert.match(accounts, /open=\{authRequired\}/);
    assert.match(automation, /open=\{showPanel && authRequired/);
  }],
  ['checking and interactive copy are distinct', () => {
    assert.match(onboarding, /Checking your LinkedIn session/);
    assert.match(onboarding, /Sign in to LinkedIn once in the secure browser/);
  }],
  ['fast-path timing stages P0 through P10 are present', () => {
    for (let stage = 0; stage <= 8; stage++) assert.match(worker, new RegExp(`P${stage}_`));
    assert.match(onboarding, /P9_frontend_connected_observed/);
    assert.match(onboarding, /P10_success_ui_rendered/);
  }],
];

let failures = 0;
for (const [name, test] of tests) {
  try { test(); process.stdout.write(`PASS ${name}\n`); }
  catch (error) { failures++; process.stderr.write(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}\n`); }
}
if (failures) process.exitCode = 1;
