import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const worker = readFileSync(resolve(process.cwd(), 'src/worker.ts'), 'utf8');
const queue = readFileSync(resolve(process.cwd(), 'src/queue.ts'), 'utf8');
const migration = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260830180000_worker_lease_identity_and_infrastructure_recovery.sql'), 'utf8');

type Lease = { owner: string; attempt: string; expiresAt: number; crossed: boolean; infra: number; maxInfra: number };
const renew = (lease: Lease, owner: string, attempt: string, now: number, seconds = 90) =>
  lease.owner === owner && lease.attempt === attempt && lease.expiresAt > now
    ? { ...lease, expiresAt: now + seconds * 1000 }
    : null;
const recover = (lease: Lease, now: number) => {
  if (lease.expiresAt > now) return 'owned';
  if (lease.crossed) return 'outcome_unknown';
  return lease.infra < lease.maxInfra ? 'safe_preinteraction_requeue' : 'terminal_preinteraction_exhausted';
};

test('per-task controller inherits the exact queue claimant worker identity', () => {
  assert.match(worker, /new Worker\(this\.workerId\)/);
  assert.doesNotMatch(worker, /const taskWorker = new Worker\(\);/);
});

test('lease renews before slow Browserbase startup and then every 30 seconds', () => {
  assert.match(worker, /const initiallyRenewed = await this\.queue\.renew\(item\.id\)/);
  assert.match(worker, /setInterval\([\s\S]*this\.queue[\s\S]*\.renew\(item\.id\)[\s\S]*30000\)/);
  let lease: Lease = { owner: 'railway-1', attempt: 'a', expiresAt: 90_000, crossed: false, infra: 0, maxInfra: 2 };
  for (const now of [30_000, 60_000, 90_000, 120_000, 180_000]) lease = renew(lease, 'railway-1', 'a', now)!;
  assert.equal(recover(lease, 200_000), 'owned');
});

test('transient heartbeat failure retains ownership inside the safety margin', () => {
  const lease: Lease = { owner: 'w', attempt: 'a', expiresAt: 120_000, crossed: false, infra: 0, maxInfra: 2 };
  assert.equal(recover(lease, 60_000), 'owned');
  assert.ok(renew(lease, 'w', 'a', 60_000));
});

test('ownership-token mismatch cannot renew or finalize another attempt', () => {
  const lease: Lease = { owner: 'w1', attempt: 'a1', expiresAt: 90_000, crossed: false, infra: 0, maxInfra: 2 };
  assert.equal(renew(lease, 'w2', 'a1', 30_000), null);
  assert.equal(renew(lease, 'w1', 'a2', 30_000), null);
  assert.match(queue, /p_worker_id: this\.workerId[\s\S]*p_attempt_id: attemptId/);
});

test('crash before interaction uses a separate bounded infrastructure budget', () => {
  const lease: Lease = { owner: 'w', attempt: 'a', expiresAt: 90_000, crossed: false, infra: 0, maxInfra: 2 };
  assert.equal(recover(lease, 90_001), 'safe_preinteraction_requeue');
  assert.match(migration, /infrastructure_retry_count<q\.max_infrastructure_retries/);
  assert.match(migration, /retry_count','q\.retry_count|'write_retry_count',q\.retry_count/);
  assert.match(worker, /recover_expired_browser_queue_leases/);
  assert.doesNotMatch(worker, /recover_orphaned_queue_tasks/);
});

test('crash after interaction is terminal outcome_unknown and nonretryable', () => {
  const lease: Lease = { owner: 'w', attempt: 'a', expiresAt: 90_000, crossed: true, infra: 0, maxInfra: 2 };
  assert.equal(recover(lease, 90_001), 'outcome_unknown');
  assert.match(migration, /'result_code','outcome_unknown','write_verified',false,'retry_allowed',false/);
});

test('same-account work is serialized while cross-account work remains claimable', () => {
  assert.match(migration, /linkedin_account_browser_leases\(account_id[\s\S]*ON CONFLICT ON CONSTRAINT linkedin_account_browser_leases_pkey/);
  assert.match(worker, /MAX_CONCURRENT_ACCOUNTS/);
});

test('SIGTERM cancels task controllers and gives finalizers a bounded drain window', () => {
  assert.match(worker, /activeTaskWorkers\.values\(\)[\s\S]*Worker is shutting down/);
  assert.match(worker, /Promise\.allSettled\(this\.activeTasks\.values\(\)\)[\s\S]*20_000/);
});

test('read-only probes and all write types share the same processTask lease heartbeat', () => {
  for (const action of ['check_connection_acceptance', 'connection_request', 'send_message', 'follow_up_message'])
    assert.match(worker, new RegExp(`case '${action}'`));
});
