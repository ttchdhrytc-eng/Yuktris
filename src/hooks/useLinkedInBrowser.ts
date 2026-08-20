// ============================================================
// useLinkedInBrowser — React Query hooks for LinkedIn automation
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { isTestFixture } from '@/services/campaign-metrics';
import type {
  LinkedInAccount, LinkedInSession, LinkedInSessionBackup,
  LinkedInLoginHistory, LinkedInDevice, LinkedInSessionEvent,
  BrowserExecutionQueueItem, BrowserExecutionHistory,
  BrowserExecutionFailure, BrowserRetryQueueItem, BrowserDeadLetterItem,
  LinkedInConversation, LinkedInMessage,
  CalendarConnection, LinkedInMeetingRequest, LinkedInMeetingSlot,
  LinkedInMeetingConfirmation,
  LinkedInAuthInteraction, LinkedInSessionHeartbeat,
} from '@/types/linkedin-browser-automation';

// ── LinkedIn Accounts ────────────────────────────────────────

export function useLinkedInAccounts() {
  const { workspace } = useWorkspace();
  return useQuery<LinkedInAccount[]>({
    queryKey: ['linkedin-accounts', workspace?.id],
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('linkedin_accounts')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as LinkedInAccount[];
    },
    enabled: !!workspace,
    refetchInterval: (query) => {
      const accounts = query.state.data;
      return accounts?.some((account) => ['pending', 'authenticating', 'requires_action'].includes(account.connection_state)) ? 1000 : 10000;
    },
  });
}

export function useLinkedInLoginAccess(accountId: string | null, queueItemId: string | null = null, verificationRequired = false) {
  const { workspace } = useWorkspace();
  return useQuery<{ loginUrl: string; expiresAt: string } | null>({
    queryKey: ['linkedin-login-access', workspace?.id, accountId, queueItemId],
    queryFn: async () => {
      if (!workspace || !accountId || !queueItemId) return null;
      const { data, error } = await supabase.rpc('get_linkedin_login_access', {
        p_workspace_id: workspace.id,
        p_account_id: accountId,
        p_queue_item_id: queueItemId,
      });
      if (error) throw error;
      const access = Array.isArray(data) ? data[0] : data;
      if (!access?.login_url || !access?.expires_at) return null;
      return { loginUrl: access.login_url as string, expiresAt: access.expires_at as string };
    },
    enabled: !!workspace && !!accountId && !!queueItemId && verificationRequired,
    refetchInterval: 2000,
  });
}

export function useLinkedInCredentialsConfigured(accountId: string | null) {
  const { workspace } = useWorkspace();
  return useQuery<boolean>({
    queryKey: ['linkedin-credentials-configured', workspace?.id, accountId],
    queryFn: async () => {
      if (!workspace || !accountId) return false;
      const { data, error } = await supabase.rpc('has_linkedin_credentials', {
        p_workspace_id: workspace.id, p_account_id: accountId,
      });
      if (error) throw error;
      return data === true;
    },
    enabled: !!workspace && !!accountId,
  });
}

export function useRecoverLinkedInAuthSurface() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ accountId, queueItemId }: { accountId: string; queueItemId: string }) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.rpc('request_linkedin_auth_surface_recovery', {
        p_workspace_id: workspace.id, p_account_id: accountId, p_queue_item_id: queueItemId,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['linkedin-login-access'] }),
  });
}

export function useCreateLinkedInAccount() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { accountName: string; linkedinEmail: string; profileUrl?: string }) => {
      if (!workspace) throw new Error('No workspace');
      const { data, error } = await supabase
        .from('linkedin_accounts')
        .insert({
          workspace_id: workspace.id,
          account_name: params.accountName,
          linkedin_email: params.linkedinEmail,
          profile_url: params.profileUrl ?? null,
          status: 'pending_login',
          session_status: 'disconnected',
          connection_state: 'pending',
        })
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['linkedin-accounts'] }),
  });
}

// ── Connect LinkedIn (connection engine state machine) ───────

