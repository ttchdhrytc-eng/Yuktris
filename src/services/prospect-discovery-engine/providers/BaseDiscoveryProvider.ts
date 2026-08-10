// ============================================================
// BaseDiscoveryProvider — Abstract base for all discovery providers
// ============================================================
//
// Every provider (LinkedIn, Apollo, ZoomInfo, Clearbit, etc.)
// extends this class and implements the methods it supports.

import type {
  IDiscoveryProvider,
  DiscoveryProviderDefinition,
  CompanySearchParams,
  CompanySearchResult,
  ContactSearchParams,
  ContactSearchResult,
  EnrichmentResult,
  SignalType,
} from '@/types/prospect-discovery-engine';

export abstract class BaseDiscoveryProvider implements IDiscoveryProvider {
  abstract definition: DiscoveryProviderDefinition;

  async searchCompanies(_params: CompanySearchParams): Promise<CompanySearchResult[]> {
    throw new Error(`${this.definition.name} does not support company search`);
  }

  async enrichCompany(_domain: string): Promise<Partial<CompanySearchResult>> {
    throw new Error(`${this.definition.name} does not support company enrichment`);
  }

  async searchContacts(_params: ContactSearchParams): Promise<ContactSearchResult[]> {
    throw new Error(`${this.definition.name} does not support contact search`);
  }

  async enrichContact(_contactId: string): Promise<EnrichmentResult> {
    throw new Error(`${this.definition.name} does not support contact enrichment`);
  }

  async detectSignals(_companyName: string, _website?: string): Promise<{ type: SignalType; data: Record<string, unknown>; strength: number }[]> {
    throw new Error(`${this.definition.name} does not support signal detection`);
  }
}
