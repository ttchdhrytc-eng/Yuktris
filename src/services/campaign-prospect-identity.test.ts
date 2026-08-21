import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCampaignProspectIdentity } from './campaign-prospect-identity.ts';

test('an associated contact without an execution job resolves canonical identity', () => {
  const contactId = '49a26d45-e56e-4471-b184-7d2dfd2578d5';
  const identity = resolveCampaignProspectIdentity(contactId, new Map([[contactId, {
    id: contactId,
    full_name: 'Canonical Person',
    job_title: 'Head of Partnerships',
    company_id: 'company-1',
    linkedin_url: 'https://www.linkedin.com/in/canonical-person',
  }]]), new Map([['company-1', 'Canonical Company']]));

  assert.deepEqual(identity, {
    name: 'Canonical Person',
    title: 'Head of Partnerships',
    company: 'Canonical Company',
    linkedinUrl: 'https://www.linkedin.com/in/canonical-person',
  });
});

test('a missing canonical contact fails instead of masquerading as unknown', () => {
  assert.throws(
    () => resolveCampaignProspectIdentity('missing-contact', new Map(), new Map()),
    /Canonical campaign contact is unavailable/,
  );
});
