import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { failureOutcomeForStage, hasPotentialExternalEffect, WRITE_INTERACTION_STAGES } from './write-interaction-stage.js';

const root = resolve(process.cwd(), '../..');
const runner = readFileSync(resolve(root, 'supabase/functions/linkedin-job-runner/index.ts'), 'utf8');
const worker = readFileSync(resolve(root, 'workers/linkedin-browser-worker/src/worker.ts'), 'utf8');
const queue = readFileSync(resolve(root, 'workers/linkedin-browser-worker/src/queue.ts'), 'utf8');
const migration = readFileSync(resolve(root, 'supabase/migrations/20260828190000_post_pilot_write_safety_remediation.sql'), 'utf8');

test('originating job retry budgets are copied monotonically to the browser queue', () => {
  assert.match(runner, /retry_count:\s*retryPolicy\.consumed/);
  assert.match(runner, /max_retries:\s*retryPolicy\.maximum/);
  assert.match(runner, /Number\(item\.retry_count\) >= policy\.consumed/);
  assert.match(runner, /Number\(item\.max_retries\) <= policy\.maximum/);
  assert.match(runner, /missing or invalid retry policy/);
  for (const [jobBudget, queueBudget] of [[0, 0], [1, 1], [3, 3]]) assert.ok(queueBudget <= jobBudget);
});

test('all potentially external exception stages are outcome_unknown and nonretryable', () => {
  const postInteraction = [
    'before_connect_click', 'connect_clicked', 'confirmation_present', 'before_confirmation_click',
    'confirmation_click_attempted', 'confirmation_clicked', 'before_message_send', 'message_send_attempted',
    'message_sent', 'post_write_verification',
  ] as const;
  for (const stage of postInteraction) {
    assert.equal(hasPotentialExternalEffect(stage), true);
    assert.deepEqual(failureOutcomeForStage(stage, 'crash'), {
      result_code: 'outcome_unknown', write_verified: false, retry_allowed: false,
      interaction_crossed: true, interaction_stage: stage, error: 'crash',
    });
  }
  for (const stage of ['not_started', 'profile_verified', 'relationship_verified', 'connect_control_resolved'] as const) {
    assert.equal(failureOutcomeForStage(stage, 'safe').result_code, 'failed');
  }
  assert.equal(new Set(WRITE_INTERACTION_STAGES).size, WRITE_INTERACTION_STAGES.length);
});

test('durable stage and stale recovery guard cover crash lease loss and SIGTERM semantics', () => {
  assert.match(migration, /record_linkedin_write_interaction_stage/);
  assert.match(migration, /OLD\.interaction_crossed[\s\S]*outcome_unknown[\s\S]*retry_allowed/);
  assert.match(migration, /guard_linkedin_write_stale_recovery_trigger/);
  assert.match(migration, /browserbase_session_id[\s\S]*persistent_context_id/);
  assert.match(queue, /recordBrowserCorrelation[\s\S]*recordWriteStage/);
});

test('worker persists pre-click boundaries and structured exception outcomes', () => {
  for (const stage of ['before_connect_click', 'connect_clicked', 'before_confirmation_click', 'confirmation_click_attempted', 'confirmation_clicked', 'before_message_send', 'message_send_attempted']) {
    assert.match(worker, new RegExp(`recordWriteStage\\('${stage}'`));
  }
  assert.match(worker, /interactionCrossed[\s\S]*result_code: 'outcome_unknown'[\s\S]*retry_allowed: false/);
  assert.match(queue, /fail_queue_task_with_result/);
});

test('confirmation overlay resolver is bounded and never force-clicks or dispatches DOM clicks', () => {
  assert.match(worker, /interop-outlet\[data-testid="interop-shadowdom"\]/);
  assert.match(worker, /timeout: 2500/);
  assert.match(worker, /getByRole\('button'/);
  assert.match(worker, /Unknown LinkedIn UI obstruction/);
  assert.doesNotMatch(worker, /force:\s*true/);
  assert.doesNotMatch(worker, /dispatchEvent\([^)]*click|\.evaluate\([^)]*\.click\(/);
});

test('message and follow-up use the same durable send boundary', () => {
  assert.match(worker, /case 'send_message':[\s\S]*case 'follow_up_message':[\s\S]*before_message_send[\s\S]*message_send_attempted/);
  assert.match(worker, /exact_outbound_message_bubble/);
});
