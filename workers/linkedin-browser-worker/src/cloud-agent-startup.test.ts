import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CloudAgentStartupError, withinStartupDeadline } from './startup-deadline.js';

const source = (name: string) => fs.readFileSync(path.join(process.cwd(), 'src', name), 'utf8');
const worker = source('worker.ts');
const linkedin = source('linkedin.ts');
const browserbase = source('browserbase.ts');
const onboarding = fs.readFileSync(path.join(process.cwd(), '..', '..', 'src', 'pages', 'OnboardingPage.tsx'), 'utf8');

test('1 Browserbase starts normally within startup deadline', async () => assert.equal(await withinStartupDeadline(Promise.resolve('ready'), Date.now(), 'provider', 50), 'ready'));
test('2 slow Browserbase creation is bounded', async () => await assert.rejects(withinStartupDeadline(new Promise(() => {}), Date.now(), 'provider_creation', 5), CloudAgentStartupError));
test('3 Browserbase creation failure is preserved', async () => await assert.rejects(withinStartupDeadline(Promise.reject(new Error('provider failed')), Date.now(), 'provider_creation', 50), /provider failed/));
test('4 Context lease conflict fails rather than bypassing lease', () => assert.match(worker, /withinStartupDeadline\(this\.linkedinContexts\.acquire/));
test('5 provider session that never becomes usable times out', () => assert.match(worker, /provider_session_and_cdp/));
test('6 delayed CDP remains under the shared startup budget', () => assert.match(linkedin, /CDP_CONNECT_TIMEOUT_MS = 30000/));
test('7 CDP attach failure closes the same provider session', () => assert.match(linkedin, /CDP connection failed[\s\S]*endSession\(this\.bbSession\.id\)/));
test('8 LinkedIn initial page classification is bounded', () => assert.match(worker, /linkedin_classification/));
test('9 login_required begins human wait only after login surface readiness', () => assert.match(worker, /auth_surface_ready[\s\S]*result = await connection/));
test('10 Live View retrieval is retried on the same session', () => assert.match(linkedin, /waitForLiveUrl[\s\S]*refreshLiveUrl/));
test('11 unavailable Live View is a classified terminal startup event', () => assert.match(linkedin, /startup_failed[\s\S]*auth_surface_unavailable/));
test('12 authenticated Context bypasses Live View', () => assert.match(worker, /if \(preflight\.result\)[\s\S]*existing_session_authenticated/));
test('13 startup timeout is non-retryable and cleanup remains in finally', () => assert.match(worker, /CloudAgentStartupError[\s\S]*isRetryable = !\(err instanceof CloudAgentStartupError\)[\s\S]*finally/));
test('14 concurrent task runners prevent unrelated account starvation', () => assert.match(worker, /new Worker\(\)[\s\S]*activeTasks\.set/));
test('15 30-minute human deadline starts after usable auth surface', () => {
  assert.ok(worker.indexOf('linkedin_login_surface') < worker.indexOf('result = await connection'));
  assert.match(browserbase, /MAX_SESSION_TIMEOUT_SECONDS = 21600/);
});
test('frontend renders authoritative startup and login-ready states', () => {
  assert.match(onboarding, /Starting Cloud LinkedIn Agent/);
  assert.match(onboarding, /LinkedIn sign-in ready/);
  assert.doesNotMatch(onboarding, /Preparing secure browser/);
});
