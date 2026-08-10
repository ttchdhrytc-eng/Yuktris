// ============================================================
// ClaudeProvider — Anthropic Claude AI provider (placeholder)
// ============================================================

import { BaseAIProvider } from '../BaseAIProvider';
import type { AIProviderDefinition, AIProviderHealth } from '@/types/ai-gateway';

const CLAUDE_DEFINITION: AIProviderDefinition = {
  id: 'anthropic',
  name: 'Anthropic Claude',
  description: 'Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku',
  icon: 'brain',
  color: '#D97757',
  models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  capabilities: [
    'generate_text', 'generate_structured', 'generate_json', 'generate_streaming',
    'tool_calling', 'image_understanding', 'token_counting', 'health_check', 'cost_calculation',
  ],
  priority: 2,
};

export class ClaudeProvider extends BaseAIProvider {
  definition = CLAUDE_DEFINITION;

  async healthCheck(): Promise<AIProviderHealth> {
    return {
      provider: 'anthropic',
      healthy: false,
      status: 'unknown',
      latency_ms: null,
      last_checked_at: new Date().toISOString(),
      error: 'Anthropic Claude provider not yet implemented.',
    };
  }
}
