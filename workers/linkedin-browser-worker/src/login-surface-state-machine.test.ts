import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLinkedInLoginSurface, type LinkedInAuthenticationState, type LoginSurfaceProbe } from './linkedin.js';

type Control = { id: string };
const control = (id: string): Control => ({ id });
const probe = (
  state: LinkedInAuthenticationState,
  controls = false,
  extra: Partial<LoginSurfaceProbe<Control>> = {},
): LoginSurfaceProbe<Control> => ({
  authentication: { state, confidence: state === 'unknown' ? 'low' : 'high', url: `https://www.linkedin.com/${state}`, signals: [] },
  username: controls ? control('username') : null,
  password: controls ? control('password') : null,
  submit: controls ? control('submit') : null,
  connected: true,
  ...extra,
});

test('login page immediately available', async () => {
  let navigations = 0;
  const result = await resolveLinkedInLoginSurface({ probe: async () => probe('unauthenticated', true), navigate: async () => { navigations++; } });
  assert.equal(result.state, 'login_ready');
  assert.equal(navigations, 0);
});

test('login page appears after delayed rendering', async () => {
  let reads = 0;
  const result = await resolveLinkedInLoginSurface({
    probe: async () => ++reads < 3 ? probe('unknown') : probe('unauthenticated', true),
    navigate: async () => {}, timeoutMs: 100, pollMs: 1,
  });
  assert.equal(result.state, 'login_ready');
  assert.ok(reads >= 3);
});

test('redirect before login form appears navigates at most once', async () => {
  let reads = 0;
  let navigations = 0;
  const result = await resolveLinkedInLoginSurface({
    probe: async () => ++reads < 3 ? probe('unknown') : probe('unauthenticated', true),
    navigate: async () => { navigations++; }, timeoutMs: 100, pollMs: 1,
  });
  assert.equal(result.state, 'login_ready');
  assert.equal(navigations, 1);
});

test('authenticated after navigation returns without a credential surface', async () => {
  let reads = 0;
  const result = await resolveLinkedInLoginSurface({
    probe: async () => ++reads === 1 ? probe('unknown') : probe('authenticated'), navigate: async () => {},
  });
  assert.equal(result.state, 'authenticated');
});

for (const stateName of ['checkpoint', 'challenge'] as const) {
  test(`${stateName} instead of login requires human verification`, async () => {
    const result = await resolveLinkedInLoginSurface({ probe: async () => probe('checkpoint'), navigate: async () => {} });
    assert.equal(result.state, 'verification_required');
  });
}

test('deterministic consent surface is handled before login', async () => {
  let accepted = false;
  const result = await resolveLinkedInLoginSurface({
    probe: async () => accepted ? probe('unauthenticated', true) : probe('unknown', false, { consentBlocking: true }),
    navigate: async () => {}, acceptConsent: async () => { accepted = true; return true; },
  });
  assert.equal(result.state, 'login_ready');
  assert.equal(accepted, true);
});

test('truly unavailable login surface is bounded', async () => {
  const result = await resolveLinkedInLoginSurface({ probe: async () => probe('unknown'), navigate: async () => {}, timeoutMs: 5, pollMs: 1 });
  assert.deepEqual({ state: result.state, reason: result.state === 'unavailable' ? result.reason : null }, { state: 'unavailable', reason: 'timeout' });
});

test('CDP disconnect fails closed', async () => {
  const result = await resolveLinkedInLoginSurface({ probe: async () => probe('unknown', false, { connected: false }), navigate: async () => {} });
  assert.deepEqual({ state: result.state, reason: result.state === 'unavailable' ? result.reason : null }, { state: 'unavailable', reason: 'disconnected' });
});

test('authenticated Context never requests navigation or credential controls', async () => {
  let navigations = 0;
  const result = await resolveLinkedInLoginSurface({ probe: async () => probe('authenticated'), navigate: async () => { navigations++; } });
  assert.equal(result.state, 'authenticated');
  assert.equal(navigations, 0);
  assert.equal(result.probe.username, null);
});

test('raw browser errors are reduced to a safe state code', async () => {
  const result = await resolveLinkedInLoginSurface({
    probe: async () => { throw new Error('locator.waitFor secret DOM internals'); }, navigate: async () => {},
  });
  assert.deepEqual({ state: result.state, reason: result.state === 'unavailable' ? result.reason : null }, { state: 'unavailable', reason: 'browser_error' });
  assert.doesNotMatch(JSON.stringify(result), /locator|secret|DOM/);
});
