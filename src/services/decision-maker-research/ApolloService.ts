// ============================================================
// ApolloService — Decision Maker Research Agent
// ============================================================
//
// Interface placeholder for future Apollo integration.
// No implementation — architecture only.

import type { ApolloEnrichmentResult } from '@/types/decision-maker-research';

export interface IApolloService {
  enrichContact(name: string, company: string): Promise<ApolloEnrichmentResult>;
  findEmails(name: string, company: string): Promise<string[]>;
  findPhones(name: string, company: string): Promise<string[]>;
}

export class ApolloService implements IApolloService {
  async enrichContact(_name: string, _company: string): Promise<ApolloEnrichmentResult> {
    throw new Error('ApolloService.enrichContact() not implemented');
  }
  async findEmails(_name: string, _company: string): Promise<string[]> {
    throw new Error('ApolloService.findEmails() not implemented');
  }
  async findPhones(_name: string, _company: string): Promise<string[]> {
    throw new Error('ApolloService.findPhones() not implemented');
  }
}
