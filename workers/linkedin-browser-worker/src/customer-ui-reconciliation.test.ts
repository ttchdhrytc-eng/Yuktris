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
  assert.match(pipeline, /peopleQueries/);
  assert.match(pipeline, /researchCompany/);
  assert.match(pipeline, /discoveryEmptyReason/);
  assert.match(pipeline, /diagnostics/);
  assert.match(pipeline, /excludeHistoricallyUnsafeProspects/);
  assert.match(pipeline, /linkedin_write_audit/);
  assert.match(pipeline, /browser_execution_queue/);
  assert.match(pipeline, /sameCompanyEvidence/);
  assert.match(pipeline, /isDecisionMakerTitle/);
  assert.match(pipeline, /matchesIntendedRole/);
  assert.match(pipeline, /new AbortController\(\)/);
  assert.match(pipeline, /combinedSignal\(signal, 7000\)/);
  assert.match(pipeline, /combinedSignal\(signal, 6000\)/);
  assert.match(pipeline, /providerStats/);
  assert.match(pipeline, /internal_deadline_reached/);
  assert.match(pipeline, /includes\("aljpmtuekghwzrnuwkat"\)/);
  assert.match(pipeline, /linkedin_production_acceptance_authorizations/);
  assert.match(campaigns, /discovering\) return/);
  assert.match(campaigns, /No outreach was started/);
});

test('discovery excludes history before deep providers and caches company work per request', () => {
  const pipeline = readFileSync(resolve(root, 'supabase/functions/linkedin-v1-pipeline/index.ts'), 'utf8');
  const discovery = pipeline.slice(pipeline.indexOf('async function discoverVerifiedProspects'), pipeline.indexOf('function discoveryEmptyReason'));
  assert.match(discovery, /newCanonical[\s\S]*excludeHistoricallyUnsafeProspects[\s\S]*candidates[\s\S]*groundedPersonExtraction[\s\S]*researchCompany/);
  assert.match(discovery, /safeCanonical\.has\(linkedinUrl\)[\s\S]*researchCompany\(companyName\)/);
  assert.match(discovery, /const companyResearchCache = new Map<string, Promise<CompanyResearch \| null>>\(\)/);
  assert.match(discovery, /companyResearchCache\.set\(identityKey, pending\)/);
  assert.match(discovery, /Store before awaiting so simultaneous candidates share/);
  assert.match(discovery, /identity:[\s\S]*domain:/);
  assert.match(discovery, /person evidence never enters it/);
  assert.match(pipeline, /internalDeadlineMs: 38000/);
  assert.match(discovery, /historical_exclusion_ms/);
  assert.match(discovery, /companyCacheMisses/);
  assert.match(discovery, /uniqueCompaniesResearched/);
});

test('discovery expands recall through bounded diverse waves without weakening evidence gates', () => {
  const pipeline = readFileSync(resolve(root, 'supabase/functions/linkedin-v1-pipeline/index.ts'), 'utf8');
  assert.match(pipeline, /maxWaves: 3/);
  assert.match(pipeline, /searchQueries: 6/);
  assert.match(pipeline, /canonicalCandidates: 18/);
  assert.match(pipeline, /deepResearchCandidates: 7/);
  assert.match(pipeline, /perWaveDeepResearchLimit = \[3, 2, 2\]/);
  assert.match(pipeline, /buildDiscoveryWaves/);
  assert.match(pipeline, /discoveryRoleVariants/);
  assert.match(pipeline, /discoveryVerticalVariants/);
  assert.match(pipeline, /no_materially_new_candidates/);
  assert.match(pipeline, /requested_target_reached/);
  assert.match(pipeline, /evaluatedCanonical/);
  assert.match(pipeline, /rejectedSemanticKeys/);
  assert.match(pipeline, /diversifyProspects/);
  assert.match(pipeline, /isOfficialCompanyCandidateUrl/);
  assert.match(pipeline, /wavesStarted/);
  assert.match(pipeline, /deadlineRemainingMs/);
});

test('discovery interprets source evidence without weakening mandatory gates', () => {
  const pipeline = readFileSync(resolve(root, 'supabase/functions/linkedin-v1-pipeline/index.ts'), 'utf8');
  assert.match(pipeline, /replace\(\/\\bvice president\\b\/g, "vp"\)/);
  assert.match(pipeline, /business development/);
  assert.match(pipeline, /Pvt/);
  assert.match(pipeline, /sameCompanyEvidence\(companyName,[\s\S]*company_person_binding_failure/);
  assert.match(pipeline, /generic word such as technology, digital, business, or software alone is insufficient/);
  assert.match(pipeline, /managed \(\?:it\|technology\) services/);
  assert.match(pipeline, /providerPage[\s\S]*\/about[\s\S]*\/services[\s\S]*\/solutions/);
  assert.match(pipeline, /sameDomain\(providerUrl\)/);
  assert.match(pipeline, /supportingQuote\.length < 15/);
  assert.match(pipeline, /qualificationStages/);
  assert.doesNotMatch(pipeline, /Alexis/);
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
