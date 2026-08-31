import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskOwnershipLifecycle } from './task-ownership.js';
import { isProcessUniqueWorkerId, runtimeWorkerId, runtimeWorkerIdentity } from './worker-identity.js';

const actions = ['check_connection_acceptance', 'connection_request', 'send_message', 'follow_up_message'];

for (const action of actions) test(`${action} starts ownership before a slow pre-interaction path`, async () => {
  const calls: string[] = [];
  const lifecycle = new TaskOwnershipLifecycle({ renew: async () => { calls.push('renew'); return true; } }, action, () => calls.push('lost'), () => calls.push('error'), 1_000_000);
  await lifecycle.start();
  calls.push('slow_browser_preparation');
  lifecycle.stop();
  assert.deepEqual(calls, ['renew', 'slow_browser_preparation']);
});

test('controlled clock keeps read, connection, message, and follow-up owned beyond 90 seconds', async () => {
  for (const action of actions) {
    let expiresAt = 90_000;
    let now = 0;
    const renew = async () => { if (expiresAt <= now) return false; expiresAt = now + 90_000; return true; };
    assert.equal(await renew(), true);
    for (now = 30_000; now <= 180_000; now += 30_000) assert.equal(await renew(), true, action);
    assert.ok(expiresAt > 180_000, action);
  }
});

test('one transient renewal error is tolerated but two consecutive errors lose ownership', async () => {
  const outcomes: Array<true | Error> = [true, new Error('transient'), true, new Error('one'), new Error('two')];
  let lost = 0;
  const timers: Array<() => void> = [];
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  global.setInterval = ((callback: () => void) => { timers.push(callback); return 1 as unknown as ReturnType<typeof setInterval>; }) as typeof setInterval;
  global.clearInterval = (() => {}) as typeof clearInterval;
  try {
    const lifecycle = new TaskOwnershipLifecycle({ renew: async () => { const value=outcomes.shift()!; if(value instanceof Error)throw value; return value; } }, 'q', () => { lost++; }, () => {}, 30_000);
    await lifecycle.start();
    for (let i=0;i<4;i++) { timers[0](); await new Promise(resolve => setImmediate(resolve)); }
    lifecycle.stop();
    assert.equal(lost, 1);
  } finally { global.setInterval=originalSetInterval;global.clearInterval=originalClearInterval; }
});

test('each process gets a unique claimant while child controllers can inherit it exactly', () => {
  const env={WORKER_ID:'worker-1',RAILWAY_DEPLOYMENT_ID:'dep',RAILWAY_REPLICA_ID:'replica'} as NodeJS.ProcessEnv;
  const first=runtimeWorkerId(env),second=runtimeWorkerId(env);
  assert.notEqual(first,second);
  assert.match(first,/^v1:worker-1:dep:replica:/);
  assert.equal(isProcessUniqueWorkerId(first),true);
});

test('one process identity is stable for claim, renew, complete, fail, release, account lease, and child controller', () => {
  const identity=runtimeWorkerIdentity({WORKER_NAME:'worker-1',RAILWAY_DEPLOYMENT_ID:'dep-a',RAILWAY_REPLICA_ID:'replica-a'} as NodeJS.ProcessEnv,'123e4567-e89b-42d3-a456-426614174000');
  const operations=['claim','renew','complete','fail','release','account_lease','child_controller'];
  const owners=operations.map(()=>identity.id);
  assert.equal(new Set(owners).size,1);
  assert.equal(isProcessUniqueWorkerId(identity.id),true);
});

test('generic, empty, malformed, and legacy durable identities are rejected', () => {
  for(const value of ['', 'worker-1', 'worker', 'default', 'worker-1:dep:replica:123e4567-e89b-42d3-a456-426614174000', 'v1:worker-1:dep:replica:not-a-uuid', null])
    assert.equal(isProcessUniqueWorkerId(value),false,String(value));
});

test('rolling deployment processes cannot impersonate each other', () => {
  const oldIdentity=runtimeWorkerIdentity({WORKER_NAME:'worker-1',RAILWAY_DEPLOYMENT_ID:'old',RAILWAY_REPLICA_ID:'replica'} as NodeJS.ProcessEnv,'123e4567-e89b-42d3-a456-426614174000');
  const newIdentity=runtimeWorkerIdentity({WORKER_NAME:'worker-1',RAILWAY_DEPLOYMENT_ID:'new',RAILWAY_REPLICA_ID:'replica'} as NodeJS.ProcessEnv,'123e4567-e89b-42d3-a456-426614174001');
  assert.notEqual(oldIdentity.id,newIdentity.id);
  assert.equal(isProcessUniqueWorkerId(oldIdentity.id),true);
  assert.equal(isProcessUniqueWorkerId(newIdentity.id),true);
});

test('invalid identity components fail startup construction', () => {
  assert.throws(()=>runtimeWorkerIdentity({WORKER_NAME:'bad:name'} as NodeJS.ProcessEnv),/Invalid worker identity/);
  assert.throws(()=>runtimeWorkerIdentity({} as NodeJS.ProcessEnv,'not-a-uuid'),/runtime ID/);
});
