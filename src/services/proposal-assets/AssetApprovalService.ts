// ============================================================
// AssetApprovalService — Approval workflow for assets
// ============================================================

import { supabase } from '@/lib/supabase';
import type { AssetReviewRecord } from '@/types/proposal-assets';

class AssetApprovalService {
  async submitForReview(params: {
    assetId: string;
    reviewerId?: string | null;
    reviewerName?: string | null;
    workspaceId?: string | null;
  }): Promise<AssetReviewRecord> {
    // Update asset approval status
    await supabase
      .from('proposal_assets')
      .update({ approval_status: 'in_review' })
      .eq('id', params.assetId);

    // Create review record
    const { data, error } = await supabase
      .from('asset_reviews')
      .insert({
        workspace_id: params.workspaceId ?? null,
        asset_id: params.assetId,
        reviewer_id: params.reviewerId ?? null,
        reviewer_name: params.reviewerName ?? null,
        review_status: 'pending',
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to submit for review: ${error.message}`);
    return data as AssetReviewRecord;
  }

  async approve(params: {
    reviewId: string;
    assetId: string;
    reviewNotes?: string;
  }): Promise<void> {
    await supabase
      .from('asset_reviews')
      .update({
        review_status: 'approved',
        review_notes: params.reviewNotes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.reviewId);

    await supabase
      .from('proposal_assets')
      .update({ approval_status: 'approved', status: 'active' })
      .eq('id', params.assetId);
  }

  async reject(params: {
    reviewId: string;
    assetId: string;
    reviewNotes?: string;
  }): Promise<void> {
    await supabase
      .from('asset_reviews')
      .update({
        review_status: 'rejected',
        review_notes: params.reviewNotes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.reviewId);

    await supabase
      .from('proposal_assets')
      .update({ approval_status: 'rejected' })
      .eq('id', params.assetId);
  }

  async requestChanges(params: {
    reviewId: string;
    assetId: string;
    reviewNotes?: string;
  }): Promise<void> {
    await supabase
      .from('asset_reviews')
      .update({
        review_status: 'changes_requested',
        review_notes: params.reviewNotes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.reviewId);

    await supabase
      .from('proposal_assets')
      .update({ approval_status: 'pending' })
      .eq('id', params.assetId);
  }

  async getPendingReviews(workspaceId?: string | null): Promise<AssetReviewRecord[]> {
    let query = supabase
      .from('asset_reviews')
      .select('*, proposal_assets(title, asset_type)')
      .eq('review_status', 'pending')
      .order('created_at', { ascending: false });

    if (workspaceId) query = query.eq('workspace_id', workspaceId);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get pending reviews: ${error.message}`);
    return (data ?? []) as AssetReviewRecord[];
  }

  async getReviewsByAsset(assetId: string): Promise<AssetReviewRecord[]> {
    const { data, error } = await supabase
      .from('asset_reviews')
      .select('*')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get reviews: ${error.message}`);
    return (data ?? []) as AssetReviewRecord[];
  }
}

export const assetApprovalService = new AssetApprovalService();
