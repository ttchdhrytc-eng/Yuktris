import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(process.cwd(), '../..');
const sql = readFileSync(resolve(root, 'supabase/migrations/20260902100000_production_acceptance_execution_boundary.sql'), 'utf8');
const worker = readFileSync(resolve(root, 'workers/linkedin-browser-worker/src/worker.ts'), 'utf8');
const queue = readFileSync(resolve(root, 'workers/linkedin-browser-worker/src/queue.ts'), 'utf8');

test('future claims start an immutable monotonic execution-boundary ledger', () => {
  for (const marker of [
    'claimed_pre_browserbase',
    'browserbase_acquisition_started',
    'browserbase_acquired',
    'live_pre_interaction',
    'interaction_boundary_crossed',
    'terminal_pre_browserbase_attested',
  ]) assert.match(sql, new RegExp(marker));
  assert.match(sql, /acceptance_boundary_regression_denied/);
  assert.match(sql, /greatest\(acceptance_max_boundary,r\)/);
  assert.match(sql, /acceptance_boundary_events_immutable BEFORE UPDATE OR DELETE/);
  assert.match(sql, /GRANT SELECT ON public\.linkedin_production_acceptance_boundary_events TO service_role/);
  assert.doesNotMatch(sql, /GRANT SELECT,INSERT ON public\.linkedin_production_acceptance_boundary_events/);
});

test('worker persists each boundary before crossing the next risk boundary', () => {
  assert.match(queue, /advance_production_acceptance_execution_boundary/);
  const started = worker.indexOf("'browserbase_acquisition_started'");
  const open = worker.indexOf('this.openPersistentContextForTask(item)', started);
  const acquired = worker.indexOf("'browserbase_acquired'", open);
  const live = worker.indexOf("'live_pre_interaction'", acquired);
  const preflight = worker.indexOf('preflightLinkedInWrite(this.client, item)', live);
  assert.ok(started >= 0 && started < open && open < acquired && acquired < live && live < preflight);
  const crossed = worker.indexOf("'interaction_boundary_crossed'");
  const inMemoryCrossed = worker.indexOf('interactionCrossed = interactionCrossed || crossed', crossed);
  assert.ok(crossed >= 0 && crossed < inMemoryCrossed);
});

test('positive Class B attestation is limited to terminal failure at claim-only rank', () => {
  assert.match(sql, /OLD\.status='running' AND NEW\.status='failed'/);
  assert.match(sql, /OLD\.acceptance_max_boundary=10/);
  assert.match(sql, /OLD\.browserbase_session_id IS NULL AND OLD\.persistent_context_id IS NULL/);
  assert.match(sql, /NOT OLD\.interaction_crossed AND OLD\.retry_count=0/);
  assert.match(sql, /q\.acceptance_terminal_attestation<>'terminal_pre_browserbase_attested'/);
  assert.match(sql, /c<>1 OR t<>1 OR m<>10/);
  for (const contradiction of ['browserbase_session_id', 'persistent_context_id', 'interaction_crossed', 'linkedin_write_audit', 'linkedin_write_interaction_events'])
    assert.match(sql, new RegExp(contradiction));
});

test('missing, acquisition-started, acquired, live, crossed, ambiguous and successful evidence fail closed', () => {
  assert.match(sql, /q\.acceptance_max_boundary<>10 OR a\.max_execution_boundary<>10/);
  assert.match(sql, /acceptance_terminal_attested_at IS NULL/);
  assert.match(sql, /outcome_unknown','success/);
  assert.match(sql, /CLASS_C_NON_REPLACEABLE/);
});

test('pristine-expired replacement policy is preserved and historical rows are never backfilled', () => {
  assert.match(sql, /status='prepared'[\s\S]*production_linkedin_acceptance_replacement_eligibility_pristine_only/);
  assert.doesNotMatch(sql, /UPDATE public\.browser_execution_queue SET acceptance_max_boundary=(10|20|30|40|50)/);
  assert.doesNotMatch(sql, /3141bc20-d8cf-4498-abe8-1c4a3b976cb7|bfd969b5-9890-44a8-8982-36b034e83e0c/);
});
