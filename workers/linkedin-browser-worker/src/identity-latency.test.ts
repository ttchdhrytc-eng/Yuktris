import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const linkedin = read('workers/linkedin-browser-worker/src/linkedin.ts');
const worker = read('workers/linkedin-browser-worker/src/worker.ts');
const fastPath = read('workers/linkedin-browser-worker/src/persistent-fast-path.test.ts');
const challenge = read('workers/linkedin-browser-worker/src/interactive-challenge.test.ts');
const start = linkedin.indexOf('private async verifyIdentity(', linkedin.indexOf('private async resolveAuthenticatedMeApiIdentity'));
const end = linkedin.indexOf('private async verifyIdentityWithRetry', start);
const resolver = linkedin.slice(start, end);

const tests: Array<[string, () => void]> = [
  ['canonical identity does not wait for irrelevant profile resources', () => {
    assert.match(resolver, /waitUntil: 'commit'/);
    assert.doesNotMatch(resolver, /networkidle|waitForLoadState|textContent\('h1'\)|waitForSelector/);
    assert.match(resolver, /document\.querySelector\('h1'\)/);
  }],
  ['authenticated self-navigation is attempted before profile navigation', () => {
    const dom = resolver.indexOf("'authenticated_navigation_dom'");
    const navigation = resolver.indexOf('this.page.goto(LINKEDIN_PROFILE_URL');
    assert.ok(dom > 0 && navigation > dom);
    assert.match(linkedin, /global-nav__me/);
  }],
  ['redirect identity requires a canonical personal LinkedIn URL', () => {
    assert.match(linkedin, /canonicalIdentityUrl[\s\S]*hostname\.endsWith\('\.linkedin\.com'\)/);
    assert.ok(linkedin.includes("^/in/([A-Za-z0-9_%.-]+)"));
    assert.match(linkedin, /toLowerCase\(\) === 'me'/);
  }],
  ['identity mismatch remains fail closed before capture', () => {
    const verify = linkedin.indexOf('const identityMismatch = this.getIdentityMismatch', linkedin.indexOf('async connect('));
    const capture = linkedin.indexOf('const session = await this.captureSession()', verify);
    assert.ok(verify > 0 && capture > verify);
    assert.match(linkedin.slice(verify, capture), /nonRetryable: true/);
  }],
  ['resolution failure cannot mark the account connected', () => {
    assert.match(linkedin, /if \(!identity\)[\s\S]*Identity verification failed/);
    const bind = worker.indexOf('await this.bindAuthenticatedIdentity(workspaceId, accountId, effectiveProfileUrl)');
    const connected = worker.indexOf("connection_state: 'connected'", bind);
    assert.ok(bind > 0 && connected > bind);
  }],
  ['identity resolution is invoked once per successful connect path', () => {
    const connectStart = linkedin.indexOf('async connect(');
    const connectEnd = linkedin.indexOf('async connectWithSession(', connectStart);
    const connect = linkedin.slice(connectStart, connectEnd > connectStart ? connectEnd : linkedin.length);
    assert.equal((connect.match(/verifyIdentityWithRetry\(/g) ?? []).length, 1);
  }],
  ['I0 through I6 and fallback timings are present and sanitized', () => {
    for (let stage = 0; stage <= 6; stage++) assert.match(resolver, new RegExp(`I${stage}_`));
    assert.match(resolver, /identity_fallback_started/);
    assert.match(resolver, /identity_fallback_completed/);
    assert.doesNotMatch(resolver, /cookie|token|storageState|liveUrl|wsUrl|CDP/i);
  }],
  ['persistent fast path and human challenge coverage remain intact', () => {
    assert.match(fastPath, /healthy Context publishes neither auth_required nor Live View/);
    assert.match(challenge, /challenge loop performs no navigation reload click fill or submission/);
  }],
];

let failures = 0;
for (const [name, test] of tests) {
  try { test(); process.stdout.write(`PASS ${name}\n`); }
  catch (error) { failures++; process.stderr.write(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}\n`); }
}
if (failures) process.exitCode = 1;
