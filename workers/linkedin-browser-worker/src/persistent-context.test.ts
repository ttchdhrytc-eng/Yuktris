import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { persistentContextsEnabled, sessionOptionsForAccount } from './linkedin-context.js';

const root = new URL('../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const migration = read('supabase/migrations/20260812180000_linkedin_persistent_browser_context_foundation.sql');
const browserbase = read('workers/linkedin-browser-worker/src/browserbase.ts');
const worker = read('workers/linkedin-browser-worker/src/worker.ts');
const linkedin = read('workers/linkedin-browser-worker/src/linkedin.ts');
const contextService = read('workers/linkedin-browser-worker/src/linkedin-context.ts');

const tests: Array<[string, () => void]> = [
  ['one active Context per account', () => assert.match(migration, /UNIQUE INDEX uq_linkedin_browser_contexts_active_account[\s\S]*WHERE deleted_at IS NULL/)],
  ['provider Context cannot belong to two accounts', () => assert.match(migration, /UNIQUE INDEX uq_linkedin_browser_contexts_provider_id/)],
  ['workspace/account ownership is enforced', () => assert.match(migration, /FOREIGN KEY \(account_id, workspace_id\)[\s\S]*linkedin_accounts\(id, workspace_id\)/)],
  ['frontend roles cannot access provider id', () => assert.match(migration, /REVOKE ALL ON public\.linkedin_browser_contexts FROM PUBLIC, anon, authenticated/)],
  ['provisioning is serialized and unique', () => { assert.match(migration, /pg_advisory_xact_lock/); assert.match(migration, /FOR UPDATE/); }],
  ['lease acquisition has one winner', () => assert.match(migration, /lease_expires_at IS NULL OR c\.lease_expires_at<=now\(\)/)],
  ['lease renewal requires exact ownership', () => assert.match(migration, /active_queue_item_id=p_queue_item_id AND c\.active_worker_id=p_worker_id[\s\S]*active_attempt_id=p_attempt_id/)],
  ['context session persists without pre-authorizing Live View', () => assert.deepEqual(sessionOptionsForAccount(true, { id:'db', workspace_id:'w', account_id:'a', provider_context_id:'provider', status:'active', generation:1 }), { keepAlive:true, contextId:'provider', persistContext:true, requirePersistentContext:true, liveView:false })],
  ['CAPTCHA solving is false', () => assert.match(browserbase, /solveCaptchas: false/)],
  ['viewport remains 1440x900', () => assert.match(browserbase, /width: 1440, height: 900/)],
  ['persistent Context is V1 default with an explicit rollback switch', () => { assert.equal(persistentContextsEnabled({}), true); assert.equal(persistentContextsEnabled({ LINKEDIN_PERSISTENT_CONTEXTS_ENABLED:'false' }), false); assert.deepEqual(sessionOptionsForAccount(false), { keepAlive:true }); }],
  ['enrolled mode cannot silently fall back', () => { assert.throws(() => sessionOptionsForAccount(true, null), /unavailable/); assert.match(linkedin, /!sessionOptions\.requirePersistentContext && this\.localFallbackEnabled\(\)/); assert.match(worker, /usePersistentContext \? null : await this\.loadSessionForAccount/); }],
  ['provider failure reuses reservation rather than inserting again', () => { assert.match(contextService, /const reserved = await this\.reserve/); assert.match(contextService, /fail_linkedin_browser_context_provisioning/); }],
  ['provider identifiers and response bodies are absent from logs/errors', () => { assert.doesNotMatch(browserbase, /logger\.(info|warn|error)\([^\n]*\{\s*contextId[,:]/); assert.doesNotMatch(browserbase, /session creation failed:.*text/); }],
];

let failed = 0;
for (const [name, test] of tests) {
  try { test(); console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}:`, error instanceof Error ? error.message : 'unknown'); }
}
if (failed) process.exitCode = 1;
else console.log(`PASS ${tests.length}/${tests.length} persistent Context foundation checks`);
