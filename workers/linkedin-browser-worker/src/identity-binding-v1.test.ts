import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonicalIdentityUrl, decideFreshIdentity, resolveLinkedInSelfIdentity } from './linkedin.js';

const worker = readFileSync('src/worker.ts', 'utf8');
const linkedin = readFileSync('src/linkedin.ts', 'utf8');
const bindingMigration = readFileSync('../../supabase/migrations/20260812150000_linkedin_post_auth_identity_binding.sql', 'utf8');
const queueMigration = readFileSync('../../supabase/migrations/20260813160000_linkedin_connection_attempt_orchestration.sql', 'utf8');

test('1 first connection with no stored identity accepts authenticated self discovery', () => {
  assert.deepEqual(decideFreshIdentity('https://www.linkedin.com/in/member', null), { state: 'verified', effectiveProfileUrl: 'https://www.linkedin.com/in/member' });
});
test('2 authenticated browser on confirmed own profile resolves current route', () => {
  assert.equal(resolveLinkedInSelfIdentity({ currentUrl: 'https://linkedin.com/in/member/?trk=x', currentRouteConfirmedSelf: true })?.profileUrl, 'https://www.linkedin.com/in/member');
});
test('3 self-profile navigation resolves identity', () => {
  assert.equal(resolveLinkedInSelfIdentity({ selfNavigationHrefs: ['https://www.linkedin.com/in/member/'] })?.method, 'self_navigation');
});
test('4 canonical URL normalization removes variants and navigation parameters', () => {
  assert.equal(canonicalIdentityUrl('https://uk.linkedin.com/in/Member/?trk=nav#top'), 'https://www.linkedin.com/in/Member');
});
test('5 first identity binding is invoked before Context synchronization', () => {
  assert.ok(worker.indexOf('bindAuthenticatedIdentity(workspaceId, accountId, effectiveProfileUrl)') < worker.indexOf('this.linkedinContexts.synchronize(persistentContext'));
});
test('6 existing identity exact match succeeds', () => assert.equal(decideFreshIdentity('https://www.linkedin.com/in/member', 'https://www.linkedin.com/in/member').state, 'verified'));
test('7 existing identity normalized match succeeds', () => assert.equal(decideFreshIdentity('https://linkedin.com/in/Member/?x=1', 'https://www.linkedin.com/in/member/').state, 'verified'));
test('8 identity mismatch fails closed', () => assert.equal(decideFreshIdentity('https://linkedin.com/in/other', 'https://linkedin.com/in/member').state, 'mismatch'));
test('9 identity cannot be resolved', () => assert.equal(resolveLinkedInSelfIdentity({ currentUrl: 'https://www.linkedin.com/feed/' }), null));
test('10 arbitrary viewed prospect is never accepted as self', () => {
  assert.equal(resolveLinkedInSelfIdentity({ currentUrl: 'https://www.linkedin.com/in/prospect', currentRouteConfirmedSelf: false }), null);
});
test('11 company page is never identity', () => assert.equal(canonicalIdentityUrl('https://www.linkedin.com/company/yuktris'), null));
test('12 Sales Navigator can resolve authenticated self through trusted navigation', () => {
  assert.equal(resolveLinkedInSelfIdentity({ currentUrl: 'https://www.linkedin.com/sales/home', selfNavigationHrefs: ['/in/member/'] })?.profileUrl, 'https://www.linkedin.com/in/member');
});
test('13 second session opens the same persisted Context', () => {
  assert.match(worker, /linkedin_persistence_proof_started[\s\S]*openPersistentContextForTask\(item\)/);
  assert.match(worker, /context_id: proofContext\.id,[\s\S]{0,100}context_generation: proofContext\.generation/);
});
test('14 second session must remain authenticated', () => assert.match(worker, /verifyPersistentAuthentication[\s\S]*second_session_not_authenticated/));
test('15 second-session identity must match bound identity', () => assert.match(worker, /profileUrl: effectiveProfileUrl[\s\S]*second_session_identity_mismatch/));
test('16 second-session logout fails', () => assert.match(linkedin, /assessment\.state !== 'authenticated'[\s\S]*errorCode: 'reauth_required'/));
test('17 second-session different identity fails', () => assert.match(linkedin, /getIdentityMismatch[\s\S]*identityState: 'mismatch'/));
test('18 one click reuses an active idempotent queue', () => assert.match(queueMigration, /RETURN QUERY SELECT v_account_id, v_existing_queue\.id, v_existing_queue\.status, true/));
test('19 first-session identity binding is atomic and idempotent', () => {
  assert.match(bindingMigration, /FOR UPDATE/);
  assert.match(bindingMigration, /SET expected_profile_url=v_profile, profile_url=v_profile/);
});
test('20 existing trusted identity cannot be silently overwritten', () => assert.match(bindingMigration, /Authenticated LinkedIn profile does not match the account being connected/));
