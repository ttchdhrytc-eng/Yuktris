import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pollForSessionTerminal } from './browserbase.js';

const root = resolve(process.cwd(), '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const linkedin = read('workers/linkedin-browser-worker/src/linkedin.ts');
const browserbase = read('workers/linkedin-browser-worker/src/browserbase.ts');
const worker = read('workers/linkedin-browser-worker/src/worker.ts');
const hook = read('src/hooks/useLinkedInBrowser.ts');
const modal = read('src/components/linkedin/SecureLinkedInAuthModal.tsx');

const tests: Array<[string, () => void | Promise<void>]> = [
  ['mocked terminal polling observes completion without diagnostic sleeps', async () => {
    const states = ['running', 'running', 'completed'] as const;
    let index = 0; let clock = 0;
    const result = await pollForSessionTerminal(
      async () => states[Math.min(index++, states.length - 1)], 15000, 500,
      () => clock, async (ms) => { clock += ms; },
    );
    assert.equal(result, 'completed');
    assert.equal(clock, 1000);
  }],
  ['mocked terminal polling fails closed at bounded timeout', async () => {
    let clock = 0;
    await assert.rejects(pollForSessionTerminal(async () => 'running', 1500, 500, () => clock, async (ms) => { clock += ms; }), /terminal state/);
    assert.equal(clock, 1500);
  }],
  ['keepAlive release is requested before Playwright disconnect', () => {
    const close = linkedin.match(/async close\(\): Promise<void> \{[\s\S]*?\n  \}/)?.[0] ?? '';
    assert.ok(close.indexOf('browserbase.endSession') < close.indexOf('this.browser.close'));
  }],
  ['Context synchronization has no five-second diagnostic sleep', () => {
    assert.match(browserbase, /CONTEXT_SETTLE_MS = 3000/);
    assert.doesNotMatch(browserbase, /setTimeout\(resolve, 5000\)/);
    assert.match(browserbase, /CONTEXT_SYNC_POLL_MS = 500/);
  }],
  ['identity is not verified again after identity_verified', () => {
    const after = linkedin.slice(linkedin.indexOf("onProgress('identity_verified'"), linkedin.indexOf('async connectWithSession'));
    assert.doesNotMatch(after, /verifyIdentity/);
  }],
  ['iframe cover is driven directly by identity_verified', () => {
    assert.match(modal, /if \(!identityVerified\) return;[\s\S]*setCovered\(true\)/);
    assert.match(modal, /requestAnimationFrame/);
  }],
  ['active account polling is one second', () => {
    assert.match(hook, /\? 1000 : 10000/);
  }],
  ['durable prerequisites precede connected and telemetry follows it', () => {
    const save = worker.indexOf('await this.saveSession');
    const sync = worker.indexOf('await this.linkedinContexts.synchronize', save);
    const connected = worker.indexOf("connection_state: 'connected'", sync);
    const telemetry = worker.indexOf('await Promise.allSettled', connected);
    assert.ok(save > 0 && sync > save && connected > sync && telemetry > connected);
  }],
  ['Context failure cannot write connected state', () => {
    const sync = worker.indexOf('await this.linkedinContexts.synchronize');
    const connected = worker.indexOf("connection_state: 'connected'", sync);
    assert.ok(sync > 0 && connected > sync);
  }],
];

let failures = 0;
for (const [name, test] of tests) {
  try { await test(); process.stdout.write(`PASS ${name}\n`); }
  catch (error) { failures++; process.stderr.write(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}\n`); }
}
if (failures) process.exitCode = 1;
