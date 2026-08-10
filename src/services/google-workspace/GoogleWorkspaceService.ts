// ============================================================
// GoogleWorkspaceService — Centralized Google Workspace Layer
// ============================================================
//
// Single source of truth for all Google Workspace integrations.
// Every future module (Gmail, Calendar, Meet, Contacts, Drive) calls
// this service — never authenticates separately.
//
// Responsibilities:
//   - Detect which Workspace services are available from granted scopes
//   - Track per-scope permission state (granted vs missing)
//   - Incremental authorization (request only missing scopes)
//   - Connection health monitoring + automatic token refresh
//   - Persist service enablement + permission state to the database

import { supabase } from '@/lib/supabase';
import { googleOAuthService } from '@/services/google-auth';
import {
  generateRandomString,
  generateCodeChallenge,
  buildOAuthUrl,
  getRedirectUri,
  getClientId,
} from '@/services/google-auth/oauthHelpers';
import {
  WORKSPACE_SERVICES,
} from '@/types/google-workspace';
import type {
  GoogleWorkspaceServiceId,
  GoogleWorkspaceRecord,
  GooglePermissionRecord,
  GoogleWorkspaceState,
  HealthCheckResult,
  ConnectionHealth,
  ScopeCheckResult,
  RequestScopesResult,
  RefreshWorkspaceResult,
} from '@/types/google-workspace';
import type { GoogleAccount, OAuthToken } from '@/types/google-auth';

const STATE_STORAGE_KEY = 'revenueai_google_workspace_state';

const SERVICE_FLAGS: { id: GoogleWorkspaceServiceId; flag: keyof Pick<GoogleWorkspaceRecord, 'gmail_enabled' | 'calendar_enabled' | 'meet_enabled' | 'contacts_enabled' | 'drive_enabled'> }[] = [
  { id: 'gmail', flag: 'gmail_enabled' },
  { id: 'calendar', flag: 'calendar_enabled' },
  { id: 'meet', flag: 'meet_enabled' },
  { id: 'contacts', flag: 'contacts_enabled' },
  { id: 'drive', flag: 'drive_enabled' },
];

class GoogleWorkspaceService {
  // ============================================================
  // initialize — Ensure a google_workspace row exists for the workspace
  // ============================================================

  async initialize(workspaceId: string, googleAccountId: string): Promise<GoogleWorkspaceRecord> {
    const { data: existing } = await supabase
      .from('google_workspace')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (existing) {
      const record = existing as GoogleWorkspaceRecord;
      if (record.google_account_id !== googleAccountId) {
        const { data: updated, error } = await supabase
          .from('google_workspace')
          .update({ google_account_id: googleAccountId })
          .eq('id', record.id)
          .select('*')
          .maybeSingle();
        if (error) throw new Error(`Failed to link Google account: ${error.message}`);
        return updated as GoogleWorkspaceRecord;
      }
      return record;
    }

    const { data: created, error } = await supabase
      .from('google_workspace')
      .insert({
        workspace_id: workspaceId,
        google_account_id: googleAccountId,
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to initialize workspace: ${error.message}`);
    return created as GoogleWorkspaceRecord;
  }

  // ============================================================
  // detectServices — Determine which services are available based on granted scopes
  // ============================================================

  detectServices(grantedScopes: string[]): Record<GoogleWorkspaceServiceId, boolean> {
    const scopeSet = new Set(grantedScopes);
    const result = {} as Record<GoogleWorkspaceServiceId, boolean>;
    for (const service of WORKSPACE_SERVICES) {
      result[service.id] = service.scopes.every((s) => scopeSet.has(s));
    }
    return result;
  }

  // ============================================================
  // checkScopes — Per-service scope validation
  // ============================================================

  checkScopes(grantedScopes: string[]): ScopeCheckResult[] {
    const scopeSet = new Set(grantedScopes);
    return WORKSPACE_SERVICES.map((service) => {
      const missing = service.scopes.filter((s) => !scopeSet.has(s));
      return {
        serviceId: service.id,
        granted: missing.length === 0,
        missingScopes: missing,
      };
    });
  }

  // ============================================================
  // loadConnectedServices — Load the google_workspace record
  // ============================================================

  async loadConnectedServices(workspaceId: string): Promise<GoogleWorkspaceRecord | null> {
    const { data, error } = await supabase
      .from('google_workspace')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load workspace services: ${error.message}`);
    return data as GoogleWorkspaceRecord | null;
  }

  // ============================================================
  // loadPermissions — Load all permission records for a workspace
  // ============================================================

  async loadPermissions(workspaceId: string): Promise<GooglePermissionRecord[]> {
    const ws = await this.loadConnectedServices(workspaceId);
    if (!ws) return [];
    const { data, error } = await supabase
      .from('google_permissions')
      .select('*')
      .eq('google_workspace_id', ws.id)
      .order('scope', { ascending: true });
    if (error) throw new Error(`Failed to load permissions: ${error.message}`);
    return (data ?? []) as GooglePermissionRecord[];
  }

  // ============================================================
  // requestAdditionalScopes — Incremental authorization
  // Uses shared OAuth helpers — no duplicated PKCE/URL logic
  // ============================================================

  async requestAdditionalScopes(params: {
    workspaceId: string;
    userId: string;
    scopes: string[];
    redirectUri?: string;
  }): Promise<RequestScopesResult> {
    const redirectUri = getRedirectUri(params.redirectUri);
    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    const stateData = {
      state,
      codeVerifier,
      workspaceId: params.workspaceId,
      userId: params.userId,
      scopes: params.scopes.join(' '),
      createdAt: Date.now(),
    };
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(stateData));

    const authUrl = buildOAuthUrl({
      clientId: getClientId(),
      redirectUri,
      scopes: params.scopes,
      state,
      codeChallenge,
    });

    return { authUrl, state };
  }

