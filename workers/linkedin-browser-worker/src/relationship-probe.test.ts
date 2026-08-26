import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { classifyRelationshipProbe, classifyStabilizedRelationshipProbe, type RelationshipProbeEvidence } from './relationship-probe.js';

const fixture = (patch: Partial<RelationshipProbeEvidence> = {}): RelationshipProbeEvidence => ({
  degree: '2nd',
  hydrated: true,
  primary: { message: false, connect: false, pending: false, follow: false, connected: false, more: false },
  moreMenu: { inspected: false, connect: false, pending: false, connected: false },
  ...patch,
});
const worker = readFileSync(resolve(process.cwd(), 'src/worker.ts'), 'utf8');

test('2nd-degree with primary Connect is eligible', () => assert.equal(classifyRelationshipProbe(fixture({
  primary: { message: false, connect: true, pending: false, follow: false, connected: false, more: false },
})), 'eligible_for_connection_request'));

test('2nd-degree with Message primary and Connect under More is eligible', () => assert.equal(classifyRelationshipProbe(fixture({
  primary: { message: true, connect: false, pending: false, follow: false, connected: false, more: true },
  moreMenu: { inspected: true, connect: true, pending: false, connected: false },
})), 'eligible_for_connection_request'));

test('2nd-degree with Follow primary and Connect under More is eligible', () => assert.equal(classifyRelationshipProbe(fixture({
  primary: { message: false, connect: false, pending: false, follow: true, connected: false, more: true },
  moreMenu: { inspected: true, connect: true, pending: false, connected: false },
})), 'eligible_for_connection_request'));

test('positive 1st-degree evidence is already connected', () => assert.equal(classifyRelationshipProbe(fixture({ degree: '1st' })), 'already_connected'));
test('positive Pending evidence is invitation pending', () => assert.equal(classifyRelationshipProbe(fixture({
  primary: { message: false, connect: false, pending: true, follow: false, connected: false, more: false },
})), 'invitation_pending'));

test('delayed hydration uses the first hydrated relationship evidence', () => assert.equal(classifyStabilizedRelationshipProbe([
  fixture({ hydrated: false, degree: null }),
  fixture({ primary: { message: true, connect: true, pending: false, follow: false, connected: false, more: false } }),
]), 'eligible_for_connection_request'));

test('missing primary buttons before hydration stays inconclusive', () => assert.equal(classifyStabilizedRelationshipProbe([
  fixture({ hydrated: false, degree: null }), fixture({ hydrated: false, degree: null }),
]), 'probe_inconclusive'));

test('More inspected without Connect stays inconclusive', () => assert.equal(classifyRelationshipProbe(fixture({
  primary: { message: false, connect: false, pending: false, follow: true, connected: false, more: true },
  moreMenu: { inspected: true, connect: false, pending: false, connected: false },
})), 'probe_inconclusive'));

test('human-visible Message without positive relationship evidence is inconclusive, never connected or unavailable', () => assert.equal(classifyRelationshipProbe(fixture({
  primary: { message: true, connect: false, pending: false, follow: false, connected: false, more: false },
})), 'probe_inconclusive'));

test('probe runs only after expected sender authentication and contains no Connect click', () => {
  const authentication = worker.indexOf('verifyPersistentAuthentication(intendedIdentity, binding)');
  const probe = worker.lastIndexOf("case 'check_connection_acceptance':");
  const request = worker.indexOf("case 'connection_request':", probe);
  assert.ok(authentication >= 0 && authentication < probe);
  const probeCode = worker.slice(probe, request);
  assert.match(probeCode, /data-yuktris-relationship-more[\s\S]*keyboard\.press\('Escape'\)/);
  assert.doesNotMatch(probeCode, /connectBtn\.click|has-text\("Connect"\).*click/);
});

test('stabilized extractor supports current h2 and accessible heading variants', () => {
  assert.match(worker, /main h1, main h2, main \[role="heading"\]/);
  assert.match(worker, /data-yuktris-relationship-more/);
});

test('hydrated header actions include accessible anchor controls without an explicit button role', () => {
  const probe = worker.slice(worker.lastIndexOf("case 'check_connection_acceptance':"), worker.lastIndexOf("case 'connection_request':"));
  assert.match(probe, /header\?\.querySelectorAll\('button, a, \[role="button"\]'\)/);
  assert.match(probe, /header_controls:[\s\S]*more_menu_accessibility_controls:[\s\S]*artifacts/);
});

test('controlled write repeats hydration and uses the same accessible anchor semantics', () => {
  const write = worker.slice(worker.lastIndexOf("case 'connection_request':"), worker.lastIndexOf("case 'send_message':"));
  assert.match(write, /waitForLinkedInProfileReady\(page, url\)/);
  assert.match(write, /querySelectorAll\('button,a,\[role="button"\]'\)/);
  assert.match(write, /data-yuktris-write-connect/);
  assert.match(write, /retry_allowed: false[\s\S]*interaction_crossed: true/);
});

test('More menu uses bounded semantic hydration and never selects Connect', () => {
  const probe = worker.slice(worker.lastIndexOf("case 'check_connection_acceptance':"), worker.lastIndexOf("case 'connection_request':"));
  assert.match(probe, /menuAttempt < 4[\s\S]*role="menuitem"[\s\S]*data-control-name/);
  assert.doesNotMatch(probe, /menuLabels[\s\S]*\.click\(/);
});
