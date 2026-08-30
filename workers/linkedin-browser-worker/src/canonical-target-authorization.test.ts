import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql=readFileSync(resolve(process.cwd(),'../../supabase/migrations/20260830200000_write_lease_and_canonical_target_authorization.sql'),'utf8');

test('normal campaign authorization binds workspace, sender, job, campaign mapping, contact and canonical URL',()=>{
  for(const token of ['workspace_id=p_workspace_id','linkedin_account_id=p_account_id','j.action_type<>p_action_type','customer_campaign_contacts','normalized_linkedin_url','customer_campaign_id=v_campaign','contact_id=j.contact_id'])assert.match(sql,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
test('staging certification authorization is exact, scoped, expiring and action-specific',()=>{
  assert.match(sql,/p_project_ref<>'vdiqfiuqckaxdjkadinu'/);
  assert.match(sql,/s\.expires_at IS NULL OR s\.expires_at>now\(\)/);
  assert.match(sql,/p_action_type=ANY\(s\.allowed_action_types\)/);
  assert.match(sql,/s\.purpose='final_real_write_certification'/);
  assert.doesNotMatch(sql,/target_identifier='\*'/);
});
test('wrong workspace, sender, campaign, contact, URL, expired authorization and action all fail closed',()=>{
  for(const code of ['job_binding_mismatch','campaign_binding_mismatch','campaign_contact_mapping_missing','canonical_target_mismatch','staging_certification_authorization_missing'])assert.match(sql,new RegExp(code));
});
test('dry preflight is service-only, cancelled-job-only and cannot create an interaction or success audit',()=>{
  assert.match(sql,/j\.status<>'cancelled'/);
  assert.match(sql,/dry_preflight_only/);
  assert.match(sql,/'interaction_possible',false/);
  assert.match(sql,/'write_audit_created',false/);
  assert.match(sql,/REVOKE ALL ON FUNCTION[\s\S]*dry_preflight_normal_campaign_write/);
});
test('lease evidence records claim, renew, recovery and release using database time',()=>{
  for(const event of ["'claimed'","'renewed'","'recovered'","'released'"])assert.match(sql,new RegExp(event));
  assert.match(sql,/server_recorded_at timestamptz NOT NULL DEFAULT now\(\)/);
});
