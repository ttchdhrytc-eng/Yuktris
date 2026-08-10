// ============================================================
// AssetSearchEngine — Semantic and keyword search
// ============================================================

import { supabase } from '@/lib/supabase';
import type { AssetSearchRequest, AssetSearchResult, ProposalAssetRecord } from '@/types/proposal-assets';

class AssetSearchEngine {
  async search(request: AssetSearchRequest): Promise<AssetSearchResult[]> {
    let query = supabase
      .from('proposal_assets')
      .select('*')
      .eq('status', 'active');

    if (request.workspaceId) query = query.eq('workspace_id', request.workspaceId);
    if (request.assetType) query = query.eq('asset_type', request.assetType);
    if (request.industry) query = query.eq('industry', request.industry);
    if (request.service) query = query.eq('service', request.service);
    if (request.categoryId) query = query.eq('category_id', request.categoryId);
    if (request.approvalStatus) query = query.eq('approval_status', request.approvalStatus);
    if (request.minConfidence !== undefined) query = query.gte('confidence_score', request.minConfidence);

    if (request.query) {
      query = query.or(`title.ilike.%${request.query}%,content_text.ilike.%${request.query}%,description.ilike.%${request.query}%`);
    }

    query = query.order('confidence_score', { ascending: false }).limit(request.limit ?? 50);

    const { data, error } = await query;
    if (error) throw new Error(`Search failed: ${error.message}`);

    return (data ?? []).map((asset) => ({
      asset: asset as ProposalAssetRecord,
      score: this.scoreResult(asset as ProposalAssetRecord, request.query),
      matched_fields: this.matchedFields(asset as ProposalAssetRecord, request.query),
    }));
  }

  async semanticSearch(params: {
    query: string;
    assetType?: string;
    industry?: string;
    limit?: number;
    workspaceId?: string | null;
  }): Promise<AssetSearchResult[]> {
    const tokens = params.query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

    let query = supabase
      .from('proposal_assets')
      .select('*')
      .eq('status', 'active')
      .limit(params.limit ? params.limit * 2 : 100);

    if (params.workspaceId) query = query.eq('workspace_id', params.workspaceId);
    if (params.assetType) query = query.eq('asset_type', params.assetType);
    if (params.industry) query = query.eq('industry', params.industry);

    const { data, error } = await query;
    if (error) throw new Error(`Semantic search failed: ${error.message}`);

    const scored = (data ?? []).map((asset) => {
      const a = asset as ProposalAssetRecord;
      const score = this.tokenScore(a, tokens);
      return { asset: a, score, matched_fields: this.matchedFields(a, params.query) };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, params.limit ?? 50);
  }

  async searchByType(assetType: string, workspaceId?: string | null, limit?: number): Promise<ProposalAssetRecord[]> {
    let query = supabase
      .from('proposal_assets')
      .select('*')
      .eq('asset_type', assetType)
      .eq('status', 'active')
      .order('usage_count', { ascending: false });

    if (workspaceId) query = query.eq('workspace_id', workspaceId);
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(`Search by type failed: ${error.message}`);
    return (data ?? []) as ProposalAssetRecord[];
  }

  async searchByIndustry(industry: string, workspaceId?: string | null, limit?: number): Promise<ProposalAssetRecord[]> {
    let query = supabase
      .from('proposal_assets')
      .select('*')
      .eq('industry', industry)
      .eq('status', 'active')
      .order('usage_count', { ascending: false });

    if (workspaceId) query = query.eq('workspace_id', workspaceId);
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(`Search by industry failed: ${error.message}`);
    return (data ?? []) as ProposalAssetRecord[];
  }

  async searchByTag(tagId: string, workspaceId?: string | null, limit?: number): Promise<ProposalAssetRecord[]> {
    const { data: mapData, error: mapError } = await supabase
      .from('asset_tag_map')
      .select('asset_id')
      .eq('tag_id', tagId);

    if (mapError) throw new Error(`Tag search failed: ${mapError.message}`);
    const assetIds = (mapData ?? []).map((r) => (r as { asset_id: string }).asset_id);
    if (assetIds.length === 0) return [];

    let query = supabase
      .from('proposal_assets')
      .select('*')
      .in('id', assetIds)
      .eq('status', 'active')
      .order('usage_count', { ascending: false });

    if (workspaceId) query = query.eq('workspace_id', workspaceId);
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(`Tag search failed: ${error.message}`);
    return (data ?? []) as ProposalAssetRecord[];
  }

  private scoreResult(asset: ProposalAssetRecord, query?: string): number {
    if (!query) return asset.confidence_score;
    let score = 0;
    const q = query.toLowerCase();
    if (asset.title.toLowerCase().includes(q)) score += 0.4;
    if (asset.content_text?.toLowerCase().includes(q)) score += 0.3;
    if (asset.description?.toLowerCase().includes(q)) score += 0.2;
    score += asset.confidence_score * 0.1;
    return Math.min(score, 1.0);
  }

  private tokenScore(asset: ProposalAssetRecord, tokens: string[]): number {
    const text = `${asset.title} ${asset.description ?? ''} ${asset.content_text ?? ''}`.toLowerCase();
    let matches = 0;
    for (const token of tokens) {
      if (text.includes(token)) matches++;
    }
    return tokens.length > 0 ? matches / tokens.length : 0;
  }

  private matchedFields(asset: ProposalAssetRecord, query?: string): string[] {
    if (!query) return [];
    const fields: string[] = [];
    const q = query.toLowerCase();
    if (asset.title.toLowerCase().includes(q)) fields.push('title');
    if (asset.content_text?.toLowerCase().includes(q)) fields.push('content');
    if (asset.description?.toLowerCase().includes(q)) fields.push('description');
    return fields;
  }
}

export const assetSearchEngine = new AssetSearchEngine();
