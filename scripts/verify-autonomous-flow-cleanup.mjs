import fs from 'node:fs';

const pipeline = fs.readFileSync('supabase/functions/linkedin-v1-pipeline/index.ts', 'utf8');
const worker = fs.readFileSync('workers/linkedin-browser-worker/src/worker.ts', 'utf8');
const prospects = fs.readFileSync('src/pages/ProspectsPage.tsx', 'utf8');
const icps = fs.readFileSync('src/pages/ICPAndOffersPage.tsx', 'utf8');
const campaigns = fs.readFileSync('src/pages/CampaignsPage.tsx', 'utf8');
const creator = fs.readFileSync('src/components/icp/CreateICPWithYuktrisModal.tsx', 'utf8');

const checks = {
  'maintenance invokes replenishment-only endpoint': worker.includes("action: 'tick_replenishment'") && worker.includes('at most one due bounded batch'),
  'scheduler selects at most one due ICP': pipeline.includes('action === "tick_replenishment"') && pipeline.includes('.limit(1)') && pipeline.includes('scheduled_refresh'),
  'scheduler preserves identity-matched sender gate': pipeline.includes('const identityOk') && pipeline.includes('A connected and identity-matched LinkedIn sender'),
  'prospects primary source is canonical inventory': prospects.includes("from('icp_prospects')") && !prospects.includes('fetchCampaignProspects') && !prospects.includes('Campaign prospects'),
  'prospects never renders raw backend error fields': !prospects.includes('error_message') && !prospects.includes('action_params') && !prospects.includes('escalation_reason'),
  'customer ICP labels hide queued internals': icps.includes("label: 'Active'") && !icps.includes('replaceAll(\'_\', \' \')'),
  'AI offer-first creation exists': creator.includes('What are you selling?') && creator.includes('generateICPFromOffer') && creator.includes('Review your ICP'),
  'advanced manual creation remains': creator.includes('Advanced / Build manually'),
  'campaign creates ICP in place': campaigns.includes('CreateICPWithYuktrisModal') && !campaigns.includes("location.assign('/app/audience')"),
  'staging outbound gates untouched': !pipeline.includes('VITE_LINKEDIN_EXECUTION_MODE') && worker.includes('this.executionGate.outboundEnabled'),
};

let failed = false;
for (const [name, passed] of Object.entries(checks)) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  if (!passed) failed = true;
}
if (failed) process.exit(1);
