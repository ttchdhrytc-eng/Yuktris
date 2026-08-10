// ============================================================
// GrokProvider — xAI Grok AI provider (placeholder)
// ============================================================

import { BaseAIProvider } from '../BaseAIProvider';
import type { AIProviderDefinition, AIProviderHealth } from '@/types/ai-gateway';

const GROK_DEFINITION: AIProviderDefinition = {
  id: 'grok',
  name: 'xAI Grok',
  description: 'Grok-2, Grok-2-mini, and future xAI models',
  icon: 'zap',
  color: '#0F0F0F',
  models: ['grok-2', 'grok-2-mini', 'grok-beta'],
  capabilities: [
    'generate_text', 'generate_structured', 'generate_json', 'generate_streaming',
    'tool_calling', 'token_counting', 'health_check', 'cost_calculation',
  ],
  priority: 4,
};

export class GrokProvider extends BaseAIProvider {
  definition = GROK_DEFINITION;

  async healthCheck(): Promise<AIProviderHealth> {
    return {
      provider: 'grok',
      healthy: false,
      status: 'unknown',
      latency_ms: null,
      last_checked_at: new Date().toISOString(),
      error: 'xAI Grok provider not yet implemented.',
    };
  }
}
