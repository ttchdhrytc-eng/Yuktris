import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const modal = read('src/components/linkedin/SecureLinkedInAuthModal.tsx');
const onboarding = read('src/pages/OnboardingPage.tsx');
const accounts = read('src/pages/LinkedInAccountsPage.tsx');
const automation = read('src/pages/LinkedInAutomationPage.tsx');
const hook = read('src/hooks/useLinkedInBrowser.ts');
const linkedin = read('workers/linkedin-browser-worker/src/linkedin.ts');
const worker = read('workers/linkedin-browser-worker/src/worker.ts');
const loginAccessMigration = read('supabase/migrations/20260812170000_linkedin_human_auth_continuity.sql');

const tests: Array<[string, () => void]> = [
  ['connect surfaces an embedded authorized authentication modal', () => {
    assert.match(onboarding, /<SecureLinkedInAuthModal/);
    assert.match(accounts, /<SecureLinkedInAuthModal/);
    assert.match(automation, /<SecureLinkedInAuthModal/);
    assert.match(modal, /<iframe/);
    assert.match(hook, /get_linkedin_login_access/);
  }],
  ['normal LinkedIn auth flow never opens a raw new window', () => {
    for (const source of [modal, onboarding, accounts, automation]) assert.doesNotMatch(source, /window\.open\(/);
    assert.doesNotMatch(accounts, /browserbase_live_url/);
    assert.doesNotMatch(automation, /browserbase_live_url/);
  }],
  ['Live View remains workspace and account authorized', () => {
    assert.match(loginAccessMigration, /is_workspace_member\(p_workspace_id\)/);
    assert.match(loginAccessMigration, /a\.id=p_account_id AND a\.workspace_id=p_workspace_id/);
    assert.match(hook, /p_workspace_id: workspace\.id/);
    assert.match(hook, /p_account_id: accountId/);
  }],
  ['identity_verified follows canonical identity and mismatch checks', () => {
    const verify = linkedin.indexOf('const identity = await this.verifyIdentityWithRetry(queueItemId, workspaceId, accountId)');
    const mismatch = linkedin.indexOf('const identityMismatch = this.getIdentityMismatch', verify);
    const emit = linkedin.indexOf("onProgress('identity_verified'", mismatch);
    const capture = linkedin.indexOf('const session = await this.captureSession()', emit);
    assert.ok(verify > 0 && mismatch > verify && emit > mismatch && capture > emit);
  }],
  ['saving_session is not the frontend hide signal', () => {
    assert.match(modal, /identityVerified/);
    assert.doesNotMatch(modal, /saving_session/);
    assert.doesNotMatch(onboarding, /latestLinkedinProgress\?\.step === 'saving_session'/);
  }],
  ['identity mismatch cannot emit identity_verified', () => {
    const mismatchReturn = linkedin.indexOf('return { success: false, error: identityMismatch');
    const emit = linkedin.indexOf("onProgress('identity_verified'");
    assert.ok(mismatchReturn > 0 && emit > mismatchReturn);
  }],
  ['checkpoint remains visible and passive', () => {
    assert.match(modal, /securityCheckRequired && !covered/);
    assert.match(modal, /Complete it directly in this secure browser/);
    assert.doesNotMatch(modal, /\.click\(|\.fill\(|otp|captcha_solution/i);
  }],
  ['identity verification immediately covers then unmounts iframe', () => {
    assert.match(modal, /setCovered\(true\)/);
    assert.match(modal, /requestAnimationFrame\(\(\) => setIframeMounted\(false\)\)/);
    assert.match(modal, /absolute inset-0 z-10/);
    assert.match(modal, /iframeMounted && safeUrl/);
    assert.match(onboarding, /event\.queue_item_id === linkedinQueueItemId/);
    assert.match(accounts, /event\.queue_item_id === currentQueueItemId/);
  }],
  ['finishing state remains while durable backend finalizes', () => {
    assert.match(modal, /Securing your LinkedIn connection/);
    const revoke = worker.indexOf('browserbase_session_id: null');
    const save = worker.indexOf('await this.saveSession', revoke);
    const connected = worker.indexOf("connection_state: 'connected'", save);
    assert.ok(revoke > 0 && save > revoke && connected > save);
  }],
  ['connected onboarding state is durable and Next is explicit', () => {
    assert.match(onboarding, /connection_state === 'connected'/);
    assert.match(onboarding, /session_status === 'connected'/);
    assert.match(onboarding, /status === 'active'/);
    assert.match(onboarding, /linkedinAccount\.profile_url/);
    const completionEffect = onboarding.match(/if \(step !== 'linkedin' \|\| !linkedinConnected[\s\S]*?\}, \[linkedinConnected, step\]\);/)?.[0] ?? '';
    assert.doesNotMatch(completionEffect, /setStep/);
    assert.match(onboarding, /onNext=\{goNext\}/);
  }],
  ['healthy connected accounts do not expose a modal and expired accounts reconnect in place', () => {
    assert.match(onboarding, /!linkedinConnected && !linkedinFailed && !linkedinExpired/);
    assert.match(accounts, /existingAccountId: acc\.id/);
    assert.match(onboarding, /existingAccountId: linkedinAccountId/);
    assert.doesNotMatch(automation, /'connecting_browser', 'connected'/);
  }],
  ['only human connect publishes Live View and access is revoked after capture', () => {
    const connectHandler = worker.match(/private async handleConnect[\s\S]*?private async handleTestConnection/)?.[0] ?? '';
    const rest = worker.replace(connectHandler, '');
    assert.match(connectHandler, /browserbase_live_url: liveUrl/);
    assert.doesNotMatch(rest, /browserbase_live_url: liveUrl/);
    assert.match(worker, /browserbase_session_id: null, browser_connected_at: null/);
    assert.match(worker, /await this\.linkedin\.neutralizeVisiblePage\(\)/);
  }],
  ['customer UI and logs do not expose credentials cookies or provider endpoints', () => {
    assert.doesNotMatch(modal, /api[_-]?key|wsEndpoint|connectUrl|cookie/i);
    assert.match(modal, /Yuktris never sees or stores your password/);
    assert.doesNotMatch(worker, /logger\.[a-z]+\([^\n]*(cookies_encrypted|storage_state_encrypted|browserbase_live_url)/i);
  }],
];

let failed = 0;
for (const [name, test] of tests) {
  try { test(); process.stdout.write(`PASS ${name}\n`); }
  catch (error) { failed++; process.stderr.write(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}\n`); }
}
if (failed) process.exitCode = 1;
