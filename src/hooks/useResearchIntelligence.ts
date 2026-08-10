// ============================================================
// Research Intelligence Engine — React Query Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { researchEngine } from '@/services/research';
import type {
  CompanyIntelligenceRecord,
  ResearchRequestRecord,
  ResearchRequestType,
  ResearchMonitorSummary,
  ProviderHealth,
} from '@/types/research-intelligence';

// ============================================================
// Query Keys
// ============================================================

export const researchKeys = {
  all: ['research'] as const,
  summary: (wsId: string) => [...researchKeys.all, 'summary', wsId] as const,
  history: (wsId: string, limit: number) => [...researchKeys.all, 'history', wsId, limit] as const,
  intelligence: (companyName: string) => [...researchKeys.all, 'intelligence', companyName] as const,
  intelligenceById: (id: string) => [...researchKeys.all, 'intelligence', 'id', id] as const,
  sources: (intelligenceId: string) => [...researchKeys.all, 'sources', intelligenceId] as const,
  providers: ['research', 'providers'] as const,
  health: ['research', 'health'] as const,
};

// ============================================================
// useCompanyResearch — Start a new research request
// ============================================================

export function useCompanyResearch() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (params: {
      companyName: string;
      website?: string | null;
      requestType?: ResearchRequestType;
    }) => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/research-start`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          company_name: params.companyName,
          website: params.website ?? null,
          request_type: params.requestType ?? 'full_intelligence',
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
      queryClient.invalidateQueries({ queryKey: researchKeys.all });
      toast.success('Research request started.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to start research.'),
  });
}

// ============================================================
// useResearchHistory — Get research request history
// ============================================================

export function useResearchHistory(limit = 20) {
  const { workspace } = useWorkspace();

  return useQuery<ResearchRequestRecord[]>({
    queryKey: [...researchKeys.history(workspace?.id ?? '', limit)],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      return researchEngine.getHistory({ workspaceId: workspace.id, limit });
    },
    refetchInterval: 10_000,
  });
}

// ============================================================
// useResearchStatus — Get a single research request status
// ============================================================

export function useResearchStatus(requestId: string | null) {
  return useQuery<ResearchRequestRecord | null>({
    queryKey: ['research', 'status', requestId],
    enabled: !!requestId,
    queryFn: async () => {
      if (!requestId) return null;
      return researchEngine.getStatus(requestId);
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled')) {
        return false;
      }
      return 3_000;
    },
  });
}

// ============================================================
// useCompanyIntelligence — Get intelligence for a company
// ============================================================

export function useCompanyIntelligence(companyName: string | null) {
  return useQuery<CompanyIntelligenceRecord | null>({
    queryKey: [...researchKeys.intelligence(companyName ?? '')],
    enabled: !!companyName,
    queryFn: async () => {
      if (!companyName) return null;
      return researchEngine.getIntelligence(companyName);
    },
  });
}

// ============================================================
// useCompanyIntelligenceById — Get intelligence by ID
// ============================================================

export function useCompanyIntelligenceById(id: string | null) {
  return useQuery<CompanyIntelligenceRecord | null>({
    queryKey: [...researchKeys.intelligenceById(id ?? '')],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;
      return researchEngine.getIntelligenceById(id);
    },
  });
}

// ============================================================
// useResearchSources — Get source attribution for intelligence
// ============================================================

export function useResearchSources(intelligenceId: string | null) {
  return useQuery({
    queryKey: [...researchKeys.sources(intelligenceId ?? '')],
    enabled: !!intelligenceId,
    queryFn: async () => {
      if (!intelligenceId) return [];
      return researchEngine.getSources(intelligenceId);
    },
  });
}

// ============================================================
// useResearchProviders — List all providers
// ============================================================

export function useResearchProviders() {
  return useQuery({
    queryKey: researchKeys.providers,
    queryFn: () => researchEngine.getProviders(),
    staleTime: 60_000,
  });
}

// ============================================================
// useResearchHealth — Provider health checks
// ============================================================

export function useResearchHealth() {
  return useQuery<ProviderHealth[]>({
    queryKey: researchKeys.health,
    queryFn: async () => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/research-health`;
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch health');
      const data = await response.json();
      return data.providers;
    },
    refetchInterval: 30_000,
  });
}

// ============================================================
// useResearchSummary — Monitoring summary metrics
// ============================================================

export function useResearchSummary() {
  const { workspace } = useWorkspace();

  return useQuery<ResearchMonitorSummary>({
    queryKey: [...researchKeys.summary(workspace?.id ?? '')],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return researchEngine.getSummary({ workspaceId: workspace.id });
    },
    refetchInterval: 15_000,
  });
}

// ============================================================
// useResearchRefresh — Refresh intelligence for a company
// ============================================================

export function useResearchRefresh() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (params: { companyName: string }) => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/research-refresh`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          company_name: params.companyName,
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
      queryClient.invalidateQueries({ queryKey: researchKeys.all });
      toast.success('Research refresh queued.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to refresh research.'),
  });
}

// ============================================================
// useAllCompanyIntelligence — List all intelligence records
// ============================================================

export function useAllCompanyIntelligence(limit = 50) {
  const { workspace } = useWorkspace();

  return useQuery<CompanyIntelligenceRecord[]>({
    queryKey: [...researchKeys.all, 'all-intelligence', workspace?.id ?? '', limit],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('company_intelligence')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('last_updated', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as CompanyIntelligenceRecord[];
    },
  });
}
