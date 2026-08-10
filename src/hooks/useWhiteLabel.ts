import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { WhiteLabelDashboard } from '@/types/white-label';

export const whiteLabelKeys = {
  all: ['white-label'] as const,
  dashboard: (wsId: string) => ['white-label', 'dashboard', wsId] as const,
};

export function useWhiteLabelDashboard() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: whiteLabelKeys.dashboard(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      const [settings, domains, assets] = await Promise.all([
        supabase.from('white_label_settings').select('*').eq('workspace_id', workspace.id).maybeSingle(),
        supabase.from('custom_domains').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('branding_assets').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
      ]);
      const s = settings.data as Record<string, unknown> | null;
      const allDomains = (domains.data ?? []) as Array<Record<string, unknown>>;
      return {
        settings: s as never, domains: allDomains as never[], assets: (assets.data ?? []) as never[],
        isWhiteLabeled: s?.is_white_labeled as boolean ?? false,
        primaryDomain: allDomains.find((d) => d.is_primary)?.domain as string ?? null,
        totalDomains: allDomains.length, totalAssets: (assets.data ?? []).length,
      } as WhiteLabelDashboard;
    },
  });
}

export function useUpdateWhiteLabelSettings() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: Partial<{ platformName: string; platformTagline: string; customAiName: string; customCeoName: string; customAgentPrefix: string; customFooter: string; customHeader: string; isWhiteLabeled: boolean }>) => {
      if (!workspace) throw new Error('No workspace');
      const { data: existing } = await supabase.from('white_label_settings').select('id').eq('workspace_id', workspace.id).maybeSingle();
      const updateData: Record<string, unknown> = { workspace_id: workspace.id, is_white_labeled: params.isWhiteLabeled ?? true };
      if (params.platformName) updateData.platform_name = params.platformName;
      if (params.platformTagline !== undefined) updateData.platform_tagline = params.platformTagline;
      if (params.customAiName !== undefined) updateData.custom_ai_name = params.customAiName;
      if (params.customCeoName !== undefined) updateData.custom_ceo_name = params.customCeoName;
      if (params.customAgentPrefix !== undefined) updateData.custom_agent_prefix = params.customAgentPrefix;
      if (params.customFooter !== undefined) updateData.custom_footer = params.customFooter;
      if (params.customHeader !== undefined) updateData.custom_header = params.customHeader;
      if (existing) { const { error } = await supabase.from('white_label_settings').update(updateData).eq('id', (existing as Record<string, string>).id); if (error) throw new Error(error.message); }
      else { const { error } = await supabase.from('white_label_settings').insert(updateData); if (error) throw new Error(error.message); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: whiteLabelKeys.all }); toast.success('I updated the white label configuration.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAddCustomDomain() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (domain: string) => {
      if (!workspace) throw new Error('No workspace');
      const { data, error } = await supabase.from('custom_domains').insert({ workspace_id: workspace.id, domain, domain_type: 'full', ssl_status: 'pending', dns_verified: false, is_primary: false, is_active: true }).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: whiteLabelKeys.all }); toast.success('I added the custom domain.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteCustomDomain() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (domainId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('custom_domains').delete().eq('id', domainId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: whiteLabelKeys.all }); toast.success('Custom domain removed.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUploadBrandingAsset() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { assetType: string; assetName: string; assetUrl?: string }) => {
      if (!workspace) throw new Error('No workspace');
      const { data, error } = await supabase.from('branding_assets').insert({ workspace_id: workspace.id, asset_type: params.assetType, asset_name: params.assetName, asset_url: params.assetUrl ?? null, is_active: true }).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: whiteLabelKeys.all }); toast.success('I uploaded the branding asset.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}
