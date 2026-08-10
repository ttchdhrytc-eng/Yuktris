// ============================================================
// OpenAIService — Buying Intent Agent
// ============================================================
//
// Interface placeholder for future OpenAI integration.
// No implementation — architecture only.

import type { OpenAIIntentResult } from '@/types/buying-intent';

export interface IIntentOpenAIService {
  predictIntent(signals: unknown[]): Promise<OpenAIIntentResult>;
  generateSummary(analysisData: unknown): Promise<string>;
  recommendPriority(analyses: unknown[]): Promise<{ company_id: string; priority: string }[]>;
  predictBuyingWindow(signals: unknown[]): Promise<{ window: string; probability: number }>;
}

export class IntentOpenAIService implements IIntentOpenAIService {
  async predictIntent(_signals: unknown[]): Promise<OpenAIIntentResult> {
    throw new Error('IntentOpenAIService.predictIntent() not implemented');
  }
  async generateSummary(_analysisData: unknown): Promise<string> {
    throw new Error('IntentOpenAIService.generateSummary() not implemented');
  }
  async recommendPriority(_analyses: unknown[]): Promise<{ company_id: string; priority: string }[]> {
    throw new Error('IntentOpenAIService.recommendPriority() not implemented');
  }
  async predictBuyingWindow(_signals: unknown[]): Promise<{ window: string; probability: number }> {
    throw new Error('IntentOpenAIService.predictBuyingWindow() not implemented');
  }
}
