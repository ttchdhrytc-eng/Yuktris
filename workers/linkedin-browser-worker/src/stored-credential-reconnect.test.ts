import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const hook = read('src/hooks/useLinkedInBrowser.ts');
const worker = read('workers/linkedin-browser-worker/src/worker.ts');
const edge = read('supabase/functions/linkedin-credentials/index.ts');

test('legacy encrypted credential APIs remain available but isolated', () => {
  assert.match(edge, /body\.action === "connect_existing"/);
  assert.match(edge, /start_linkedin_connection_with_stored_credentials/);
  assert.match(worker, /claim_linkedin_credentials_for_login/);
});

test('V1 reconnect does not call the legacy credential API', () => {
  const connect = hook.match(/export function useConnectLinkedIn[\s\S]*?export function useLinkedInConnectionAttempt/)?.[0] ?? '';
  assert.match(connect, /rpc\('start_linkedin_connection'/);
  assert.doesNotMatch(connect, /connect_existing|linkedin-credentials|username|password/);
});

test('V1 worker handlers do not claim credentials', () => {
  const connect = worker.match(/private async handleConnect[\s\S]*?private async handleTestConnection/)?.[0] ?? '';
  assert.doesNotMatch(connect, /claimCredentials|markCredentialResult/);
});
