import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const connections = read('src/pages/ConnectionsPage.tsx');
const campaigns = read('src/pages/CampaignsPage.tsx');
const prospects = read('src/pages/ProspectsPage.tsx');
const sidebar = read('src/components/layout/Sidebar.tsx');

test('LinkedIn-only Connections distinguishes loading data from an error and omits Google requirements', () => {
  assert.match(connections, /linkedIn\.isError/);
  assert.match(connections, /Connected[\s\S]*Healthy/);
  assert.doesNotMatch(connections, /Gmail|Google Calendar|useGoogleConnection|useConnectGoogle/);
});

test('Campaigns has an explicit create path, truthful query errors, and schedule fields before launch', () => {
  assert.match(campaigns, /Create Campaign/);
  assert.match(campaigns, /existing\.isError/);
  assert.match(campaigns, /No campaigns yet/);
  assert.match(campaigns, /operating_days:[\s\S]*operating_hours:[\s\S]*outreach_timezone:/);
  assert.match(campaigns, /Review & Launch/);
  assert.match(campaigns, /Find Prospects with AI/);
  assert.match(campaigns, /preview_discovery/);
  assert.match(campaigns, /selectedProspectUrls\.size === 0/);
  assert.match(campaigns, /reviewed_linkedin_urls: \[\.\.\.selectedProspectUrls\]/);
  assert.match(campaigns, /type="checkbox"/);
  assert.match(campaigns, /LinkedIn: \{prospect\.linkedin_url\}/);
  assert.match(campaigns, /ICP fit:/);
  assert.match(campaigns, /Why selected:/);
  assert.doesNotMatch(campaigns, /Calendar connected/);
});

test('launch revalidates only canonical prospects explicitly reviewed from source-backed discovery', () => {
  const pipeline = readFileSync(resolve(root, 'supabase/functions/linkedin-v1-pipeline/index.ts'), 'utf8');
  assert.match(pipeline, /reviewed_prospects_required/);
  assert.match(pipeline, /reviewedTargetSet\.has\(prospect\.linkedinUrl\)/);
  assert.match(pipeline, /reviewed_prospects_not_revalidated/);
  assert.match(pipeline, /source_provider: "Tavily search \+ Jina Reader"/);
  assert.match(pipeline, /companyQueries/);
  assert.match(pipeline, /discoveryEmptyReason/);
  assert.match(pipeline, /diagnostics/);
  assert.match(pipeline, /excludeHistoricallyUnsafeProspects/);
  assert.match(pipeline, /linkedin_write_audit/);
  assert.match(pipeline, /browser_execution_queue/);
  assert.match(pipeline, /sameCompanyEvidence/);
  assert.match(pipeline, /isDecisionMakerTitle/);
});

test('Prospect reads and mutations remain scoped to the authenticated workspace', () => {
  assert.match(prospects, /from\('prospects'\)[\s\S]*workspace_id/);
  assert.match(prospects, /delete\(\)\.eq\('workspace_id', workspace\.id\)\.eq\('id', id\)/);
  assert.match(prospects, /update\(\{ status \}\)\.eq\('workspace_id', workspace\.id\)\.eq\('id', id\)/);
  assert.match(prospects, /Prospect data could not be loaded/);
});

test('V1 billing remains non-actionable manual provisioning', () => {
  assert.doesNotMatch(sidebar, /Upgrade to Growth|window\.location\.assign\('\/app\/settings'\)/);
  assert.match(sidebar, /manual provisioning[\s\S]*Coming Soon/);
});
