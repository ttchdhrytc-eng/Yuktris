import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(process.cwd(), '../..');
const migration = readFileSync(resolve(root, 'supabase/migrations/20260902103000_prebrowser_deterministic_write_eligibility.sql'), 'utf8');
const worker = readFileSync(resolve(root, 'workers/linkedin-browser-worker/src/worker.ts'), 'utf8');
const safety = readFileSync(resolve(root, 'workers/linkedin-browser-worker/src/linkedin-execution-safety.ts'), 'utf8');

test('deterministic gate runs before Browserbase acquisition begins', () => {
  assert.match(safety, /validate_linkedin_write_deterministic_eligibility/);
  const deterministic = worker.indexOf('validateDeterministicLinkedInWrite(this.client, item)');
  const started = worker.indexOf("'browserbase_acquisition_started'", deterministic);
  const open = worker.indexOf('this.openPersistentContextForTask(item)', started);
  assert.ok(deterministic >= 0 && deterministic < started && started < open);
});

test('normal campaign uses campaign schedule and never account working-hour metadata', () => {
  const deterministic = migration.slice(migration.indexOf('CREATE FUNCTION public.validate_linkedin_write_deterministic_eligibility'), migration.indexOf('CREATE OR REPLACE FUNCTION public.preflight_production_linkedin_acceptance_write_without_expected_name'));
  assert.match(deterministic, /campaign_outreach_preflight/);
  assert.match(deterministic, /campaign_schedule_missing/);
  assert.match(deterministic, /normal_campaign_target_authorization/);
  assert.doesNotMatch(deterministic, /working_days|working_hours_start|working_hours_end|outside_working_hours/);
});

test('controlled acceptance time authority is exact unexpired durable authorization', () => {
  for (const binding of ['project_ref', "status<>'executing'", 'expires_at<=now()', 'queue_item_id', 'attempt_id', 'worker_id', 'workspace_id', 'linkedin_account_id', 'canonical_target_url', 'expected_display_name', 'persistent_context_required', 'acceptance_test_mode'])
    assert.match(migration, new RegExp(binding.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(migration, /q\.action_params\?'note' OR q\.action_params\?'message'/);
});

test('health, limits, cooldown and duplicate checks are deterministic and audit-free', () => {
  for (const protection of ['account_paused', 'verification_required', 'linkedin_restricted', 'cooldown_active', 'hourly_limit_reached', 'rate_limited', 'daily_limit_reached', 'duplicate_action'])
    assert.match(migration, new RegExp(protection));
  assert.match(migration, /'audit_created',false/);
  const deterministic = migration.slice(0, migration.indexOf('CREATE OR REPLACE FUNCTION public.preflight_production_linkedin_acceptance_write_without_expected_name'));
  assert.doesNotMatch(deterministic, /INSERT INTO public\.linkedin_write_audit/);
});

test('acceptance audit preflight no longer inherits account working hours', () => {
  const acceptance = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.preflight_production_linkedin_acceptance_write_without_expected_name'));
  assert.doesNotMatch(acceptance, /working_days|working_hours_start|working_hours_end|outside_working_hours/);
  assert.match(acceptance, /bound_browser_context_not_reused/);
  assert.match(acceptance, /linkedin_write_audit/);
});

test('live protections and interaction ordering remain after acquisition', () => {
  const acquired = worker.indexOf("'browserbase_acquired'");
  const fullPreflight = worker.indexOf('preflightLinkedInWrite(this.client, item)', acquired);
  const profileIdentity = worker.indexOf('expected_display_name', fullPreflight);
  const relationship = worker.indexOf("'relationship_verified'", profileIdentity);
  const boundary = worker.indexOf("'interaction_boundary_crossed'");
  assert.ok(acquired >= 0 && acquired < fullPreflight && fullPreflight < profileIdentity && profileIdentity < relationship);
  assert.ok(boundary >= 0 && boundary < worker.indexOf('interactionCrossed = interactionCrossed || crossed', boundary));
});

test('historical Bryon evidence is never referenced or rewritten', () => {
  assert.doesNotMatch(migration, /61bd5ab3-f8d0-4862-bb09-71c7f9dc84f5|34450c47-a95a-47a8-b7c2-2db6da770735|00b2ead5-ea6d-46f4-9422-7623400bcf3b/);
});
