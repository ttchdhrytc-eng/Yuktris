// ============================================================
// ProviderHealthService — Centralized health monitoring
// ============================================================

import { supabase } from '@/lib/supabase';
import type {
  HealthCheckResult,
  ConnectionHealth,
  ProviderConnectionRecord,
  ProviderKey,
  ProviderHealthRecord,
  ProviderHealthSummary,
} from '@/types/communication-providers';
import { providerRegistry } from './ProviderRegistry';

class ProviderHealthService {
  async checkConnection(connectionId: string): Promise<HealthCheckResult> {
    const { data, error } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('id', connectionId)
      .maybeSingle();
    if (error || !data) throw new Error(`Connection not found: ${connectionId}`);

    const record = data as ProviderConnectionRecord;
    const provider = providerRegistry.get(record.provider_key as ProviderKey);

    if (provider) {
      try {
        return provider.healthCheck(connectionId);
      } catch {
        // fall through to base check
      }
    }

    return this.baseHealthCheck(record);
  }

  async checkWorkspace(workspaceId: string): Promise<HealthCheckResult[]> {
    const { data, error } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('workspace_id', workspaceId);
    if (error) throw new Error(`Failed to load connections: ${error.message}`);

    const results: HealthCheckResult[] = [];
    for (const record of (data ?? []) as ProviderConnectionRecord[]) {
      try {
        const provider = providerRegistry.get(record.provider_key as ProviderKey);
        if (provider) {
          results.push(await provider.healthCheck(record.id));
        } else {
          results.push(await this.baseHealthCheck(record));
        }
      } catch (err) {
        results.push({
          connection_id: record.id,
          provider_key: record.provider_key as ProviderKey,
          healthy: false,
          health: 'error',
          latency_ms: null,
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

  async getHealthSummary(workspaceId: string): Promise<ProviderHealthSummary> {
    const { data, error } = await supabase
      .from('provider_connections')
      .select('connection_health')
      .eq('workspace_id', workspaceId);
    if (error) throw new Error(`Failed to load health: ${error.message}`);

    const summary: ProviderHealthSummary = { total: 0, healthy: 0, degraded: 0, expired: 0, error: 0, unknown: 0 };
    for (const row of (data ?? []) as Array<{ connection_health: ConnectionHealth }>) {
      summary.total++;
      summary[row.connection_health]++;
    }
    return summary;
  }

  async getLatestHealth(connectionId: string): Promise<ProviderHealthRecord | null> {
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

  async recordHealthSnapshot(params: {
    connectionId: string;
    healthStatus: ConnectionHealth;
    latencyMs: number | null;
    isHealthy: boolean;
    errorMessage?: string | null;
    consecutiveFailures?: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await supabase.from('provider_health').insert({
      connection_id: params.connectionId,
      health_status: params.healthStatus,
      latency_ms: params.latencyMs,
      is_healthy: params.isHealthy,
      error_message: params.errorMessage ?? null,
      consecutive_failures: params.consecutiveFailures ?? 0,
      last_checked_at: new Date().toISOString(),
      metadata: params.metadata ?? {},
    });
    if (error) console.error('[ProviderHealthService] Failed to record health:', error.message);

    await supabase
      .from('provider_connections')
      .update({
        connection_health: params.healthStatus,
        last_health_check_at: new Date().toISOString(),
      })
      .eq('id', params.connectionId);
  }

  private async baseHealthCheck(record: ProviderConnectionRecord): Promise<HealthCheckResult> {
    const errors: string[] = [];
    const now = new Date().toISOString();
    const tokenExpired = record.token_expires_at
      ? new Date(record.token_expires_at) < new Date()
      : false;

    let health: ConnectionHealth = 'healthy';
    if (record.status === 'disconnected') {
      health = 'unknown';
      errors.push('Connection is disconnected.');
    } else if (record.status === 'error') {
      health = 'error';
      errors.push('Connection is in error state.');
    } else if (tokenExpired) {
      health = 'expired';
      errors.push('Token has expired.');
    }

    await this.recordHealthSnapshot({
      connectionId: record.id,
      healthStatus: health,
      latencyMs: null,
      isHealthy: health === 'healthy',
      errorMessage: errors.length > 0 ? errors.join('; ') : null,
    });

    return {
      connection_id: record.id,
      provider_key: record.provider_key as ProviderKey,
      healthy: health === 'healthy',
      health,
      latency_ms: null,
      status: record.status,
      token_expired: tokenExpired,
      token_expires_at: record.token_expires_at,
      last_checked_at: now,
      errors,
    };
  }
}

export const providerHealthService = new ProviderHealthService();
