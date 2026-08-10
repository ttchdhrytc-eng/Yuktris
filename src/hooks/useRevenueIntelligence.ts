// ============================================================
// Revenue Intelligence Engine — React Query Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { revenueIntelligenceEngine } from '@/services/revenue-intelligence';
import type {
  RevenueProfileRecord,
  RevenueRecommendationRecord,
  IntelligenceSignal,
  RevenueMonitorSummary,
  RevenueHealth,
} from '@/types/revenue-intelligence';

// ============================================================
// Query Keys
// ============================================================

export const revenueKeys = {
  all: ['revenue'] as const,
  summary: (wsId: string) => [...revenueKeys.all, 'summary', wsId] as const,
  health: ['revenue', 'health'] as const,
  profile: (companyId: string) => [...revenueKeys.all, 'profile', companyId] as const,
  signals: (companyId: string) => [...revenueKeys.all, 'signals', companyId] as const,
  recommendations: (companyId: string) => [...revenueKeys.all, 'recommendations', companyId] as const,
  profiles: (wsId: string) => [...revenueKeys.all, 'profiles', wsId] as const,
};

// ============================================================
// useRevenueProfile — Get revenue profile for a company
// ============================================================

export function useRevenueProfile(companyId: string | null) {
  return useQuery<RevenueProfileRecord | null>({
    queryKey: [...revenueKeys.profile(companyId ?? '')],
    enabled: !!companyId,
    queryFn: () => {
      if (!companyId) return null;
      return revenueIntelligenceEngine.getProfile(companyId);
    },
  });
}

// ============================================================
// useRevenueScores — Alias for useRevenueProfile (scores are in the profile)
// ============================================================

export function useRevenueScores(companyId: string | null) {
  return useRevenueProfile(companyId);
}

// ============================================================
// useBuyingSignals — Get intelligence signals for a company
// ============================================================

export function useBuyingSignals(companyId: string | null) {
  return useQuery<IntelligenceSignal[]>({
    queryKey: [...revenueKeys.signals(companyId ?? '')],
    enabled: !!companyId,
    queryFn: () => {
      if (!companyId) return [];
      return revenueIntelligenceEngine.getSignals(companyId);
    },
  });
}

// ============================================================
// useRecommendations — Get recommendations for a company
// ============================================================

export function useRecommendations(companyId: string | null) {
  return useQuery<RevenueRecommendationRecord[]>({
    queryKey: [...revenueKeys.recommendations(companyId ?? '')],
    enabled: !!companyId,
    queryFn: () => {
      if (!companyId) return [];
      return revenueIntelligenceEngine.getRecommendations(companyId);
    },
  });
}

// ============================================================
// useOpportunityScores — Get all revenue profiles (opportunity ranking)
// ============================================================

export function useOpportunityScores(limit?: number) {
  const { workspace } = useWorkspace();

  return useQuery<(RevenueProfileRecord & { company_name: string })[]>({
    queryKey: [...revenueKeys.profiles(workspace?.id ?? ''), limit ?? 50],
    enabled: !!workspace?.id,
    queryFn: () => revenueIntelligenceEngine.getAllProfiles(workspace?.id ?? null, limit),
    refetchInterval: 30_000,
  });
}

// ============================================================
// useRevenueSummary — Monitoring summary
// ============================================================

export function useRevenueSummary() {
  const { workspace } = useWorkspace();

  return useQuery<RevenueMonitorSummary>({
    queryKey: [...revenueKeys.summary(workspace?.id ?? '')],
    enabled: !!workspace?.id,
    queryFn: () => revenueIntelligenceEngine.getSummary(workspace?.id ?? null),
    refetchInterval: 30_000,
  });
}

// ============================================================
// useRevenueHealth — Health check
// ============================================================

export function useRevenueHealth() {
  const { workspace } = useWorkspace();

  return useQuery<RevenueHealth>({
    queryKey: revenueKeys.health,
    queryFn: async () => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/revenue-health${workspace?.id ? `?workspace_id=${workspace.id}` : ''}`;
      const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      });
      if (!response.ok) throw new Error('Failed to fetch revenue health');
      return response.json();
    },
    refetchInterval: 60_000,
  });
}

// ============================================================
// Mutations
// ============================================================

export function useAnalyzeCompany() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (params: { companyId: string }) => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/revenue-analyze`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          company_id: params.companyId,
          workspace_id: workspace?.id ?? null,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: revenueKeys.all });
      toast.success('Revenue analysis completed.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to analyze company.'),
  });
}

export function useRecalculateRevenue() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (params: { companyId?: string; all?: boolean }) => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/revenue-recalculate`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          company_id: params.companyId,
          workspace_id: workspace?.id ?? null,
          all: params.all,
        }),
      });
      if (!response.ok) throw new Error('Recalculation failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: revenueKeys.all });
      toast.success('Revenue recalculation completed.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to recalculate.'),
  });
}

export function useUpdateRecommendationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { recommendationId: string; status: string }) =>
      revenueIntelligenceEngine.updateRecommendationStatus(params.recommendationId, params.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: revenueKeys.all });
      toast.success('Recommendation updated.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update recommendation.'),
  });
}
