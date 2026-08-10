// ============================================================
// DeepSeekProvider — DeepSeek AI provider (placeholder)
// ============================================================

import { BaseAIProvider } from '../BaseAIProvider';
import type { AIProviderDefinition, AIProviderHealth } from '@/types/ai-gateway';

const DEEPSEEK_DEFINITION: AIProviderDefinition = {
  id: 'deepseek',
  name: 'DeepSeek',
  description: 'DeepSeek-V3, DeepSeek-R1, cost-effective reasoning models',
  icon: 'search',
  color: '#4D6BFE',
  models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'],
  capabilities: [
    'generate_text', 'generate_structured', 'generate_json', 'generate_streaming',
    'tool_calling', 'token_counting', 'health_check', 'cost_calculation',
  ],
  priority: 7,
};

export class DeepSeekProvider extends BaseAIProvider {
  definition = DEEPSEEK_DEFINITION;

  async healthCheck(): Promise<AIProviderHealth> {
    return {
      provider: 'deepseek',
      healthy: false,
      status: 'unknown',
      latency_ms: null,
      last_checked_at: new Date().toISOString(),
      error: 'DeepSeek provider not yet implemented.',
    };
  }
}