export type ConnectionState =
  | 'idle'
  | 'creating_session'
  | 'session_created'
  | 'connecting_browser'
  | 'connected'
  | 'opening_linkedin'
  | 'ready_for_login'
  | 'authenticated'
  | 'requires_action'
  | 'session_expired'
  | 'session_invalid'
  | 'restricted'
  | 'disconnected'
  | 'failed';

export function useConnectLinkedIn() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { existingAccountId?: string; operationId: string }) => {
      if (!workspace) throw new Error('No workspace');
      const idempotencyKey = params.operationId;
      if (!idempotencyKey) throw new Error('LinkedIn connection operation ID is required');
      const startedAt = performance.now();
      console.info('[linkedin-queue-timing]', {
        stage: 'Q1_enqueue_started', workspaceId: workspace.id,
        supabaseHost: new URL(import.meta.env.VITE_SUPABASE_URL).hostname,
        timestamp: new Date().toISOString(),
      });
      const { data, error } = await supabase.rpc('start_linkedin_connection', {
        p_workspace_id: workspace.id,
        p_linkedin_email: null,
        p_display_name: null,
        p_expected_profile_url: null,
        p_existing_account_id: params.existingAccountId ?? null,
        p_idempotency_key: idempotencyKey,
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.account_id || !result?.queue_item_id) {
        throw new Error('Unable to start LinkedIn connection: no queue attempt was created. Please try again.');
      }
      const { data: queueItem, error: queueError } = await supabase
        .from('browser_execution_queue')
        .select('id, workspace_id, account_id, action_type, status, scheduled_at, next_retry_at, lease_expires_at')
        .eq('id', result.queue_item_id)
        .eq('workspace_id', workspace.id)
        .eq('account_id', result.account_id)
        .maybeSingle();
      if (queueError) throw queueError;
      if (!queueItem || queueItem.action_type !== 'linkedin_connect') {
        throw new Error('Unable to confirm the LinkedIn connection attempt. Please try again.');
      }
      if (['failed', 'cancelled'].includes(queueItem.status)) {
        throw new Error(`LinkedIn connection attempt is ${queueItem.status}. Please try again.`);
      }
      console.info('[linkedin-queue-timing]', {
        stage: 'Q2_queue_item_confirmed', queueItemId: queueItem.id, workspaceId: workspace.id,
        queueStatus: queueItem.status, elapsedMs: performance.now() - startedAt, timestamp: new Date().toISOString(),
      });
      return { accountId: result.account_id as string, queueItemId: queueItem.id as string, queueStatus: queueItem.status as string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['browser-exec-queue'] });
    },
  });
}

export function useLinkedInConnectionAttempt(queueItemId: string | null) {
  const { workspace } = useWorkspace();
  return useQuery<Pick<BrowserExecutionQueueItem, 'id' | 'account_id' | 'action_type' | 'status' | 'error' | 'created_at' | 'started_at' | 'completed_at'> | null>({
    queryKey: ['linkedin-connection-attempt', workspace?.id, queueItemId],
    queryFn: async () => {
      if (!workspace || !queueItemId) return null;
      const { data, error } = await supabase.from('browser_execution_queue')
        .select('id, account_id, action_type, status, error, created_at, started_at, completed_at')
        .eq('workspace_id', workspace.id).eq('id', queueItemId).maybeSingle();
      if (error) throw error;
      if (data && data.action_type !== 'linkedin_connect') throw new Error('Invalid LinkedIn connection queue attempt');
      return data as Pick<BrowserExecutionQueueItem, 'id' | 'account_id' | 'action_type' | 'status' | 'error' | 'created_at' | 'started_at' | 'completed_at'> | null;
    },
    enabled: !!workspace && !!queueItemId,
    refetchInterval: 1000,
  });
}

