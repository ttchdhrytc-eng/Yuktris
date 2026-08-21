import assert from 'node:assert/strict';
import test from 'node:test';
import { deduplicateCampaignProspects } from './campaign-prospect-dedup.ts';

test('one LinkedIn identity renders once across existing and discovery sources', () => {
  const campaignId = 'f4ee741d-f3b8-47b8-ba67-770f44b58c00';
  const rows = deduplicateCampaignProspects([
    { campaignId, contactId: 'canonical', linkedinUrl: 'https://www.linkedin.com/in/tarun-chaudhary', source: 'Existing workspace prospect' },
    { campaignId, contactId: 'duplicate', linkedinUrl: 'https://linkedin.com/in/TARUN-CHAUDHARY/?trk=test', source: 'Campaign discovery' },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].contactId, 'canonical');
});

test('same identity in separate campaigns remains separately visible', () => {
  const rows = deduplicateCampaignProspects([
    { campaignId: 'one', contactId: 'a', linkedinUrl: 'https://www.linkedin.com/in/tarun-chaudhary', source: 'Campaign discovery' },
    { campaignId: 'two', contactId: 'a', linkedinUrl: 'https://www.linkedin.com/in/tarun-chaudhary', source: 'Campaign discovery' },
  ]);
  assert.equal(rows.length, 2);
});
