import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const worker = read('workers/linkedin-browser-worker/src/worker.ts');
const linkedin = read('workers/linkedin-browser-worker/src/linkedin.ts');
const context = read('workers/linkedin-browser-worker/src/linkedin-context.ts');
const hook = read('src/hooks/useLinkedInBrowser.ts');

const checks: Array<[string, () => void]> = [
  ['authenticated Context bypasses manual login', () => assert.match(worker, /if \(preflight\.result\)[\s\S]*result = preflight\.result/)],
  ['logged-out Context enters passive manual authentication', () => { const block=worker.match(/private async handleConnect[\s\S]*?private async handleTestConnection/)?.[0]??''; assert.match(block,/Sign in to LinkedIn once/); assert.doesNotMatch(block,/claimCredentials/); }],
  ['challenge remains observation-only', () => assert.match(linkedin, /worker_action: assessment\.state === 'checkpoint'[\s\S]*?'observe_only'/)],
  ['same persistent Context is supplied with persist true', () => assert.match(context, /contextId: context\.provider_context_id, persistContext: true/)],
  ['frontend uses idempotent non-credential RPC', () => { assert.match(hook,/rpc\('start_linkedin_connection'/); assert.match(hook,/params\.operationId/); }],
  ['credentials are absent from V1 hook', () => { const block=hook.match(/export function useConnectLinkedIn[\s\S]*?export function useLinkedInConnectionAttempt/)?.[0]??''; assert.doesNotMatch(block,/username|password|connect_existing/); }],
];

let failures=0;
for (const [name,check] of checks) { try { check(); console.log(`PASS ${name}`); } catch (error) { failures++; console.error(`FAIL ${name}:`, error); } }
if (failures) process.exitCode=1;
else console.log(`PASS ${checks.length}/${checks.length} manual persistent V1 checks`);
