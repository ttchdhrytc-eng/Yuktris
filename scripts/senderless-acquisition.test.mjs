import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { requestInitialAcquisition } from '../src/services/initial-acquisition.ts';
import { runDueProspectMaintenance } from '../workers/linkedin-browser-worker/src/prospect-maintenance.ts';
import { nextAcquisitionCadence } from '../supabase/functions/_shared/prospectAcquisition.ts';

let calls=[];
await requestInitialAcquisition({functions:{invoke:async(name, args)=>{calls.push(args.body);return {data:{job_id:'durable'},error:null}}}},'workspace','icp','icp_activated');
assert.equal(calls.length,1);assert.equal(calls[0].linkedin_account_id,undefined);
for(const result of [{data:null,error:{message:'unavailable'}},{data:{},error:null}]) {
  await assert.rejects(requestInitialAcquisition({functions:{invoke:async()=>result}},'w','i','icp_activated'), /saved and scheduled for automatic retry/);
}
let ticks=[];
await runDueProspectMaintenance({rpc:async(name)=>{assert.equal(name,'due_prospect_replenishment_workspaces');return {data:[{workspace_id:'senderless'},{workspace_id:'connected'},{workspace_id:'senderless'}],error:null}}},async id=>{ticks.push(id)});
assert.deepEqual(ticks,['senderless','connected']);
ticks=[];await runDueProspectMaintenance({rpc:async()=>({data:Array.from({length:50},(_,i)=>({workspace_id:String(i)})),error:null})},async id=>{ticks.push(id)});assert.equal(ticks.length,10);
await assert.rejects(runDueProspectMaintenance({rpc:async()=>({data:null,error:{message:'denied'}})},async()=>{throw Error('must not tick')}),/denied/);
const pipeline=readFileSync('supabase/functions/linkedin-v1-pipeline/index.ts','utf8');
const ast=ts.createSourceFile('pipeline.ts',pipeline,ts.ScriptTarget.Latest,true);
const names=['excludeHistoricallyUnsafeProspects','normalizeLinkedInProfile'];
const extracted=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text)).map(n=>n.getText(ast)).join('\n');
assert.equal(ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text)).length,2);
const js=ts.transpileModule(extracted,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const exclude=new Function('Deno','pipelineError',js+';return excludeHistoricallyUnsafeProspects;')({env:{get:()=> 'https://aljpmtuekghwzrnuwkat.supabase.co'}},(_code,message)=>new Error(message));
const sources=['contacts','linkedin_execution_jobs','linkedin_write_audit','browser_execution_queue','controlled_acceptance_generations','linkedin_production_acceptance_authorizations'];
const prospects=sources.map((_,i)=>({linkedinUrl:'https://www.linkedin.com/in/history-'+i}));prospects.push({linkedinUrl:'https://www.linkedin.com/in/new-person'});
const rows={
 contacts:[{id:'c',normalized_linkedin_url:prospects[0].linkedinUrl}],
 linkedin_execution_jobs:[{action_payload:{profile_url:prospects[1].linkedinUrl}}],
 linkedin_write_audit:[{target_identifier:prospects[2].linkedinUrl}],
 browser_execution_queue:[{action_type:'linkedin_message',action_params:{profile_url:prospects[3].linkedinUrl}}],
 controlled_acceptance_generations:[{target_identifier:prospects[4].linkedinUrl}],
 linkedin_production_acceptance_authorizations:[{canonical_target_url:prospects[5].linkedinUrl,status:'active'}],
};
let filters=[];
const admin={from(table){let q={select(){return q},eq(k,v){filters.push([table,k,v]);return q},in(){return q},then(resolve){return Promise.resolve({data:rows[table],error:null}).then(resolve)}};return q}};
let result=await exclude(admin,'workspace',undefined,prospects,{historicalExcluded:0});assert.deepEqual(result,[prospects[6]]);
assert.equal(filters.filter(([,k])=>k==='workspace_id').length,6);assert.equal(filters.filter(([,k])=>k.includes('account')).length,0);
filters=[];await exclude(admin,'workspace','sender',prospects,{historicalExcluded:0});assert.equal(filters.filter(([,k])=>k.includes('account')).length,5);
const failing={from(){let q={select(){return q},eq(){return q},in(){return q},then(resolve){return Promise.resolve({error:{message:'history unavailable'}}).then(resolve)}};return q}};
await assert.rejects(exclude(failing,'workspace',undefined,prospects,{historicalExcluded:0}),/history/);
const config={minimum_ready_inventory:5,acquisition_phase:'initial_acquisition',initial_acquisition_batches_completed:0,starter_ready_target:3,max_initial_acquisition_batches:3,initial_acquisition_interval_minutes:10};
assert.deepEqual(nextAcquisitionCadence(config,0),{phase:'initial_acquisition',initialBatchesCompleted:1,delayMinutes:10});
assert.equal(nextAcquisitionCadence({...config,initial_acquisition_batches_completed:2},0).delayMinutes,360);
assert.equal(nextAcquisitionCadence({...config,acquisition_phase:'maintenance'},5).delayMinutes,1440);
for(const file of ['src/components/icp/CreateICPWithYuktrisModal.tsx','src/services/icp-intelligence/ICPIntelligenceService.ts']) {
 const source=readFileSync(file,'utf8');assert.match(source,/next_refresh_at: new Date/);assert.match(source,/await requestInitialAcquisition/);
}
const worker=readFileSync('workers/linkedin-browser-worker/src/worker.ts','utf8');
const maintenance=worker.slice(worker.indexOf('private async runAutonomousMaintenance'),worker.indexOf('private async processTask'));
assert.ok(maintenance.indexOf('runDueProspectMaintenance')<maintenance.indexOf("from('linkedin_accounts')"));
assert.ok(maintenance.includes("from('linkedin_accounts').select('workspace_id').eq('connection_state', 'connected')"));
assert.match(readFileSync('src/pages/ProspectsPage.tsx','utf8'),/icon={<Users/);
assert.match(readFileSync('src/pages/DashboardPage.tsx','utf8'),/Video, Activity, Mail/);
console.log('PASS senderless/connected handoff, visible failure, bounded tick, workspace historical exclusions, fail-closed history, cadence, execution separation, preserved page fixes');
