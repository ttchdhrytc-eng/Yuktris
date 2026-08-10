// ============================================================
// Gmail — React Query Hooks
// All operations route through CommunicationProviderManager,
// which is the single execution path to GmailProvider → GmailService.
// No hook calls GmailService directly.
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { communicationProviderManager } from '@/services/providers';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type {
  GmailConnectionState,
  GmailMessage,
  GmailThread,
  SendEmailParams,
  ReplyEmailParams,
  SearchParams,
  SyncResult,
} from '@/types/gmail';

// ============================================================
// Query Keys
// ============================================================

export const gmailKeys = {
  all: ['gmail'] as const,
  connection: (wsId: string) => [...gmailKeys.all, 'connection', wsId] as const,
  messages: (accId: string, filter?: string) => [...gmailKeys.all, 'messages', accId, filter ?? 'all'] as const,
  threads: (accId: string) => [...gmailKeys.all, 'threads', accId] as const,
  search: (accId: string, query: string) => [...gmailKeys.all, 'search', accId, query] as const,
};

// ============================================================
// useGmail — Get Gmail connection state (account, counts, status)
// ============================================================

export function useGmail() {
  const { workspace } = useWorkspace();

  return useQuery<GmailConnectionState>({
    queryKey: gmailKeys.connection(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return communicationProviderManager.gmailGetConnectionState(workspace.id);
    },
    refetchInterval: 300_000, // 5 minutes
  });
}

// ============================================================
// useInbox — Get inbox messages
// ============================================================

export function useInbox(options?: { unreadOnly?: boolean; limit?: number; includeArchived?: boolean }) {
  const { workspace } = useWorkspace();
  const gmailConnection = useGmail();
  const gmailAccountId = gmailConnection.data?.account?.id ?? '';

  return useQuery<GmailMessage[]>({
    queryKey: gmailKeys.messages(gmailAccountId, options?.unreadOnly ? 'unread' : options?.includeArchived ? 'archived' : 'all'),
    enabled: !!gmailAccountId,
    queryFn: async () => {
      if (!gmailAccountId) return [];
      return communicationProviderManager.gmailGetMessages(gmailAccountId, {
        unreadOnly: options?.unreadOnly,
        limit: options?.limit ?? 50,
        includeArchived: options?.includeArchived,
      });
    },
    refetchInterval: 300_000, // 5 minutes
  });
}

// ============================================================
// useThreads — Get email threads
// ============================================================

export function useThreads(limit?: number) {
  const { workspace } = useWorkspace();
  const gmailConnection = useGmail();
  const gmailAccountId = gmailConnection.data?.account?.id ?? '';

  return useQuery<GmailThread[]>({
    queryKey: gmailKeys.threads(gmailAccountId),
    enabled: !!gmailAccountId,
    queryFn: async () => {
      if (!gmailAccountId) return [];
      return communicationProviderManager.gmailGetThreads(gmailAccountId, limit ?? 50);
    },
    refetchInterval: 300_000, // 5 minutes
  });
}

// ============================================================
// useSendEmail — Send a new email
// ============================================================

export function useSendEmail() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SendEmailParams) => {
      if (!workspace) throw new Error('No workspace');
      return communicationProviderManager.gmailSendEmail(workspace.id, params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.all });
      toast.success('Email sent successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to send email.');
    },
  });
}

// ============================================================
// useReplyEmail — Reply to an email thread
// ============================================================

export function useReplyEmail() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ReplyEmailParams) => {
      if (!workspace) throw new Error('No workspace');
      return communicationProviderManager.gmailReplyEmail(workspace.id, params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.all });
      toast.success('Reply sent successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to send reply.');
    },
  });
}

// ============================================================
// useSearch — Search emails via Gmail API
// ============================================================

export function useSearch() {
  const { workspace } = useWorkspace();
  const gmailConnection = useGmail();
  const gmailAccountId = gmailConnection.data?.account?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SearchParams) => {
      if (!workspace || !gmailAccountId) throw new Error('Gmail not connected');
      return communicationProviderManager.gmailSearch(workspace.id, gmailAccountId, params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Search failed.');
    },
  });
}

// ============================================================
// useConnectGmail — Connect Gmail for the workspace
// ============================================================

export function useConnectGmail() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return communicationProviderManager.gmailConnect(workspace.id);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.all });
      if (data.connected) {
        toast.success('Gmail connected successfully.');
      } else {
        toast.error(data.error ?? 'Failed to connect Gmail.');
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to connect Gmail.');
    },
  });
}

// ============================================================
// useDisconnectGmail — Disconnect Gmail
// ============================================================

export function useDisconnectGmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (gmailAccountId: string) => {
      return communicationProviderManager.gmailDisconnect(gmailAccountId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.all });
      toast.success('Gmail disconnected.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to disconnect Gmail.');
    },
  });
}

// ============================================================
// useSyncInbox — Sync inbox from Gmail API
// ============================================================

