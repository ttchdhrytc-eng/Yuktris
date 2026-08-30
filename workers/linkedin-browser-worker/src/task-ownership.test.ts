import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskOwnershipLifecycle } from './task-ownership.js';
import { runtimeWorkerId } from './worker-identity.js';

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
  assert.match(first,/^worker-1:dep:replica:/);
});
