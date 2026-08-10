// ============================================================
// FirecrawlService — Interface Placeholder
// ============================================================
//
// This service defines the contract for website crawling and content
// extraction using Firecrawl. The actual API integration is not
// implemented yet — these method signatures serve as the architecture
// for future implementation.
//
// When implementing, inject an API key via environment variables and
// proxy requests through a Supabase Edge Function.

import type { CrawlResult, ExtractedPage, PageType } from '@/types/business-intelligence';

export interface IFirecrawlService {
  /** Crawl a single URL and return the page content as markdown. */
  crawlWebsite(url: string): Promise<CrawlResult>;

  /** Extract structured markdown from a page URL. */
  extractMarkdown(url: string): Promise<string>;

  /** Extract metadata (title, description, og tags, etc.) from a URL. */
  extractMetadata(url: string): Promise<Record<string, unknown>>;

  /** Crawl an entire site and return all discovered pages. */
  crawlSite(rootUrl: string, maxPages?: number): Promise<ExtractedPage[]>;

  /** Map a site's URL structure without extracting content. */
  mapSite(rootUrl: string): Promise<string[]>;

  /** Detect the page type (homepage, pricing, blog, etc.) from URL and content. */
  detectPageType(url: string, content: string): Promise<PageType>;
}

export class FirecrawlService implements IFirecrawlService {
  private apiKey: string | null;
  private baseUrl = 'https://api.firecrawl.dev/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? null;
  }

  async crawlWebsite(_url: string): Promise<CrawlResult> {
    throw new Error('FirecrawlService.crawlWebsite() not implemented — configure API key and implement in an Edge Function.');
  }

  async extractMarkdown(_url: string): Promise<string> {
    throw new Error('FirecrawlService.extractMarkdown() not implemented.');
  }

  async extractMetadata(_url: string): Promise<Record<string, unknown>> {
    throw new Error('FirecrawlService.extractMetadata() not implemented.');
  }

  async crawlSite(_rootUrl: string, _maxPages?: number): Promise<ExtractedPage[]> {
    throw new Error('FirecrawlService.crawlSite() not implemented.');
  }

  async mapSite(_rootUrl: string): Promise<string[]> {
    throw new Error('FirecrawlService.mapSite() not implemented.');
  }

  async detectPageType(_url: string, _content: string): Promise<PageType> {
    throw new Error('FirecrawlService.detectPageType() not implemented.');
  }

  isConfigured(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }
}
