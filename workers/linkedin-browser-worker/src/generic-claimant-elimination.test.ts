import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=resolve(process.cwd(),'../..');
const migration=readFileSync(resolve(root,'supabase/migrations/20260831100000_fail_closed_process_unique_worker_claims.sql'),'utf8');
const worker=readFileSync(resolve(root,'workers/linkedin-browser-worker/src/worker.ts'),'utf8');
const queue=readFileSync(resolve(root,'workers/linkedin-browser-worker/src/queue.ts'),'utf8');
const index=readFileSync(resolve(root,'workers/linkedin-browser-worker/src/index.ts'),'utf8');

test('server rejects generic, empty, null, and malformed identities before queue recovery or claim',()=>{
  assert.match(migration,/IF NOT public\.is_process_unique_worker_identity\(p_worker_id\) THEN[\s\S]*invalid_process_unique_worker_identity/);
  const guard=migration.indexOf('IF NOT public.is_process_unique_worker_identity');
  assert.ok(guard<migration.indexOf('recover_expired_browser_queue_leases'));
  assert.match(migration,/coalesce\(p_worker_id ~ [\s\S]*,false\)/);
});

test('historical generic identities remain readable because no historical row rewrite or constraint is added',()=>{
  assert.doesNotMatch(migration,/worker_id\s*=\s*'worker-1'/i);
  assert.doesNotMatch(migration,/DELETE FROM public\.(linkedin_queue_lease_events|browser_workers)/i);
  assert.doesNotMatch(migration,/ADD\s+CONSTRAINT/i);
});

test('startup constructs one identity and logs safe correlation metadata',()=>{
  assert.match(index,/const identity = runtimeWorkerIdentity\(\)/);
  assert.match(index,/worker_name: identity\.workerName[\s\S]*deployment_id: identity\.deploymentId[\s\S]*replica_id: identity\.replicaId[\s\S]*runtime_id: identity\.runtimeId/);
  assert.match(index,/new Worker\(identity\.id\)/);
});

test('worker and child controller fail closed and inherit the exact claimant identity',()=>{
  assert.match(worker,/isProcessUniqueWorkerId\(this\.workerId\)[\s\S]*process-unique v1 contract/);
  assert.match(worker,/const taskWorker = new Worker\(this\.workerId\)/);
});

test('outbound work shares the guarded claimant while authentication has a restricted claimant',()=>{
  for(const action of ['check_connection_acceptance','connection_request','send_message','follow_up_message'])
    assert.match(worker,new RegExp(action));
  assert.match(worker,/this\.executionGate\.outboundEnabled\s*\? await this\.queue\.claimNext\(\)\s*:\s*await this\.queue\.claimNextAuthentication\(\)/);
  assert.match(queue,/item\.action_type !== 'linkedin_connect'/);
});

test('preinteraction recovery and postinteraction outcome_unknown safety remain in force',()=>{
  const recovery=readFileSync(resolve(root,'supabase/migrations/20260830180000_worker_lease_identity_and_infrastructure_recovery.sql'),'utf8');
  assert.match(recovery,/safe_preinteraction_requeue/);
  assert.match(recovery,/terminal_outcome_unknown/);
  assert.match(recovery,/interaction_crossed[\s\S]*outcome_unknown/);
});

test('same-account serialization and cross-account concurrency remain enabled',()=>{
  assert.match(migration,/ON CONFLICT ON CONSTRAINT linkedin_account_browser_leases_pkey/);
  assert.match(worker,/MAX_CONCURRENT_ACCOUNTS/);
});
