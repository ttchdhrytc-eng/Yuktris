import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { customerSuccessService } from '@/services/customer-success';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export const customerSuccessKeys = {
  all: ['customer-success'] as const,
  commandCenter: (wsId: string) => ['customer-success', 'command-center', wsId] as const,
};

export function useCustomerSuccessCommandCenter() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: customerSuccessKeys.commandCenter(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      return customerSuccessService.loadCommandCenter(workspace.id);
    },
    refetchInterval: 15000,
  });
}

export function useSyncCustomers() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return customerSuccessService.syncCustomers(workspace.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerSuccessKeys.all });
      toast.success('Customers synced from closed-won deals.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCalculateHealth() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      if (!workspace) throw new Error('No workspace');
      return customerSuccessService.calculateHealthScore(workspace.id, accountId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerSuccessKeys.all });
      toast.success('Customer health calculated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePredictChurn() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      if (!workspace) throw new Error('No workspace');
      return customerSuccessService.predictChurn(workspace.id, accountId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerSuccessKeys.all });
      toast.success('Churn prediction generated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDetectExpansion() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      if (!workspace) throw new Error('No workspace');
      return customerSuccessService.detectExpansionOpportunity(workspace.id, accountId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerSuccessKeys.all });
      toast.success('Expansion opportunities detected.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDetectRenewalRisk() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return customerSuccessService.detectRenewalRisk(workspace.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerSuccessKeys.all });
      toast.success('Renewal risk assessed.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGenerateSuccessPlan() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      if (!workspace) throw new Error('No workspace');
      return customerSuccessService.generateCustomerSuccessPlan(workspace.id, accountId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerSuccessKeys.all });
      toast.success('Customer success plan generated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGenerateExecutiveReview() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      if (!workspace) throw new Error('No workspace');
      return customerSuccessService.generateExecutiveBusinessReview(workspace.id, accountId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerSuccessKeys.all });
      toast.success('Executive business review generated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGenerateReferrals() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      if (!workspace) throw new Error('No workspace');
      return customerSuccessService.generateReferralRecommendations(workspace.id, accountId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerSuccessKeys.all });
      toast.success('Referral recommendations generated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGenerateCaseStudy() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      if (!workspace) throw new Error('No workspace');
      return customerSuccessService.generateCaseStudyRecommendations(workspace.id, accountId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerSuccessKeys.all });
      toast.success('Case study recommendations generated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGenerateCustomerInsights() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return customerSuccessService.generateCustomerInsights(workspace.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerSuccessKeys.all });
      toast.success('Customer insights generated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGenerateRenewalForecast() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return customerSuccessService.generateRenewalForecast(workspace.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerSuccessKeys.all });
      toast.success('Renewal forecast generated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
