import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), '../..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260813210000_linkedin_v1_encrypted_credentials.sql'), 'utf8');
const rpcFix = fs.readFileSync(path.join(root, 'supabase/migrations/20260813220000_fix_linkedin_credential_rpc_ambiguity.sql'), 'utf8');
const endpoint = fs.readFileSync(path.join(root, 'supabase/functions/linkedin-credentials/index.ts'), 'utf8');
const worker = fs.readFileSync(path.join(process.cwd(), 'src/worker.ts'), 'utf8');
const linkedin = fs.readFileSync(path.join(process.cwd(), 'src/linkedin.ts'), 'utf8');
const hook = fs.readFileSync(path.join(root, 'src/hooks/useLinkedInBrowser.ts'), 'utf8');
const onboarding = fs.readFileSync(path.join(root, 'src/pages/OnboardingPage.tsx'), 'utf8');

test('credential table is ciphertext-only and browser roles have no table access', () => {
  assert.match(migration, /encrypted_username text NOT NULL/);
  assert.match(migration, /encrypted_password text NOT NULL/);
  assert.doesNotMatch(migration, /\b(username|password) text NOT NULL/);
  assert.match(migration, /REVOKE ALL ON public\.linkedin_credentials FROM PUBLIC, anon, authenticated/);
});

test('submission uses authenticated backend and returns no password', () => {
  assert.match(endpoint, /authorizeLinkedInWorkspace/);
  assert.match(endpoint, /crypto\.subtle\.encrypt/);
  assert.match(endpoint, /credentials_configured: true/);
  assert.doesNotMatch(endpoint, /jsonResponse\([^)]*password/);
  assert.match(hook, /functions\.invoke\('linkedin-credentials'/);
});

test('queue ownership gates service-role credential retrieval and retries', () => {
  assert.match(migration, /q\.worker_id=p_worker_id AND q\.attempt_id=p_attempt_id AND q\.lease_expires_at>now\(\)/);
  assert.match(migration, /last_attempt_at < now\(\)-interval '60 seconds'/);
  assert.doesNotMatch(migration, /action_params[^\n]*(encrypted_password|password)/);
});

test('credential transaction qualifies output-column names and remains atomic', () => {
  assert.match(rpcFix, /c\.workspace_id=p_workspace_id AND c\.account_id=v_start\.account_id/);
  assert.match(rpcFix, /ON CONFLICT ON CONSTRAINT linkedin_credentials_workspace_id_account_id_key/);
  assert.match(rpcFix, /start_linkedin_connection[\s\S]*INSERT INTO public\.linkedin_credentials[\s\S]*RETURN QUERY/);
});

test('authenticated Context bypasses decryption while logged-out Context uses credentials once', () => {
  assert.match(worker, /if \(!result\.success && result\.authState === 'unauthenticated'\)/);
  assert.match(worker, /if \(preflight\.result\)[\s\S]*else \{[\s\S]*claimCredentials\(item\)/);
  assert.match(linkedin, /submitLinkedInCredentials/);
});

test('invalid credentials fail distinctly and challenges expose Live View conditionally', () => {
  assert.match(linkedin, /failureCode: 'invalid_credentials'/);
  assert.match(worker, /result\.errorCode === 'invalid_credentials'/);
  assert.match(linkedin, /challengeLiveUrl = await this\.refreshLiveUrl\(\)/);
  assert.match(onboarding, /!!linkedinChallenge \|\| linkedinIdentityVerified/);
});

test('V1 onboarding excludes Gmail and Calendar from step order', () => {
  assert.match(onboarding, /const stepOrder: Step\[\] = \['welcome', 'linkedin', 'business', 'icp', 'review', 'launch'\]/);
});