export function useTestLinkedInConnection() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      if (!workspace) throw new Error('No workspace selected');

      const { data, error: enqueueError } = await supabase.rpc(
        'enqueue_linkedin_connection_test',
        {
          p_workspace_id: workspace.id,
          p_account_id: accountId,
        },
      );

      if (enqueueError) {
        throw new Error(enqueueError.message || 'Failed to queue LinkedIn connection test');
      }

      const queueItemId = data as string | null;
      if (!queueItemId) {
        throw new Error('LinkedIn connection test was queued but no queue item ID was returned');
      }

      const timeoutMs = 60_000;
      const pollIntervalMs = 1_000;
      const startedAt = Date.now();

      while (Date.now() - startedAt < timeoutMs) {
        const { data: queueItem, error: queueError } = await supabase
          .from('browser_execution_queue')
          .select('id, status, error, result, worker_id, started_at, completed_at')
          .eq('id', queueItemId)
          .eq('workspace_id', workspace.id)
          .maybeSingle();

        if (queueError) {
          throw new Error(queueError.message || 'Unable to read LinkedIn connection test status');
        }

        if (!queueItem) {
          throw new Error('LinkedIn connection test queue item could not be found');
        }

        if (queueItem.status === 'completed') {
          return {
            queueItemId,
            message: 'LinkedIn connection is healthy',
            result: queueItem.result,
            completedAt: queueItem.completed_at,
          };
        }

        if (
          queueItem.status === 'failed' ||
          queueItem.status === 'dead_letter' ||
          queueItem.status === 'cancelled'
        ) {
          throw new Error(
            queueItem.error || `LinkedIn connection test ended with status: ${queueItem.status}`,
          );
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }

      throw new Error(
        'LinkedIn connection test timed out. The cloud worker did not finish within 60 seconds.',
      );
    },

    onSuccess: async () => {
      toast.success('LinkedIn connection is healthy');

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['browser-exec-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['linkedin-accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['linkedin-sessions'] }),
        queryClient.invalidateQueries({ queryKey: ['session-health'] }),
        queryClient.invalidateQueries({ queryKey: ['linkedin-diagnostics'] }),
      ]);
    },

    onError: (error: Error) => {
      toast.error(error.message || 'LinkedIn connection test failed');

      queryClient.invalidateQueries({ queryKey: ['browser-exec-queue'] });
      queryClient.invalidateQueries({ queryKey: ['linkedin-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['linkedin-diagnostics'] });
    },
  });
}

export function useDisconnectLinkedIn() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      if (!workspace) throw new Error('No workspace');

      const { error: cancelError } = await supabase.rpc('cancel_account_browser_executions', {
        p_workspace_id: workspace.id,
        p_account_id: accountId,
      });
      if (cancelError) throw cancelError;

      await supabase
        .from('linkedin_sessions')
        .update({ status: 'revoked' })
        .eq('account_id', accountId)
        .eq('workspace_id', workspace.id);
      // RLS ensures only workspace members can update

      await supabase
        .from('linkedin_session_backups')
        .delete()
        .eq('account_id', accountId)
        .eq('workspace_id', workspace.id);

      const { error } = await supabase
        .from('linkedin_accounts')
        .update({
          connection_state: 'disconnected',
          session_status: 'disconnected',
          status: 'disconnected',
          last_error: null,
        })
        .eq('id', accountId)
        .eq('workspace_id', workspace.id);
      if (error) throw error;

      await supabase
        .from('linkedin_session_events')
        .insert({
          workspace_id: workspace.id,
          account_id: accountId,
          event_type: 'revoked',
          event_data: { reason: 'user_disconnect' },
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['linkedin-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['browser-exec-queue'] });
    },
  });
}

export function useToggleDryRun() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { accountId: string; enabled: boolean }) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase
        .from('linkedin_accounts')
        .update({ dry_run_enabled: params.enabled })
        .eq('id', params.accountId)
        .eq('workspace_id', workspace.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-accounts'] });
    },
  });
}

export function useDeleteLinkedInAccount() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase
        .from('linkedin_accounts')
        .delete()
        .eq('id', accountId)
        .eq('workspace_id', workspace?.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['linkedin-accounts'] }),
  });
}

// ── LinkedIn Sessions ────────────────────────────────────────

