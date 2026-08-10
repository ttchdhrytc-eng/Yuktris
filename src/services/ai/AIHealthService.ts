// ============================================================
// AIHealthService — Health monitoring for all AI providers
// ============================================================

import { aiProviderRegistry } from './AIProviderRegistry';
import type { AIProviderHealth, AIProviderId } from '@/types/ai-gateway';

class AIHealthService {
  // Check health of a single provider
  async checkProvider(providerId: AIProviderId): Promise<AIProviderHealth> {
    const provider = aiProviderRegistry.get(providerId);
    if (!provider) {
      return {
        provider: providerId,
        healthy: false,
        status: 'unknown',
        latency_ms: null,
        last_checked_at: new Date().toISOString(),
        error: 'Provider not registered.',
      };
    }
    return provider.healthCheck();
  }

  // Check health of all registered providers
  async checkAll(): Promise<AIProviderHealth[]> {
    const providers = aiProviderRegistry.getAll();
    const results: AIProviderHealth[] = [];

    for (const provider of providers) {
      try {
        results.push(await provider.healthCheck());
      } catch (err) {
        results.push({
          provider: provider.definition.id,
          healthy: false,
          status: 'down',
          latency_ms: null,
          last_checked_at: new Date().toISOString(),
          error: err instanceof Error ? err.message : 'Health check failed.',
        });
      }
    }

    return results;
  }

  // Get a summary of provider health
  async getSummary(): Promise<{
    total: number;
    healthy: number;
    degraded: number;
    down: number;
    unknown: number;
  }> {
    const results = await this.checkAll();
    const summary = { total: 0, healthy: 0, degraded: 0, down: 0, unknown: 0 };

    for (const result of results) {
      summary.total++;
      if (result.healthy) {
        summary.healthy++;
      } else {
        summary[result.status]++;
      }
    }

    return summary;
  }
}

export const aiHealthService = new AIHealthService();
