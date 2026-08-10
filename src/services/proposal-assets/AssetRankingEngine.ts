// ============================================================
// AssetRankingEngine — Ranks assets by relevance, confidence, usage
// ============================================================

import type { ProposalAssetRecord, AssetSearchResult } from '@/types/proposal-assets';

class AssetRankingEngine {
  rank(assets: ProposalAssetRecord[]): ProposalAssetRecord[] {
    return assets
      .map((a) => ({ asset: a, score: this.compositeScore(a) }))
      .sort((a, b) => b.score - a.score)
      .map((s) => s.asset);
  }

  rankSearchResults(results: AssetSearchResult[]): AssetSearchResult[] {
    return results
      .map((r) => ({
        ...r,
        score: r.score * 0.5 + this.compositeScore(r.asset) * 0.5,
      }))
      .sort((a, b) => b.score - a.score);
  }

  compositeScore(asset: ProposalAssetRecord): number {
    const usage = Math.min(asset.usage_count / 100, 1) * 0.35;
    const confidence = asset.confidence_score * 0.35;
    const freshness = this.freshnessScore(asset) * 0.15;
    const approval = asset.approval_status === 'approved' ? 0.15 : 0;
    return usage + confidence + freshness + approval;
  }

  private freshnessScore(asset: ProposalAssetRecord): number {
    const updatedAt = new Date(asset.updated_at).getTime();
    const ageMs = Date.now() - updatedAt;
    const maxAgeMs = 1000 * 60 * 60 * 24 * 90; // 90 days
    if (ageMs <= 0) return 1.0;
    if (ageMs >= maxAgeMs) return 0.0;
    return Math.exp(-ageMs / (maxAgeMs / 3));
  }

  getTopAssets(assets: ProposalAssetRecord[], limit: number): ProposalAssetRecord[] {
    return this.rank(assets).slice(0, limit);
  }

  filterByConfidence(assets: ProposalAssetRecord[], min: number): ProposalAssetRecord[] {
    return assets.filter((a) => a.confidence_score >= min);
  }

  filterByApproval(assets: ProposalAssetRecord[], status: string): ProposalAssetRecord[] {
    return assets.filter((a) => a.approval_status === status);
  }
}

export const assetRankingEngine = new AssetRankingEngine();
