// ============================================================
// ProviderRegistry — Central registry for all integration providers
// ============================================================
//
// Every provider must register itself here. Future providers become
// available by simply adding a registration call — no other code
// changes needed.

import type { ProviderId, ProviderDefinition, IIntegrationProvider } from '@/types/integrations';

class ProviderRegistry {
  private providers = new Map<ProviderId, IIntegrationProvider>();
  private definitions = new Map<ProviderId, ProviderDefinition>();

  register(provider: IIntegrationProvider): void {
    const id = provider.definition.id;
    if (this.providers.has(id)) {
      console.warn(`[ProviderRegistry] Provider already registered: ${id}`);
      return;
    }
    this.providers.set(id, provider);
    this.definitions.set(id, provider.definition);
  }

  get(id: ProviderId): IIntegrationProvider | undefined {
    return this.providers.get(id);
  }

  getDefinition(id: ProviderId): ProviderDefinition | undefined {
    return this.definitions.get(id);
  }

  getAll(): IIntegrationProvider[] {
    return Array.from(this.providers.values());
  }

  getAllDefinitions(): ProviderDefinition[] {
    return Array.from(this.definitions.values());
  }

  has(id: ProviderId): boolean {
    return this.providers.has(id);
  }

  getIds(): ProviderId[] {
    return Array.from(this.providers.keys());
  }
}

export const providerRegistry = new ProviderRegistry();
