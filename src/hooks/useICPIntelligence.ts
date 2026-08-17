// ============================================================
// React Query Hooks — ICP Intelligence Agent
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { icpService, ICP_STAGES } from '@/services/icp-intelligence';
import type { FullICP, ICP } from '@/types/icp-intelligence';

// ============================================================
// Query Keys
// ============================================================

export const icpKeys = {
  all: ['icp-intelligence'] as const,
  list: (wsId: string, company: string) => [...icpKeys.all, 'list', wsId, company] as const,
  detail: (id: string) => [...icpKeys.all, 'detail', id] as const,
};

// ============================================================
// useICP — Load all ICPs for workspace
// ============================================================

export function useICP() {
  const { workspace, selectedCompany } = useWorkspace();

  return useQuery({
    queryKey: icpKeys.list(workspace?.id ?? '', selectedCompany ?? ''),
    enabled: !!workspace?.id,
    queryFn: async (): Promise<FullICP[]> => {
      if (!workspace) return [];
      return icpService.loadAllICPs(workspace.id, selectedCompany);
    },
  });
}

// ============================================================
// useGenerateICP — Generate ICPs from persisted business/market research
// ============================================================

export function useGenerateICP() {
  const { workspace, selectedCompany } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<FullICP[]> => {
      if (!workspace) throw new Error('No active workspace');
      const result = await icpService.generateFullPipeline(workspace.id, selectedCompany);
      return result.icps;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: icpKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'ICP generation failed. Please try again.');
    },
  });
}

// ============================================================
// useRefreshICP — Regenerate ICPs from the latest research
// ============================================================

export function useRefreshICP() {
  const { workspace, selectedCompany } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (icpId: string): Promise<void> => {
      if (!workspace) throw new Error('No active workspace');
      await icpService.refreshICP(icpId);
      await icpService.generateFullPipeline(workspace.id, selectedCompany);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: icpKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Refresh failed. Please try again.');
    },
  });
}

// ============================================================
// useDeleteICP — Delete an ICP
// ============================================================

export function useDeleteICP() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (icpId: string): Promise<void> => {
      await icpService.deleteICP(icpId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: icpKeys.all });
      toast.success('ICP deleted successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete ICP.');
    },
  });
}

// ============================================================
// usePrimaryICP — Set an ICP as primary
// ============================================================

export function usePrimaryICP() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (icpId: string): Promise<void> => {
      if (!workspace) throw new Error('No active workspace');
      await icpService.setPrimaryICP(icpId, workspace.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: icpKeys.all });
      toast.success('Primary ICP updated.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to set primary ICP.');
    },
  });
}

// ============================================================
// useUpdateICP — Update ICP fields
// ============================================================

export function useUpdateICP() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ICP> }): Promise<ICP> => {
      const { data, error } = await supabase
        .from('icps')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data as ICP;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: icpKeys.all });
      toast.success('ICP updated.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update ICP.');
    },
  });
}
