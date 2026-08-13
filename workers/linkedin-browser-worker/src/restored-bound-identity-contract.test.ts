import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(process.cwd(), '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const linkedin = read('workers/linkedin-browser-worker/src/linkedin.ts');
const worker = read('workers/linkedin-browser-worker/src/worker.ts');
const restore = linkedin.match(/async connectWithSession[\s\S]*?async testConnection/)?.[0] ?? '';
const reuse = worker.match(/if \(reuseResult\.success\)[\s\S]*?logger\.info\('LinkedIn account connected via session reuse'/)?.[0] ?? '';

test('1 unresolved fresh identity reuses a validated full bound URL and completes', () => {
  assert.match(restore, /canonicalPersonalProfileUrl\(intendedIdentity\.profileUrl\)/);
  assert.match(restore, /effectiveProfileUrl: boundProfileUrl, reuseBoundIdentity: true/);
  assert.match(reuse, /updateAccount[\s\S]*connection_state: 'connected'[\s\S]*queue\.complete/);
});
test('2 matching fresh identity returns a verified effective URL', () => assert.match(restore, /effectiveProfileUrl: identity\.profileUrl[\s\S]*identityState: 'verified'/));
test('3 resolved mismatch remains fail closed', () => assert.match(restore, /identityMismatch[\s\S]*nonRetryable: true[\s\S]*identityState: 'mismatch'/));
test('4 unbound unresolved identity remains fail closed', () => assert.match(restore, /if \(boundProfileUrl\)[\s\S]*errorCode: 'identity_resolution_failed'/));
test('5 accepted bound fallback creates no Session B', () => assert.doesNotMatch(reuse, /linkedin\.launch|createSession/));
test('6 accepted bound fallback never emits auth_required', () => assert.doesNotMatch(reuse, /auth_required/));
test('7 connected progress follows all required persistence', () => {
  const update = reuse.indexOf('await this.updateAccount');
  const event = reuse.indexOf('await this.logSessionEvent');
  const close = reuse.indexOf('await this.linkedin.close');
  const connected = reuse.indexOf("await onProgress('connected'");
  const complete = reuse.indexOf('await this.queue.complete');
  assert.ok(update >= 0 && event > update && close > event && connected > close && complete > connected);
  assert.doesNotMatch(restore, /onProgress\?\.\('connected'|onProgress\('connected'/);
});
test('8 persistence never receives a slug, in-me, null, or undefined', () => {
  assert.match(reuse, /if \(!effectiveProfileUrl\) throw/);
  assert.match(reuse, /if \(!reuseResult\.reuseBoundIdentity\)[\s\S]*bindAuthenticatedIdentity\([^\n]*effectiveProfileUrl/);
  assert.match(reuse, /profile_url: effectiveProfileUrl/);
  assert.doesNotMatch(reuse, /bindAuthenticatedIdentity\([^\n]*identity\?\.profileUrl/);
});
