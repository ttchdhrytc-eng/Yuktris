import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  activateLoginSubmission,
  enterCredentialRealistically,
  loginSubmitProducedEffect,
  type LoginSubmitObservation,
} from './linkedin.js';

const none = (): LoginSubmitObservation => ({
  submitEventObserved: false,
  authenticationRequestObserved: false,
  urlChanged: false,
  loginFormChanged: false,
  authenticatedCookieAppeared: false,
  explicitLinkedInErrorAppeared: false,
  challengeAppeared: false,
});

class ControlledInputFixture {
  value = '';
  frameworkInputEvents = 0;
  events: string[] = [];
  async click() { this.events.push('focus'); }
  async press(key: string) {
    this.events.push(key);
    if (key === 'Backspace') this.value = '';
  }
  async pressSequentially(value: string) {
    this.events.push('keyboard_type');
    for (const character of value) { this.value += character; this.frameworkInputEvents++; }
  }
  async inputValue() { return this.value; }
  async isVisible() { return true; }
  async isEnabled() { return this.frameworkInputEvents > 0; }
  async isEditable() { return true; }
  async fill(value: string) { this.value = value; }
}

test('React-controlled email input receives focus clear and keyboard input events', async () => {
  const input = new ControlledInputFixture();
  assert.equal(await enterCredentialRealistically(input as never, 'user@example.test'), true);
  assert.deepEqual(input.events, ['focus', process.platform === 'darwin' ? 'Meta+A' : 'Control+A', 'Backspace', 'keyboard_type']);
  assert.ok(input.frameworkInputEvents > 1);
});

test('React-controlled password input uses the same realistic interaction without exposing its value', async () => {
  const input = new ControlledInputFixture();
  assert.equal(await enterCredentialRealistically(input as never, 'secret-value'), true);
  assert.ok(input.frameworkInputEvents > 0);
});

test('fixture reproduces fill not activating framework state while typing does', async () => {
  const input = new ControlledInputFixture();
  await input.fill('user@example.test');
  assert.equal(await input.isEnabled(), false);
  await enterCredentialRealistically(input as never, 'user@example.test');
  assert.equal(await input.isEnabled(), true);
});

test('visible submit click is used when it produces a submit event', async () => {
  let clicks = 0; let enters = 0; let submissions = 0;
  const result = await activateLoginSubmission(
    { click: async () => { clicks++; submissions++; } } as never,
    { press: async () => { enters++; submissions++; } } as never,
    async () => ({ ...none(), submitEventObserved: true }),
  );
  assert.equal(result.method, 'visible_submit_click');
  assert.deepEqual({ clicks, enters, submissions }, { clicks: 1, enters: 0, submissions: 1 });
});

test('Enter is a single bounded fallback only after a proven no-op click', async () => {
  let observations = 0; let actualSubmissions = 0; let enters = 0;
  const result = await activateLoginSubmission(
    { click: async () => {} } as never,
    { press: async (key: string) => { assert.equal(key, 'Enter'); enters++; actualSubmissions++; } } as never,
    async () => ++observations === 1 ? none() : ({ ...none(), submitEventObserved: true }),
  );
  assert.equal(result.method, 'password_enter_after_proven_noop_click');
  assert.equal(enters, 1);
  assert.equal(actualSubmissions, 1);
});

test('authentication navigation after click prevents Enter fallback', async () => {
  let enters = 0;
  const result = await activateLoginSubmission(
    { click: async () => {} } as never, { press: async () => { enters++; } } as never,
    async () => ({ ...none(), urlChanged: true, authenticationRequestObserved: true }),
  );
  assert.equal(result.method, 'visible_submit_click');
  assert.equal(enters, 0);
});

test('explicit invalid credentials count as processed', () => {
  assert.equal(loginSubmitProducedEffect({ ...none(), explicitLinkedInErrorAppeared: true }), true);
});

test('challenge after submit counts as processed', () => {
  assert.equal(loginSubmitProducedEffect({ ...none(), challengeAppeared: true }), true);
});

test('complete no-effect state is classified distinctly', () => {
  assert.equal(loginSubmitProducedEffect(none()), false);
  const source = readFileSync('src/linkedin.ts', 'utf8');
  assert.match(source, /errorCode: 'login_submit_not_processed'/);
});

test('instrumentation records sanitized request metadata and never request bodies', () => {
  const source = readFileSync('src/linkedin.ts', 'utf8');
  assert.match(source, /authentication_request_observed:/);
  assert.match(source, /request_target_host:/);
  assert.match(source, /request_method:/);
  assert.match(source, /response_status_category:/);
  const block = source.match(/LinkedIn credential submission observed[\s\S]*?return processed;/)?.[0] ?? '';
  assert.doesNotMatch(block, /postData|request\.headers|cookie\.value|credentials\.username|credentials\.password/);
});

test('selected LinkedIn login page is frozen from control resolution through submit', () => {
  const source = readFileSync('src/linkedin.ts', 'utf8');
  const block = source.match(/private async submitLinkedInCredentials[\s\S]*?\n  async connect\(/)?.[0] ?? '';
  assert.match(block, /const page = this\.page/);
  assert.match(block, /this\.page !== page/);
  assert.match(block, /selected_page_open:/);
  assert.match(block, /selected_page_count:/);
  assert.doesNotMatch(block, /ensureActivePage|newPage|bringToFront/);
});

test('production path performs at most one effective credential submission', () => {
  const source = readFileSync('src/linkedin.ts', 'utf8');
  const helper = source.match(/export async function activateLoginSubmission[\s\S]*?\n}/)?.[0] ?? '';
  assert.match(helper, /loginSubmitProducedEffect\(clickObservation\)/);
  assert.match(helper, /password\.press\('Enter'\)/);
  assert.equal((helper.match(/submit\.click/g) ?? []).length, 1);
  assert.equal((helper.match(/password\.press/g) ?? []).length, 1);
});