export function useLinkedInSessions(accountId?: string) {
  const { workspace } = useWorkspace();
  return useQuery<LinkedInSession[]>({
    queryKey: ['linkedin-sessions', workspace?.id, accountId],
    queryFn: async () => {
      if (!workspace) return [];
      let query = supabase
        .from('linkedin_session_public_view')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('updated_at', { ascending: false });
      if (accountId) query = query.eq('account_id', accountId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as LinkedInSession[];
    },
    enabled: !!workspace,
  });
}

export function useDeleteLinkedInSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.from('linkedin_sessions').delete().eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['linkedin-sessions'] }),
  });
}

// ── Session Health ────────────────────────────────────────────

export function useSessionHealth(accountId?: string) {
  const { workspace } = useWorkspace();
  return useQuery<{
    id: string;
    account_id: string;
    health_status: string;
    connection_state: string;
    last_validated_at: string | null;
    last_activity_at: string | null;
    authenticated: boolean;
    failure_reason: string | null;
    retry_count: number;
  } | null>({
    queryKey: ['session-health', workspace?.id, accountId],
    queryFn: async () => {
      if (!workspace || !accountId) return null;
      const { data, error } = await supabase
        .from('linkedin_session_public_view')
        .select('id, account_id, health_status, connection_state, last_validated_at, last_activity_at, authenticated, failure_reason, retry_count')
        .eq('workspace_id', workspace.id)
        .eq('account_id', accountId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!workspace && !!accountId,
    refetchInterval: 15000,
  });
}

export function useRefreshSession() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase
        .from('browser_execution_queue')
        .insert({
          workspace_id: workspace.id,
          account_id: accountId,
          action_type: 'linkedin_test_connection',
          action_params: { account_id: accountId, refresh: true },
          priority: 2,
          priority_label: 'high',
          status: 'pending',
        });
      if (error) throw error;
      return { message: 'Session refresh queued.' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['browser-exec-queue'] });
      queryClient.invalidateQueries({ queryKey: ['session-health'] });
    },
  });
}

// ── Session Backups ──────────────────────────────────────────

export function useLinkedInSessionBackups(accountId?: string) {
  const { workspace } = useWorkspace();
  return useQuery<LinkedInSessionBackup[]>({
    queryKey: ['linkedin-session-backups', workspace?.id, accountId],
    queryFn: async () => {
      if (!workspace) return [];
      let query = supabase
        .from('linkedin_session_backups')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });
      if (accountId) query = query.eq('account_id', accountId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as LinkedInSessionBackup[];
    },
    enabled: !!workspace,
  });
}

// ── Login History ──────────────────────────────────────────────

export function useLinkedInLoginHistory(accountId?: string) {
  const { workspace } = useWorkspace();
  return useQuery<LinkedInLoginHistory[]>({
    queryKey: ['linkedin-login-history', workspace?.id, accountId],
    queryFn: async () => {
      if (!workspace) return [];
      let query = supabase
        .from('linkedin_login_history')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (accountId) query = query.eq('account_id', accountId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as LinkedInLoginHistory[];
    },
    enabled: !!workspace,
  });
}

// ── Devices ──────────────────────────────────────────────────

export function useLinkedInDevices(accountId?: string) {
  const { workspace } = useWorkspace();
  return useQuery<LinkedInDevice[]>({
    queryKey: ['linkedin-devices', workspace?.id, accountId],
    queryFn: async () => {
      if (!workspace) return [];
      let query = supabase
        .from('linkedin_devices')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });
      if (accountId) query = query.eq('account_id', accountId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as LinkedInDevice[];
    },
    enabled: !!workspace,
  });
}

// ── Session Events ────────────────────────────────────────────

