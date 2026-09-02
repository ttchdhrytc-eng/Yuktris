import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(process.cwd(), '../..');
const sql = readFileSync(resolve(root, 'supabase/migrations/20260902093000_production_acceptance_unattempted_supersession.sql'), 'utf8');

test('only expired pristine prepared reservations are eligible', () => {
  assert.match(sql, /a\.status<>'prepared'[\s\S]*a\.expires_at>now\(\)/);
  for (const evidence of ['queue_item_id', 'worker_id', 'attempt_id', 'preflighted_at', 'consumed_at', 'completed_at'])
    assert.match(sql, new RegExp(`a\\.${evidence} IS NOT NULL`));
  assert.match(sql, /a\.outcome IS NULL OR a\.outcome<>'\{\}'::jsonb/);
});

test('queue, retry history, write audit and interaction evidence all block replacement', () => {
  for (const code of [
    'queue_evidence_present', 'queue_history_evidence_present', 'external_write_audit_present', 'interaction_event_present',
    'interaction_crossed_evidence_present', 'ambiguous_outcome_present', 'successful_write_evidence_present',
    'relationship_evidence_present',
  ]) assert.match(sql, new RegExp(code));
  assert.match(sql, /browser_execution_queue[\s\S]*browser_execution_history[\s\S]*linkedin_write_audit[\s\S]*linkedin_write_interaction_events/);
  assert.match(sql, /outcome_unknown[\s\S]*outcome_or_uncertain_evidence_present/);
});

test('supersession preserves history and requires fresh approval', () => {
  assert.match(sql, /status='superseded',superseded_at=now\(\)/);
  assert.match(sql, /supersedes_authorization_id/);
  assert.match(sql, /superseded_by=v_id/);
  assert.match(sql, /fresh_human_approval_reference_required/);
  assert.doesNotMatch(sql, /DELETE FROM public\.linkedin_production_acceptance_authorizations/);
});

test('current reservation remains unique and attempted writes remain lifetime protected', () => {
  assert.match(sql, /CREATE UNIQUE INDEX production_acceptance_current_reservation_once[\s\S]*WHERE superseded_at IS NULL/);
  assert.match(sql, /linkedin_write_audit[\s\S]*target_identifier/);
  assert.match(sql, /REVOKE UPDATE,DELETE,TRUNCATE[\s\S]*FROM service_role/);
});

test('replacement retains every authorization binding and never creates executable work', () => {
  for (const binding of [
    'canonical_target_url', 'expected_display_name', 'linkedin_account_id', 'persistent_context_id',
    'provider_context_id', "'connection_request'", 'idempotency_key', 'approval_reference', 'expires_at',
  ]) assert.match(sql, new RegExp(binding.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(sql, /INSERT INTO public\.browser_execution_queue/);
  assert.match(sql, /'executable',false/);
});
