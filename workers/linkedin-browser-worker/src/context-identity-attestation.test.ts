import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const worker = fs.readFileSync(path.join(root, 'src/worker.ts'), 'utf8');
const linkedin = fs.readFileSync(path.join(root, 'src/linkedin.ts'), 'utf8');
const context = fs.readFileSync(path.join(root, 'src/linkedin-context.ts'), 'utf8');
const migration = fs.readFileSync(path.join(root, '../../supabase/migrations/20260815170000_linkedin_context_identity_attestation.sql'), 'utf8');

test('live same identity wins and refreshes certification', () => {
  assert.match(linkedin, /senderVerificationMode: 'verified_live_identity'/);
  assert.match(worker, /verified_live_identity'[\s\S]*certifyIdentity/);
});
test('unresolved identity may use only the certified bound canonical identity', () => {
  assert.match(linkedin, /bound && certified && bound === certified[\s\S]*verified_context_binding/);
});
test('positive mismatch remains fail closed and revokes attestation', () => {
  assert.match(linkedin, /comparison !== 'match'[\s\S]*success: false/);
  assert.match(worker, /identityState === 'mismatch'[\s\S]*revokeIdentity/);
});
test('unauthenticated and checkpoint states return before fallback', () => {
  assert.ok(linkedin.indexOf("assessment.state === 'checkpoint'") < linkedin.indexOf('const identity = await this.resolveAuthenticatedSelfIdentity'));
  assert.ok(linkedin.indexOf("assessment.state !== 'authenticated'") < linkedin.indexOf('const identity = await this.resolveAuthenticatedSelfIdentity'));
});
test('Context id and generation are exact attestation keys', () => {
  assert.match(migration, /c\.id=p_context_id[\s\S]*c\.provider_context_id=p_provider_context_id[\s\S]*c\.generation=p_context_generation/);
});
test('new or replacement Context without certification cannot fall back', () => {
  assert.match(context, /if \(!data\) return null/);
  assert.match(linkedin, /certifiedBinding\?\.proofType === 'two_session_identity_proof'/);
});
test('sender attestation is account-bound and never derived from target parameters', () => {
  assert.match(migration, /a\.id=p_account_id AND a\.workspace_id=p_workspace_id/);
  assert.doesNotMatch(context, /target_profile|target_url|action_params/);
});
test('preflight follows successful sender verification and target verification remains later', () => {
  assert.ok(worker.indexOf('verifyPersistentAuthentication(intendedIdentity, binding)') < worker.indexOf('preflightLinkedInWrite(this.client, item)'));
  assert.match(worker, /preflightLinkedInWrite\(this\.client, item\)[\s\S]*authorizedTarget[\s\S]*presentedTarget/);
});
test('two-session persistence proof creates the attestation', () => {
  assert.match(worker, /linkedin_persistence_proof_started[\s\S]*verifyPersistentAuthentication[\s\S]*certifyIdentity/);
});
test('attestation storage is service-role-only and contains no browser secret', () => {
  assert.match(migration, /REVOKE ALL[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(migration, /li_at|cookie|password|secret/);
});
