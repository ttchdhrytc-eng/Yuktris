export type CanonicalContactRow = Record<string, unknown>;

export type CanonicalCampaignProspectIdentity = {
  name: string;
  title: string | null;
  company: string | null;
  linkedinUrl: string | null;
};

export type CampaignProspectIdentityResult =
  | { ok: true; identity: CanonicalCampaignProspectIdentity; diagnostic: null }
  | { ok: false; identity: CanonicalCampaignProspectIdentity; diagnostic: 'canonical_contact_unavailable' };

export function resolveCampaignProspectIdentity(
  contactId: string,
  contacts: Map<string, CanonicalContactRow>,
  companies: Map<string, string>,
): CanonicalCampaignProspectIdentity {
  const contact = contacts.get(contactId);
  if (!contact) throw new Error('Canonical campaign contact is unavailable');

  return {
    name: String(contact.full_name ?? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`).trim() || 'Unknown prospect',
    title: contact.job_title ? String(contact.job_title) : null,
    company: contact.company_id ? (companies.get(String(contact.company_id)) ?? null) : null,
    linkedinUrl: String(contact.linkedin_url ?? '') || null,
  };
}

export function resolveCampaignProspectIdentitySafely(
  contactId: string,
  contacts: Map<string, CanonicalContactRow>,
  companies: Map<string, string>,
): CampaignProspectIdentityResult {
  try {
    return { ok: true, identity: resolveCampaignProspectIdentity(contactId, contacts, companies), diagnostic: null };
  } catch {
    return {
      ok: false,
      identity: { name: 'Prospect identity unavailable', title: null, company: null, linkedinUrl: null },
      diagnostic: 'canonical_contact_unavailable',
    };
  }
}
