import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(process.cwd(), '../../supabase/functions/linkedin-v1-pipeline/index.ts'), 'utf8');

const forbidden = [
  'vdiqfiuqckaxdjkadinu', 'pooya', 'tarun', 'controlled_acceptance',
  'controlled-acceptance', 'safe_write', 'safe-target', 'pilot', 'certification',
];

test('production pipeline contains no environment or certification authorization', () => {
  for (const value of forbidden) assert.doesNotMatch(source, new RegExp(value, 'i'), value);
});

test('normal onboarding and campaign initialization remain available', () => {
  assert.match(source, /action === "initialize"/);
  assert.match(source, /customer_campaigns[\s\S]*upsert/);
  assert.match(source, /linkedin_account_selection/);
});

test('normal launch validates account identity and creates scheduled jobs', () => {
  assert.match(source, /action === "launch"/);
  assert.match(source, /connection_state", "connected"/);
  assert.match(source, /profile_url[\s\S]*expected_profile_url/);
  assert.match(source, /from\("linkedin_execution_jobs"\)[\s\S]*status: "scheduled"/);
});

test('schedule preview and persistence retain campaign schedule authority', () => {
  assert.match(source, /action === "schedule_preview"/);
  assert.match(source, /action === "update_schedule"/);
  assert.match(source, /campaign_schedule_validation/);
  assert.match(source, /update_customer_campaign_schedule/);
});

test('pause and resume remain fail-closed through the scoped RPC', () => {
  assert.match(source, /action === "pause_campaign" \|\| action === "resume_campaign"/);
  assert.match(source, /set_customer_campaign_paused/);
  assert.match(source, /p_workspace_id: workspaceId/);
});

test('prospect association remains workspace scoped and does not enqueue outreach', () => {
  assert.match(source, /action === "associate_existing_prospect"/);
  assert.match(source, /from\("prospects"\)[\s\S]*eq\("workspace_id", workspaceId\)/);
  assert.match(source, /job_created: false, write_performed: false/);
});

test('workspace authorization and invalid-input rejection remain enforced', () => {
  assert.match(source, /authorizeLinkedInWorkspace\(req, workspaceId/);
  assert.match(source, /const workspaceId = requireString\(body\.workspace_id, "workspace_id"\)/);
  assert.match(source, /Unknown action: \$\{action\}/);
});

test('tests cannot perform outbound interaction', () => {
  assert.doesNotMatch(import.meta.url, /https?:/);
  assert.doesNotMatch(source, /browserbase\.com/);
});