export function useSyncInbox() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const gmailConnection = useGmail();
  const gmailAccountId = gmailConnection.data?.account?.id ?? '';

  return useMutation<SyncResult, Error>({
    mutationFn: async (pageToken?: string) => {
      if (!workspace || !gmailAccountId) throw new Error('Gmail not connected');
      return communicationProviderManager.gmailSyncInbox(workspace.id, gmailAccountId, pageToken);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.all });
      if (data.errors > 0 && data.synced === 0) {
        toast.error('Inbox sync failed. Please try again.');
      } else if (data.errors > 0) {
        toast.warning(`Synced ${data.synced} messages with ${data.errors} errors.`);
      } else {
        toast.success(`Synced ${data.synced} messages.`);
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Sync failed.');
    },
  });
}

// ============================================================
// useRefreshGmail — Refresh unread count and sync status
// ============================================================

export function useRefreshGmail() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const gmailConnection = useGmail();
  const gmailAccountId = gmailConnection.data?.account?.id ?? '';

  return useMutation({
    mutationFn: async () => {
      if (!workspace || !gmailAccountId) throw new Error('Gmail not connected');
      return communicationProviderManager.gmailRefresh(workspace.id, gmailAccountId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Refresh failed.');
    },
  });
}

// ============================================================
// useMarkAsRead / useMarkAsUnread / useStar / useArchive
// Now sync to Gmail API AND Supabase
// ============================================================

export function useMarkAsRead() {
  const { workspace } = useWorkspace();
  const gmailConnection = useGmail();
  const gmailAccountId = gmailConnection.data?.account?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (googleMessageId: string) => {
      if (!workspace || !gmailAccountId) throw new Error('Gmail not connected');
      return communicationProviderManager.gmailMarkAsRead(workspace.id, gmailAccountId, googleMessageId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gmailKeys.all }),
    onError: (err: Error) => toast.error(err.message || 'Failed to mark as read.'),
  });
}

export function useMarkAsUnread() {
  const { workspace } = useWorkspace();
  const gmailConnection = useGmail();
  const gmailAccountId = gmailConnection.data?.account?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (googleMessageId: string) => {
      if (!workspace || !gmailAccountId) throw new Error('Gmail not connected');
      return communicationProviderManager.gmailMarkAsUnread(workspace.id, gmailAccountId, googleMessageId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gmailKeys.all }),
    onError: (err: Error) => toast.error(err.message || 'Failed to mark as unread.'),
  });
}

export function useStarEmail() {
  const { workspace } = useWorkspace();
  const gmailConnection = useGmail();
  const gmailAccountId = gmailConnection.data?.account?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (googleMessageId: string) => {
      if (!workspace || !gmailAccountId) throw new Error('Gmail not connected');
      return communicationProviderManager.gmailStar(workspace.id, gmailAccountId, googleMessageId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gmailKeys.all }),
    onError: (err: Error) => toast.error(err.message || 'Failed to star email.'),
  });
}

export function useUnstarEmail() {
  const { workspace } = useWorkspace();
  const gmailConnection = useGmail();
  const gmailAccountId = gmailConnection.data?.account?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (googleMessageId: string) => {
      if (!workspace || !gmailAccountId) throw new Error('Gmail not connected');
      return communicationProviderManager.gmailUnstar(workspace.id, gmailAccountId, googleMessageId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gmailKeys.all }),
    onError: (err: Error) => toast.error(err.message || 'Failed to unstar email.'),
  });
}

export function useArchiveEmail() {
  const { workspace } = useWorkspace();
  const gmailConnection = useGmail();
  const gmailAccountId = gmailConnection.data?.account?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (googleMessageId: string) => {
      if (!workspace || !gmailAccountId) throw new Error('Gmail not connected');
      return communicationProviderManager.gmailArchive(workspace.id, gmailAccountId, googleMessageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.all });
      toast.success('Email archived.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to archive email.');
    },
  });
}

export function useUnarchiveEmail() {
  const { workspace } = useWorkspace();
  const gmailConnection = useGmail();
  const gmailAccountId = gmailConnection.data?.account?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (googleMessageId: string) => {
      if (!workspace || !gmailAccountId) throw new Error('Gmail not connected');
      return communicationProviderManager.gmailUnarchive(workspace.id, gmailAccountId, googleMessageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.all });
      toast.success('Email moved back to inbox.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to unarchive email.');
    },
  });
}

// ============================================================
// useIncrementalSync — Incremental sync using historyId
// ============================================================

export function useIncrementalSync() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const gmailConnection = useGmail();
  const gmailAccountId = gmailConnection.data?.account?.id ?? '';

  return useMutation<SyncResult, Error>({
    mutationFn: async () => {
      if (!workspace || !gmailAccountId) throw new Error('Gmail not connected');
      return communicationProviderManager.gmailIncrementalSync(workspace.id, gmailAccountId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.all });
      if (data.synced > 0) {
        toast.success(`Synced ${data.synced} new messages.`);
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Incremental sync failed.');
    },
  });
}
