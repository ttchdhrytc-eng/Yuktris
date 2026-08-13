import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { sessionTimeoutSeconds } from './browserbase.js';

test('interactive Browserbase lifetime is converted from milliseconds to API seconds', () => {
  assert.equal(sessionTimeoutSeconds(2_100_000), 2100);
  assert.equal(sessionTimeoutSeconds(60_001), 61);
  assert.equal(sessionTimeoutSeconds(), undefined);
});

test('Browserbase API timeout bounds fail before a provider request', () => {
  assert.throws(() => sessionTimeoutSeconds(59_000), /between 60 and 21600 seconds/);
  assert.throws(() => sessionTimeoutSeconds(21_601_000), /between 60 and 21600 seconds/);
});

test('LinkedIn connect sessions outlive the bounded 30-minute human challenge window', () => {
  const worker = readFileSync('src/worker.ts', 'utf8');
  const linkedin = readFileSync('src/linkedin.ts', 'utf8');
  assert.match(worker, /BROWSERBASE_INTERACTIVE_SESSION_TIMEOUT_MS \|\| '2100000'/);
  assert.match(worker, /launchOptions = \{[\s\S]*timeoutMs: INTERACTIVE_BROWSER_SESSION_TIMEOUT_MS/);
  assert.match(linkedin, /MAX_AUTH_ATTEMPT_LIFETIME_MS = 30 \* 60 \* 1000/);
});
