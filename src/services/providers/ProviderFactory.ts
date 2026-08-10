// ============================================================
// ProviderFactory — Creates provider instances on demand
// ============================================================
//
// Implements the Factory Pattern. Given a provider key, the factory
// returns the registered provider implementation. This decouples
// callers from concrete provider classes.

import { providerRegistry } from './ProviderRegistry';
import type { ProviderKey, ICommunicationProvider } from '@/types/communication-providers';

class ProviderFactory {
  create(key: ProviderKey): ICommunicationProvider {
    const provider = providerRegistry.get(key);
    if (!provider) throw new Error(`Provider not registered: ${key}`);
    return provider;
  }

  createOptional(key: ProviderKey): ICommunicationProvider | undefined {
    return providerRegistry.get(key);
  }

  createAll(): ICommunicationProvider[] {
    return providerRegistry.getAll();
  }

  createByCapability(capability: string): ICommunicationProvider[] {
    return providerRegistry.getByCapability(capability);
  }
}

export const providerFactory = new ProviderFactory();
