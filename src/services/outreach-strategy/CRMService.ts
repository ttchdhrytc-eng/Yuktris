// ============================================================
// CRMService — Outreach Strategy Agent
// ============================================================
//
// Interface placeholder for future CRM integration.
// No implementation — architecture only.

import type { CRMHistoryResult } from '@/types/outreach-strategy';

export interface IOutreachCRMService {
  loadCampaignHistory(contactId: string): Promise<CRMHistoryResult>;
}

export class OutreachCRMService implements IOutreachCRMService {
  async loadCampaignHistory(_contactId: string): Promise<CRMHistoryResult> {
    throw new Error('OutreachCRMService.loadCampaignHistory() not implemented');
  }
}
