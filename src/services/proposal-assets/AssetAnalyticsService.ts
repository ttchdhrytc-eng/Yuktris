// ============================================================
// AssetAnalyticsService — Usage analytics and insights
// ============================================================

import { supabase } from '@/lib/supabase';
import type { ProposalAssetRecord, AssetAnalytics } from '@/types/proposal-assets';

class AssetAnalyticsService {
  async getAnalytics(workspaceId?: string | null): Promise<AssetAnalytics> {
    let assetQuery = supabase.from('proposal_assets').select('*');
    if (workspaceId) assetQuery = assetQuery.eq('workspace_id', workspaceId);
    const { data: assets } = await assetQuery;
    const assetList = (assets ?? []) as ProposalAssetRecord[];

    const activeCount = assetList.filter((a) => a.status === 'active').length;
    const archivedCount = assetList.filter((a) => a.status === 'archived').length;
    const expiredCount = assetList.filter((a) => a.status === 'expired').length;
    const pendingApproval = assetList.filter((a) => a.approval_status === 'pending').length;
    const approvedCount = assetList.filter((a) => a.approval_status === 'approved').length;
    const totalUsage = assetList.reduce((s, a) => s + a.usage_count, 0);
    const avgConfidence = assetList.length > 0
      ? Math.round(assetList.reduce((s, a) => s + a.confidence_score, 0) / assetList.length * 100) / 100
      : 0;

    const typeDist: Record<string, number> = {};
    for (const a of assetList) typeDist[a.asset_type] = (typeDist[a.asset_type] ?? 0) + 1;

    const industryDist: Record<string, number> = {};
    for (const a of assetList) {
      if (a.industry) industryDist[a.industry] = (industryDist[a.industry] ?? 0) + 1;
    }

    const sorted = [...assetList].sort((a, b) => b.usage_count - a.usage_count);
    const mostUsed = sorted.slice(0, 10).map((a) => ({ id: a.id, title: a.title, usage_count: a.usage_count, asset_type: a.asset_type }));
    const leastUsed = sorted.filter((a) => a.usage_count > 0).slice(-10).reverse().map((a) => ({ id: a.id, title: a.title, usage_count: a.usage_count, asset_type: a.asset_type }));
    const unused = assetList.filter((a) => a.usage_count === 0).length;

    // Ratings
    let ratingQuery = supabase.from('asset_ratings').select('asset_id, rating');
    if (workspaceId) ratingQuery = ratingQuery.eq('workspace_id', workspaceId);
    const { data: ratings } = await ratingQuery;
    const ratingList = (ratings ?? []) as { asset_id: string; rating: number }[];

    const avgRating = ratingList.length > 0
      ? Math.round(ratingList.reduce((s, r) => s + r.rating, 0) / ratingList.length * 100) / 100
      : 0;

    const ratingByAsset: Record<string, number[]> = {};
    for (const r of ratingList) {
      if (!ratingByAsset[r.asset_id]) ratingByAsset[r.asset_id] = [];
      ratingByAsset[r.asset_id].push(r.rating);
    }

    const topRated = Object.entries(ratingByAsset)
      .map(([id, ratings]) => {
        const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
        const asset = assetList.find((a) => a.id === id);
        return { id, title: asset?.title ?? 'Unknown', average_rating: Math.round(avg * 100) / 100, asset_type: asset?.asset_type ?? 'unknown' };
      })
      .sort((a, b) => b.average_rating - a.average_rating)
      .slice(0, 10);

    // Duplicate detection
    const duplicates = this.detectDuplicates(assetList);

    return {
      total_assets: assetList.length,
      active_assets: activeCount,
      archived_assets: archivedCount,
      expired_assets: expiredCount,
      pending_approval: pendingApproval,
      approved_assets: approvedCount,
      total_usage: totalUsage,
      average_confidence: avgConfidence,
      average_rating: avgRating,
      type_distribution: typeDist,
      industry_distribution: industryDist,
      most_used: mostUsed,
      least_used: leastUsed,
      top_rated: topRated,
      unused_assets: unused,
      duplicate_candidates: duplicates,
    };
  }

  private detectDuplicates(assets: ProposalAssetRecord[]): { primary_id: string; duplicate_id: string; similarity: number }[] {
    const candidates: { primary_id: string; duplicate_id: string; similarity: number }[] = [];

    for (let i = 0; i < assets.length; i++) {
      for (let j = i + 1; j < assets.length; j++) {
        if (assets[i].asset_type !== assets[j].asset_type) continue;

        const titleSim = this.jaccard(
          assets[i].title.toLowerCase().split(/\s+/),
          assets[j].title.toLowerCase().split(/\s+/),
        );

        if (titleSim >= 0.7) {
          candidates.push({
            primary_id: assets[i].id,
            duplicate_id: assets[j].id,
            similarity: Math.round(titleSim * 100) / 100,
          });
        }
      }
    }

    return candidates;
  }

  private jaccard(a: string[], b: string[]): number {
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  async getUsageTrends(workspaceId?: string | null, days = 30): Promise<{ date: string; usage_count: number }[]> {
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('asset_usage_history')
      .select('created_at')
      .gte('created_at', sinceDate)
      .order('created_at', { ascending: true });

    if (workspaceId) query = query.eq('workspace_id', workspaceId);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get usage trends: ${error.message}`);

    const byDate: Record<string, number> = {};
    for (const row of (data ?? []) as { created_at: string }[]) {
      const date = row.created_at.split('T')[0];
      byDate[date] = (byDate[date] ?? 0) + 1;
    }

    return Object.entries(byDate)
      .map(([date, count]) => ({ date, usage_count: count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

export const assetAnalyticsService = new AssetAnalyticsService();
