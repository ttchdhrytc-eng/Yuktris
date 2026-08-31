import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const migration = readFileSync(resolve(
  process.cwd(),
  '../../supabase/migrations/20260901000000_production_safe_campaign_and_lease_runtime.sql',
), 'utf8');

test('production extraction contains required normal runtime contracts', () => {
  for (const contract of [
    'next_campaign_account_outreach_at',
    'campaign_window_validation',
    'linkedin_queue_lease_events',
    'capture_linkedin_queue_lease_event',
    'production_v1_runtime_prerequisites_missing',
  ]) assert.match(migration, new RegExp(contract));
});

test('production extraction excludes certification identities and staging authorization machinery', () => {
  for (const forbidden of [
    'vdiqfiuqckaxdjkadinu',
    'pooya',
    'tarun',
    'controlled_acceptance',
    'linkedin_staging_write_authorizations',
    'linkedin_safe_write_targets',
    'acceptance_override',
    'pilot',
  ]) assert.doesNotMatch(migration.toLowerCase(), new RegExp(forbidden));
});

test('production extraction is forward-only and preserves customer data', () => {
  assert.doesNotMatch(migration, /\b(?:DROP|TRUNCATE|DELETE\s+FROM)\b/i);
  assert.doesNotMatch(migration, /INSERT\s+INTO\s+public\.(?:workspaces|contacts|customer_campaigns|linkedin_accounts)/i);
  assert.match(migration, /BEGIN;[\s\S]*COMMIT;/);
});
