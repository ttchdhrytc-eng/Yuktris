import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const linkedin = read('workers/linkedin-browser-worker/src/linkedin.ts');
const worker = read('workers/linkedin-browser-worker/src/worker.ts');
const browserbase = read('workers/linkedin-browser-worker/src/browserbase.ts');
const modal = read('src/components/linkedin/SecureLinkedInAuthModal.tsx');
const fastPath = read('workers/linkedin-browser-worker/src/persistent-fast-path.test.ts');
const challengeStart = linkedin.indexOf('private async waitForAuthenticationWithChallenges');
const challengeEnd = linkedin.indexOf('private async detectChallengeDetailed', challengeStart);
const challengeWait = linkedin.slice(challengeStart, challengeEnd);

const tests: Array<[string, () => void]> = [
  ['first-time CAPTCHA pins one page and remains observation-only', () => {
    assert.match(challengeWait, /pinnedChallengePage = this\.page/);
    assert.match(challengeWait, /assessAuthentication\(pinnedChallengePage \?\? undefined, pinnedChallengePage === null\)/);
    assert.match(challengeWait, /worker_action: 'observe_only'/);
  }],
  ['challenge loop performs no navigation reload click fill or submission', () => {
    assert.doesNotMatch(challengeWait, /\.goto\(|\.reload\(|\.click\(|\.fill\(|\.press\(|\.submit\(/);
  }],
  ['challenge loop creates no page Context Browserbase session or credentials', () => {
    assert.doesNotMatch(challengeWait, /newPage\(|newContext\(|createSession\(|openLinkedIn\(|session_key|session_password/);
  }],
  ['same queue attempt remains held and renewable during human challenge', () => {
    assert.match(worker, /setInterval\([\s\S]*this\.queue\.renew\(item\.id\)/);
    assert.match(challengeWait, /browser_execution_queue[\s\S]*status === 'cancelled'/);
  }],
  ['challenge timeout and cancellation are non-retryable', () => {
    assert.match(linkedin, /authentication not completed within timeout[\s\S]*nonRetryable: true/);
    assert.match(linkedin, /cancelled: true, nonRetryable: true/);
    assert.match(worker, /result\.retryable === true \|\| !isNonRetryable/);
  }],
  ['provider rechallenge is navigation-derived and remains passive', () => {
    assert.match(challengeWait, /providerRechallenge[\s\S]*mainFrameNavigationCount !== lastChallengeNavigationCount/);
    assert.match(challengeWait, /classification: providerRechallenge \? 'provider_rechallenge' : 'human_challenge_required'/);
    assert.match(challengeWait, /onProgress\('provider_rechallenge'/);
  }],
  ['safe telemetry contains booleans and never logs secret state', () => {
    assert.match(challengeWait, /login_form_exists:/);
    assert.match(challengeWait, /authenticated_cookie_exists:/);
    assert.match(challengeWait, /challenge_occurrence_count:/);
    assert.doesNotMatch(challengeWait, /cookie\.value|storageState|captcha_token|password:/i);
  }],
  ['authenticated completion continues through identity and session finalization', () => {
    const connect = linkedin.match(/async connect\([\s\S]*?\n  }\n\n  \/\/ .*RESTORE SESSION/)?.[0] ?? linkedin;
    assert.match(connect, /authResult\.authenticated[\s\S]*verifyIdentityWithRetry[\s\S]*getIdentityMismatch[\s\S]*captureSession/);
  }],
  ['identity mismatch after challenge remains fail closed', () => {
    assert.match(linkedin, /getIdentityMismatch\(identity, intendedIdentity\)[\s\S]*nonRetryable: true/);
  }],
  ['rechallenge UX explains provider verification and preserves Cancel', () => {
    assert.match(modal, /LinkedIn is requesting additional verification/);
    assert.match(modal, /cancel and try again later/);
    assert.match(modal, /!covered && <Button[^>]+onClick=\{onCancel\}/);
  }],
  ['session configuration remains stable and fast path remains covered', () => {
    assert.match(browserbase, /solveCaptchas: false/);
    assert.match(browserbase, /viewport/);
    assert.match(fastPath, /healthy Context publishes neither auth_required nor Live View/);
  }],
];

let failures = 0;
for (const [name, test] of tests) {
  try { test(); process.stdout.write(`PASS ${name}\n`); }
  catch (error) { failures++; process.stderr.write(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}\n`); }
}
if (failures) process.exitCode = 1;
