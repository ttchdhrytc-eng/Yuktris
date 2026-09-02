import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { productionAcceptanceScheduleCandidate } from './production-acceptance-schedule.js';
import type { QueueItem } from './queue.js';

const authorizationId = '3141bc20-d8cf-4498-abe8-1c4a3b976cb7';
const item = (overrides: Partial<QueueItem> = {}): QueueItem => ({
  id: 'bfd969b5-9890-44a8-8982-36b034e83e0c', workspace_id: 'workspace', account_id: 'sender',
  action_type: 'connection_request', action_params: { production_acceptance_authorization_id: authorizationId },
  status: 'running', priority: 1, retry_count: 0, max_retries: 0,
  ...overrides,
} as QueueItem);
const root = resolve(process.cwd(), '../..');
const worker = readFileSync(resolve(root, 'workers/linkedin-browser-worker/src/worker.ts'), 'utf8');
const migration = readFileSync(resolve(root, 'supabase/migrations/20260902094500_production_acceptance_schedule_attestation.sql'), 'utf8');

test('only the exact disabled-mode selector binding becomes an attestation candidate', () => {
  assert.equal(productionAcceptanceScheduleCandidate(item(), authorizationId, false), authorizationId);
  assert.equal(productionAcceptanceScheduleCandidate(item(), null, false), null);
  assert.equal(productionAcceptanceScheduleCandidate(item(), '00000000-0000-4000-8000-000000000000', false), null);
  assert.equal(productionAcceptanceScheduleCandidate(item(), authorizationId, true), null);
});

test('arbitrary connection request or metadata cannot obtain an exemption', () => {
  assert.equal(productionAcceptanceScheduleCandidate(item({ action_params: {} }), authorizationId, false), null);
  assert.equal(productionAcceptanceScheduleCandidate(item({ action_params: { acceptance_test_mode: true, purpose: 'production_single_action_acceptance' } }), authorizationId, false), null);
  assert.equal(productionAcceptanceScheduleCandidate(item({ action_type: 'send_message' }), authorizationId, false), null);
});

test('database attestation binds lifecycle, claim, sender, Context, target, name and no-note payload', () => {
  for (const token of [
    "a.status<>'executing'", 'a.expires_at<=now()', 'a.queue_item_id<>q.id', 'a.attempt_id<>p_attempt_id',
    'a.worker_id<>p_worker_id', 'q.workspace_id<>a.workspace_id', 'q.account_id<>a.linkedin_account_id',
    "q.action_type<>'connection_request'", 'q.idempotency_key<>a.idempotency_key',
    "production_acceptance_authorization_id", "profile_url", "expected_display_name", 'a.persistent_context_id',
    "c.status='active'", "q.action_params ? 'note'", "q.action_params ? 'message'",
  ]) assert.match(migration, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('attested acceptance bypasses only campaign scheduling; normal writes retain fail-closed schedule checks', () => {
  assert.match(worker, /validate_production_acceptance_schedule_exemption/);
  assert.match(worker, /if \(!scheduleExempt\)[\s\S]*Campaign schedule missing[\s\S]*campaign_outreach_preflight/);
  assert.match(worker, /productionAcceptanceScheduleCandidate/);
});

test('dedicated preflight and post-interaction no-retry protections remain in the execution path', () => {
  assert.match(worker, /preflightLinkedInWrite\(this\.client, item\)/);
  assert.match(worker, /retryAllowed = !interactionCrossed && result\.data\?\.retry_allowed !== false/);
});
