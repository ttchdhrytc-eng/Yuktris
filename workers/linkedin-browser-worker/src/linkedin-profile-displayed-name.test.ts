import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { resolveDisplayedNameSignals, type DisplayedNameSignal } from './linkedin-profile-displayed-name.js';
import { verifyLinkedInDisplayName } from './linkedin-profile-identity.js';

const signal = (source: DisplayedNameSignal['source'], value: string, primary = true): DisplayedNameSignal => ({ source, value, primary });
const source = readFileSync(join(import.meta.dirname, '..', 'src', 'linkedin-profile-displayed-name.ts'), 'utf8');
const worker = readFileSync(join(import.meta.dirname, '..', 'src', 'worker.ts'), 'utf8');

test('ordinary visible primary heading extracts exactly', () => {
  assert.deepEqual(resolveDisplayedNameSignals([signal('visible_primary_heading', 'Leticia McAlexander')]).name, 'Leticia McAlexander');
});

test('alternative semantic and accessibility-backed primary headings extract', () => {
  assert.equal(resolveDisplayedNameSignals([signal('semantic_primary_heading', 'Leticia McAlexander')]).status, 'found');
  assert.equal(resolveDisplayedNameSignals([signal('primary_accessible_name', 'Leticia McAlexander')]).status, 'found');
});

test('duplicated identical strong signals corroborate one identity', () => {
  const result = resolveDisplayedNameSignals([
    signal('visible_primary_heading', 'Leticia McAlexander'),
    signal('semantic_primary_heading', 'Leticia McAlexander'),
    signal('structured_person_metadata', 'Leticia McAlexander', false),
  ]);
  assert.equal(result.status, 'found');
  assert.equal(result.candidateCount, 1);
  assert.equal(result.corroboratingSources.length, 3);
});

test('recommendations, messaging, navbar, companies and education are not primary evidence', () => {
  const result = resolveDisplayedNameSignals([
    signal('visible_primary_heading', 'Leticia McAlexander'),
    signal('semantic_primary_heading', 'Recommended Person', false),
    signal('primary_accessible_name', 'Messaging Contact', false),
    signal('primary_intro_structure', 'Tarun Chaudhary', false),
    signal('semantic_primary_heading', 'Example Company', false),
    signal('semantic_primary_heading', 'Example University', false),
  ]);
  assert.equal(result.status, 'found');
  assert.equal(result.name, 'Leticia McAlexander');
  for (const exclusion of ['nav,aside,footer', 'role="dialog"', 'more profiles', 'people also viewed', 'education', 'company'])
    assert.match(source, new RegExp(exclusion, 'i'));
});

test('missing, empty shell and conflicting strong signals fail closed', () => {
  assert.equal(resolveDisplayedNameSignals([]).status, 'missing');
  assert.equal(resolveDisplayedNameSignals([signal('structured_person_metadata', 'Leticia McAlexander', false)]).status, 'missing');
  assert.equal(resolveDisplayedNameSignals([
    signal('visible_primary_heading', 'Leticia McAlexander'),
    signal('semantic_primary_heading', 'Another Person'),
  ]).status, 'ambiguous');
});

test('exact normalization remains NFKC, trim, whitespace-only and case-sensitive', () => {
  assert.equal(verifyLinkedInDisplayName('Leticia McAlexander', '  Leticia\u00a0 McAlexander ').allowed, true);
  assert.equal(verifyLinkedInDisplayName('Leticia McAlexander', 'leticia McAlexander').allowed, false);
});

test('canonical, name and interaction gates remain independently ordered', () => {
  const canonical = worker.indexOf('presentedTarget !== authorizedTarget');
  const extraction = worker.indexOf('extractLinkedInDisplayedName(page)', canonical);
  const relationship = worker.indexOf("recordWriteStage('profile_verified'", extraction);
  const interaction = worker.indexOf("recordWriteStage('before_connect_click'", relationship);
  const click = worker.indexOf('await connectBtn.click()', interaction);
  assert.ok(canonical >= 0 && canonical < extraction && extraction < relationship && relationship < interaction && interaction < click);
  assert.match(worker, /displayed_name_ambiguous/);
  assert.match(worker, /target_identity_denied[\s\S]*retry_allowed: false[\s\S]*interaction_crossed: false/);
});

test('checkpoint and login surfaces terminate without yielding member identity', () => {
  assert.match(source, /security_surface/);
  assert.match(source, /checkpoint\|security verification\|captcha\|\\\/login\|authwall\|sign in to linkedin/);
});
