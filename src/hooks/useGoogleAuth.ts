// ============================================================
// Google OAuth — React Query Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { googleOAuthService } from '@/services/google-auth';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import type {
  GoogleAccount,
  GoogleConnectionState,
  CallbackResult,
} from '@/types/google-auth';

// ============================================================
// Query Keys
// ============================================================

export const googleKeys = {
  all: ['google-oauth'] as const,
  accounts: (wsId: string) => [...googleKeys.all, 'accounts', wsId] as const,
  primary: (wsId: string) => [...googleKeys.all, 'primary', wsId] as const,
  connection: (wsId: string) => [...googleKeys.all, 'connection', wsId] as const,
};

// ============================================================
// useGoogleAccounts — List all connected Google accounts
// ============================================================

export function useGoogleAccounts() {
  const { workspace } = useWorkspace();

  return useQuery<GoogleAccount[]>({
    queryKey: googleKeys.accounts(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      return googleOAuthService.getConnectedAccounts(workspace.id);
    },
  });
}

// ============================================================
// useGoogleConnection — Get primary account connection state
// ============================================================

export function useGoogleConnection() {
  const { workspace } = useWorkspace();

  return useQuery<GoogleConnectionState>({
    queryKey: googleKeys.connection(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return googleOAuthService.checkConnection(workspace.id);
    },
    refetchInterval: 60_000,
  });
}

// ============================================================
// useConnectGoogle — Initiate OAuth flow
// ============================================================

export function useConnectGoogle() {
  const { workspace, loading: wsLoading } = useWorkspace();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (authLoading || wsLoading) {
        throw new Error('Still loading your session. Please try again in a moment.');
      }
      if (!user) throw new Error('You must be signed in to connect Google.');
      if (!workspace) throw new Error('No workspace found. Please complete the business details step first.');
      const result = await googleOAuthService.connectGoogle({
        workspaceId: workspace.id,
        userId: user.id,
      });
      return result;
    },
    onSuccess: (data) => {
      const popup = window.open(data.authUrl, '_blank', 'width=500,height=600');

      if (popup) {
        const poll = setInterval(() => {
          if (popup.closed) {
            clearInterval(poll);
            queryClient.invalidateQueries({ queryKey: googleKeys.all });
          }
        }, 1000);
      } else {
        const a = document.createElement('a');
        a.href = data.authUrl;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to start Google connection.');
    },
  });
}

// ============================================================
// useHandleGoogleCallback — Process OAuth callback
// ============================================================

export function useHandleGoogleCallback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { code: string; state: string }): Promise<CallbackResult> => {
      return googleOAuthService.handleCallback(params);
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: googleKeys.all });
        toast.success('Google account connected successfully.');
      } else {
        toast.error(data.error ?? 'Failed to connect Google account.');
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'OAuth callback failed.');
    },
  });
}

// ============================================================
// useDisconnectGoogle — Disconnect a Google account
// ============================================================

export function useDisconnectGoogle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      return googleOAuthService.disconnectGoogle(accountId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: googleKeys.all });
      toast.success('Google account disconnected.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to disconnect Google account.');
    },
  });
}

// ============================================================
// useSetPrimaryGoogle — Set primary Google account
// ============================================================

export function useSetPrimaryGoogle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { accountId: string; workspaceId: string }) => {
      return googleOAuthService.setPrimaryAccount(params.accountId, params.workspaceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: googleKeys.all });
      toast.success('Primary Google account updated.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to set primary account.');
    },
  });
}

// ============================================================
// useRefreshGoogleToken — Refresh expired token
// ============================================================

export function useRefreshGoogleToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      return googleOAuthService.refreshToken(accountId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: googleKeys.all });
      if (data.refreshed) {
        toast.success('Google token refreshed.');
      } else {
        toast.error('Google token could not be refreshed. Please reconnect.');
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to refresh Google token.');
    },
  });
}

// ============================================================
// useRefreshExpiredTokens — Batch refresh all expired tokens
// ============================================================

export function useRefreshExpiredTokens() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return googleOAuthService.refreshExpiredTokens(workspace.id);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: googleKeys.all });
      if (data.failed > 0) {
        toast.warning(`${data.refreshed} token(s) refreshed, ${data.failed} failed.`);
      } else if (data.refreshed > 0) {
        toast.success(`${data.refreshed} token(s) refreshed.`);
      } else {
        toast.info('No tokens needed refreshing.');
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to refresh tokens.');
    },
  });
}
