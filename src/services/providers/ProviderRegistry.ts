// ============================================================
// ProviderRegistry — Central registry for communication providers
// ============================================================
//
// Every provider plug-in registers itself here. The registry is the
// single source of truth for which providers are available and how
// to obtain their implementations.

import type { ProviderKey, ProviderDefinition, ICommunicationProvider } from '@/types/communication-providers';

class ProviderRegistry {
  private providers = new Map<ProviderKey, ICommunicationProvider>();
  private definitions = new Map<ProviderKey, ProviderDefinition>();

  register(provider: ICommunicationProvider, definition: ProviderDefinition): void {
    const key = provider.providerKey;
    if (this.providers.has(key)) {
      console.warn(`[ProviderRegistry] Provider already registered: ${key}`);
      return;
    }
    this.providers.set(key, provider);
    this.definitions.set(key, definition);
  }

  get(key: ProviderKey): ICommunicationProvider | undefined {
    return this.providers.get(key);
  }

  getDefinition(key: ProviderKey): ProviderDefinition | undefined {
    return this.definitions.get(key);
  }

  getAll(): ICommunicationProvider[] {
    return Array.from(this.providers.values());
  }

  getAllDefinitions(): ProviderDefinition[] {
    return Array.from(this.definitions.values());
  }

  has(key: ProviderKey): boolean {
    return this.providers.has(key);
  }

  getKeys(): ProviderKey[] {
    return Array.from(this.providers.keys());
  }

  getByCapability(capability: string): ICommunicationProvider[] {
    return this.getAll().filter((p) => {
      const def = this.definitions.get(p.providerKey);
      return def?.capabilities.includes(capability as never);
    });
  }
}

export const providerRegistry = new ProviderRegistry();
