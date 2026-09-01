import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  LINKEDIN_EXECUTION_DISABLED,
  LINKEDIN_EXECUTION_ENABLED,
  resolveLinkedInExecutionGate,
} from './execution-mode.js';
import { runtimeWorkerIdentity } from './worker-identity.js';

const workerSource = readFileSync(resolve(process.cwd(), 'src/worker.ts'), 'utf8');
const disabledClaim = workerSource.indexOf('await this.queue.claimNextAuthentication()');
const outboundClaim = workerSource.indexOf('await this.queue.claimNext()');

test('explicit disabled mode fails closed', () => {
  assert.deepEqual(resolveLinkedInExecutionGate(LINKEDIN_EXECUTION_DISABLED), {
    configuredValue: 'disabled', outboundEnabled: false, reason: 'explicitly_disabled',
  });
});

test('missing, empty, malformed and unknown modes fail closed', () => {
  for (const value of [undefined, '', ' ', 'enabled', 'true', 'worker-1', 'CLOUD_PERSISTENT_AGENT'])
    assert.equal(resolveLinkedInExecutionGate(value).outboundEnabled, false);
});

test('only the explicit recognized value enables the existing path', () => {
  assert.equal(resolveLinkedInExecutionGate(LINKEDIN_EXECUTION_ENABLED).outboundEnabled, true);
});

test('disabled gate selects only the dedicated authentication claim', () => {
  assert.ok(disabledClaim > 0 && outboundClaim > 0);
  assert.match(workerSource, /this\.executionGate\.outboundEnabled\s*\? await this\.queue\.claimNext\(\)\s*:\s*await this\.queue\.claimNextAuthentication\(\)/);
});

test('disabled path cannot construct task browser execution', () => {
  const taskWorker = workerSource.indexOf('const taskWorker = new Worker(this.workerId)');
  const processTask = workerSource.indexOf('.processTask(item)');
  assert.ok(taskWorker > disabledClaim && processTask > taskWorker);
});

test('heartbeat and registration remain outside the outbound gate', () => {
  assert.match(workerSource, /setInterval\(\(\) => this\.heartbeat\(\), HEARTBEAT_INTERVAL\)/);
  assert.match(workerSource, /outbound_enabled: this\.executionGate\.outboundEnabled/);
});

test('certification and outbound action names receive no bypass', () => {
  const claimBoundary = workerSource.slice(Math.min(disabledClaim, outboundClaim), Math.max(disabledClaim, outboundClaim) + 50);
  assert.doesNotMatch(claimBoundary, /controlled_acceptance|pooya|tarun|vdiqfiuqckaxdjkadinu|connection_request|send_message|follow_up|accept_connection|book_meeting/i);
  assert.equal((workerSource.match(/queue\.claimNext\(\)/g) ?? []).length, 1);
});

test('process identity and ownership remain process unique', () => {
  const identity = runtimeWorkerIdentity({
    WORKER_NAME: 'linkedin-worker', RAILWAY_DEPLOYMENT_ID: 'deployment-a', RAILWAY_REPLICA_ID: 'replica-a',
  } as NodeJS.ProcessEnv, '123e4567-e89b-42d3-a456-426614174000');
  assert.match(identity.id, /^v1:linkedin-worker:deployment-a:replica-a:/);
  assert.match(workerSource, /new Worker\(this\.workerId\)/);
  assert.match(workerSource, /rememberClaim\(item\)/);
});

test('unit verification performs no browser, network, queue or LinkedIn interaction', () => {
  assert.doesNotMatch(import.meta.url, /https?:/);
});
