// ============================================================
// Enterprise Proposal Asset Library — React Query Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { proposalAssetLibrary, assetApprovalService } from '@/services/proposal-assets';
import type {
  ProposalAssetRecord,
  AssetCategoryRecord,
  AssetTagRecord,
  AssetSearchRequest,
  AssetSearchResult,
  AssetAnalytics,
  AssetLibraryHealth,
  AssetRecommendation,
  AssetRecommendationRequest,
  AssetCreateRequest,
  AssetUpdateRequest,
  AssetReviewRecord,
} from '@/types/proposal-assets';

// ============================================================
// Query Keys
// ============================================================

export const assetKeys = {
  all: ['assets'] as const,
  health: ['assets', 'health'] as const,
  analytics: (wsId: string) => [...assetKeys.all, 'analytics', wsId] as const,
  categories: (wsId: string) => [...assetKeys.all, 'categories', wsId] as const,
  tags: (wsId: string) => [...assetKeys.all, 'tags', wsId] as const,
  list: (wsId: string, params?: Record<string, unknown>) => [...assetKeys.all, 'list', wsId, params ?? {}] as const,
  detail: (id: string) => [...assetKeys.all, 'detail', id] as const,
  search: (query: string) => [...assetKeys.all, 'search', query] as const,
  versions: (id: string) => [...assetKeys.all, 'versions', id] as const,
  reviews: (id: string) => [...assetKeys.all, 'reviews', id] as const,
  pendingReviews: (wsId: string) => [...assetKeys.all, 'pending-reviews', wsId] as const,
  recommendations: (wsId: string, params: Record<string, unknown>) => [...assetKeys.all, 'recommendations', wsId, params] as const,
};

// ============================================================
// useAssets — List/search assets
// ============================================================

export function useAssets(params?: AssetSearchRequest) {
  const { workspace } = useWorkspace();

  return useQuery<ProposalAssetRecord[]>({
    queryKey: [...assetKeys.list(workspace?.id ?? '', params ?? {})],
    enabled: !!workspace?.id,
    queryFn: async () => {
      const results = await proposalAssetLibrary.search({
        ...params,
        workspaceId: params?.workspaceId ?? workspace?.id ?? null,
      });
      return results.map((r) => r.asset);
    },
    refetchInterval: 30_000,
  });
}

// ============================================================
// useAsset — Get a single asset
// ============================================================

export function useAsset(assetId: string | null) {
  return useQuery<ProposalAssetRecord | null>({
    queryKey: [...assetKeys.detail(assetId ?? '')],
    enabled: !!assetId,
    queryFn: () => {
      if (!assetId) return null;
      return proposalAssetLibrary.getById(assetId);
    },
  });
}

// ============================================================
// useAssetSearch — Search assets
// ============================================================

export function useAssetSearch(request: AssetSearchRequest | null) {
  const { workspace } = useWorkspace();

  return useQuery<AssetSearchResult[]>({
    queryKey: request ? [...assetKeys.search(request.query ?? '')] : ['assets', 'search', 'disabled'],
    enabled: !!request,
    queryFn: () => {
      if (!request) return [];
      return proposalAssetLibrary.search({
        ...request,
        workspaceId: request.workspaceId ?? workspace?.id ?? null,
      });
    },
  });
}

// ============================================================
// useAssetAnalytics
// ============================================================

