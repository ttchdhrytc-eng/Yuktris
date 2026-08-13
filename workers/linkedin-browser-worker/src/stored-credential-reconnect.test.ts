import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const read = (path: string) => fs.readFileSync(new URL(path, root), 'utf8');
const migration = read('supabase/migrations/20260813233000_fix_stored_linkedin_reconnect_contract.sql');
const edge = read('supabase/functions/linkedin-credentials/index.ts');
const worker = read('workers/linkedin-browser-worker/src/worker.ts');
const hook = read('src/hooks/useLinkedInBrowser.ts');

test('connect_existing uses the exact Edge and RPC contract', () => {
  assert.match(hook, /action: 'connect_existing'[\s\S]*account_id: params\.existingAccountId/);
  assert.match(edge, /body\.action === "connect_existing"[\s\S]*start_linkedin_connection_with_stored_credentials/);
  for (const parameter of ['p_workspace_id', 'p_account_id', 'p_idempotency_key']) assert.match(edge, new RegExp(parameter));
});

test('stored reconnect never writes a credential row', () => {
  const body = migration.match(/CREATE OR REPLACE FUNCTION public\.start_linkedin_connection_with_stored_credentials[\s\S]*?END \$\$/)?.[0] ?? '';
  assert.doesNotMatch(body, /INSERT INTO public\.linkedin_credentials|UPDATE public\.linkedin_credentials/);
  assert.match(body, /v_credential_status NOT IN \('configured','valid'\)/);
});

test('all queue identifiers are qualified and output collisions are impossible', () => {
  assert.match(migration, /UPDATE public\.browser_execution_queue AS q SET max_retries=0/);
  assert.match(migration, /q\.id=v_start\.queue_item_id[\s\S]*q\.workspace_id=p_workspace_id[\s\S]*q\.account_id=p_account_id/);
  assert.doesNotMatch(migration, /WHERE id=v_start\.queue_item_id AND workspace_id=/);
});

test('queue is single-attempt and transactionally confirmed', () => {
  assert.match(migration, /SET max_retries=0/);
  assert.match(migration, /IF NOT FOUND THEN[\s\S]*linkedin_connection_queue_mismatch/);
  assert.match(migration, /v_start\.attempt_reused/);
});

test('workspace, account, credential, and Context ownership are fail closed', () => {
  assert.match(migration, /is_workspace_member\(p_workspace_id\)/);
  assert.match(migration, /a\.id=p_account_id AND a\.workspace_id=p_workspace_id/);
  assert.match(migration, /c\.account_id=p_account_id AND c\.workspace_id=p_workspace_id/);
  assert.match(migration, /c\.provider='browserbase' AND c\.deleted_at IS NULL/);
});

test('missing and disabled credentials have intentional safe errors', () => {
  assert.match(migration, /linkedin_credentials_missing/);
  assert.match(migration, /linkedin_credentials_disabled/);
  assert.match(edge, /linkedin_credentials_missing: \{ status: 409/);
  assert.match(edge, /linkedin_credentials_disabled: \{ status: 409/);
});

test('missing, invalid, and unrelated leased Contexts have intentional safe errors', () => {
  for (const code of ['linkedin_context_missing', 'linkedin_context_unavailable', 'linkedin_context_leased']) {
    assert.match(migration, new RegExp(code));
    assert.match(edge, new RegExp(`${code}: \\{ status: 409`));
  }
  assert.match(migration, /active_q\.action_type='linkedin_connect'/);
});

test('malformed and unauthorized requests are rejected before RPC', () => {
  assert.match(edge, /Invalid request body", 400/);
  assert.match(edge, /!isUuid\(workspaceId\)[\s\S]*400/);
  assert.match(edge, /!isUuid\(accountId\)[\s\S]*400/);
  assert.match(edge, /"not authorized": \{ status: 403/);
});

test('worker consumes the exact linkedin_connect action and claims credentials under lease ownership', () => {
  assert.match(worker, /case 'linkedin_connect':[\s\S]*handleConnect/);
  assert.match(worker, /claim_linkedin_credentials_for_login/);
  for (const parameter of ['p_workspace_id', 'p_account_id', 'p_queue_item_id', 'p_worker_id', 'p_attempt_id']) {
    assert.match(worker, new RegExp(parameter));
  }
});

test('worker selects the existing persistent Context before credential claim', () => {
  const ensureIndex = worker.indexOf('this.linkedinContexts.ensureProvisioned(owner)');
  const acquireIndex = worker.indexOf('this.linkedinContexts.acquire(owner)');
  const claimIndex = worker.indexOf('this.claimCredentials(item)');
  assert.ok(ensureIndex >= 0 && acquireIndex > ensureIndex && claimIndex > acquireIndex);
  assert.match(worker, /preflight\.result[\s\S]*else \{[\s\S]*claimCredentials\(item\)/);
});

test('authenticated Context bypasses credential decryption and no replacement Context is requested', () => {
  assert.match(worker, /checkExistingAuthenticatedSession[\s\S]*if \(preflight\.result\)[\s\S]*else \{[\s\S]*claimCredentials/);
  assert.match(worker, /persistentContextsEnabled\(\)[\s\S]*ensureV1Enrollment/);
});

test('Edge response returns the committed queue and never credential material', () => {
  assert.match(edge, /queue_item_id: result\?\.queue_item_id/);
  assert.match(edge, /credentials_configured: true/);
  const response = edge.match(/body\.action === "connect_existing"[\s\S]*?return jsonResponse\([\s\S]*?\);/i)?.[0] ?? '';
  assert.doesNotMatch(response, /encrypted_username|encrypted_password|password:/);
});
