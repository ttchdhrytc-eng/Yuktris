// ============================================================
// OpenRouterProvider — OpenRouter AI provider (placeholder)
// ============================================================

import { BaseAIProvider } from '../BaseAIProvider';
import type { AIProviderDefinition, AIProviderHealth } from '@/types/ai-gateway';

const OPENROUTER_DEFINITION: AIProviderDefinition = {
  id: 'openrouter',
  name: 'OpenRouter',
  description: 'Multi-model access to 100+ LLMs through a single API',
  icon: 'route',
  color: '#6366F1',
  models: ['auto', 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-1.5-pro'],
  capabilities: [
    'generate_text', 'generate_structured', 'generate_json', 'generate_streaming',
    'tool_calling', 'token_counting', 'health_check', 'cost_calculation',
  ],
  priority: 5,
};

export class OpenRouterProvider extends BaseAIProvider {
  definition = OPENROUTER_DEFINITION;

  async healthCheck(): Promise<AIProviderHealth> {
    return {
      provider: 'openrouter',
      healthy: false,
      status: 'unknown',
      latency_ms: null,
      last_checked_at: new Date().toISOString(),
      error: 'OpenRouter provider not yet implemented.',
    };
  }
}
