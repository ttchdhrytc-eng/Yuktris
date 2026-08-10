// ============================================================
// DiscoveryProviderRegistry — Central registry for discovery providers
// ============================================================

import type {
  IDiscoveryProvider,
  DiscoveryProviderDefinition,
  ProviderType,
} from '@/types/prospect-discovery-engine';

class DiscoveryProviderRegistry {
  private providers = new Map<ProviderType, IDiscoveryProvider>();
  private definitions = new Map<ProviderType, DiscoveryProviderDefinition>();

  register(provider: IDiscoveryProvider): void {
    const id = provider.definition.id;
    if (this.providers.has(id)) {
      console.warn(`[DiscoveryProviderRegistry] Provider already registered: ${id}`);
      return;
    }
    this.providers.set(id, provider);
    this.definitions.set(id, provider.definition);
  }

  get(id: ProviderType): IDiscoveryProvider | undefined {
    return this.providers.get(id);
  }

  getDefinition(id: ProviderType): DiscoveryProviderDefinition | undefined {
    return this.definitions.get(id);
  }

  getAll(): IDiscoveryProvider[] {
    return Array.from(this.providers.values());
  }

  getAllDefinitions(): DiscoveryProviderDefinition[] {
    return Array.from(this.definitions.values());
  }

  has(id: ProviderType): boolean {
    return this.providers.has(id);
  }

  getIds(): ProviderType[] {
    return Array.from(this.providers.keys());
  }

  getByCapability(capability: 'company_search' | 'company_enrich' | 'contact_search' | 'contact_enrich' | 'signal_detection'): IDiscoveryProvider[] {
    return this.getAll().filter((p) =>
      p.definition.capabilities.some((c) => c.type === capability && c.supported),
    );
  }
}

export const discoveryProviderRegistry = new DiscoveryProviderRegistry();
