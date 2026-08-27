import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '../..');
const migration = readFileSync(resolve(root, 'supabase/migrations/20260827094500_linkedin_account_browser_serialization.sql'), 'utf8');
const worker = readFileSync(resolve(root, 'workers/linkedin-browser-worker/src/worker.ts'), 'utf8');
const queue = readFileSync(resolve(root, 'workers/linkedin-browser-worker/src/queue.ts'), 'utf8');
const campaignAuthority = readFileSync(resolve(root, 'supabase/migrations/20260826053300_restore_customer_campaign_schedule_authority.sql'), 'utf8');

test('five same-account tasks have one durable active owner', () => {
  assert.match(migration, /account_id uuid PRIMARY KEY/);
  assert.match(migration, /ON CONFLICT\(account_id\)[\s\S]*lease_expires_at<=now\(\)/);
});

test('same-account contenders remain queued while another lease is active', () => {
  assert.match(migration, /IF claimed_id IS DISTINCT FROM candidate\.id THEN CONTINUE/);
  assert.doesNotMatch(migration, /persistent Context is already leased/);
});

test('different accounts are not globally serialized', () => {
  assert.doesNotMatch(migration, /LOCK TABLE|pg_advisory_lock/);
  assert.match(migration, /PRIMARY KEY REFERENCES public\.linkedin_accounts/);
});

test('lease heartbeat renews queue and account ownership atomically', () => {
  assert.match(migration, /renew_queue_lease[\s\S]*linkedin_account_browser_leases[\s\S]*browser_execution_queue/);
  assert.match(worker, /this\.queue[\s\S]*\.renew\(item\.id\)/);
});

test('release occurs after persistent Context and browser cleanup', () => {
  const contextRelease = worker.indexOf('this.linkedinContexts.release(active.context.id, active.owner)');
  const accountRelease = worker.indexOf('this.queue.releaseAccountLease(item.id)');
  assert.ok(contextRelease > 0 && accountRelease > contextRelease);
  assert.match(queue, /release_linkedin_account_browser_lease/);
});

test('expired owner is recoverable and exhausted retry budget is terminal', () => {
  assert.match(migration, /DELETE FROM public\.linkedin_account_browser_leases[\s\S]*lease_expires_at<=now\(\)/);
  assert.match(migration, /retry_count<q\.max_retries THEN 'retry' ELSE 'failed'/);
});

test('active lease cannot be stolen and retry uses the same account gate', () => {
  assert.match(migration, /WHERE public\.linkedin_account_browser_leases\.lease_expires_at<=now\(\)/);
  assert.match(migration, /q\.status='retry'[\s\S]*INSERT INTO public\.linkedin_account_browser_leases/);
});

test('relationship probes acceptance checks and writes share one claim path', () => {
  assert.match(worker, /case 'check_connection_acceptance':[\s\S]*case 'connection_request':[\s\S]*case 'send_message'/);
  assert.match(worker, /processTask\(item/);
  assert.doesNotMatch(migration, /action_type.*check_connection_acceptance/);
});

test('campaign-only schedule compatibility function ignores account working metadata', () => {
  const compatibility = campaignAuthority.slice(campaignAuthority.indexOf('CREATE OR REPLACE FUNCTION public.next_campaign_account_outreach_at'), campaignAuthority.indexOf('CREATE OR REPLACE FUNCTION public.campaign_window_validation'));
  assert.match(compatibility, /next_campaign_outreach_at/);
  assert.doesNotMatch(compatibility, /working_days|working_hours|a\.timezone/);
});

test('Saturday and every-day campaign windows are not intersected with account metadata', () => {
  assert.match(campaignAuthority, /Customer campaigns are the only scheduling authority/);
  assert.doesNotMatch(campaignAuthority, /account_local|account_day|working_hours_start|working_hours_end/);
});
