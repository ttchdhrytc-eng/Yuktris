// ============================================================
// CRM Service — Interface Placeholder
// ============================================================
// Future integration: HubSpot / Salesforce / Pipedrive
// No implementation. Architecture only.

export interface CRMOpportunity {
  id: string;
  name: string;
  stage: string;
  deal_value: number;
  close_date: string;
  owner: string;
  contact_id: string;
  company_id: string;
}

export class CRMService {
  async createOpportunity(_params: {
    name: string;
    stage: string;
    deal_value: number;
    close_date: string;
    owner: string;
    contact_id: string;
    company_id: string;
  }): Promise<CRMOpportunity> {
    throw new Error('CRMService.createOpportunity() not implemented — architecture placeholder');
  }

  async updateDeal(_dealId: string, _params: Partial<CRMOpportunity>): Promise<CRMOpportunity> {
    throw new Error('CRMService.updateDeal() not implemented — architecture placeholder');
  }

  async getOpportunity(_dealId: string): Promise<CRMOpportunity> {
    throw new Error('CRMService.getOpportunity() not implemented — architecture placeholder');
  }
}
