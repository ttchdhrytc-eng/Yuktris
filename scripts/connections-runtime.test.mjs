import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';

const mocks = {
  '@/contexts/WorkspaceContext': "const workspace={id:'offline-workspace'};export const useWorkspace=()=>({workspace});",
  '@/lib/supabase': `export const supabase={
    async rpc(name,params){window.calls.push({name,params});
      if(name==='start_linkedin_connection'){
        if(window.scenario==='denied')return {data:null,error:{message:'Connection service unavailable. Contact support.'}};
        await new Promise(resolve=>window.releaseStart=resolve);
        return {data:[{account_id:'existing-account',queue_item_id:'attempt'}],error:null};
      }
      if(name==='get_linkedin_login_access')return {data:{login_url:'https://www.browserbase.com/offline-auth',expires_at:'2099-01-01T00:00:00Z'},error:null};
      if(name==='cancel_browser_execution')return {data:null,error:null};
      throw Error('Unexpected RPC '+name);
    },
    from(table){const query={select(){return query},eq(){return query},order(){return query},limit(){return query},maybeSingle(){return query},then(resolve){
      const data=table==='linkedin_accounts'?[{id:'existing-account',connection_state:'failed',health_status:'warning',expected_profile_url:'https://www.linkedin.com/in/offline-person'}]
        :table==='browser_execution_queue'?{id:'attempt',account_id:'existing-account',workspace_id:'offline-workspace',action_type:'linkedin_connect',status:window.failAttempt?'failed':'running',error:window.failAttempt?'Browser launch failed: Secure browser provider is unavailable':null}
        :table==='linkedin_auth_interactions'?(window.scenario==='secure'?[{queue_item_id:'attempt',interaction_type:'progress',step:'auth_required',status:'completed'}]:[]):[];
      return Promise.resolve({data,error:null}).then(resolve);
    }};return query;}
  };`,
};
const result=await build({stdin:{contents:"import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {ConnectionsPage} from './src/pages/ConnectionsPage';window.calls=[];const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><ConnectionsPage/></QueryClientProvider>);",resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',tsconfigRaw:{compilerOptions:{baseUrl:'.',paths:{'@/*':['src/*']}}},define:{'import.meta.env':JSON.stringify({VITE_SUPABASE_URL:'https://aljpmtuekghwzrnuwkat.supabase.co'})},plugins:[{name:'offline',setup(b){
  b.onResolve({filter:/.*/},a=>Object.hasOwn(mocks,a.path)?{path:a.path,namespace:'mock'}:undefined);
  b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));
  if(process.env.CONNECTIONS_BASELINE==='1')b.onLoad({filter:/ConnectionsPage\.tsx$/},()=>({contents:execFileSync('git',['show','HEAD:src/pages/ConnectionsPage.tsx'],{encoding:'utf8'}),loader:'tsx'}));
}}]});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  for(const scenario of ['secure','provider-failure','denied']){
    const page=await browser.newPage();page.setDefaultTimeout(7000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:r.request().url()==='https://offline.test/'?'<div id="root"></div>':'<p>Offline secure browser fixture</p>'}));
    await page.goto('https://offline.test/');await page.evaluate(value=>window.scenario=value,scenario);await page.addScriptTag({content:result.outputFiles[0].text});
    await page.getByRole('button',{name:'Reconnect',exact:true}).click();
    await page.waitForFunction(()=>window.calls.some(c=>c.name==='start_linkedin_connection'));
    if(scenario!=='denied'){
      await page.waitForFunction(()=>typeof window.releaseStart==='function');await page.evaluate(()=>window.releaseStart());
      await page.getByRole('dialog',{name:'Secure LinkedIn sign-in'}).waitFor();
      assert.equal(await page.evaluate(()=>window.calls.find(c=>c.name==='start_linkedin_connection').params.p_existing_account_id),'existing-account');
      if(scenario==='secure')await page.locator('iframe[title="LinkedIn secure authentication"]').waitFor();
      else {await page.evaluate(()=>window.failAttempt=true);await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/Secure browser provider is unavailable/);assert.equal(await page.getByRole('dialog').count(),0);}
    }else {await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/Connection service unavailable/);}
    assert.deepEqual(errors,[]);console.log('PASS '+scenario+' (real component and hooks; offline RPC/provider fixtures)');await page.close();
  }
}finally{await browser.close();}
