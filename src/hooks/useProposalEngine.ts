// ============================================================
// Enterprise Proposal Intelligence Engine — React Query Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { proposalEngine } from '@/services/proposal';
import type {
  ProposalGenerateRequest,
  ProposalProjectRecord,
  ProposalVersionRecord,
  ProposalHealth,
  ProposalMonitorSummary,
  ExportFormat,
} from '@/types/proposal';

// ============================================================
// Query Keys
// ============================================================

export const proposalKeys = {
  all: ['proposal'] as const,
  health: ['proposal', 'health'] as const,
  summary: (wsId: string) => [...proposalKeys.all, 'summary', wsId] as const,
  projects: (wsId: string) => [...proposalKeys.all, 'projects', wsId] as const,
  project: (id: string) => [...proposalKeys.all, 'project', id] as const,
  version: (id: string) => [...proposalKeys.all, 'version', id] as const,
  history: (projectId: string) => [...proposalKeys.all, 'history', projectId] as const,
};

// ============================================================
// useProposal — Get a proposal project with latest version
// ============================================================

export function useProposal(projectId: string | null) {
  return useQuery({
    queryKey: [...proposalKeys.project(projectId ?? '')],
    enabled: !!projectId,
    queryFn: async () => {
      if (!projectId) return null;
      const project = await proposalEngine.getProject(projectId);
      const version = await proposalEngine.getLatestVersion(projectId);
      return { project, version };
    },
  });
}

// ============================================================
// useProposalPreview — Preview a specific version
// ============================================================

export function useProposalPreview(versionId: string | null) {
  return useQuery<ProposalVersionRecord | null>({
    queryKey: [...proposalKeys.version(versionId ?? '')],
    enabled: !!versionId,
    queryFn: () => {
      if (!versionId) return null;
      return proposalEngine.getVersion(versionId);
    },
  });
}

// ============================================================
// useProposalHistory — Get version history
// ============================================================

export function useProposalHistory(projectId: string | null, limit?: number) {
  return useQuery<ProposalVersionRecord[]>({
    queryKey: [...proposalKeys.history(projectId ?? '')],
    enabled: !!projectId,
    queryFn: () => {
      if (!projectId) return [];
      return proposalEngine.getHistory(projectId, limit);
    },
  });
}

// ============================================================
// useProposalExport — Export mutation
// ============================================================

export function useProposalExport() {
  return useMutation({
    mutationFn: async (params: { versionId: string; format: ExportFormat }) => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proposal-export`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          version_id: params.versionId,
          format: params.format,
        }),
      });
      if (!response.ok) throw new Error('Failed to export proposal');
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(`Proposal exported as ${data.format.toUpperCase()}.`);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to export proposal.'),
  });
}

// ============================================================
// useProposalProjects — List all projects
// ============================================================

export function useProposalProjects(limit?: number) {
  const { workspace } = useWorkspace();

  return useQuery<(ProposalProjectRecord & { company_name: string })[]>({
    queryKey: [...proposalKeys.projects(workspace?.id ?? ''), limit ?? 50],
    enabled: !!workspace?.id,
    queryFn: () => proposalEngine.getProjects(workspace?.id ?? null, limit),
    refetchInterval: 30_000,
  });
}

// ============================================================
// useProposalHealth
// ============================================================

export function useProposalHealth() {
  const { workspace } = useWorkspace();

  return useQuery<ProposalHealth>({
    queryKey: proposalKeys.health,
    queryFn: async () => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proposal-health${workspace?.id ? `?workspace_id=${workspace.id}` : ''}`;
      const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      });
      if (!response.ok) throw new Error('Failed to fetch proposal health');
      return response.json();
    },
    refetchInterval: 60_000,
  });
}

// ============================================================
// useProposalSummary
// ============================================================

export function useProposalSummary() {
  const { workspace } = useWorkspace();

  return useQuery<ProposalMonitorSummary>({
    queryKey: [...proposalKeys.summary(workspace?.id ?? '')],
    enabled: !!workspace?.id,
    queryFn: () => proposalEngine.getSummary(workspace?.id ?? null),
    refetchInterval: 30_000,
  });
}

// ============================================================
// Mutations
// ============================================================

export function useGenerateProposal() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (request: Omit<ProposalGenerateRequest, 'workspaceId'>) => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proposal-generate`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          ...request,
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
      queryClient.invalidateQueries({ queryKey: proposalKeys.all });
      toast.success('Proposal generated successfully.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to generate proposal.'),
  });
}

export function useReviewProposal() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (params: {
      versionId: string;
      reviewStatus: string;
      reviewNotes?: string;
      overallScore?: number;
      reviewerName?: string;
    }) => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proposal-review`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          version_id: params.versionId,
          review_status: params.reviewStatus,
          review_notes: params.reviewNotes,
          overall_score: params.overallScore,
          reviewer_name: params.reviewerName,
          workspace_id: workspace?.id ?? null,
        }),
      });
      if (!response.ok) throw new Error('Failed to submit review');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: proposalKeys.all });
      toast.success('Review submitted successfully.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to submit review.'),
  });
}
