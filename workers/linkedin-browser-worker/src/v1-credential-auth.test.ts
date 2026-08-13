import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const migration = read('supabase/migrations/20260813210000_linkedin_v1_encrypted_credentials.sql');
const hook = read('src/hooks/useLinkedInBrowser.ts');
const worker = read('workers/linkedin-browser-worker/src/worker.ts');
const onboarding = read('src/pages/OnboardingPage.tsx');

test('encrypted credential storage remains protected but is not the V1 launch path', () => {
  assert.match(migration, /encrypted_username text NOT NULL/);
  assert.match(migration, /encrypted_password text NOT NULL/);
  assert.match(migration, /REVOKE ALL ON public\.linkedin_credentials FROM PUBLIC, anon, authenticated/);
  const connect = hook.match(/export function useConnectLinkedIn[\s\S]*?export function useLinkedInConnectionAttempt/)?.[0] ?? '';
  assert.match(connect, /rpc\('start_linkedin_connection'/);
  assert.doesNotMatch(connect, /linkedin-credentials|username|password|connect_existing/);
});

test('normal worker connection never decrypts or submits credentials', () => {
  const connect = worker.match(/private async handleConnect[\s\S]*?private async handleTestConnection/)?.[0] ?? '';
  assert.doesNotMatch(connect, /claimCredentials|markCredentialResult|submitLinkedInCredentials/);
});

test('normal onboarding has no credential collection', () => {
  assert.doesNotMatch(onboarding, /linkedinUsername|linkedinPassword|current-password|Encrypted LinkedIn credentials are configured/);
  assert.match(onboarding, /Sign in to LinkedIn once in the secure browser/);
});
