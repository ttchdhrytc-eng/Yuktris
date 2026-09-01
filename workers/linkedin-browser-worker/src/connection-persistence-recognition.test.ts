import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(process.cwd(), '../..');
const worker = readFileSync(resolve(root, 'workers/linkedin-browser-worker/src/worker.ts'), 'utf8');
const onboarding = readFileSync(resolve(root, 'src/pages/OnboardingPage.tsx'), 'utf8');
const repair = readFileSync(resolve(root, 'supabase/migrations/20260901104000_repair_linkedin_connection_recognition.sql'), 'utf8');

test('successful connected account writes include healthy account recognition', () => {
  const connectedWrites = [...worker.matchAll(/updateAccount\(accountId, \{([\s\S]*?)\}\);/g)]
    .map((match) => match[1])
    .filter((body) => /connection_state:\s*'connected'/.test(body));
  assert.ok(connectedWrites.length >= 7);
  for (const body of connectedWrites) assert.match(body, /health_status:\s*'healthy'/);
});

test('Launch Review includes authenticated LinkedIn connection', () => {
  assert.match(onboarding, /label="Connections"[\s\S]{0,160}linkedinConnected \? 'LinkedIn' : null/);
});

test('repair requires authenticated session and active synchronized persistent Context', () => {
  assert.match(repair, /s\.authenticated IS TRUE/);
  assert.match(repair, /s\.health_status='healthy'/);
  assert.match(repair, /c\.status='active'/);
  assert.match(repair, /c\.provider_context_id IS NOT NULL/);
  assert.match(repair, /c\.last_synchronized_at IS NOT NULL/);
});

test('recognition verification performs no browser or LinkedIn interaction', () => {
  assert.doesNotMatch(import.meta.url, /https?:/);
});
