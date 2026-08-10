// ============================================================
// BaseIntegrationProvider — Abstract base for all providers
// ============================================================
//
// Implements the common IIntegrationProvider interface with shared
// database operations. Every concrete provider extends this class
// and overrides only the methods it supports.

import { supabase } from '@/lib/supabase';
import { integrationLogger } from './IntegrationLogger';
import type {
  ProviderDefinition,
  IntegrationRecord,
  IntegrationPermissionRecord,
  IIntegrationProvider,
  ConnectResult,
  RefreshResult,
  HealthCheckResult,
  SyncResult,
  ProviderId,
  ConnectionHealth,
  IntegrationStatus,
} from '@/types/integrations';

export abstract class BaseIntegrationProvider implements IIntegrationProvider {
  abstract definition: ProviderDefinition;

  // ----------------------------------------------------------
  // initialize — Create an integration record if it doesn't exist
  // ----------------------------------------------------------

  async initialize(workspaceId: string): Promise<IntegrationRecord> {
    const { data: existing } = await supabase
      .from('integrations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider', this.definition.id)
      .maybeSingle();

    if (existing) return existing as IntegrationRecord;

    const { data: created, error } = await supabase
      .from('integrations')
      .insert({
        workspace_id: workspaceId,
        provider: this.definition.id,
        provider_name: this.definition.name,
        provider_type: this.definition.type,
        status: 'disconnected',
        connection_health: 'unknown',
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to initialize ${this.definition.id}: ${error.message}`);
    return created as IntegrationRecord;
  }

  // ----------------------------------------------------------
  // Helper: load integration record
  // ----------------------------------------------------------

  protected async loadRecord(integrationId: string): Promise<IntegrationRecord> {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', integrationId)
      .maybeSingle();
    if (error || !data) throw new Error(`Integration not found: ${integrationId}`);
    return data as IntegrationRecord;
  }

  // ----------------------------------------------------------
  // Helper: update integration record
  // ----------------------------------------------------------

  protected async updateRecord(
    integrationId: string,
    updates: Partial<IntegrationRecord>
  ): Promise<IntegrationRecord> {
    const { data, error } = await supabase
      .from('integrations')
      .update(updates)
      .eq('id', integrationId)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(`Failed to update integration: ${error.message}`);
    return data as IntegrationRecord;
  }

  // ----------------------------------------------------------
  // Helper: upsert permission
  // ----------------------------------------------------------

  protected async upsertPermission(
    integrationId: string,
    permissionName: string,
    granted: boolean,
    required: boolean
  ): Promise<void> {
    const { data: existing } = await supabase
      .from('integration_permissions')
      .select('id')
      .eq('integration_id', integrationId)
      .eq('permission_name', permissionName)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('integration_permissions')
        .update({ granted, last_checked: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase.from('integration_permissions').insert({
        integration_id: integrationId,
        permission_name: permissionName,
        granted,
        required,
        last_checked: new Date().toISOString(),
      });
    }
  }

  // ----------------------------------------------------------
  // connect — Override in concrete provider
  // ----------------------------------------------------------

  async connect(_params: {
    workspaceId: string;
    redirectUri?: string;
    scopes?: string[];
  }): Promise<ConnectResult> {
    throw new Error(`${this.definition.name} connect not implemented`);
  }

  // ----------------------------------------------------------
  // disconnect — Mark as disconnected
  // ----------------------------------------------------------

  async disconnect(integrationId: string): Promise<void> {
    await this.updateRecord(integrationId, {
      status: 'disconnected',
      connection_health: 'unknown',
      connected_account: null,
      token_expires_at: null,
    });

    await integrationLogger.log({
      integrationId,
      event: 'disconnect',
      status: 'success',
      message: `${this.definition.name} disconnected.`,
    });
  }

  // ----------------------------------------------------------
  // reconnect — Override in concrete provider
  // ----------------------------------------------------------

  async reconnect(_integrationId: string): Promise<ConnectResult> {
    throw new Error(`${this.definition.name} reconnect not implemented`);
  }

  // ----------------------------------------------------------
  // refreshTokens — Override in concrete provider
  // ----------------------------------------------------------

  async refreshTokens(_integrationId: string): Promise<RefreshResult> {
    throw new Error(`${this.definition.name} token refresh not implemented`);
  }

  // ----------------------------------------------------------
  // validateConnection — Check token expiry + status
  // ----------------------------------------------------------

  async validateConnection(integrationId: string): Promise<boolean> {
    const record = await this.loadRecord(integrationId);
    if (record.status !== 'connected') return false;
    if (record.token_expires_at && new Date(record.token_expires_at) < new Date()) return false;
    return true;
  }

  // ----------------------------------------------------------
  // healthCheck — Base implementation; override for provider-specific checks
  // ----------------------------------------------------------

  async healthCheck(integrationId: string): Promise<HealthCheckResult> {
    const record = await this.loadRecord(integrationId);
    const errors: string[] = [];
    const now = new Date().toISOString();
    const tokenExpired = record.token_expires_at
      ? new Date(record.token_expires_at) < new Date()
      : false;

    let health: ConnectionHealth = 'healthy';

    if (record.status === 'disconnected') {
      health = 'unknown';
      errors.push('Integration is disconnected.');
    } else if (record.status === 'error') {
      health = 'error';
      errors.push('Integration is in error state.');
    } else if (tokenExpired) {
      health = 'expired';
      errors.push('Token has expired.');
    }

    const result: HealthCheckResult = {
      integration_id: integrationId,
      provider: this.definition.id,
      healthy: health === 'healthy',
      health,
      status: record.status as IntegrationStatus,
      token_expired: tokenExpired,
      token_expires_at: record.token_expires_at,
      last_checked_at: now,
      errors,
    };

    await this.updateRecord(integrationId, {
      connection_health: health,
      last_health_check: now,
    });

    await integrationLogger.log({
      integrationId,
      event: 'health_check',
      status: health === 'healthy' ? 'success' : health === 'expired' ? 'warning' : 'failure',
      message: errors.length > 0 ? errors.join('; ') : 'Health check passed.',
      metadata: { health, token_expired: tokenExpired },
    });

    return result;
  }

  // ----------------------------------------------------------
  // getPermissions — Load all permissions for an integration
  // ----------------------------------------------------------

  async getPermissions(integrationId: string): Promise<IntegrationPermissionRecord[]> {
    const { data, error } = await supabase
      .from('integration_permissions')
      .select('*')
      .eq('integration_id', integrationId)
      .order('permission_name', { ascending: true });
    if (error) throw new Error(`Failed to load permissions: ${error.message}`);
    return (data ?? []) as IntegrationPermissionRecord[];
  }

  // ----------------------------------------------------------
  // requestPermissions — Override in concrete provider
  // ----------------------------------------------------------

  async requestPermissions(_integrationId: string, _permissions: string[]): Promise<ConnectResult> {
    throw new Error(`${this.definition.name} request permissions not implemented`);
  }

  // ----------------------------------------------------------
  // sync — Base implementation; override for provider-specific sync
  // ----------------------------------------------------------

  async sync(integrationId: string): Promise<SyncResult> {
    const record = await this.loadRecord(integrationId);
    const now = new Date().toISOString();

    if (record.status !== 'connected') {
      const result: SyncResult = {
        integration_id: integrationId,
        provider: this.definition.id,
        synced: false,
        last_sync: now,
        error: 'Integration is not connected.',
      };
      await integrationLogger.log({
        integrationId,
        event: 'sync',
        status: 'failure',
        message: 'Sync attempted on disconnected integration.',
      });
      return result;
    }

    await this.updateRecord(integrationId, { last_sync: now });

    await integrationLogger.log({
      integrationId,
      event: 'sync',
      status: 'success',
      message: `${this.definition.name} sync completed.`,
    });

    return {
      integration_id: integrationId,
      provider: this.definition.id,
      synced: true,
      last_sync: now,
      error: null,
    };
  }

  // ----------------------------------------------------------
  // Helper: get provider id
  // ----------------------------------------------------------

  get id(): ProviderId {
    return this.definition.id;
  }
}
