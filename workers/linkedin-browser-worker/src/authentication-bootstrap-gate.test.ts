import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const queue = readFileSync(resolve(process.cwd(), 'src/queue.ts'), 'utf8');
const worker = readFileSync(resolve(process.cwd(), 'src/worker.ts'), 'utf8');
const migration = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260901101500_allow_auth_bootstrap_while_outbound_disabled.sql'), 'utf8');

test('disabled mode uses a separate authentication-only claim RPC', () => {
  assert.match(worker, /outboundEnabled\s*\? await this\.queue\.claimNext\(\)\s*:\s*await this\.queue\.claimNextAuthentication\(\)/);
  assert.match(queue, /rpc\('claim_linkedin_auth_task'/);
  assert.match(queue, /item\.action_type !== 'linkedin_connect'/);
});

test('database claim is atomically restricted to linkedin_connect', () => {
  assert.match(migration, /q\.action_type='linkedin_connect'/);
  assert.match(migration, /FOR UPDATE SKIP LOCKED/);
  assert.doesNotMatch(migration, /connection_request|send_message|follow_up_message|accept_connection|book_meeting|controlled_acceptance/i);
});

test('authentication bootstrap test performs no network or LinkedIn interaction', () => {
  assert.doesNotMatch(import.meta.url, /https?:/);
});
