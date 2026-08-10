// ============================================================
// AIProviderRegistry — Central registry for all AI providers
// ============================================================
//
// Every AI provider must register itself here. Future providers
// become available by adding a registration call — no business logic
// changes needed.

import type { AIProviderId, AIProviderDefinition, IAIProvider } from '@/types/ai-gateway';

class AIProviderRegistry {
  private providers = new Map<AIProviderId, IAIProvider>();
  private definitions = new Map<AIProviderId, AIProviderDefinition>();
  private defaultProvider: AIProviderId | null = null;

  register(provider: IAIProvider): void {
    const id = provider.definition.id;
    if (this.providers.has(id)) {
      console.warn(`[AIProviderRegistry] Provider already registered: ${id}`);
      return;
    }
    this.providers.set(id, provider);
    this.definitions.set(id, provider.definition);

    if (this.defaultProvider === null) {
      this.defaultProvider = id;
    }
  }

  get(id: AIProviderId): IAIProvider | undefined {
    return this.providers.get(id);
  }

  getDefinition(id: AIProviderId): AIProviderDefinition | undefined {
    return this.definitions.get(id);
  }

  getAll(): IAIProvider[] {
    return Array.from(this.providers.values());
  }

  getAllDefinitions(): AIProviderDefinition[] {
    return Array.from(this.definitions.values()).sort((a, b) => a.priority - b.priority);
  }

  has(id: AIProviderId): boolean {
    return this.providers.has(id);
  }

  getIds(): AIProviderId[] {
    return Array.from(this.providers.keys());
  }

  setDefaultProvider(id: AIProviderId): void {
    if (!this.providers.has(id)) {
      throw new Error(`Cannot set default to unregistered provider: ${id}`);
    }
    this.defaultProvider = id;
  }

  getDefaultProvider(): AIProviderId | null {
    return this.defaultProvider;
  }

  getDefault(): IAIProvider | undefined {
    if (!this.defaultProvider) return undefined;
    return this.providers.get(this.defaultProvider);
  }
}

export const aiProviderRegistry = new AIProviderRegistry();
