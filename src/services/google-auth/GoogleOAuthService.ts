// ============================================================
// GoogleOAuthService — Production Google OAuth Orchestrator
// ============================================================
//
// Manages the full Google OAuth lifecycle:
//   - Initiating the OAuth flow (building the authorization URL)
//   - Handling the OAuth callback (exchanging code for tokens)
//   - Storing/refreshing tokens in the database
//   - Disconnecting accounts and revoking tokens
//   - Checking connection status and token expiry
//   - Managing primary account selection
//   - Validating granted scopes
//
// Token exchange happens via a Supabase Edge Function to keep
// the client secret server-side. The service calls that function
// and then persists the result to the database.

import { supabase } from '@/lib/supabase';
import {
  DEFAULT_GOOGLE_SCOPES,
  SCOPE_LABELS,
} from '@/types/google-auth';
import {
  generateRandomString,
  generateCodeChallenge,
  buildOAuthUrl,
  getRedirectUri,
  getClientId,
} from './oauthHelpers';
import type {
  GoogleAccount,
  OAuthToken,
  GoogleConnectionState,
  ConnectGoogleResult,
  CallbackResult,
  RefreshTokenResult,
  DisconnectResult,
  SetPrimaryResult,
  ValidateScopesResult,
  GoogleAccountWithToken,
} from '@/types/google-auth';

const STATE_STORAGE_KEY = 'revenueai_google_oauth_state';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

class GoogleOAuthService {
  // ============================================================
  // connectGoogle — Build OAuth URL and redirect user
  // ============================================================

  async connectGoogle(params: {
    workspaceId: string;
    userId: string;
    redirectUri?: string;
    scopes?: string[];
  }): Promise<ConnectGoogleResult> {
    const scopes = params.scopes ?? DEFAULT_GOOGLE_SCOPES;
    const redirectUri = getRedirectUri(params.redirectUri);
    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    const stateData = {
      state,
      codeVerifier,
      workspaceId: params.workspaceId,
      userId: params.userId,
      scopes: scopes.join(' '),
      createdAt: Date.now(),
    };
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(stateData));

    const authUrl = buildOAuthUrl({
      clientId: getClientId(),
      redirectUri,
      scopes,
      state,
      codeChallenge,
    });

