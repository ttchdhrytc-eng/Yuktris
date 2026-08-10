// ============================================================
// ProviderRouter — Selects the best provider for a message
// ============================================================
//
// Implements the Strategy Pattern. Given a desired channel and
// workspace, the router finds the best available provider connection
// based on health, priority, capabilities, and rate limits.

import { supabase } from '@/lib/supabase';
import { providerRegistry } from './ProviderRegistry';
import { providerHealthService } from './ProviderHealthService';
import type {
  ProviderKey,
  ProviderConnectionRecord,
  CapabilityKey,
  ConnectionHealth,
} from '@/types/communication-providers';

type RouteResult = {
  connection: ProviderConnectionRecord;
  providerKey: ProviderKey;
  fallbacks: ProviderConnectionRecord[];
};

class ProviderRouter {
  async route(params: {
    workspaceId: string;
    channel: string;
    requiredCapability?: CapabilityKey;
    preferredProvider?: ProviderKey;
  }): Promise<RouteResult | null> {
    const { workspaceId, channel, requiredCapability, preferredProvider } = params;

    const { data, error } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'connected')
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Failed to load connections: ${error.message}`);

    const connections = (data ?? []) as ProviderConnectionRecord[];
    if (connections.length === 0) return null;

    const candidates = await this.filterByCapability(connections, requiredCapability);
    const channelMatches = this.filterByChannel(candidates, channel);

    if (channelMatches.length === 0) return null;

    const sorted = await this.sortByHealthAndPriority(channelMatches, preferredProvider);
    if (sorted.length === 0) return null;

    const [primary, ...fallbacks] = sorted;
    return { connection: primary, providerKey: primary.provider_key as ProviderKey, fallbacks };
  }

  async getAvailableProviders(workspaceId: string, channel: string): Promise<ProviderKey[]> {
    const { data, error } = await supabase
      .from('provider_connections')
      .select('provider_key')
      .eq('workspace_id', workspaceId)
      .eq('status', 'connected');
    if (error) return [];

    const keys = ((data ?? []) as Array<{ provider_key: string }>).map((r) => r.provider_key as ProviderKey);
    return keys.filter((key) => {
      const def = providerRegistry.getDefinition(key);
      return def?.capabilities.includes('send_message' as never) ?? false;
    });
  }

  private async filterByCapability(connections: ProviderConnectionRecord[], capability?: CapabilityKey): Promise<ProviderConnectionRecord[]> {
    if (!capability) return connections;

    const result: ProviderConnectionRecord[] = [];
    for (const conn of connections) {
      const def = providerRegistry.getDefinition(conn.provider_key as ProviderKey);
      if (def?.capabilities.includes(capability)) {
        result.push(conn);
      }
    }
    return result;
  }

  private filterByChannel(connections: ProviderConnectionRecord[], channel: string): ProviderConnectionRecord[] {
    const channelToProviderType: Record<string, string[]> = {
      email: ['email'],
      linkedin: ['messaging'],
      whatsapp: ['messaging'],
      slack: ['messaging'],
      teams: ['messaging'],
      sms: ['sms'],
    };

    const acceptableTypes = channelToProviderType[channel] ?? [];
    if (acceptableTypes.length === 0) return connections;

    return connections.filter((conn) => {
      const def = providerRegistry.getDefinition(conn.provider_key as ProviderKey);
      return def && acceptableTypes.includes(def.type);
    });
  }

  private async sortByHealthAndPriority(
    connections: ProviderConnectionRecord[],
    preferred?: ProviderKey
  ): Promise<ProviderConnectionRecord[]> {
    const healthScores = new Map<string, number>();
    const healthOrder: Record<ConnectionHealth, number> = {
      healthy: 0, degraded: 1, unknown: 2, expired: 3, error: 4,
    };

    for (const conn of connections) {
      let score = healthOrder[conn.connection_health as ConnectionHealth] ?? 2;
      const def = providerRegistry.getDefinition(conn.provider_key as ProviderKey);
      if (def) score += def.priority / 1000;
      if (preferred && conn.provider_key === preferred) score -= 10;
      healthScores.set(conn.id, score);
    }

    return connections.sort((a, b) => (healthScores.get(a.id) ?? 0) - (healthScores.get(b.id) ?? 0));
  }
}

export const providerRouter = new ProviderRouter();