export function useAssetAnalytics() {
  const { workspace } = useWorkspace();

  return useQuery<AssetAnalytics>({
    queryKey: [...assetKeys.analytics(workspace?.id ?? '')],
    enabled: !!workspace?.id,
    queryFn: async () => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asset-analyze`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ workspace_id: workspace?.id ?? null }),
      });
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
    refetchInterval: 30_000,
  });
}

// ============================================================
// useAssetCategories
// ============================================================

export function useAssetCategories() {
  const { workspace } = useWorkspace();

  return useQuery<AssetCategoryRecord[]>({
    queryKey: [...assetKeys.categories(workspace?.id ?? '')],
    enabled: !!workspace?.id,
    queryFn: () => proposalAssetLibrary.getCategories(workspace?.id ?? null),
  });
}

// ============================================================
// useAssetTags
// ============================================================

export function useAssetTags() {
  const { workspace } = useWorkspace();

  return useQuery<AssetTagRecord[]>({
    queryKey: [...assetKeys.tags(workspace?.id ?? '')],
    enabled: !!workspace?.id,
    queryFn: () => proposalAssetLibrary.getTags(workspace?.id ?? null),
  });
}

// ============================================================
// useAssetRecommendations
// ============================================================

export function useAssetRecommendations(request: AssetRecommendationRequest | null) {
  const { workspace } = useWorkspace();

  return useQuery<AssetRecommendation[]>({
    queryKey: [...assetKeys.recommendations(workspace?.id ?? '', request ? { t: request.proposalType, i: request.industry, s: request.service } : {})],
    enabled: !!workspace?.id && !!request,
    queryFn: () => {
      if (!request) return [];
      return proposalAssetLibrary.getRecommendations({
        ...request,
        workspaceId: request.workspaceId ?? workspace?.id ?? null,
      });
    },
  });
}

// ============================================================
// useAssetHealth
// ============================================================

export function useAssetHealth() {
  const { workspace } = useWorkspace();

  return useQuery<AssetLibraryHealth>({
    queryKey: assetKeys.health,
    queryFn: async () => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asset-health${workspace?.id ? `?workspace_id=${workspace.id}` : ''}`;
      const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      });
      if (!response.ok) throw new Error('Failed to fetch asset health');
      return response.json();
    },
    refetchInterval: 60_000,
  });
}

// ============================================================
// useAssetVersions
// ============================================================

export function useAssetVersions(assetId: string | null, limit?: number) {
  return useQuery({
    queryKey: [...assetKeys.versions(assetId ?? '')],
    enabled: !!assetId,
    queryFn: () => {
      if (!assetId) return [];
      return proposalAssetLibrary.getVersions(assetId, limit);
    },
  });
}

// ============================================================
// useAssetReviews
// ============================================================

export function useAssetReviews(assetId: string | null) {
  return useQuery<AssetReviewRecord[]>({
    queryKey: [...assetKeys.reviews(assetId ?? '')],
    enabled: !!assetId,
    queryFn: () => {
      if (!assetId) return [];
      return proposalAssetLibrary.getReviews(assetId);
    },
  });
}

// ============================================================
// usePendingAssetReviews
// ============================================================

export function usePendingAssetReviews() {
  const { workspace } = useWorkspace();

  return useQuery<AssetReviewRecord[]>({
    queryKey: [...assetKeys.pendingReviews(workspace?.id ?? '')],
    enabled: !!workspace?.id,
    queryFn: () => assetApprovalService.getPendingReviews(workspace?.id ?? null),
    refetchInterval: 30_000,
  });
}

// ============================================================
// Mutations
// ============================================================

export function useCreateAsset() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (request: Omit<AssetCreateRequest, 'workspaceId'>) => {
      return proposalAssetLibrary.create({
        ...request,
        workspaceId: workspace?.id ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetKeys.all });
      toast.success('Asset created successfully.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create asset.'),
  });
}

export function useUpdateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; updates: AssetUpdateRequest }) => {
      return proposalAssetLibrary.update(params.id, params.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetKeys.all });
      toast.success('Asset updated successfully.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update asset.'),
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await proposalAssetLibrary.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetKeys.all });
      toast.success('Asset deleted.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete asset.'),
  });
}

export function useArchiveAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await proposalAssetLibrary.archive(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetKeys.all });
      toast.success('Asset archived.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to archive asset.'),
  });
}

export function useCloneAsset() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (params: { id: string; newTitle: string }) => {
      return proposalAssetLibrary.clone(params.id, params.newTitle, workspace?.id ?? null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetKeys.all });
      toast.success('Asset cloned successfully.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to clone asset.'),
  });
}

export function useApproveAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { reviewId: string; assetId: string; notes?: string }) => {
      await assetApprovalService.approve(params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetKeys.all });
      toast.success('Asset approved.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to approve asset.'),
  });
}

export function useRejectAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { reviewId: string; assetId: string; notes?: string }) => {
      await assetApprovalService.reject(params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetKeys.all });
      toast.success('Asset rejected.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to reject asset.'),
  });
}

export function useSubmitAssetForReview() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (params: { assetId: string; reviewerName?: string }) => {
      return assetApprovalService.submitForReview({
        assetId: params.assetId,
        reviewerName: params.reviewerName,
        workspaceId: workspace?.id ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetKeys.all });
      toast.success('Asset submitted for review.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to submit for review.'),
  });
}
