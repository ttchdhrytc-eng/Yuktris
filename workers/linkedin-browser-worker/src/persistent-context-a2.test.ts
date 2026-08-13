import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LinkedInContextService } from './linkedin-context.js';

const root=new URL('../../../',import.meta.url);
const read=(p:string)=>readFileSync(new URL(p,root),'utf8');
const migration=read('supabase/migrations/20260813100000_linkedin_persistent_context_controlled_enrollment.sql');
const worker=read('workers/linkedin-browser-worker/src/worker.ts');
const browserbase=read('workers/linkedin-browser-worker/src/browserbase.ts');

type Result={data:any;error:any};
class FakeClient {
  calls:Array<[string,Record<string,unknown>]> = [];
  constructor(private handlers:Record<string,(args:Record<string,unknown>)=>Result>){}
  async rpc(name:string,args:Record<string,unknown>={}) { this.calls.push([name,args]); return this.handlers[name]?.(args) ?? {data:null,error:null}; }
}
const service=(client:FakeClient)=>new LinkedInContextService(client as any);

const tests:Array<[string,()=>void|Promise<void>]> = [
 ['flag off + enrolled without Context stays legacy',async()=>assert.equal(await service(new FakeClient({get_linkedin_browser_context_policy:()=>({data:[{enrolled:true,has_persistent_context:false}],error:null})})).shouldUsePersistentContext('w','a',false),false)],
 ['flag on + non-enrolled stays legacy',async()=>assert.equal(await service(new FakeClient({get_linkedin_browser_context_policy:()=>({data:[{enrolled:false,has_persistent_context:false}],error:null})})).shouldUsePersistentContext('w','a',true),false)],
 ['flag on + enrolled selects Context path',async()=>assert.equal(await service(new FakeClient({get_linkedin_browser_context_policy:()=>({data:[{enrolled:true,has_persistent_context:false}],error:null})})).shouldUsePersistentContext('w','a',true),true)],
 ['existing Context cannot fresh-fall-back',async()=>await assert.rejects(service(new FakeClient({get_linkedin_browser_context_policy:()=>({data:[{enrolled:true,has_persistent_context:true}],error:null})})).shouldUsePersistentContext('w','a',false),/paused/)],
 ['concurrent provisioning has one database claimant',()=>{assert.match(migration,/claim_linkedin_browser_context_provisioning/);assert.match(migration,/lease_expires_at IS NULL OR lease_expires_at<=now\(\)/)}],
 ['existing Context is reused',()=>assert.match(read('workers/linkedin-browser-worker/src/linkedin-context.ts'),/if \(reserved\.provider_context_id\) return this\.ensureExecutionPreferences\(reserved\)/)],
 ['running or unknown stale session blocks replacement',()=>{assert.match(read('workers/linkedin-browser-worker/src/linkedin-context.ts'),/status === 'running' \|\| status === 'unknown'[\s\S]*previous persistent browser session/);assert.match(migration,/release_linkedin_browser_context_lease[\s\S]*active_queue_item_id=NULL[\s\S]*active_worker_id=NULL/);const release=migration.match(/CREATE OR REPLACE FUNCTION public\.release_linkedin_browser_context_lease[\s\S]*?END \$\$/)?.[0]??'';assert.doesNotMatch(release,/active_browserbase_session_id=NULL/)}],
 ['terminal stale session synchronizes then reconciles',()=>{assert.match(read('workers/linkedin-browser-worker/src/linkedin-context.ts'),/settleClosedContext[\s\S]*reconcile_terminal_linkedin_browser_context_session/)}],
 ['deletion request is idempotent',()=>assert.match(migration,/ON CONFLICT\(context_id\) DO UPDATE/)],
 ['provider 404 is successful deletion',()=>assert.match(browserbase,/res\.status === 404\) return 'not_found'/)],
 ['temporary deletion failure remains pending',()=>{assert.match(browserbase,/status === 429 \|\| res\.status >= 500/);assert.match(migration,/status='retry'/)}],
 ['workspace/account isolation is enforced',()=>assert.match(migration,/FOREIGN KEY \(account_id, workspace_id\).*linkedin_accounts\(id, workspace_id\)/s)],
 ['frontend cannot enroll or read provider IDs',()=>{assert.match(migration,/REVOKE ALL ON public\.linkedin_browser_context_enrollments FROM PUBLIC, anon, authenticated/);assert.match(migration,/REVOKE ALL ON public\.linkedin_browser_context_deletion_jobs FROM PUBLIC, anon, authenticated/)}],
 ['canonical mismatch remains fail closed',()=>assert.match(read('workers/linkedin-browser-worker/src/phase2a.test.ts'),/identity mismatch fails closed/)],
 ['synchronization precedes connected state',()=>{const sync=worker.indexOf('linkedinContexts.synchronize');const connected=worker.indexOf("connection_state: 'connected'",sync);assert.ok(sync>0&&connected>sync)}],
];
let failed=0;
for(const [name,test] of tests){try{await test();console.log(`PASS ${name}`)}catch(e){failed++;console.error(`FAIL ${name}:`,e instanceof Error?e.message:'unknown')}}
if(failed)process.exitCode=1;else console.log(`PASS ${tests.length}/${tests.length} Phase A2 checks`);
