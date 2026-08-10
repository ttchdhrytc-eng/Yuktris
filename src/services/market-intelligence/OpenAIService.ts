// ============================================================
// OpenAIService — Market Intelligence Interface Placeholder
// ============================================================
//
// Extends the base OpenAIService interface with market-specific
// generation methods. Not implemented — architecture only.

import type { MarketInsightResult, StrategyResult } from '@/types/market-intelligence';

export interface IMarketOpenAIService {
  /** Generate comprehensive market insights from research data. */
  generateMarketInsights(researchData: unknown): Promise<MarketInsightResult>;

  /** Generate a GTM strategy from scored opportunities. */
  generateStrategy(opportunities: MarketInsightResult): Promise<StrategyResult>;

  /** Generate an executive summary of the market analysis. */
  generateExecutiveSummary(analysis: unknown): Promise<string>;

  /** Score opportunities based on market data. */
  scoreOpportunities(opportunities: unknown[]): Promise<unknown[]>;

  /** Recommend target industries. */
  recommendIndustries(industries: unknown[]): Promise<string[]>;

  /** Recommend target countries. */
  recommendCountries(countries: unknown[]): Promise<string[]>;

  /** Recommend messaging angles for outreach. */
  recommendMessaging(businessData: unknown): Promise<string>;

  /** Recommend market positioning. */
  recommendPositioning(businessData: unknown): Promise<string>;
}

export class MarketOpenAIService implements IMarketOpenAIService {
  private _apiKey: string | null;
  private _model: string;

  constructor(apiKey?: string, model = 'gpt-4o') {
    this._apiKey = apiKey ?? null;
    this._model = model;
  }

  async generateMarketInsights(_researchData: unknown): Promise<MarketInsightResult> {
    throw new Error('MarketOpenAIService.generateMarketInsights() not implemented — configure API key and implement in an Edge Function.');
  }

  async generateStrategy(_opportunities: MarketInsightResult): Promise<StrategyResult> {
    throw new Error('MarketOpenAIService.generateStrategy() not implemented.');
  }

  async generateExecutiveSummary(_analysis: unknown): Promise<string> {
    throw new Error('MarketOpenAIService.generateExecutiveSummary() not implemented.');
  }

  async scoreOpportunities(_opportunities: unknown[]): Promise<unknown[]> {
    throw new Error('MarketOpenAIService.scoreOpportunities() not implemented.');
  }

  async recommendIndustries(_industries: unknown[]): Promise<string[]> {
    throw new Error('MarketOpenAIService.recommendIndustries() not implemented.');
  }

  async recommendCountries(_countries: unknown[]): Promise<string[]> {
    throw new Error('MarketOpenAIService.recommendCountries() not implemented.');
  }

  async recommendMessaging(_businessData: unknown): Promise<string> {
    throw new Error('MarketOpenAIService.recommendMessaging() not implemented.');
  }

  async recommendPositioning(_businessData: unknown): Promise<string> {
    throw new Error('MarketOpenAIService.recommendPositioning() not implemented.');
  }

  isConfigured(): boolean {
    return this._apiKey !== null && this._apiKey.length > 0;
  }
}
