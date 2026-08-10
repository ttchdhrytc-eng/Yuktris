// ============================================================
// GoogleProvider — Google Workspace integration
// ============================================================
//
// Delegates to the existing Google OAuth + Workspace infrastructure.
// Connect/reconnect/refresh are implemented; other methods use the
// base implementation.

import { BaseIntegrationProvider } from '../BaseIntegrationProvider';
import { googleOAuthService } from '@/services/google-auth';
import { googleWorkspaceService } from '@/services/google-workspace';
import { integrationLogger } from '../IntegrationLogger';
import { supabase } from '@/lib/supabase';
import type {
  ProviderDefinition,
  ConnectResult,
  RefreshResult,
  HealthCheckResult,
} from '@/types/integrations';

const GOOGLE_DEFINITION: ProviderDefinition = {
  id: 'google',
  name: 'Google Workspace',
  type: 'oauth',
  description: 'Gmail, Calendar, Meet, Contacts, and Drive',
  icon: 'google',
  color: '#4285F4',
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
  ],
  docsUrl: 'https://developers.google.com/workspace',
  capabilities: [
    'initialize', 'connect', 'disconnect', 'reconnect', 'refresh_tokens',
    'validate_connection', 'health_check', 'get_permissions', 'request_permissions', 'sync',
  ],
};

export class GoogleProvider extends BaseIntegrationProvider {
  definition = GOOGLE_DEFINITION;

  async connect(params: {
    workspaceId: string;
    redirectUri?: string;
    scopes?: string[];
  }): Promise<ConnectResult> {
    const authUrl = await googleOAuthService.getAuthUrl({
      workspaceId: params.workspaceId,
      redirectUri: params.redirectUri,
      scopes: params.scopes ?? GOOGLE_DEFINITION.scopes,
    });

    return { authUrl, connected: false, error: null };
  }

  async reconnect(integrationId: string): Promise<ConnectResult> {
    const record = await this.loadRecord(integrationId);
    return this.connect({ workspaceId: record.workspace_id });
  }

  async refreshTokens(integrationId: string): Promise<RefreshResult> {
    const record = await this.loadRecord(integrationId);

    const { data: wsRecord } = await supabase
      .from('google_workspace')
      .select('google_account_id')
      .eq('workspace_id', record.workspace_id)
      .maybeSingle();

    if (!wsRecord?.google_account_id) {
      return {
        integration_id: integrationId,
        provider: 'google',
        refreshed: false,
        expires_at: null,
        error: 'No Google account linked.',
      };
    }

    const result = await googleOAuthService.refreshToken(wsRecord.google_account_id);

    await integrationLogger.log({
      integrationId,
      event: 'refresh',
      status: result.refreshed ? 'success' : 'failure',
      message: result.refreshed ? 'Token refreshed.' : (result.error ?? 'Refresh failed.'),
    });

    return {
      integration_id: integrationId,
      provider: 'google',
      refreshed: result.refreshed,
      expires_at: result.expires_at,
      error: result.refreshed ? null : (result.error ?? 'Refresh failed.'),
    };
  }

  async healthCheck(integrationId: string): Promise<HealthCheckResult> {
    const record = await this.loadRecord(integrationId);
    const state = await googleWorkspaceService.validateConnection(record.workspace_id);

    const errors: string[] = [];
    let health = 'healthy' as const;
    if (!state.account) {
      health = 'error';
      errors.push('No Google account connected.');
    } else if (state.isExpired) {
      health = 'expired';
      errors.push('Token expired.');
    } else if (state.needsReconnect) {
      health = 'error';
      errors.push('Needs reconnection.');
    } else if (Object.values(state.services).some((v) => !v)) {
      health = 'degraded';
    }

    const now = new Date().toISOString();
    await this.updateRecord(integrationId, {
      connection_health: health,
      last_health_check: now,
      status: health === 'error' ? 'error' : record.status,
      token_expires_at: state.tokenExpiresAt,
    });

    await integrationLogger.log({
      integrationId,
      event: 'health_check',
      status: health === 'healthy' ? 'success' : health === 'expired' ? 'warning' : 'failure',
      message: errors.length > 0 ? errors.join('; ') : 'Health check passed.',
    });

    return {
      integration_id: integrationId,
      provider: 'google',
      healthy: health === 'healthy',
      health,
      status: record.status,
      token_expired: state.isExpired,
      token_expires_at: state.tokenExpiresAt,
      last_checked_at: now,
      errors,
    };
  }
}