  // ============================================================
  // refreshTokens — Refresh the access token for the workspace's Google account
  // ============================================================

  async refreshTokens(workspaceId: string): Promise<RefreshWorkspaceResult> {
    const ws = await this.loadConnectedServices(workspaceId);
    if (!ws?.google_account_id) {
      return { refreshed: false, expiresAt: null, error: 'No Google account linked.' };
    }
    const result = await googleOAuthService.refreshToken(ws.google_account_id);
    return {
      refreshed: result.refreshed,
      expiresAt: result.expires_at,
      error: result.refreshed ? null : 'Token refresh failed.',
    };
  }

  // ============================================================
  // validateConnection — Full validation of account + token + scopes
  // ============================================================

  async validateConnection(workspaceId: string): Promise<GoogleWorkspaceState> {
    const account = await googleOAuthService.getPrimaryAccount(workspaceId);
    const ws = await this.loadConnectedServices(workspaceId);

    if (!account) {
      return this.emptyState();
    }

    const { data: tokenData } = await supabase
      .from('oauth_tokens')
      .select('*')
      .eq('google_account_id', account.id)
      .maybeSingle();
    const token = tokenData as OAuthToken | null;

    const grantedScopes = (token?.scope ?? '').split(' ').filter(Boolean);
    const services = this.detectServices(grantedScopes);
    const permissions = await this.loadPermissions(workspaceId);

    const isExpired = token?.expires_at ? new Date(token.expires_at) < new Date() : !token;
    const needsReconnect = account.status === 'disconnected' || account.status === 'revoked' || (!token?.refresh_token && isExpired);

    return {
      workspace: ws,
      account,
      token,
      permissions,
      services,
      grantedScopes,
      missingScopes: this.getMissingScopes(grantedScopes),
      isExpired,
      needsReconnect,
      health: ws?.connection_health ?? 'unknown',
      lastHealthCheck: ws?.last_health_check ?? null,
      tokenExpiresAt: token?.expires_at ?? null,
    };
  }

  // ============================================================
  // healthCheck — Check token validity + service availability + persist
  // ============================================================

