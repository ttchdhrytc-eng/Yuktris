export type CampaignProspectIdentity = {
  campaignId: string;
  contactId: string;
  linkedinUrl: string | null;
  source: string;
};

export function canonicalCampaignProspectKey(row: CampaignProspectIdentity): string {
  const raw = row.linkedinUrl?.trim();
  if (raw) {
    try {
      const url = new URL(raw);
      if (/(^|\.)linkedin\.com$/i.test(url.hostname) && url.pathname.toLowerCase().startsWith('/in/')) {
        return `${row.campaignId}:linkedin:${url.pathname.toLowerCase().replace(/\/+$/, '')}`;
      }
    } catch {
      /* Fall back to the canonical contact below. */
    }
  }
  return `${row.campaignId}:contact:${row.contactId}`;
}

export function deduplicateCampaignProspects<T extends CampaignProspectIdentity>(rows: T[]): T[] {
  const unique = new Map<string, T>();
  for (const row of rows) {
    const key = canonicalCampaignProspectKey(row);
    const current = unique.get(key);
    if (!current || (current.source !== 'Existing workspace prospect' && row.source === 'Existing workspace prospect')) unique.set(key, row);
  }
  return [...unique.values()];
}
