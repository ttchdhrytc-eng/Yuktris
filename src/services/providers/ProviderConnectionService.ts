// ============================================================
// ProviderConnectionService — Manages provider connections
// ============================================================

import { supabase } from '@/lib/supabase';
import type {
  ProviderConnectionRecord,
  ProviderConnectionViewModel,
  CommunicationProviderRecord,
  ProviderCapabilityRecord,
  ProviderHealthRecord,
  ProviderKey,
  ConnectionStatus,
} from '@/types/communication-providers';
import { providerCapabilityService } from './ProviderCapabilityService';

class ProviderConnectionService {
  async listConnections(workspaceId: string): Promise<ProviderConnectionViewModel[]> {
    const { data, error } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Failed to load connections: ${error.message}`);

    const connections = (data ?? []) as ProviderConnectionRecord[];
    const viewModels: ProviderConnectionViewModel[] = [];

    for (const conn of connections) {
      const vm = await this.enrichConnection(conn);
      viewModels.push(vm);
    }

    return viewModels;
  }

  async getConnection(connectionId: string): Promise<ProviderConnectionViewModel | null> {
    const { data, error } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('id', connectionId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load connection: ${error.message}`);
    if (!data) return null;

    return this.enrichConnection(data as ProviderConnectionRecord);
  }

  async getConnectionByProvider(workspaceId: string, providerKey: ProviderKey): Promise<ProviderConnectionViewModel | null> {
    const { data, error } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider_key', providerKey)
      .maybeSingle();
    if (error) throw new Error(`Failed to load connection: ${error.message}`);
    if (!data) return null;

    return this.enrichConnection(data as ProviderConnectionRecord);
  }

  async createConnection(params: {
    workspaceId: string;
    providerId: string;
    providerKey: ProviderKey;
    createdBy?: string;
  }): Promise<ProviderConnectionRecord> {
    const { data, error } = await supabase
      .from('provider_connections')
      .insert({
        workspace_id: params.workspaceId,
        provider_id: params.providerId,
        provider_key: params.providerKey,
        status: 'disconnected',
        connection_health: 'unknown',
        created_by: params.createdBy ?? null,
      })
      .select('*')
      .maybeSingle();
    if (error) throw new Error(`Failed to create connection: ${error.message}`);
    return data as ProviderConnectionRecord;
  }

  async updateConnection(connectionId: string, updates: Partial<ProviderConnectionRecord>): Promise<void> {
    const { error } = await supabase
      .from('provider_connections')
      .update(updates)
      .eq('id', connectionId);
    if (error) throw new Error(`Failed to update connection: ${error.message}`);
  }

  async updateStatus(connectionId: string, status: ConnectionStatus): Promise<void> {
    await this.updateConnection(connectionId, { status });
  }

  async deleteConnection(connectionId: string): Promise<void> {
    const { error } = await supabase
      .from('provider_connections')
      .delete()
      .eq('id', connectionId);
    if (error) throw new Error(`Failed to delete connection: ${error.message}`);
  }

  async getProvider(providerId: string): Promise<CommunicationProviderRecord | null> {
    const { data, error } = await supabase
      .from('communication_providers')
      .select('*')
      .eq('id', providerId)
      .maybeSingle();
    if (error) return null;
    return data as CommunicationProviderRecord;
  }

  async getProviderByKey(key: ProviderKey): Promise<CommunicationProviderRecord | null> {
    const { data, error } = await supabase
      .from('communication_providers')
      .select('*')
      .eq('provider_key', key)
      .maybeSingle();
    if (error) return null;
    return data as CommunicationProviderRecord;
  }

  async listProviders(): Promise<CommunicationProviderRecord[]> {
    const { data, error } = await supabase
      .from('communication_providers')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true });
    if (error) throw new Error(`Failed to load providers: ${error.message}`);
    return (data ?? []) as CommunicationProviderRecord[];
  }

  private async enrichConnection(conn: ProviderConnectionRecord): Promise<ProviderConnectionViewModel> {
    const [provider, capabilities, latestHealth] = await Promise.all([
      this.getProvider(conn.provider_id),
      providerCapabilityService.getCapabilities(conn.provider_id),
      this.getLatestHealth(conn.id),
    ]);

    const isExpired = conn.token_expires_at
      ? new Date(conn.token_expires_at) < new Date()
      : false;

    return {
      ...conn,
      provider,
      capabilities,
      latest_health: latestHealth,
      is_expired: isExpired,
      needs_reconnect: conn.status === 'disconnected' || conn.status === 'error' || (isExpired && conn.status !== 'connected'),
    };
  }

  private async getLatestHealth(connectionId: string): Promise<ProviderHealthRecord | null> {
    const { data, error } = await supabase
      .from('provider_health')
      .select('*')
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return data as ProviderHealthRecord;
  }
}

export const providerConnectionService = new ProviderConnectionService();
