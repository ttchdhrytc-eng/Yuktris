import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { decideFreshIdentity } from './linkedin.js';

test('existing bound account plus same resolved identity verifies', () => {
  assert.deepEqual(
    decideFreshIdentity('https://www.linkedin.com/in/existing-user/', 'https://linkedin.com/in/existing-user', true),
    { state: 'verified', effectiveProfileUrl: 'https://www.linkedin.com/in/existing-user' },
  );
});

test('existing bound account on reused Context may defer unresolved fresh identity', () => {
  assert.deepEqual(
    decideFreshIdentity(null, 'https://www.linkedin.com/in/existing-user', true),
    { state: 'deferred', effectiveProfileUrl: 'https://www.linkedin.com/in/existing-user' },
  );
});

test('different resolved identity fails closed', () => {
  assert.deepEqual(
    decideFreshIdentity('https://www.linkedin.com/in/different-user', 'https://www.linkedin.com/in/existing-user', true),
    { state: 'mismatch' },
  );
});

test('new unbound account with unresolved identity remains unresolved', () => {
  assert.deepEqual(decideFreshIdentity(null, null, true), { state: 'unresolved' });
});

test('new unbound account with resolved identity can bind', () => {
  assert.deepEqual(
    decideFreshIdentity('https://www.linkedin.com/in/new-user', null, false),
    { state: 'verified', effectiveProfileUrl: 'https://www.linkedin.com/in/new-user' },
  );
});

test('bound-account deferral is disabled without persistent Context reuse', () => {
  assert.deepEqual(
    decideFreshIdentity(null, 'https://www.linkedin.com/in/existing-user', false),
    { state: 'unresolved' },
  );
});

test('fresh persistent branch requires identity evidence and never silently defers', () => {
  const worker = readFileSync('src/worker.ts', 'utf8');
  const linkedin = readFileSync('src/linkedin.ts', 'utf8');
  assert.match(worker, /preflight\.preserveCurrentPage, false/);
  assert.match(linkedin, /if \(!identity\)[\s\S]*identity_resolution_pending/);
  assert.match(worker, /if \(!result\.reuseBoundIdentity\) await this\.bindAuthenticatedIdentity/);
});
