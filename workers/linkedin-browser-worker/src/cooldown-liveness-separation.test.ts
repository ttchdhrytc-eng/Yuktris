import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..', '..', '..');
const migration = readFileSync(join(root, 'supabase', 'migrations', '20260902110000_separate_linkedin_liveness_from_write_cooldown.sql'), 'utf8');
const worker = readFileSync(join(import.meta.dirname, '..', 'src', 'worker.ts'), 'utf8');
const deterministic = readFileSync(join(root, 'supabase', 'migrations', '20260902103000_prebrowser_deterministic_write_eligibility.sql'), 'utf8');
const schedule = readFileSync(join(root, 'supabase', 'migrations', '20260821220000_customer_controlled_campaign_schedule.sql'), 'utf8');

test('Brian regression: heartbeat liveness is isolated from external-write cooldown', () => {
  assert.match(worker, /sessionHeartbeat[\s\S]*insert_session_heartbeat[\s\S]*touch_account_activity/);
  assert.match(migration, /last_activity_at IS[\s\S]*operational account\/session liveness/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS last_external_action_at/);
  assert.match(migration, /replace\(definition,'\.last_activity_at','\.last_external_action_at'\)/);
  assert.doesNotMatch(worker.slice(worker.indexOf('private async sessionHeartbeat'), worker.indexOf('private async pollLoop')), /last_external_action_at/);
});

test('authentication and read-only activity cannot advance the write clock', () => {
  assert.doesNotMatch(worker, /last_external_action_at/);
  assert.match(worker, /last_validated_at:/);
  assert.match(worker, /last_activity_at:/);
  assert.match(migration, /last_activity_at[\s\S]*Never use for LinkedIn write cooldown/);
});

test('external mutation boundary and conservative terminal outcomes advance cooldown monotonically', () => {
  assert.match(migration, /AFTER INSERT ON public\.linkedin_write_interaction_events[\s\S]*NEW\.interaction_crossed IS TRUE/);
  assert.match(migration, /execution_result IN \('success','outcome_unknown'\)/);
  assert.match(migration, /greatest\([\s\S]*last_external_action_at/);
  assert.doesNotMatch(migration, /execution_result IN \('failed'/);
});

test('every effective write preflight is patched without weakening its other controls', () => {
  for (const fn of [
    'preflight_linkedin_write_without_acceptance_override',
    'validate_linkedin_write_deterministic_eligibility',
    'preflight_production_linkedin_acceptance_write_without_expected_name',
  ]) assert.match(migration, new RegExp(fn));
  for (const guard of ['hourly_limit_reached', 'daily_limit_reached', 'rate_limited', 'duplicate_action', 'campaign_outreach_preflight'])
    assert.match(deterministic + schedule, new RegExp(guard));
});

test('deterministic eligibility remains before Browserbase acquisition and campaign schedule remains authoritative', () => {
  const gate = worker.indexOf('validateDeterministicLinkedInWrite(this.client, item)');
  const acquireStarted = worker.indexOf("'browserbase_acquisition_started'", gate);
  const acquire = worker.indexOf('this.openPersistentContextForTask(item)', acquireStarted);
  assert.ok(gate >= 0 && gate < acquireStarted && acquireStarted < acquire);
  assert.match(deterministic, /campaign_outreach_preflight/);
  assert.doesNotMatch(deterministic, /working_hours_start|working_hours_end/);
});

test('remediation carries no acceptance identity, selector, target, or execution mutation', () => {
  assert.doesNotMatch(migration, /Paul|Bryon|Brian|PROD-LI|LINKEDIN_PRODUCTION_ACCEPTANCE_AUTHORIZATION_ID/i);
  assert.doesNotMatch(migration, /INSERT INTO public\.browser_execution_queue/i);
  assert.doesNotMatch(migration, /UPDATE public\.linkedin_production_acceptance_authorizations/i);
});
