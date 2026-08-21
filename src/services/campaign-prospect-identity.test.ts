import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCampaignProspectIdentity, resolveCampaignProspectIdentitySafely } from './campaign-prospect-identity.ts';

test('Tarun post-association shape resolves without a job, history, sequence, company, or action fields', () => {
  const contactId = '49a26d45-e56e-4471-b184-7d2dfd2578d5';
  const identity = resolveCampaignProspectIdentity(contactId, new Map([[contactId, {
    id: contactId,
    full_name: 'Tarun Chaudhary',
    job_title: 'Fouonder at Revenue Clutch',
    company_id: null,
    linkedin_url: 'https://www.linkedin.com/in/tarun-chaudhary',
  }]]), new Map());

  assert.deepEqual(identity, {
    name: 'Tarun Chaudhary',
    title: 'Fouonder at Revenue Clutch',
    company: null,
    linkedinUrl: 'https://www.linkedin.com/in/tarun-chaudhary',
  });
});

test('a missing canonical contact fails instead of masquerading as unknown', () => {
  assert.throws(
    () => resolveCampaignProspectIdentity('missing-contact', new Map(), new Map()),
    /Canonical campaign contact is unavailable/,
  );
});

test('one malformed mapped contact becomes a row diagnostic instead of throwing', () => {
  assert.deepEqual(resolveCampaignProspectIdentitySafely('missing-contact', new Map(), new Map()), {
    ok: false,
    identity: { name: 'Prospect identity unavailable', title: null, company: null, linkedinUrl: null },
    diagnostic: 'canonical_contact_unavailable',
  });
});