    return { authUrl, state };
  }

  // Alias for backward compatibility with GoogleProvider
  async getAuthUrl(params: {
    workspaceId: string;
    redirectUri?: string;
    scopes?: string[];
  }): Promise<string> {
    const result = await this.connectGoogle({
      workspaceId: params.workspaceId,
      userId: '',
      redirectUri: params.redirectUri,
      scopes: params.scopes,
    });
    return result.authUrl;
  }

  // ============================================================
  // handleCallback — Exchange code for tokens via edge function
  // ============================================================

  async handleCallback(params: {
    code: string;
    state: string;
    redirectUri?: string;
  }): Promise<CallbackResult> {
    const storedRaw = localStorage.getItem(STATE_STORAGE_KEY);
    if (!storedRaw) {
      return { success: false, accountId: null, error: 'OAuth session not found. Please try connecting again.' };
    }

    const stored = JSON.parse(storedRaw) as {
      state: string;
      codeVerifier: string;
      workspaceId: string;
      userId: string;
      scopes: string;
      createdAt: number;
    };

    if (stored.state !== params.state) {
      localStorage.removeItem(STATE_STORAGE_KEY);
      return { success: false, accountId: null, error: 'Invalid OAuth state. This may be a CSRF attack.' };
    }

    if (Date.now() - stored.createdAt > 10 * 60 * 1000) {
      localStorage.removeItem(STATE_STORAGE_KEY);
      return { success: false, accountId: null, error: 'OAuth session expired. Please try connecting again.' };
    }

    const redirectUri = getRedirectUri(params.redirectUri);

    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('google-oauth-callback', {
        body: {
          code: params.code,
          codeVerifier: stored.codeVerifier,
          redirectUri,
          workspaceId: stored.workspaceId,
          userId: stored.userId,
          scopes: stored.scopes,
        },
      });

      localStorage.removeItem(STATE_STORAGE_KEY);

      if (fnError || !fnData?.success) {
        return {
          success: false,
          accountId: null,
          error: fnData?.error ?? fnError?.message ?? 'Token exchange failed.',
        };
      }

      return {
        success: true,
        accountId: fnData.accountId,
        error: null,
      };
    } catch (err) {
      localStorage.removeItem(STATE_STORAGE_KEY);
      return {
        success: false,
        accountId: null,
        error: err instanceof Error ? err.message : 'OAuth callback failed.',
      };
    }
  }

  // ============================================================
  // getConnectedAccounts — List all Google accounts for workspace
  // ============================================================

  async getConnectedAccounts(workspaceId: string): Promise<GoogleAccount[]> {
    const { data, error } = await supabase
      .from('google_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('is_primary', { ascending: false })
      .order('connected_at', { ascending: true });

    if (error) throw new Error(`Failed to load Google accounts: ${error.message}`);
    return (data ?? []) as GoogleAccount[];
  }

  // ============================================================
  // getPrimaryAccount — Get the primary Google account
  // ============================================================

  async getPrimaryAccount(workspaceId: string): Promise<GoogleAccount | null> {
    const { data, error } = await supabase
      .from('google_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_primary', true)
      .in('status', ['connected', 'expired'])
      .maybeSingle();

    if (error) throw new Error(`Failed to load primary account: ${error.message}`);
    return data as GoogleAccount | null;
  }

  // ============================================================
  // setPrimaryAccount — Set a Google account as primary
  // ============================================================

  async setPrimaryAccount(accountId: string, workspaceId: string): Promise<SetPrimaryResult> {
    const { error: unsetError } = await supabase
      .from('google_accounts')
      .update({ is_primary: false })
      .eq('workspace_id', workspaceId)
      .neq('id', accountId);

    if (unsetError) throw new Error(`Failed to update primary account: ${unsetError.message}`);

    const { error: setError } = await supabase
      .from('google_accounts')
      .update({ is_primary: true })
      .eq('id', accountId)
      .eq('workspace_id', workspaceId);

    if (setError) throw new Error(`Failed to set primary account: ${setError.message}`);

    return { updated: true };
  }

  // ============================================================
  // disconnectGoogle — Revoke tokens and mark disconnected
  // ============================================================

  async disconnectGoogle(accountId: string): Promise<DisconnectResult> {
    const { data: token } = await supabase
      .from('oauth_tokens')
      .select('access_token, refresh_token')
      .eq('google_account_id', accountId)
      .maybeSingle();

    if (token?.refresh_token) {
      try {
        await fetch(`${GOOGLE_TOKEN_URL}/revoke?token=${token.refresh_token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
      } catch {
        // Best-effort revocation
      }
    }

    await supabase.from('oauth_tokens').delete().eq('google_account_id', accountId);

    const { error } = await supabase
      .from('google_accounts')
      .update({ status: 'disconnected', is_primary: false })
      .eq('id', accountId);

    if (error) throw new Error(`Failed to disconnect account: ${error.message}`);

    return { disconnected: true };
  }

  // ============================================================
  // refreshToken — Refresh expired access token via edge function
  // ============================================================

  async refreshToken(accountId: string): Promise<RefreshTokenResult> {
    const { data: token, error: tokenError } = await supabase
      .from('oauth_tokens')
      .select('refresh_token')
      .eq('google_account_id', accountId)
      .maybeSingle();

    if (tokenError || !token?.refresh_token) {
      return { refreshed: false, expires_at: null };
    }

    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('google-oauth-refresh', {
        body: {
          refreshToken: token.refresh_token,
          accountId,
        },
      });

      if (fnError || !fnData?.refreshed) {
        return { refreshed: false, expires_at: null };
      }

      return {
        refreshed: true,
        expires_at: fnData.expires_at,
      };
    } catch {
      return { refreshed: false, expires_at: null };
    }
  }

  // ============================================================
  // checkConnection — Get full connection state for an account
  // ============================================================

  async checkConnection(workspaceId: string): Promise<GoogleConnectionState> {
    const account = await this.getPrimaryAccount(workspaceId);

    if (!account) {
      return {
        account: null,
        token: null,
        isExpired: false,
        isRefreshing: false,
        hasError: false,
        needsReconnect: true,
      };
    }

    const { data: token } = await supabase
      .from('oauth_tokens')
      .select('*')
      .eq('google_account_id', account.id)
      .maybeSingle();

    const oauthToken = token as OAuthToken | null;

    const isExpired = oauthToken
      ? oauthToken.expires_at
        ? new Date(oauthToken.expires_at) < new Date()
        : false
      : true;

    const hasError = account.status === 'error' || account.status === 'revoked';
    const needsReconnect = account.status === 'disconnected' || account.status === 'revoked' || (!oauthToken?.refresh_token && isExpired);

    return {
      account,
      token: oauthToken,
      isExpired,
      isRefreshing: false,
      hasError,
      needsReconnect,
    };
  }

  // ============================================================
  // validateScopes — Check if granted scopes cover required scopes
  // ============================================================

  async validateScopes(accountId: string, requiredScopes: string[]): Promise<ValidateScopesResult> {
    const { data: token } = await supabase
      .from('oauth_tokens')
      .select('scope')
      .eq('google_account_id', accountId)
      .maybeSingle();

    const grantedScopes = (token?.scope ?? '').split(' ').filter(Boolean);
    const missing = requiredScopes.filter((s) => !grantedScopes.includes(s));

    return {
      valid: missing.length === 0,
      missing,
      granted: grantedScopes,
    };
  }

  // ============================================================
  // refreshExpiredTokens — Batch refresh all expired tokens
  // ============================================================

  async refreshExpiredTokens(workspaceId: string): Promise<{ refreshed: number; failed: number }> {
    const accounts = await this.getConnectedAccounts(workspaceId);
    const connected = accounts.filter((a) => a.status === 'connected' || a.status === 'expired');

    let refreshed = 0;
    let failed = 0;

    for (const account of connected) {
      const result = await this.refreshToken(account.id);
      if (result.refreshed) {
        refreshed++;
      } else {
        failed++;
      }
    }

    return { refreshed, failed };
  }

  // ============================================================
  // getGrantedScopeLabels — Human-readable list of granted scopes
  // ============================================================

  getGrantedScopeLabels(scopeString: string | null): string[] {
    if (!scopeString) return [];
    return scopeString
      .split(' ')
      .filter(Boolean)
      .map((s) => SCOPE_LABELS[s] ?? s);
  }

  // ============================================================
  // getAccountWithToken — Load account + its token
  // ============================================================

  async getAccountWithToken(accountId: string): Promise<GoogleAccountWithToken | null> {
    const { data: account, error: accError } = await supabase
      .from('google_accounts')
      .select('*')
      .eq('id', accountId)
      .maybeSingle();

    if (accError || !account) return null;

    const { data: token } = await supabase
      .from('oauth_tokens')
      .select('*')
      .eq('google_account_id', accountId)
      .maybeSingle();

    return {
      ...(account as GoogleAccount),
      token: (token as OAuthToken) ?? null,
    };
  }

  // ============================================================
  // updateIntegrationStatus — Upsert integration health record
  // ============================================================

  async updateIntegrationStatus(params: {
    workspaceId: string;
    integration: string;
    status: 'connected' | 'disconnected' | 'expired' | 'error' | 'refreshing';
    lastError?: string | null;
    connectedAccountId?: string | null;
  }): Promise<void> {
    const { error } = await supabase
      .from('integration_status')
      .upsert({
        workspace_id: params.workspaceId,
        integration: params.integration,
        status: params.status,
        last_check: new Date().toISOString(),
        last_error: params.lastError ?? null,
        connected_account: params.connectedAccountId ?? null,
      }, {
        onConflict: 'workspace_id,integration',
      });

    if (error) throw new Error(`Failed to update integration status: ${error.message}`);
  }

  // ============================================================
  // getIntegrationStatus — Load integration health record
  // ============================================================

  async getIntegrationStatus(workspaceId: string, integration: string) {
    const { data, error } = await supabase
      .from('integration_status')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('integration', integration)
      .maybeSingle();

    if (error) throw new Error(`Failed to load integration status: ${error.message}`);
    return data;
  }
}

export const googleOAuthService = new GoogleOAuthService();
