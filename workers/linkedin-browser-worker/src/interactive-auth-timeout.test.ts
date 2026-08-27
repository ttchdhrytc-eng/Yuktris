import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  interactiveAuthTimeoutMs,
  interactiveBrowserSessionTimeoutMs,
} from './interactive-auth-config.js';

test('ordinary manual authentication receives the full 30-minute budget', () => {
  assert.equal(interactiveAuthTimeoutMs({}), 30 * 60 * 1000);
});

test('provider lifetime exceeds the human authentication deadline by five minutes', () => {
  assert.equal(interactiveBrowserSessionTimeoutMs({}), 35 * 60 * 1000);
  assert.ok(interactiveBrowserSessionTimeoutMs({}) > interactiveAuthTimeoutMs({}));
});

test('incompatible configured deadlines fail before session creation', () => {
  assert.throws(() => interactiveBrowserSessionTimeoutMs({
    INTERACTIVE_AUTH_TIMEOUT_MS: '1800000',
    BROWSERBASE_INTERACTIVE_SESSION_TIMEOUT_MS: '1800000',
  }), /must exceed/);
});

test('automatic and challenge login use separate bounded lifecycles', () => {
  const linkedin = readFileSync('src/linkedin.ts', 'utf8');
  assert.match(linkedin, /AUTOMATIC_LOGIN_RESULT_TIMEOUT_MS = 45 \* 1000/);
  assert.match(linkedin, /normalDeadline = startedAt \+ \(automaticCredentialLogin/);
  assert.match(linkedin, /absoluteDeadline = startedAt \+ MAX_AUTH_ATTEMPT_LIFETIME_MS/);
  assert.match(linkedin, /Math\.min\(now \+ HUMAN_VERIFICATION_TIMEOUT_MS, absoluteDeadline\)/);
});

test('active queue and Context leases renew throughout the interactive wait', () => {
  const worker = readFileSync('src/worker.ts', 'utf8');
  assert.match(worker, /const leaseTimer = setInterval\(\(\) => \{[\s\S]*?\.renew\(item\.id\)/);
  assert.match(worker, /this\.linkedinContexts[\s\S]{0,30}\.renew\(active\.context\.id, active\.owner\)/);
  assert.match(worker, /\}, 30000\)/);
});

test('cancellation and provider failure remain prompt', () => {
  const linkedin = readFileSync('src/linkedin.ts', 'utf8');
  assert.match(linkedin, /if \(this\.cancellationReason\) return/);
  assert.match(linkedin, /if \(!this\.browser\?\.isConnected\(\)\)[\s\S]*recoverAuthSurface/);
});

test('terminal queues remain terminal and no timeout fallback creates another Context', () => {
  const worker = readFileSync('src/worker.ts', 'utf8');
  const migration = readFileSync('../../supabase/migrations/20260810090000_phase2a_linkedin_connection_hardening.sql', 'utf8');
  assert.match(migration, /complete_queue_task[\s\S]*status = 'running'[\s\S]*queue claim ownership lost/);
  assert.match(migration, /fail_queue_task[\s\S]*status='running'[\s\S]*queue claim ownership lost/);
  assert.doesNotMatch(worker, /login_timeout[\s\S]*ensureProvisioned/);
});

test('authorized Live View remains available for the full active human budget', () => {
  const migration = readFileSync('../../supabase/migrations/20260813200000_linkedin_interactive_auth_timeout_alignment.sql', 'utf8');
  assert.match(migration, /v_connected_at \+ interval '30 minutes'/);
  assert.match(migration, /v_event_at \+ interval '30 minutes'/);
});
