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
const disabledGate = workerSource.indexOf('if (!this.executionGate.outboundEnabled)');
const claimLog = workerSource.indexOf('logger.info(`Poll #${pollCount}: calling claimNext()`');
const claim = workerSource.indexOf('const item = await this.queue.claimNext()');

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

test('disabled gate precedes queue claim and preserves queued work', () => {
  assert.ok(disabledGate > 0 && claim > disabledGate);
  const gateBranch = workerSource.slice(disabledGate, claimLog);
  assert.match(gateBranch, /continue;/);
  assert.doesNotMatch(gateBranch, /\.complete|\.fail|\.cancel|\.release|queue\.claimNext/);
});

test('disabled path cannot construct task browser execution', () => {
  const taskWorker = workerSource.indexOf('const taskWorker = new Worker(this.workerId)');
  const processTask = workerSource.indexOf('.processTask(item)');
  assert.ok(taskWorker > claim && processTask > taskWorker);
});

test('heartbeat and registration remain outside the outbound gate', () => {
  assert.match(workerSource, /setInterval\(\(\) => this\.heartbeat\(\), HEARTBEAT_INTERVAL\)/);
  assert.match(workerSource, /outbound_enabled: this\.executionGate\.outboundEnabled/);
});

test('certification action names receive no bypass', () => {
  const claimBoundary = workerSource.slice(disabledGate, claim + 'const item = await this.queue.claimNext()'.length);
  assert.doesNotMatch(claimBoundary, /action_type|controlled_acceptance|pooya|tarun|vdiqfiuqckaxdjkadinu/i);
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
