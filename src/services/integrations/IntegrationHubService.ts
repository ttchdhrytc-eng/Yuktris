// ============================================================
// IntegrationHubService — Central facade for all integration operations
// ============================================================
//
// This is the single entry point for the UI and hooks. It delegates
// to the ProviderRegistry to find the right provider, then calls the
// appropriate method. No other code should import providers directly.

import { supabase } from '@/lib/supabase';
import { providerRegistry } from './ProviderRegistry';
import { integrationLogger } from './IntegrationLogger';
import { integrationHealthService } from './IntegrationHealthService';
import type {
  ProviderId,
  IntegrationRecord,
  IntegrationPermissionRecord,
  IntegrationViewModel,
  HealthCheckResult,
  SyncResult,
  RefreshResult,
  ConnectResult,
  ProviderDefinition,
  LogEvent,
  LogStatus,
} from '@/types/integrations';

class IntegrationHubService {
  // ----------------------------------------------------------
  // listIntegrations — All integrations for a workspace
  // ----------------------------------------------------------

  async listIntegrations(workspaceId: string): Promise<IntegrationViewModel[]> {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Failed to load integrations: ${error.message}`);

    const records = (data ?? []) as IntegrationRecord[];
    const viewModels: IntegrationViewModel[] = [];

    for (const record of records) {
      const permissions = await this.loadPermissions(record.id);
      const definition = providerRegistry.getDefinition(record.provider as ProviderId);
      const granted = permissions.filter((p) => p.granted).map((p) => p.permission_name);
      const missing = permissions.filter((p) => !p.granted && p.required).map((p) => p.permission_name);
      const isExpired = record.token_expires_at
        ? new Date(record.token_expires_at) < new Date()
        : false;

      viewModels.push({
        ...record,
        permissions,
        definition: definition ?? this.fallbackDefinition(record.provider as ProviderId),
        granted_permissions: granted,
        missing_permissions: missing,
        is_expired: isExpired,
        needs_reconnect: record.status === 'disconnected' || record.status === 'error' || (isExpired && record.status !== 'connected'),
      });
    }

    return viewModels;
  }

  // ----------------------------------------------------------
  // getIntegration — Single integration by provider
  // ----------------------------------------------------------

  async getIntegration(workspaceId: string, provider: ProviderId): Promise<IntegrationViewModel | null> {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider', provider)
      .maybeSingle();
    if (error) throw new Error(`Failed to load integration: ${error.message}`);
    if (!data) return null;

    const record = data as IntegrationRecord;
    const permissions = await this.loadPermissions(record.id);
    const definition = providerRegistry.getDefinition(provider);
    const granted = permissions.filter((p) => p.granted).map((p) => p.permission_name);
    const missing = permissions.filter((p) => !p.granted && p.required).map((p) => p.permission_name);
    const isExpired = record.token_expires_at
      ? new Date(record.token_expires_at) < new Date()
      : false;

    return {
      ...record,
      permissions,
      definition: definition ?? this.fallbackDefinition(provider),
      granted_permissions: granted,
      missing_permissions: missing,
      is_expired: isExpired,
      needs_reconnect: record.status === 'disconnected' || record.status === 'error' || (isExpired && record.status !== 'connected'),
    };
  }

  // ----------------------------------------------------------
  // connect — Initialize + connect via provider
  // ----------------------------------------------------------

  async connect(params: {
    workspaceId: string;
    provider: ProviderId;
    redirectUri?: string;
    scopes?: string[];
  }): Promise<ConnectResult> {
    const providerImpl = providerRegistry.get(params.provider);
    if (!providerImpl) throw new Error(`Provider not registered: ${params.provider}`);

    await providerImpl.initialize(params.workspaceId);

    const result = await providerImpl.connect({
      workspaceId: params.workspaceId,
      redirectUri: params.redirectUri,
      scopes: params.scopes,
    });

    return result;
  }

  // ----------------------------------------------------------
  // disconnect — Disconnect via provider
  // ----------------------------------------------------------

  async disconnect(integrationId: string): Promise<void> {
    const record = await this.loadRecord(integrationId);
    const provider = providerRegistry.get(record.provider as ProviderId);
    if (!provider) throw new Error(`Provider not registered: ${record.provider}`);
    await provider.disconnect(integrationId);
  }

  // ----------------------------------------------------------
  // refresh — Refresh tokens via provider
  // ----------------------------------------------------------

  async refresh(integrationId: string): Promise<RefreshResult> {
    const record = await this.loadRecord(integrationId);
    const provider = providerRegistry.get(record.provider as ProviderId);
    if (!provider) throw new Error(`Provider not registered: ${record.provider}`);
    return provider.refreshTokens(integrationId);
  }

  // ----------------------------------------------------------
  // sync — Sync via provider
  // ----------------------------------------------------------

  async sync(integrationId: string): Promise<SyncResult> {
    const record = await this.loadRecord(integrationId);
    const provider = providerRegistry.get(record.provider as ProviderId);
    if (!provider) throw new Error(`Provider not registered: ${record.provider}`);
    return provider.sync(integrationId);
  }

  // ----------------------------------------------------------
  // healthCheck — Run health check for one integration
  // ----------------------------------------------------------

  async healthCheck(integrationId: string): Promise<HealthCheckResult> {
    return integrationHealthService.checkIntegration(integrationId);
  }

  // ----------------------------------------------------------
  // healthCheckWorkspace — Run health checks for all workspace integrations
  // ----------------------------------------------------------

  async healthCheckWorkspace(workspaceId: string): Promise<HealthCheckResult[]> {
    return integrationHealthService.checkWorkspace(workspaceId);
  }

  // ----------------------------------------------------------
  // getLogs — Retrieve logs for an integration
  // ----------------------------------------------------------

  async getLogs(integrationId: string, limit = 50) {
    return integrationLogger.getLogs(integrationId, limit);
  }

  // ----------------------------------------------------------
  // getWorkspaceLogs — Retrieve logs for all workspace integrations
  // ----------------------------------------------------------

  async getWorkspaceLogs(workspaceId: string, limit = 100, filters?: { event?: LogEvent; status?: LogStatus }) {
    return integrationLogger.getLogsForWorkspace(workspaceId, limit, filters);
  }

  // ----------------------------------------------------------
  // getHealthSummary — Aggregate health counts
  // ----------------------------------------------------------

  async getHealthSummary(workspaceId: string) {
    return integrationHealthService.getHealthSummary(workspaceId);
  }

  // ----------------------------------------------------------
  // getProviders — All registered provider definitions
  // ----------------------------------------------------------

  getProviders(): ProviderDefinition[] {
    return providerRegistry.getAllDefinitions();
  }

  // ----------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------

  private async loadRecord(integrationId: string): Promise<IntegrationRecord> {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', integrationId)
      .maybeSingle();
    if (error || !data) throw new Error(`Integration not found: ${integrationId}`);
    return data as IntegrationRecord;
  }

  private async loadPermissions(integrationId: string): Promise<IntegrationPermissionRecord[]> {
    const { data, error } = await supabase
      .from('integration_permissions')
      .select('*')
      .eq('integration_id', integrationId)
      .order('permission_name', { ascending: true });
    if (error) return [];
    return (data ?? []) as IntegrationPermissionRecord[];
  }

  private fallbackDefinition(provider: ProviderId): ProviderDefinition {
    return {
      id: provider,
      name: provider,
      type: 'service',
      description: 'Unknown provider',
      icon: 'plug',
      color: '#6b7280',
      capabilities: [],
    };
  }
}

export const integrationHubService = new IntegrationHubService();
