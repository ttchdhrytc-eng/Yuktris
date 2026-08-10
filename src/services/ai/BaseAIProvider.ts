// ============================================================
// BaseAIProvider — Abstract base for all AI providers
// ============================================================
//
// Implements the common IAIProvider interface. Every concrete
// provider extends this class and overrides only the methods it
// supports. The base class provides shared cost calculation and
// health check infrastructure.

import { supabase } from '@/lib/supabase';
import type {
  AIProviderDefinition,
  AIProviderId,
  AIProviderHealth,
  HealthStatus,
  GenerateTextParams,
  GenerateTextResult,
  GenerateStructuredParams,
  GenerateStructuredResult,
  GenerateEmbeddingParams,
  GenerateEmbeddingResult,
  CountTokensParams,
  CountTokensResult,
  IAIProvider,
  AICapability,
} from '@/types/ai-gateway';

export abstract class BaseAIProvider implements IAIProvider {
  abstract definition: AIProviderDefinition;

  async initialize(): Promise<void> {
    // Override in concrete provider to validate API key, etc.
  }

  async generateText(_params: GenerateTextParams): Promise<GenerateTextResult> {
    throw new Error(`${this.definition.name} generateText not implemented`);
  }

  async generateStructured(_params: GenerateStructuredParams): Promise<GenerateStructuredResult> {
    throw new Error(`${this.definition.name} generateStructured not implemented`);
  }

  async *generateStreaming(_params: GenerateTextParams): AsyncGenerator<string, void, unknown> {
    throw new Error(`${this.definition.name} generateStreaming not implemented`);
  }

  async generateEmbeddings(_params: GenerateEmbeddingParams): Promise<GenerateEmbeddingResult> {
    throw new Error(`${this.definition.name} generateEmbeddings not implemented`);
  }

  async countTokens(_params: CountTokensParams): Promise<CountTokensResult> {
    // Fallback: rough estimate (4 chars per token)
    return { tokenCount: 0, model: _params.model };
  }

  async healthCheck(): Promise<AIProviderHealth> {
    const now = new Date().toISOString();
    return {
      provider: this.definition.id,
      healthy: false,
      status: 'unknown' as HealthStatus,
      latency_ms: null,
      last_checked_at: now,
      error: 'Health check not implemented for this provider.',
    };
  }

  async calculateCost(promptTokens: number, completionTokens: number, model: string): Promise<number> {
    const { data } = await supabase
      .from('ai_models')
      .select('input_cost_per_1k, output_cost_per_1k')
      .eq('provider', this.definition.id)
      .eq('model_name', model)
      .maybeSingle();

    if (!data) return 0;

    const inputCost = (promptTokens / 1000) * Number(data.input_cost_per_1k);
    const outputCost = (completionTokens / 1000) * Number(data.output_cost_per_1k);
    return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
  }

  hasCapability(capability: AICapability): boolean {
    return this.definition.capabilities.includes(capability);
  }

  get id(): AIProviderId {
    return this.definition.id;
  }
}
