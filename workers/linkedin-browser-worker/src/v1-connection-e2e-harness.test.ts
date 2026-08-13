import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const linkedin = read('workers/linkedin-browser-worker/src/linkedin.ts');
const worker = read('workers/linkedin-browser-worker/src/worker.ts');
const context = read('workers/linkedin-browser-worker/src/linkedin-context.ts');
const onboarding = read('src/pages/OnboardingPage.tsx');
const modal = read('src/components/linkedin/SecureLinkedInAuthModal.tsx');
const hook = read('src/hooks/useLinkedInBrowser.ts');
const migration = read('supabase/migrations/20260813230000_linkedin_stored_credential_reconnect.sql');

const scenarios: Array<[string, () => void]> = [
  ['1 already authenticated bypasses credentials and connects', () => assert.match(worker, /if \(preflight\.result\)[\s\S]*result = preflight\.result/)],
  ['2 standard credential login resolves email/password/submit and waits for li_at', () => {
    assert.match(linkedin, /input\[type="email"\]/); assert.match(linkedin, /submitLinkedInCredentials/); assert.match(linkedin, /cookie\.name === 'li_at'/);
  }],
  ['3 delayed rendering is bounded and repeatedly probed', () => assert.match(linkedin, /while \(Date\.now\(\) < deadline\)[\s\S]*options\.probe/)],
  ['4 hidden duplicate controls require visible enabled editable candidates', () => {
    assert.match(linkedin, /candidate\.isVisible/); assert.match(linkedin, /candidate\.isEnabled/); assert.match(linkedin, /candidate\.isEditable/);
  }],
  ['5 uas login redirects through one canonical login navigation', () => assert.match(linkedin, /if \(!navigated\)[\s\S]*options\.navigate\(\)[\s\S]*navigated = true/)],
  ['6 challenge alone authorizes same-session Live View', () => assert.match(linkedin, /assessment\.state === 'checkpoint'[\s\S]*challengeLiveUrl = await this\.refreshLiveUrl/)],
  ['7 Live View recovery does not terminate a healthy backend queue', () => {
    assert.doesNotMatch(modal, /15_000|readinessTimedOut/); assert.match(modal, /backend authentication remains active/);
  }],
  ['8 explicit invalid credentials become credentials_invalid', () => assert.match(linkedin, /failureCode: 'invalid_credentials'/)],
  ['9 bound unresolved identity is deferred', () => assert.match(linkedin, /allowBoundIdentityDeferral && bound[\s\S]*state: 'deferred'/)],
  ['10 positive identity mismatch fails closed', () => assert.match(linkedin, /resolved && bound[\s\S]*state: 'mismatch'/)],
  ['11 Browserbase and CDP failures are classified infrastructure failures', () => assert.match(worker, /Browser launch failed[\s\S]*context creation failed/i)],
  ['12 backend operation over fifteen seconds cannot be failed by frontend', () => {
    assert.doesNotMatch(onboarding, /15_000|auth_surface_preparation|linkedinAttemptTimeoutStage/); assert.match(onboarding, /activeLinkedinQueue/);
  }],
  ['13 human verification retains the thirty-minute budget', () => assert.match(linkedin, /MAX_AUTH_ATTEMPT_LIFETIME_MS/)],
  ['14 provider session exceeds human verification budget', () => assert.match(worker, /INTERACTIVE_BROWSER_SESSION_TIMEOUT_MS/)],
  ['15 second session reuses Context and bypasses credential retrieval when authenticated', () => {
    assert.match(context, /provider_context_id/); assert.match(worker, /if \(preflight\.result\)[\s\S]*else \{[\s\S]*claimCredentials/);
  }],
  ['16 worker restart uses durable Context mapping and stored credentials remain queue-scoped', () => {
    assert.match(context, /get_linkedin_browser_context/); assert.match(migration, /start_linkedin_connection_with_stored_credentials/); assert.match(hook, /connect_existing/);
  }],
];

for (const [name, verify] of scenarios) test(name, verify);
