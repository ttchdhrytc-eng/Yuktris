export type CanonicalContactRow = Record<string, unknown>;

export type CanonicalCampaignProspectIdentity = {
  name: string;
  title: string | null;
  company: string | null;
  linkedinUrl: string | null;
};

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
