// ============================================================
// FirecrawlService — Market Intelligence Interface Placeholder
// ============================================================
//
// Extends the base FirecrawlService interface with competitor-
// specific extraction methods. Not implemented — architecture only.

export interface IMarketFirecrawlService {
  /** Extract content from a competitor's website. */
  extractCompetitorWebsite(url: string): Promise<{ title: string; content: string; metadata: Record<string, unknown> }>;

  /** Extract pricing information from a competitor's pricing page. */
  extractPricing(url: string): Promise<string>;

  /** Extract services/product offerings from a competitor's site. */
  extractServices(url: string): Promise<string[]>;
}

export class MarketFirecrawlService implements IMarketFirecrawlService {
  private _apiKey: string | null;
  private _baseUrl = 'https://api.firecrawl.dev/v1';

  constructor(apiKey?: string) {
    this._apiKey = apiKey ?? null;
  }

  async extractCompetitorWebsite(_url: string): Promise<{ title: string; content: string; metadata: Record<string, unknown> }> {
    throw new Error('MarketFirecrawlService.extractCompetitorWebsite() not implemented — configure API key and implement in an Edge Function.');
  }

  async extractPricing(_url: string): Promise<string> {
    throw new Error('MarketFirecrawlService.extractPricing() not implemented.');
  }

  async extractServices(_url: string): Promise<string[]> {
    throw new Error('MarketFirecrawlService.extractServices() not implemented.');
  }

  isConfigured(): boolean {
    return this._apiKey !== null && this._apiKey.length > 0;
  }
}
