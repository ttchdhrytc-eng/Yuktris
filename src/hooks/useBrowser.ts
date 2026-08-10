// ============================================================
// useBrowser — React Query hooks for browser automation
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type {
  BrowserWorker, BrowserHealth, BrowserSession,
  BrowserQueueItem, BrowserLog, BrowserError,
  BrowserScreenshot, QueueStatus, ActionType,
} from '@/types/browser-automation';

const FUNCTION_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const HEADERS = {
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

// ── Workers ────────────────────────────────────────────────

export function useBrowserWorkers() {
  const { workspace } = useWorkspace();
  return useQuery<BrowserWorker[]>({
    queryKey: ['browser-workers', workspace?.id],
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('browser_workers')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as BrowserWorker[];
    },
    enabled: !!workspace,
    refetchInterval: 5000,
  });
}

// ── Health ─────────────────────────────────────────────────

export function useBrowserHealth(workerId?: string) {
  const { workspace } = useWorkspace();
  return useQuery<BrowserHealth[]>({
    queryKey: ['browser-health', workspace?.id, workerId],
    queryFn: async () => {
      if (!workspace) return [];
      let query = supabase
        .from('browser_health')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('recorded_at', { ascending: false })
        .limit(100);
      if (workerId) query = query.eq('worker_id', workerId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as BrowserHealth[];
    },
    enabled: !!workspace,
    refetchInterval: 10000,
  });
}

// ── Sessions ───────────────────────────────────────────────

export function useBrowserSessions() {
  const { workspace } = useWorkspace();
  return useQuery<BrowserSession[]>({
    queryKey: ['browser-sessions', workspace?.id],
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('browser_sessions')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BrowserSession[];
    },
    enabled: !!workspace,
  });
}

export function useDeleteBrowserSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('browser_sessions')
        .delete()
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['browser-sessions'] });
    },
  });
}

// ── Queue ──────────────────────────────────────────────────

export function useBrowserQueue(status?: QueueStatus) {
  const { workspace } = useWorkspace();
  return useQuery<BrowserQueueItem[]>({
    queryKey: ['browser-queue', workspace?.id, status],
    queryFn: async () => {
      if (!workspace) return [];
      let query = supabase
        .from('browser_queue')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(100);
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as BrowserQueueItem[];
    },
    enabled: !!workspace,
    refetchInterval: 5000,
  });
}

export function useEnqueueBrowserAction() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      actionType: ActionType;
      actionParams: Record<string, unknown>;
      priority?: number;
      sessionId?: string;
      workerId?: string;
    }) => {
      if (!workspace) throw new Error('No workspace');
      const { data, error } = await supabase
        .from('browser_queue')
        .insert({
          workspace_id: workspace.id,
          worker_id: params.workerId ?? null,
          session_id: params.sessionId ?? null,
          action_type: params.actionType,
          action_params: params.actionParams,
          priority: params.priority ?? 5,
          status: 'pending',
        })
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['browser-queue'] });
    },
  });
}

export function useCancelBrowserQueueItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (queueId: string) => {
      const { error } = await supabase
        .from('browser_queue')
        .update({ status: 'cancelled', completed_at: new Date().toISOString() })
        .eq('id', queueId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['browser-queue'] });
    },
  });
}

export function useRetryBrowserQueueItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (queueId: string) => {
      const { error } = await supabase
        .from('browser_queue')
        .update({ status: 'pending', error: null, retry_count: 0 })
        .eq('id', queueId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['browser-queue'] });
    },
  });
}

// ── Logs ───────────────────────────────────────────────────

export function useBrowserLogs(limit = 100) {
  const { workspace } = useWorkspace();
  return useQuery<BrowserLog[]>({
    queryKey: ['browser-logs', workspace?.id, limit],
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('browser_logs')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as BrowserLog[];
    },
    enabled: !!workspace,
    refetchInterval: 10000,
  });
}

// ── Errors ─────────────────────────────────────────────────

export function useBrowserErrors(resolved?: boolean) {
  const { workspace } = useWorkspace();
  return useQuery<BrowserError[]>({
    queryKey: ['browser-errors', workspace?.id, resolved],
    queryFn: async () => {
      if (!workspace) return [];
      let query = supabase
        .from('browser_errors')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (resolved !== undefined) query = query.eq('resolved', resolved);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as BrowserError[];
    },
    enabled: !!workspace,
    refetchInterval: 10000,
  });
}

export function useResolveBrowserError() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (errorId: string) => {
      const { error } = await supabase
        .from('browser_errors')
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', errorId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['browser-errors'] });
    },
  });
}

// ── Screenshots ────────────────────────────────────────────

export function useBrowserScreenshots(limit = 50) {
  const { workspace } = useWorkspace();
  return useQuery<BrowserScreenshot[]>({
    queryKey: ['browser-screenshots', workspace?.id, limit],
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('browser_screenshots')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as BrowserScreenshot[];
    },
    enabled: !!workspace,
  });
}

// ── Edge Function Actions ───────────────────────────────────

export function useLaunchBrowserPool() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (poolSize: number) => {
      const response = await fetch(`${FUNCTION_BASE}/browser-launch`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ workspace_id: workspace?.id, pool_size: poolSize }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Launch failed' }));
        throw new Error((err as Record<string, string>).error ?? `Failed (${response.status})`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['browser-workers'] });
    },
  });
}

export function useCloseBrowserPool() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`${FUNCTION_BASE}/browser-close`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ workspace_id: workspace?.id }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Close failed' }));
        throw new Error((err as Record<string, string>).error ?? `Failed (${response.status})`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['browser-workers'] });
    },
  });
}

export function useProcessBrowserQueue() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (batchSize?: number) => {
      const response = await fetch(`${FUNCTION_BASE}/browser-worker`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          workspace_id: workspace?.id,
          batch_size: batchSize ?? 10,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Queue processing failed' }));
        throw new Error((err as Record<string, string>).error ?? `Failed (${response.status})`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['browser-queue'] });
      queryClient.invalidateQueries({ queryKey: ['browser-workers'] });
    },
  });
}
