import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { productionAcceptanceAuthorizationId } from './production-acceptance.js';

const root = resolve(process.cwd(), '../..');
const migration = readFileSync(resolve(root, 'supabase/migrations/20260901170000_production_single_action_acceptance_gate.sql'), 'utf8');
const targetOnce = readFileSync(resolve(root, 'supabase/migrations/20260901171000_production_acceptance_target_once.sql'), 'utf8');
const expectedName = readFileSync(resolve(root, 'supabase/migrations/20260902090000_production_acceptance_expected_display_name.sql'), 'utf8');
const worker = readFileSync(resolve(root, 'workers/linkedin-browser-worker/src/worker.ts'), 'utf8');
const queue = readFileSync(resolve(root, 'workers/linkedin-browser-worker/src/queue.ts'), 'utf8');
const safety = readFileSync(resolve(root, 'workers/linkedin-browser-worker/src/linkedin-execution-safety.ts'), 'utf8');

test('acceptance authorization selector is absent by default and rejects malformed values', () => {
  assert.equal(productionAcceptanceAuthorizationId(undefined), null);
  assert.equal(productionAcceptanceAuthorizationId(''), null);
  assert.equal(productionAcceptanceAuthorizationId('not-an-authorization'), null);
  assert.equal(productionAcceptanceAuthorizationId('4E5D1DE8-66E3-48CB-A419-FDB0F002FE6F'), '4e5d1de8-66e3-48cb-a419-fdb0f002fe6f');
});

test('disabled worker can claim only the explicitly configured acceptance authorization', () => {
  assert.match(worker, /this\.executionGate\.outboundEnabled[\s\S]*this\.acceptanceAuthorizationId[\s\S]*claimProductionAcceptance\(this\.acceptanceAuthorizationId\)[\s\S]*claimNextAuthentication/);
  assert.match(queue, /claim_production_linkedin_acceptance_task/);
  assert.match(queue, /item\.action_type !== 'connection_request'/);
  assert.match(queue, /production_acceptance_authorization_id !== authorizationId/);
});

test('production authorization is exact, expiring, one-attempt and context-bound', () => {
  for (const binding of [
    "project_ref = 'aljpmtuekghwzrnuwkat'", 'workspace_id', 'linkedin_account_id', 'persistent_context_id',
    'provider_context_id', 'canonical_target_url', "action_type = 'connection_request'", 'idempotency_key text NOT NULL UNIQUE',
    'expires_at', 'consumed_at', 'one_active_production_linkedin_acceptance',
  ]) assert.match(migration, new RegExp(binding.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(migration, /max_retries,\s*max_infrastructure_retries[\s\S]*'pending',0,0/);
  assert.match(migration, /q\.persistent_context_id=a\.persistent_context_id/);
  assert.match(migration, /a\.preflighted_at IS NOT NULL OR a\.consumed_at IS NOT NULL/);
  assert.match(migration, /production_acceptance_target_once[\s\S]*project_ref,workspace_id,linkedin_account_id,canonical_target_url,action_type/);
  assert.match(targetOnce, /production_acceptance_target_once[\s\S]*project_ref,workspace_id,linkedin_account_id,canonical_target_url,action_type/);
  for (const safety of ['hourly_action_limit', 'daily_connection_limit', 'daily_total_action_limit', 'minimum_write_interval_seconds', 'cooldown_until', 'outside_working_hours'])
    assert.match(migration, new RegExp(safety));
});

test('arming is separate from preparation and no target or authorization row is seeded', () => {
  assert.match(migration, /prepare_production_linkedin_acceptance/);
  assert.match(migration, /arm_production_linkedin_acceptance/);
  assert.doesNotMatch(migration, /INSERT INTO public\.linkedin_production_acceptance_authorizations[\s\S]*VALUES\s*\(\s*'[0-9a-f-]{36}'/i);
  assert.doesNotMatch(migration, /pooya|tarun|vdiqfiuqckaxdjkadinu|controlled_acceptance_generations|linkedin_staging_write_authorizations/i);
});

test('normal preflight remains separate and acceptance finalization reuses ambiguity accounting', () => {
  assert.match(safety, /authorizationId \? 'preflight_production_linkedin_acceptance_write' : 'preflight_linkedin_write'/);
  assert.match(safety, /finalize_production_linkedin_acceptance_write/);
  assert.match(migration, /PERFORM public\.finalize_linkedin_write_outcome/);
  assert.match(migration, /'outcome_unknown'[\s\S]*interaction_crossed/);
});

test('production acceptance binds and verifies expected display name before Connect', () => {
  assert.match(expectedName, /ADD COLUMN expected_display_name text/);
  assert.match(expectedName, /expected_display_name_required/);
  assert.match(expectedName, /'expected_display_name',a\.expected_display_name/);
  assert.match(expectedName, /action_params->>'expected_display_name'\) IS NOT DISTINCT FROM a\.expected_display_name/);
  const identityCheck = worker.indexOf('verifyLinkedInDisplayName(params.expected_display_name, displayedName)');
  const connectClick = worker.indexOf('await connectBtn.click()');
  assert.ok(identityCheck >= 0 && connectClick > identityCheck, 'identity validation must precede Connect');
  assert.match(worker, /displayedNameCandidates\.length === 1/);
  assert.match(worker, /result_code: 'target_identity_denied'[\s\S]*retry_allowed: false[\s\S]*interaction_crossed: false/);
});

test('canonical URL and displayed identity are independent mandatory checks', () => {
  assert.match(worker, /presentedTarget !== authorizedTarget/);
  assert.match(worker, /verifyLinkedInDisplayName\(params\.expected_display_name, displayedName\)/);
});

test('terminal identity denial cannot create retry or replacement work', () => {
  assert.match(expectedName, /max_retries,\s*max_infrastructure_retries[\s\S]*'pending',0,0/);
  assert.doesNotMatch(expectedName, /retry_count\s*=|INSERT[\s\S]*replacement/i);
  assert.match(worker, /target_identity_denied[\s\S]*retry_allowed: false/);
  assert.match(worker, /retryAllowed = !interactionCrossed && result\.data\?\.retry_allowed !== false/);
  assert.match(worker, /this\.queue\.fail\([\s\S]*retryAllowed, outcome\)/);
});
