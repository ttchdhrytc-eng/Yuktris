import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { revenueForecastService } from '@/services/revenue-forecast';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export const revenueForecastKeys = {
  all: ['revenue-forecast'] as const,
  commandCenter: (wsId: string) => ['revenue-forecast', 'command-center', wsId] as const,
};

export function useRevenueCommandCenter() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: revenueForecastKeys.commandCenter(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      return revenueForecastService.loadCommandCenter(workspace.id);
    },
    refetchInterval: 15000,
  });
}

export function useSyncPipeline() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return revenueForecastService.syncPipeline(workspace.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: revenueForecastKeys.all });
      toast.success('Pipeline synced from all phases.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGenerateForecast() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (forecastType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual') => {
      if (!workspace) throw new Error('No workspace');
      return revenueForecastService.generateRevenueForecast(workspace.id, forecastType);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: revenueForecastKeys.all });
      toast.success('Revenue forecast generated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCalculatePipelineHealth() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return revenueForecastService.calculatePipelineHealth(workspace.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: revenueForecastKeys.all });
      toast.success('Pipeline health calculated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCalculateMRR() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return revenueForecastService.calculateMRR(workspace.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: revenueForecastKeys.all });
      toast.success('MRR/ARR calculated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGenerateExecutiveSummary() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (summaryType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'board') => {
      if (!workspace) throw new Error('No workspace');
      return revenueForecastService.generateExecutiveSummary(workspace.id, summaryType);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: revenueForecastKeys.all });
      toast.success('Executive summary generated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGenerateRevenueAlerts() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return revenueForecastService.generateRevenueAlerts(workspace.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: revenueForecastKeys.all });
      toast.success('Revenue alerts generated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGenerateRevenueInsights() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return revenueForecastService.generateRevenueInsights(workspace.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: revenueForecastKeys.all });
      toast.success('Revenue insights generated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
