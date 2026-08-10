// ============================================================
// IntegrationHealthService — Centralized health monitoring
// ============================================================

import { supabase } from '@/lib/supabase';
import { integrationLogger } from './IntegrationLogger';
import { providerRegistry } from './ProviderRegistry';
import type {
  HealthCheckResult,
  ConnectionHealth,
  IntegrationRecord,
  ProviderId,
} from '@/types/integrations';

class IntegrationHealthService {
  // ----------------------------------------------------------
  // checkIntegration — Run health check for a single integration
  // ----------------------------------------------------------

  async checkIntegration(integrationId: string): Promise<HealthCheckResult> {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', integrationId)
      .maybeSingle();
    if (error || !data) throw new Error(`Integration not found: ${integrationId}`);

    const record = data as IntegrationRecord;
    const provider = providerRegistry.get(record.provider as ProviderId);
    if (!provider) throw new Error(`Provider not registered: ${record.provider}`);

    return provider.healthCheck(integrationId);
  }

  // ----------------------------------------------------------
  // checkWorkspace — Run health checks for all integrations in a workspace
  // ----------------------------------------------------------

  async checkWorkspace(workspaceId: string): Promise<HealthCheckResult[]> {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('workspace_id', workspaceId);
    if (error) throw new Error(`Failed to load integrations: ${error.message}`);

    const results: HealthCheckResult[] = [];
    for (const record of (data ?? []) as IntegrationRecord[]) {
      try {
        const provider = providerRegistry.get(record.provider as ProviderId);
        if (provider) {
          results.push(await provider.healthCheck(record.id));
        }
      } catch (err) {
        results.push({
          integration_id: record.id,
          provider: record.provider as ProviderId,
          healthy: false,
          health: 'error',
          status: record.status,
          token_expired: false,
          token_expires_at: record.token_expires_at,
          last_checked_at: new Date().toISOString(),
          errors: [err instanceof Error ? err.message : 'Health check failed.'],
        });
      }
    }
    return results;
  }

  // ----------------------------------------------------------
  // autoRefresh — Refresh expired tokens for a workspace
  // ----------------------------------------------------------

  async autoRefresh(workspaceId: string): Promise<void> {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'connected');
    if (error) throw new Error(`Failed to load integrations: ${error.message}`);

    for (const record of (data ?? []) as IntegrationRecord[]) {
      const isExpired = record.token_expires_at
        ? new Date(record.token_expires_at) < new Date(Date.now() + 5 * 60 * 1000)
        : false;

      if (isExpired) {
        try {
          const provider = providerRegistry.get(record.provider as ProviderId);
          if (provider) {
            await provider.refreshTokens(record.id);
          }
        } catch (err) {
          await integrationLogger.log({
            integrationId: record.id,
            event: 'error',
            status: 'failure',
            message: `Auto-refresh failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
          });
        }
      }
    }
  }

  // ----------------------------------------------------------
  // getHealthSummary — Aggregate health across a workspace
  // ----------------------------------------------------------

  async getHealthSummary(workspaceId: string): Promise<{
    total: number;
    healthy: number;
    degraded: number;
    expired: number;
    error: number;
    unknown: number;
  }> {
    const { data, error } = await supabase
      .from('integrations')
      .select('connection_health')
      .eq('workspace_id', workspaceId);
    if (error) throw new Error(`Failed to load health: ${error.message}`);

    const summary = { total: 0, healthy: 0, degraded: 0, expired: 0, error: 0, unknown: 0 };
    for (const row of (data ?? []) as Array<{ connection_health: ConnectionHealth }>) {
      summary.total++;
      summary[row.connection_health]++;
    }
    return summary;
  }
}

export const integrationHealthService = new IntegrationHealthService();
