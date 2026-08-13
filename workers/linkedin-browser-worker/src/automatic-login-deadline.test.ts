import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  AUTOMATIC_LOGIN_RESULT_TIMEOUT_MS,
  HUMAN_VERIFICATION_TIMEOUT_MS,
  classifyAutomaticLoginResult,
} from './linkedin.js';

const assessment = (state: 'authenticated' | 'unauthenticated' | 'checkpoint' | 'unknown', signals: string[] = []) => ({ state, signals });

test('credentials submitted can resolve authenticated within the automatic window', () => {
  assert.equal(classifyAutomaticLoginResult(assessment('authenticated'), false), 'authenticated');
});

test('explicit invalid credentials terminate immediately', () => {
  assert.equal(classifyAutomaticLoginResult(assessment('unauthenticated', ['login_form', 'invalid_credentials']), false), 'credentials_invalid');
});

test('OTP and checkpoint surfaces enter human verification', () => {
  assert.equal(classifyAutomaticLoginResult(assessment('checkpoint', ['checkpoint_control']), false), 'verification_required');
  assert.equal(classifyAutomaticLoginResult(assessment('checkpoint', ['checkpoint_url']), false), 'verification_required');
});

test('unchanged login form becomes a bounded login failure', () => {
  assert.equal(classifyAutomaticLoginResult(assessment('unauthenticated', ['login_form']), true), 'login_failed');
});

test('unknown LinkedIn error surface becomes unavailable', () => {
  assert.equal(classifyAutomaticLoginResult(assessment('unknown', ['linkedin_error']), false), 'linkedin_unavailable');
  assert.equal(classifyAutomaticLoginResult(assessment('unknown'), true), 'linkedin_unavailable');
});

test('automatic and human deadlines are separate', () => {
  assert.ok(AUTOMATIC_LOGIN_RESULT_TIMEOUT_MS >= 30_000 && AUTOMATIC_LOGIN_RESULT_TIMEOUT_MS <= 60_000);
  assert.equal(HUMAN_VERIFICATION_TIMEOUT_MS, 30 * 60 * 1000);
  assert.ok(AUTOMATIC_LOGIN_RESULT_TIMEOUT_MS < HUMAN_VERIFICATION_TIMEOUT_MS);
});

test('challenge wait stays on the same page/session and activates human deadline only after checkpoint', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/linkedin.ts'), 'utf8');
  const start = source.indexOf('private async waitForAuthenticationWithChallenges');
  const end = source.indexOf('private async detectChallengeDetailed', start);
  const wait = source.slice(start, end);
  assert.match(wait, /if \(assessment\.state === 'checkpoint'\)[\s\S]*challengeDeadline = Math\.min\(now \+ HUMAN_VERIFICATION_TIMEOUT_MS/);
  assert.match(wait, /pinnedChallengePage = this\.page/);
  assert.doesNotMatch(wait, /newContext\(|createSession\(|newPage\(/);
});

test('automatic timeout emits only sanitized terminal output', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/linkedin.ts'), 'utf8');
  assert.match(source, /failureCode = unchangedLogin \? 'automatic_login_timeout' : 'linkedin_unavailable'/);
  assert.match(source, /await onProgress\?\.\('login_failed', failure, \{ error_code: failureCode \}\)/);
  assert.doesNotMatch(source.match(/Automatic LinkedIn login reached bounded terminal result[\s\S]*?return \{ authenticated:/)?.[0] ?? '', /cookie\.value|password|ciphertext|storageState/);
});

test('frontend follows backend state and has no invented authentication watchdog', () => {
  const root = resolve(process.cwd(), '..', '..');
  const hook = readFileSync(resolve(root, 'src/hooks/useLinkedInBrowser.ts'), 'utf8');
  assert.doesNotMatch(hook, /15_000|30_000|authentication watchdog|auth_surface_preparation/i);
  assert.match(hook, /linkedin_auth_interactions|browser_execution_queue|connection_state/);
});
