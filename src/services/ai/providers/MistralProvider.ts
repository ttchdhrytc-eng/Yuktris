// ============================================================
// MistralProvider — Mistral AI provider (placeholder)
// ============================================================

import { BaseAIProvider } from '../BaseAIProvider';
import type { AIProviderDefinition, AIProviderHealth } from '@/types/ai-gateway';

const MISTRAL_DEFINITION: AIProviderDefinition = {
  id: 'mistral',
  name: 'Mistral AI',
  description: 'Mistral Large, Mistral Medium, Mixtral 8x7B',
  icon: 'wind',
  color: '#FF7000',
  models: ['mistral-large-latest', 'mistral-medium-latest', 'open-mixtral-8x7b'],
  capabilities: [
    'generate_text', 'generate_structured', 'generate_json', 'generate_streaming',
    'tool_calling', 'generate_embeddings', 'token_counting', 'health_check', 'cost_calculation',
  ],
  priority: 6,
};

export class MistralProvider extends BaseAIProvider {
  definition = MISTRAL_DEFINITION;

  async healthCheck(): Promise<AIProviderHealth> {
    return {
      provider: 'mistral',
      healthy: false,
      status: 'unknown',
      latency_ms: null,
      last_checked_at: new Date().toISOString(),
      error: 'Mistral AI provider not yet implemented.',
    };
  }
}
