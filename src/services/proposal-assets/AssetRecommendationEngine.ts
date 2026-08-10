// ============================================================
// AssetRecommendationEngine — Recommends assets for proposals
// ============================================================

import { supabase } from '@/lib/supabase';
import type { AssetRecommendation, AssetRecommendationRequest, ProposalAssetRecord } from '@/types/proposal-assets';

class AssetRecommendationEngine {
  async recommend(request: AssetRecommendationRequest): Promise<AssetRecommendation[]> {
    let query = supabase
      .from('proposal_assets')
      .select('*')
      .eq('status', 'active')
      .eq('approval_status', 'approved')
      .order('usage_count', { ascending: false })
      .limit(request.limit ? request.limit * 3 : 100);

    if (request.workspaceId) query = query.eq('workspace_id', request.workspaceId);
    if (request.industry) query = query.eq('industry', request.industry);
    if (request.service) query = query.eq('service', request.service);
    if (request.assetTypes && request.assetTypes.length > 0) {
      query = query.in('asset_type', request.assetTypes);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Recommendation failed: ${error.message}`);

    const assets = (data ?? []) as ProposalAssetRecord[];

    const scored = assets.map((asset) => {
      let score = 0.3;
      const reasons: string[] = [];

      // Industry match
      if (request.industry && asset.industry === request.industry) {
        score += 0.25;
        reasons.push('Industry match');
      }

      // Service match
      if (request.service && asset.service === request.service) {
        score += 0.2;
        reasons.push('Service match');
      }

      // Usage popularity
      const usageScore = Math.min(asset.usage_count / 100, 1) * 0.15;
      score += usageScore;
      if (asset.usage_count > 10) reasons.push(`Popular (${asset.usage_count} uses)`);

      // Confidence
      score += asset.confidence_score * 0.1;

      // Proposal type alignment
      if (request.proposalType) {
        const pt = request.proposalType.toLowerCase();
        const at = asset.asset_type.toLowerCase();
        if (at.includes(pt) || pt.includes(at)) {
          score += 0.1;
          reasons.push('Type alignment');
        }
      }

      return {
        asset,
        relevance_score: Math.min(score, 1.0),
        reason: reasons.join(', ') || 'General recommendation',
      };
    });

    return scored
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, request.limit ?? 20);
  }

  async findMissingAssets(params: {
    proposalType?: string;
    industry?: string;
    requiredTypes: string[];
    workspaceId?: string | null;
  }): Promise<{ asset_type: string; has_assets: boolean; count: number }[]> {
    const results: { asset_type: string; has_assets: boolean; count: number }[] = [];

    for (const type of params.requiredTypes) {
      let query = supabase
        .from('proposal_assets')
        .select('id', { count: 'exact', head: true })
        .eq('asset_type', type)
        .eq('status', 'active')
        .eq('approval_status', 'approved');

      if (params.workspaceId) query = query.eq('workspace_id', params.workspaceId);
      if (params.industry) query = query.eq('industry', params.industry);

      const { count } = await query;
      results.push({
        asset_type: type,
        has_assets: (count ?? 0) > 0,
        count: count ?? 0,
      });
    }

    return results;
  }

  async suggestAssets(params: {
    industry?: string;
    service?: string;
    workspaceId?: string | null;
    limit?: number;
  }): Promise<AssetRecommendation[]> {
    return this.recommend({
      industry: params.industry,
      service: params.service,
      limit: params.limit ?? 10,
      workspaceId: params.workspaceId,
    });
  }
}

export const assetRecommendationEngine = new AssetRecommendationEngine();
