import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { linkedinExecutionService, linkedinAccountService } from '@/services/linkedin-operations';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export const linkedinOpsKeys = {
  all: ['linkedin-operations'] as const,
  dashboard: (wsId: string) => ['linkedin-operations', 'dashboard', wsId] as const,
  accounts: (wsId: string) => ['linkedin-operations', 'accounts', wsId] as const,
  jobs: (wsId: string) => ['linkedin-operations', 'jobs', wsId] as const,
  queue: (wsId: string) => ['linkedin-operations', 'queue', wsId] as const,
  history: (wsId: string) => ['linkedin-operations', 'history', wsId] as const,
  usage: (wsId: string) => ['linkedin-operations', 'usage', wsId] as const,
  health: (wsId: string) => ['linkedin-operations', 'health', wsId] as const,
  limits: (wsId: string) => ['linkedin-operations', 'limits', wsId] as const,
  sequences: (wsId: string) => ['linkedin-operations', 'sequences', wsId] as const,
  monitor: (wsId: string) => ['linkedin-operations', 'monitor', wsId] as const,
};

export function useLinkedInOpsDashboard() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: linkedinOpsKeys.dashboard(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      return linkedinExecutionService.loadDashboard(workspace.id);
    },
    refetchInterval: 5000,
  });
}

export function useLinkedInAccounts() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: linkedinOpsKeys.accounts(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      return linkedinAccountService.loadAccounts(workspace.id);
    },
  });
}

export function useLinkedInMonitor() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: linkedinOpsKeys.monitor(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      return linkedinExecutionService.getAIMonitor(workspace.id);
    },
    refetchInterval: 5000,
  });
}

export function useStartLinkedInExecution() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return linkedinExecutionService.startExecution(workspace.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: linkedinOpsKeys.all });
      toast.success('LinkedIn execution started for approved prospects.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to start execution.'),
  });
}

export function useConnectLinkedInAccount() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { profile_url: string; display_name: string; headline?: string; session_token?: string }) => {
      if (!workspace) throw new Error('No workspace');
      return linkedinAccountService.createAccount(workspace.id, params);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: linkedinOpsKeys.all });
      toast.success('LinkedIn account added. Browser authentication task has been queued — complete the login in the browser window to connect.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to connect account.'),
  });
}

export function useDeleteLinkedInAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      console.warn('[FORENSIC] DELETE linkedin_accounts PRE-EXECUTION', {
        file: 'src/hooks/useLinkedInOperations.ts',
        function: 'useDeleteLinkedInAccount',
        accountId,
        timestamp: new Date().toISOString(),
        stack: new Error().stack,
      });
      return linkedinAccountService.deleteAccount(accountId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: linkedinOpsKeys.all });
      toast.success('LinkedIn account removed.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateLinkedInLimits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ accountId, limits }: { accountId: string; limits: Record<string, number> }) => {
      return linkedinAccountService.updateLimits(accountId, limits);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: linkedinOpsKeys.all });
      toast.success('Limits updated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
