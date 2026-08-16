import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  classifyConnectionProfileState,
  isNoNoteConfirmCandidate,
  pickNoNoteConfirmLabel,
} from './connection-dialog.js';

const root = resolve(process.cwd(), '..', '..');
const worker = readFileSync(resolve(root, 'workers/linkedin-browser-worker/src/worker.ts'), 'utf8');

// 1-4: bounded no-note confirmation label variants actually observed on LinkedIn.
test('recognizes Send without note', () => assert.equal(isNoNoteConfirmCandidate('Send without note'), true));
test('recognizes Send', () => assert.equal(isNoNoteConfirmCandidate('Send'), true));
test('recognizes Send now', () => assert.equal(isNoNoteConfirmCandidate('Send now'), true));
test('recognizes direct Connect confirmation', () => assert.equal(isNoNoteConfirmCandidate('Connect'), true));

// 5: Add a note + Send pair — the note-input Send control is a separate, unrelated match.
test('rejects Add a note as a no-note confirmation', () => assert.equal(isNoNoteConfirmCandidate('Add a note'), false));
test('picks the most specific label when several are visible', () => {
  assert.equal(pickNoNoteConfirmLabel(['Connect', 'Send without note']), 'Send without note');
});

// 6: already pending.
test('classifies already pending before any click', () => {
  assert.equal(classifyConnectionProfileState({ hasPending: true, hasConnect: false, hasMessage: false }), 'already_pending');
});

// 7: already connected.
test('classifies already connected before any click', () => {
  assert.equal(classifyConnectionProfileState({ hasPending: false, hasConnect: false, hasMessage: true }), 'already_connected');
});

// 8: modal absent / direct connect confirmation.
test('classifies connect available when only Connect is present', () => {
  assert.equal(classifyConnectionProfileState({ hasPending: false, hasConnect: true, hasMessage: false }), 'connect_available');
});
test('classifies unavailable when no known control is present', () => {
  assert.equal(classifyConnectionProfileState({ hasPending: false, hasConnect: false, hasMessage: false }), 'unavailable');
});

// 9: challenge/restriction after opening — worker must check detectRestriction after the open click.
test('worker checks for restriction after opening the connect dialog', () => {
  assert.match(worker, /await connectBtn\.click\(\);[\s\S]*?await this\.linkedin\.detectRestriction\(\)/);
});

// 10: duplicate/no second click — connection state is classified before any click, and only
// one connectBtn.click() and one confirm-button click exist in the write path.
test('classifies existing connection state before clicking Connect', () => {
  const clickIndex = worker.indexOf('await connectBtn.click();');
  const classifyIndex = worker.indexOf("initialState === 'already_pending'");
  assert.ok(classifyIndex >= 0 && classifyIndex < clickIndex);
});
test('worker never clicks the Connect button more than once per attempt', () => {
  const matches = worker.match(/await connectBtn\.click\(\);/g) ?? [];
  assert.equal(matches.length, 1);
});
test('duplicate write dedupe remains untouched', () => {
  assert.match(worker, /preflight\.code === 'duplicate_action' && preflight\.already_done/);
});

test('no-note confirm search excludes the Add a note control', () => {
  assert.match(worker, /isNoNoteConfirmCandidate\(text\)/);
  assert.doesNotMatch(worker, /scope\.\$\(`button:visible:has-text\("Add a note"\)`\)/);
});
