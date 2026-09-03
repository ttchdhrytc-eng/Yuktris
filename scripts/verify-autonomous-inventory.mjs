import fs from 'node:fs';

const pipeline = fs.readFileSync('supabase/functions/linkedin-v1-pipeline/index.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260904120000_autonomous_prospect_inventory.sql', 'utf8');
const campaigns = fs.readFileSync('src/pages/CampaignsPage.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const checks = {
  'certified discovery is shared by preview and replenishment': /preview_discovery[\s\S]*discoverVerifiedProspects/.test(pipeline) && /processReplenishment[\s\S]*discoverVerifiedProspects/.test(pipeline),
  'inventory persistence is canonical and ICP-specific': pipeline.includes('workspace_id,normalized_linkedin_url') && pipeline.includes('icp_id,prospect_id'),
  'bounded discovery budget remains five': pipeline.includes('Math.min(config.replenishment_batch_size, 5)'),
  'autonomous campaigns use server reservations': pipeline.includes('reserve_autonomous_campaign_prospects'),
  'manual Find Prospects is not customer UI': !campaigns.includes('Find Prospects with AI'),
  'campaign builder is four steps': campaigns.includes("['Goal & Audience', 'Outreach', 'Safety & Schedule', 'Review & Launch']"),
  'ICP and Offers has a customer route': app.includes('ICPAndOffersPage'),
  'one active replenishment per ICP is constrained': migration.includes('replenishment_one_active_per_icp'),
  'workspace RLS exists on all new tables': ['icp_prospects_select','replenishment_select','reservations_select'].every((value) => migration.includes(value)),
  'intent defaults unknown, separate from fit': migration.includes("intent_status text NOT NULL DEFAULT 'unknown'"),
};
for (const [name, passed] of Object.entries(checks)) console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
if (Object.values(checks).some((passed) => !passed)) process.exit(1);
