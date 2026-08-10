// ============================================================
// Enterprise Outreach Intelligence Engine — React Query Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { outreachEngine } from '@/services/outreach';
import type {
  OutreachGenerateRequest,
  OutreachCampaignRecord,
  OutreachHealth,
  OutreachAnalytics,
  CampaignMetricsRecord,
  AudienceSegmentRecord,
} from '@/types/outreach';

export const outreachKeys = {
  all: ['outreach'] as const,
  health: ['outreach', 'health'] as const,
  analytics: (wsId: string) => [...outreachKeys.all, 'analytics', wsId] as const,
  campaigns: (wsId: string) => [...outreachKeys.all, 'campaigns', wsId] as const,
  campaign: (id: string) => [...outreachKeys.all, 'campaign', id] as const,
  metrics: (id: string) => [...outreachKeys.all, 'metrics', id] as const,
  history: (id: string) => [...outreachKeys.all, 'history', id] as const,
  segments: (wsId: string) => [...outreachKeys.all, 'segments', wsId] as const,
};

export function useOutreachCampaign(campaignId: string | null) {
  return useQuery({
    queryKey: [...outreachKeys.campaign(campaignId ?? '')],
    enabled: !!campaignId,
    queryFn: () => {
      if (!campaignId) return null;
      return outreachEngine.getCampaign(campaignId);
    },
  });
}

export function useOutreachPreview(campaignId: string | null) {
  return useQuery({
    queryKey: [...outreachKeys.campaign(campaignId ?? ''), 'preview'],
    enabled: !!campaignId,
    queryFn: async () => {
      if (!campaignId) return null;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/outreach-preview`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      if (!response.ok) throw new Error('Failed to preview campaign');
      return response.json();
    },
  });
}

export function useOutreachHistory(campaignId: string | null) {
  return useQuery({
    queryKey: [...outreachKeys.history(campaignId ?? '')],
    enabled: !!campaignId,
    queryFn: () => {
      if (!campaignId) return { events: [], messages: [] };
      return outreachEngine.getHistory(campaignId);
    },
  });
}

export function useCampaignMetrics(campaignId: string | null) {
  return useQuery<CampaignMetricsRecord>({
    queryKey: [...outreachKeys.metrics(campaignId ?? '')],
    enabled: !!campaignId,
    queryFn: () => {
      if (!campaignId) return null as unknown as CampaignMetricsRecord;
      return outreachEngine.getMetrics(campaignId) as Promise<CampaignMetricsRecord>;
    },
  });
}

export function useAudienceSegments(campaignId?: string | null) {
  const { workspace } = useWorkspace();
  return useQuery<AudienceSegmentRecord[]>({
    queryKey: [...outreachKeys.segments(workspace?.id ?? ''), campaignId ?? 'all'],
    enabled: !!workspace?.id,
    queryFn: async () => {
      let url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/audience_segments?select=*`;
      if (workspace?.id) url += `&workspace_id=eq.${workspace.id}`;
      if (campaignId) url += `&campaign_id=eq.${campaignId}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      });
      if (!response.ok) throw new Error('Failed to fetch segments');
      return response.json();
    },
  });
}

export function useOutreachCampaigns(limit?: number) {
  const { workspace } = useWorkspace();
  return useQuery<OutreachCampaignRecord[]>({
    queryKey: [...outreachKeys.campaigns(workspace?.id ?? ''), limit ?? 50],
    enabled: !!workspace?.id,
    queryFn: () => outreachEngine.getCampaigns(workspace?.id ?? null, limit),
    refetchInterval: 30_000,
  });
}

export function useOutreachHealth() {
  const { workspace } = useWorkspace();
  return useQuery<OutreachHealth>({
    queryKey: outreachKeys.health,
    queryFn: async () => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/outreach-health${workspace?.id ? `?workspace_id=${workspace.id}` : ''}`;
      const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` } });
      if (!response.ok) throw new Error('Failed to fetch outreach health');
      return response.json();
    },
    refetchInterval: 60_000,
  });
}

export function useOutreachAnalytics() {
  const { workspace } = useWorkspace();
  return useQuery<OutreachAnalytics>({
    queryKey: [...outreachKeys.analytics(workspace?.id ?? '')],
    enabled: !!workspace?.id,
    queryFn: () => outreachEngine.getAnalytics(workspace?.id ?? null),
    refetchInterval: 30_000,
  });
}

export function useGenerateOutreach() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (request: Omit<OutreachGenerateRequest, 'workspaceId'>) => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/outreach-build`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ ...request, workspace_id: workspace?.id ?? null }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: outreachKeys.all });
      toast.success('Outreach campaign generated successfully.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to generate outreach campaign.'),
  });
}

export function useScoreCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/outreach-score`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      if (!response.ok) throw new Error('Failed to score campaign');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: outreachKeys.all });
      toast.success('Campaign metrics calculated.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to score campaign.'),
  });
}