export function useLinkedInSessionEvents(accountId?: string, limit = 50) {
  const { workspace } = useWorkspace();
  return useQuery<LinkedInSessionEvent[]>({
    queryKey: ['linkedin-session-events', workspace?.id, accountId, limit],
    queryFn: async () => {
      if (!workspace) return [];
      let query = supabase
        .from('linkedin_session_events')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (accountId) query = query.eq('account_id', accountId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as LinkedInSessionEvent[];
    },
    enabled: !!workspace,
  });
}

// ── Execution Queue ──────────────────────────────────────────

export function useBrowserExecutionQueue(status?: string) {
  const { workspace } = useWorkspace();
  return useQuery<BrowserExecutionQueueItem[]>({
    queryKey: ['browser-exec-queue', workspace?.id, status],
    queryFn: async () => {
      if (!workspace) return [];
      let query = supabase
        .from('browser_execution_queue')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(100);
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as BrowserExecutionQueueItem[];
    },
    enabled: !!workspace,
    refetchInterval: 5000,
  });
}

export function useEnqueueExecution() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      actionType: string;
      actionParams: Record<string, unknown>;
      priority?: number;
      accountId?: string;
      sessionId?: string;
    }) => {
      if (!workspace) throw new Error('No workspace');
      const { data, error } = await supabase
        .from('browser_execution_queue')
        .insert({
          workspace_id: workspace.id,
          account_id: params.accountId ?? null,
          session_id: params.sessionId ?? null,
          action_type: params.actionType,
          action_params: params.actionParams,
          priority: params.priority ?? 3,
          priority_label: params.priority === 1 ? 'critical' : params.priority === 2 ? 'high' : params.priority === 4 ? 'low' : 'medium',
          status: 'pending',
        })
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['browser-exec-queue'] }),
  });
}

export function useCancelExecution() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.rpc('cancel_browser_execution', {
        p_workspace_id: workspace.id,
        p_task_id: itemId,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['browser-exec-queue'] }),
  });
}

export function useBrowserExecutionHistory(limit = 50) {
  const { workspace } = useWorkspace();
  return useQuery<BrowserExecutionHistory[]>({
    queryKey: ['browser-exec-history', workspace?.id, limit],
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('browser_execution_history')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as BrowserExecutionHistory[];
    },
    enabled: !!workspace,
  });
}

export function useBrowserExecutionFailures(resolved?: boolean) {
  const { workspace } = useWorkspace();
  return useQuery<BrowserExecutionFailure[]>({
    queryKey: ['browser-exec-failures', workspace?.id, resolved],
    queryFn: async () => {
      if (!workspace) return [];
      let query = supabase
        .from('browser_execution_failures')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (resolved !== undefined) query = query.eq('resolved', resolved);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as BrowserExecutionFailure[];
    },
    enabled: !!workspace,
    refetchInterval: 15000,
  });
}

export function useResolveExecutionFailure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (failureId: string) => {
      const { error } = await supabase
        .from('browser_execution_failures')
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', failureId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['browser-exec-failures'] }),
  });
}

export function useBrowserRetryQueue() {
  const { workspace } = useWorkspace();
  return useQuery<BrowserRetryQueueItem[]>({
    queryKey: ['browser-retry-queue', workspace?.id],
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('browser_retry_queue')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('next_retry_at', { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as BrowserRetryQueueItem[];
    },
    enabled: !!workspace,
    refetchInterval: 10000,
  });
}

export function useBrowserDeadLetterQueue() {
  const { workspace } = useWorkspace();
  return useQuery<BrowserDeadLetterItem[]>({
    queryKey: ['browser-dlq', workspace?.id],
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('browser_dead_letter_queue')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as BrowserDeadLetterItem[];
    },
    enabled: !!workspace,
  });
}

// ── Auth Interactions (live progress + challenges) ───────────

export function useAuthInteractions(accountId: string | null) {
  const { workspace } = useWorkspace();
  return useQuery<LinkedInAuthInteraction[]>({
    queryKey: ['linkedin-auth-interactions', workspace?.id, accountId],
    queryFn: async () => {
      if (!workspace || !accountId) return [];
      const { data, error } = await supabase
        .from('linkedin_auth_interactions')
        .select('*')
        .eq('workspace_id', workspace.id)
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return ((data ?? []) as LinkedInAuthInteraction[]).reverse();
    },
    enabled: !!workspace && !!accountId,
    refetchInterval: 2000,
  });
}