  async healthCheck(workspaceId: string): Promise<HealthCheckResult> {
    const state = await this.validateConnection(workspaceId);
    const errors: string[] = [];

    if (!state.account) {
      errors.push('No Google account connected.');
    }
    if (state.isExpired) {
      errors.push('Access token has expired.');
    }
    if (state.needsReconnect) {
      errors.push('Account needs reconnection.');
    }

    let health: ConnectionHealth = 'healthy';
    if (errors.length > 0 && !state.account) {
      health = 'error';
    } else if (state.isExpired) {
      health = 'expired';
    } else if (Object.values(state.services).some((v) => !v)) {
      health = 'degraded';
    }

    const result: HealthCheckResult = {
      healthy: health === 'healthy',
      health,
      services: state.services,
      tokenExpired: state.isExpired,
      tokenExpiresAt: state.tokenExpiresAt,
      lastCheckedAt: new Date().toISOString(),
      errors,
    };

    await this.persistHealthCheck(workspaceId, health, state.grantedScopes);

    return result;
  }

  // ============================================================
  // refreshWorkspace — Refresh tokens + re-run health check
  // ============================================================

  async refreshWorkspace(workspaceId: string): Promise<GoogleWorkspaceState> {
    const refreshResult = await this.refreshTokens(workspaceId);
    if (!refreshResult.refreshed && refreshResult.error) {
      const state = await this.validateConnection(workspaceId);
      await this.persistHealthCheck(workspaceId, 'error', state.grantedScopes);
      return state;
    }
    return this.validateConnection(workspaceId);
  }

  // ============================================================
  // enableService — Toggle a service flag on the workspace record
  // ============================================================

  async enableService(workspaceId: string, serviceId: GoogleWorkspaceServiceId, enabled: boolean): Promise<void> {
    const ws = await this.loadConnectedServices(workspaceId);
    if (!ws) throw new Error('Workspace not initialized.');

    const flag = SERVICE_FLAGS.find((f) => f.id === serviceId)?.flag;
    if (!flag) throw new Error(`Unknown service: ${serviceId}`);

    const { error } = await supabase
      .from('google_workspace')
      .update({ [flag]: enabled })
      .eq('id', ws.id);
    if (error) throw new Error(`Failed to update service: ${error.message}`);
  }

  // ============================================================
  // Private: persistHealthCheck — Save health + sync permissions to DB
  // ============================================================

  private async persistHealthCheck(workspaceId: string, health: ConnectionHealth, grantedScopes: string[]): Promise<void> {
    const ws = await this.loadConnectedServices(workspaceId);
    if (!ws) return;

    await supabase
      .from('google_workspace')
      .update({
        connection_health: health,
        last_health_check: new Date().toISOString(),
      })
      .eq('id', ws.id);

    const allScopes = WORKSPACE_SERVICES.flatMap((s) => s.scopes);
    const grantedSet = new Set(grantedScopes);

    for (const scope of allScopes) {
      const isGranted = grantedSet.has(scope);
      const existing = await supabase
        .from('google_permissions')
        .select('id')
        .eq('google_workspace_id', ws.id)
        .eq('scope', scope)
        .maybeSingle();

      if (existing.data) {
        await supabase
          .from('google_permissions')
          .update({ granted: isGranted, last_checked: new Date().toISOString() })
          .eq('id', existing.data.id);
      } else {
        await supabase
          .from('google_permissions')
          .insert({
            google_workspace_id: ws.id,
            scope,
            granted: isGranted,
            last_checked: new Date().toISOString(),
          });
      }
    }
  }

  // ============================================================
  // Private: getMissingScopes — All required scopes not yet granted
  // ============================================================

  private getMissingScopes(grantedScopes: string[]): string[] {
    const grantedSet = new Set(grantedScopes);
    const allRequired = WORKSPACE_SERVICES.flatMap((s) => s.scopes);
    return [...new Set(allRequired)].filter((s) => !grantedSet.has(s));
  }

  // ============================================================
  // Private: emptyState — Return a blank state when no account is connected
  // ============================================================

  private emptyState(): GoogleWorkspaceState {
    const services = {} as Record<GoogleWorkspaceServiceId, boolean>;
    for (const s of WORKSPACE_SERVICES) services[s.id] = false;
    return {
      workspace: null,
      account: null,
      token: null,
      permissions: [],
      services,
      grantedScopes: [],
      missingScopes: WORKSPACE_SERVICES.flatMap((s) => s.scopes),
      isExpired: false,
      needsReconnect: true,
      health: 'unknown',
      lastHealthCheck: null,
      tokenExpiresAt: null,
    };
  }
}

export const googleWorkspaceService = new GoogleWorkspaceService();