export function useCancelAuthInteraction() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (interaction: LinkedInAuthInteraction) => {
      const { error } = await supabase
        .from('linkedin_auth_interactions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', interaction.id);
      if (error) throw error;
      if (interaction.queue_item_id) {
        if (!workspace) throw new Error('No workspace');
        const { error: queueError } = await supabase.rpc('cancel_browser_execution', {
          p_workspace_id: workspace.id,
          p_task_id: interaction.queue_item_id,
        });
        if (queueError) throw queueError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-auth-interactions'] });
    },
  });
}

export function useSessionHeartbeats(accountId?: string) {
  const { workspace } = useWorkspace();
  return useQuery<LinkedInSessionHeartbeat[]>({
    queryKey: ['linkedin-session-heartbeats', workspace?.id, accountId],
    queryFn: async () => {
      if (!workspace) return [];
      let query = supabase
        .from('linkedin_session_heartbeats')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (accountId) query = query.eq('account_id', accountId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as LinkedInSessionHeartbeat[];
    },
    enabled: !!workspace,
    refetchInterval: 30000,
  });
}

// ── Conversations ──────────────────────────────────────────────

export function useLinkedInConversations() {
  const { workspace } = useWorkspace();
  return useQuery<LinkedInConversation[]>({
    queryKey: ['linkedin-conversations', workspace?.id],
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('linkedin_conversations')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('last_message_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).filter((row) => !isTestFixture(row as Record<string, unknown>)) as LinkedInConversation[];
    },
    enabled: !!workspace,
    refetchInterval: 15000,
  });
}

export function useLinkedInMessages(conversationId: string | null) {
  return useQuery<LinkedInMessage[]>({
    queryKey: ['linkedin-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from('linkedin_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as LinkedInMessage[];
    },
    enabled: !!conversationId,
  });
}

export function useApproveMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { messageId: string; userId: string }) => {
      const { error } = await supabase
        .from('linkedin_messages')
        .update({ approved: true, approved_by: params.userId, approved_at: new Date().toISOString() })
        .eq('id', params.messageId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['linkedin-messages'] }),
  });
}

// ── Calendar & Meetings ────────────────────────────────────────

export function useCalendarConnections() {
  const { workspace } = useWorkspace();
  return useQuery<CalendarConnection[]>({
    queryKey: ['calendar-connections', workspace?.id],
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('google_accounts')
        .select('id,workspace_id,email,status,is_primary,connected_at,last_synced_at')
        .eq('workspace_id', workspace.id)
        .in('status', ['connected', 'expired'])
        .order('is_primary', { ascending: false })
        .order('connected_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        workspace_id: row.workspace_id,
        provider: 'google' as const,
        email: row.email,
        status: row.status === 'expired' ? 'expired' as const : 'active' as const,
        calendar_id: 'primary',
        last_synced_at: row.last_synced_at,
        metadata: { google_account_id: row.id, is_primary: row.is_primary },
        created_at: row.connected_at,
        updated_at: row.last_synced_at ?? row.connected_at,
      }));
    },
    enabled: !!workspace,
  });
}

export function useMeetingRequests() {
  const { workspace } = useWorkspace();
  return useQuery<LinkedInMeetingRequest[]>({
    queryKey: ['meeting-requests', workspace?.id],
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('linkedin_meeting_requests')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as LinkedInMeetingRequest[];
    },
    enabled: !!workspace,
  });
}

export function useMeetingSlots(meetingRequestId: string | null) {
  return useQuery<LinkedInMeetingSlot[]>({
    queryKey: ['meeting-slots', meetingRequestId],
    queryFn: async () => {
      if (!meetingRequestId) return [];
      const { data, error } = await supabase
        .from('linkedin_meeting_slots')
        .select('*')
        .eq('meeting_request_id', meetingRequestId)
        .order('start_time', { ascending: true });
      if (error) throw error;
      return (data ?? []) as LinkedInMeetingSlot[];
    },
    enabled: !!meetingRequestId,
  });
}

export function useMeetingConfirmations() {
  const { workspace } = useWorkspace();
  return useQuery<LinkedInMeetingConfirmation[]>({
    queryKey: ['meeting-confirmations', workspace?.id],
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('linkedin_meeting_confirmations')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as LinkedInMeetingConfirmation[];
    },
    enabled: !!workspace,
  });
}
