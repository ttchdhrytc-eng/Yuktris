// ============================================================
// ProposalAssetLibrary — Central facade for all asset operations
// ============================================================

import { supabase } from '@/lib/supabase';
import type {
  ProposalAssetRecord,
  AssetCategoryRecord,
  AssetTagRecord,
  AssetCreateRequest,
  AssetUpdateRequest,
  AssetSearchRequest,
  AssetSearchResult,
  AssetAnalytics,
  AssetLibraryHealth,
  AssetRecommendation,
  AssetRecommendationRequest,
  AssetVersionRecord,
  AssetRelationshipRecord,
  AssetUsageHistoryRecord,
  AssetReviewRecord,
  AssetRatingRecord,
} from '@/types/proposal-assets';

class ProposalAssetLibrary {
  // ----------------------------------------------------------
  // CRUD
  // ----------------------------------------------------------

  async create(request: AssetCreateRequest): Promise<ProposalAssetRecord> {
    const { data, error } = await supabase
      .from('proposal_assets')
      .insert({
        workspace_id: request.workspaceId ?? null,
        category_id: request.categoryId ?? null,
        title: request.title,
        description: request.description ?? null,
        asset_type: request.assetType,
        industry: request.industry ?? null,
        service: request.service ?? null,
        content: request.content ?? {},
        content_text: request.contentText ?? null,
        language: request.language ?? 'en',
        status: 'draft',
        approval_status: 'pending',
        owner: request.owner ?? null,
        confidence_score: request.confidenceScore ?? 0.5,
        expiration_date: request.expirationDate ?? null,
        created_by: request.createdBy ?? null,
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to create asset: ${error.message}`);
    const asset = data as ProposalAssetRecord;

    // Create initial version
    await this.createVersion(asset.id, {
      content: request.content ?? {},
      contentText: request.contentText,
      changeSummary: 'Initial version',
      workspaceId: request.workspaceId,
      createdBy: request.createdBy,
    });

    // Assign tags
    if (request.tagIds && request.tagIds.length > 0) {
      await this.assignTags(asset.id, request.tagIds);
    }

    return asset;
  }

  async getById(id: string): Promise<ProposalAssetRecord | null> {
    const { data, error } = await supabase
      .from('proposal_assets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to get asset: ${error.message}`);
    return data as ProposalAssetRecord | null;
  }

  async update(id: string, request: AssetUpdateRequest): Promise<ProposalAssetRecord> {
    const updateFields: Record<string, unknown> = {};
    if (request.title !== undefined) updateFields.title = request.title;
    if (request.description !== undefined) updateFields.description = request.description;
    if (request.content !== undefined) updateFields.content = request.content;
    if (request.contentText !== undefined) updateFields.content_text = request.contentText;
    if (request.categoryId !== undefined) updateFields.category_id = request.categoryId;
    if (request.industry !== undefined) updateFields.industry = request.industry;
    if (request.service !== undefined) updateFields.service = request.service;
    if (request.status !== undefined) updateFields.status = request.status;
    if (request.owner !== undefined) updateFields.owner = request.owner;
    if (request.confidenceScore !== undefined) updateFields.confidence_score = request.confidenceScore;
    if (request.expirationDate !== undefined) updateFields.expiration_date = request.expirationDate;
    if (request.updatedBy !== undefined) updateFields.updated_by = request.updatedBy;
    updateFields.version = (await this.getCurrentVersionNumber(id)) + 1;

    const { data, error } = await supabase
      .from('proposal_assets')
      .update(updateFields)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to update asset: ${error.message}`);
    const asset = data as ProposalAssetRecord;

    // Create version snapshot
    await this.createVersion(id, {
      content: request.content ?? {},
      contentText: request.contentText,
      changeSummary: `Updated: ${Object.keys(updateFields).join(', ')}`,
      workspaceId: asset.workspace_id,
      createdBy: request.updatedBy,
    });

    // Update tags
    if (request.tagIds !== undefined) {
      await this.replaceTags(id, request.tagIds);
    }

    return asset;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('proposal_assets')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete asset: ${error.message}`);
  }

  async archive(id: string): Promise<void> {
    await supabase
      .from('proposal_assets')
      .update({ status: 'archived' })
      .eq('id', id);
  }

  async restore(id: string): Promise<void> {
    await supabase
      .from('proposal_assets')
      .update({ status: 'active' })
      .eq('id', id);
  }

  async clone(id: string, newTitle: string, workspaceId?: string | null): Promise<ProposalAssetRecord> {
    const original = await this.getById(id);
    if (!original) throw new Error('Asset not found');

    return this.create({
      title: newTitle,
      description: original.description ?? undefined,
      assetType: original.asset_type,
      industry: original.industry ?? undefined,
      service: original.service ?? undefined,
      content: original.content,
      contentText: original.content_text ?? undefined,
      categoryId: original.category_id,
      language: original.language,
      workspaceId: workspaceId ?? original.workspace_id,
    });
  }

  // ----------------------------------------------------------
  // Search
  // ----------------------------------------------------------

  async search(request: AssetSearchRequest): Promise<AssetSearchResult[]> {
    let query = supabase
      .from('proposal_assets')
      .select('*')
      .order('confidence_score', { ascending: false });

    if (request.workspaceId) query = query.eq('workspace_id', request.workspaceId);
    if (request.assetType) query = query.eq('asset_type', request.assetType);
    if (request.industry) query = query.eq('industry', request.industry);
    if (request.service) query = query.eq('service', request.service);
    if (request.categoryId) query = query.eq('category_id', request.categoryId);
    if (request.status) query = query.eq('status', request.status);
    if (request.approvalStatus) query = query.eq('approval_status', request.approvalStatus);
    if (request.minConfidence !== undefined) query = query.gte('confidence_score', request.minConfidence);
    if (request.query) query = query.or(`title.ilike.%${request.query}%,content_text.ilike.%${request.query}%`);
    if (request.limit) query = query.limit(request.limit);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to search assets: ${error.message}`);

    return (data ?? []).map((asset) => ({
      asset: asset as ProposalAssetRecord,
      score: this.calculateRelevanceScore(asset as ProposalAssetRecord, request.query),
      matched_fields: this.getMatchedFields(asset as ProposalAssetRecord, request.query),
    }));
  }

  // ----------------------------------------------------------
  // Categories
  // ----------------------------------------------------------

  async getCategories(workspaceId?: string | null): Promise<AssetCategoryRecord[]> {
    let query = supabase
      .from('asset_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (workspaceId) query = query.eq('workspace_id', workspaceId);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get categories: ${error.message}`);
    return (data ?? []) as AssetCategoryRecord[];
  }

  async createCategory(params: {
    name: string;
    slug: string;
    description?: string;
    parentId?: string | null;
    workspaceId?: string | null;
  }): Promise<AssetCategoryRecord> {
    const { data, error } = await supabase
      .from('asset_categories')
      .insert({
        workspace_id: params.workspaceId ?? null,
        name: params.name,
        slug: params.slug,
        description: params.description ?? null,
        parent_id: params.parentId ?? null,
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to create category: ${error.message}`);
    return data as AssetCategoryRecord;
  }

  // ----------------------------------------------------------
  // Tags
  // ----------------------------------------------------------

  async getTags(workspaceId?: string | null): Promise<AssetTagRecord[]> {
    let query = supabase.from('asset_tags').select('*').order('name', { ascending: true });
    if (workspaceId) query = query.eq('workspace_id', workspaceId);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get tags: ${error.message}`);
    return (data ?? []) as AssetTagRecord[];
  }

  async createTag(params: { name: string; slug: string; color?: string; workspaceId?: string | null }): Promise<AssetTagRecord> {
    const { data, error } = await supabase
      .from('asset_tags')
      .insert({
        workspace_id: params.workspaceId ?? null,
        name: params.name,
        slug: params.slug,
        color: params.color ?? 'gray',
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to create tag: ${error.message}`);
    return data as AssetTagRecord;
  }

  async getAssetTags(assetId: string): Promise<AssetTagRecord[]> {
    const { data, error } = await supabase
      .from('asset_tag_map')
      .select('tag_id, asset_tags(id, name, slug, color)')
      .eq('asset_id', assetId);

    if (error) throw new Error(`Failed to get asset tags: ${error.message}`);
    return (data ?? []).map((row) => (row as { asset_tags: AssetTagRecord }).asset_tags).filter(Boolean);
  }

  async assignTags(assetId: string, tagIds: string[]): Promise<void> {
    const inserts = tagIds.map((tagId) => ({ asset_id: assetId, tag_id: tagId }));
    if (inserts.length > 0) {
      await supabase.from('asset_tag_map').insert(inserts);
    }
  }

  async replaceTags(assetId: string, tagIds: string[]): Promise<void> {
    await supabase.from('asset_tag_map').delete().eq('asset_id', assetId);
    await this.assignTags(assetId, tagIds);
  }

  // ----------------------------------------------------------
  // Versions
  // ----------------------------------------------------------

  async createVersion(params: {
    assetId: string;
    content: Record<string, unknown>;
    contentText?: string;
    changeSummary?: string;
    workspaceId?: string | null;
    createdBy?: string;
  }): Promise<AssetVersionRecord> {
    const versionNumber = await this.getCurrentVersionNumber(params.assetId) + 1;

    const { data, error } = await supabase
      .from('asset_versions')
      .insert({
        workspace_id: params.workspaceId ?? null,
        asset_id: params.assetId,
        version_number: versionNumber,
        content: params.content,
        content_text: params.contentText ?? null,
        change_summary: params.changeSummary ?? null,
        created_by: params.createdBy ?? null,
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to create version: ${error.message}`);
    return data as AssetVersionRecord;
  }

  async getVersions(assetId: string, limit?: number): Promise<AssetVersionRecord[]> {
    let query = supabase
      .from('asset_versions')
      .select('*')
      .eq('asset_id', assetId)
      .order('version_number', { ascending: false });

    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get versions: ${error.message}`);
    return (data ?? []) as AssetVersionRecord[];
  }

  // ----------------------------------------------------------
  // Relationships
  // ----------------------------------------------------------

  async createRelationship(params: {
    sourceAssetId: string;
    targetAssetId: string;
    relationshipType: string;
    strength?: number;
    workspaceId?: string | null;
  }): Promise<AssetRelationshipRecord> {
    const { data, error } = await supabase
      .from('asset_relationships')
      .insert({
        workspace_id: params.workspaceId ?? null,
        source_asset_id: params.sourceAssetId,
        target_asset_id: params.targetAssetId,
        relationship_type: params.relationshipType,
        strength: params.strength ?? 0.5,
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to create relationship: ${error.message}`);
    return data as AssetRelationshipRecord;
  }

  async getRelationships(assetId: string): Promise<AssetRelationshipRecord[]> {
    const { data, error } = await supabase
      .from('asset_relationships')
      .select('*')
      .or(`source_asset_id.eq.${assetId},target_asset_id.eq.${assetId}`)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get relationships: ${error.message}`);
    return (data ?? []) as AssetRelationshipRecord[];
  }

  // ----------------------------------------------------------
  // Usage Tracking
  // ----------------------------------------------------------

  async recordUsage(params: {
    assetId: string;
    proposalVersionId?: string | null;
    usageContext?: string;
    personalizationApplied?: Record<string, unknown>;
    usedBy?: string;
    workspaceId?: string | null;
  }): Promise<void> {
    await supabase.from('asset_usage_history').insert({
      workspace_id: params.workspaceId ?? null,
      asset_id: params.assetId,
      proposal_version_id: params.proposalVersionId ?? null,
      usage_context: params.usageContext ?? null,
      personalization_applied: params.personalizationApplied ?? {},
      used_by: params.usedBy ?? null,
    });

    // Increment usage count
    await supabase.rpc('increment_asset_usage', { asset_id: params.assetId }).catch(() => {
      // Fallback if RPC doesn't exist
      return supabase
        .from('proposal_assets')
        .update({ usage_count: (usage_counts[params.assetId] ?? 0) + 1, last_used_at: new Date().toISOString() })
        .eq('id', params.assetId);
    });
  }

  async getUsageHistory(assetId: string, limit?: number): Promise<AssetUsageHistoryRecord[]> {
    let query = supabase
      .from('asset_usage_history')
      .select('*')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false });

    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get usage history: ${error.message}`);
    return (data ?? []) as AssetUsageHistoryRecord[];
  }

  // ----------------------------------------------------------
  // Reviews & Ratings
  // ----------------------------------------------------------

  async createReview(params: {
    assetId: string;
    reviewerId?: string | null;
    reviewerName?: string | null;
    reviewStatus?: string;
    reviewNotes?: string;
    workspaceId?: string | null;
  }): Promise<AssetReviewRecord> {
    const { data, error } = await supabase
      .from('asset_reviews')
      .insert({
        workspace_id: params.workspaceId ?? null,
        asset_id: params.assetId,
        reviewer_id: params.reviewerId ?? null,
        reviewer_name: params.reviewerName ?? null,
        review_status: params.reviewStatus ?? 'pending',
        review_notes: params.reviewNotes ?? null,
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to create review: ${error.message}`);

    // Update asset approval status based on review
    if (params.reviewStatus === 'approved') {
      await supabase
        .from('proposal_assets')
        .update({ approval_status: 'approved', status: 'active' })
        .eq('id', params.assetId);
    } else if (params.reviewStatus === 'rejected') {
      await supabase
        .from('proposal_assets')
        .update({ approval_status: 'rejected' })
        .eq('id', params.assetId);
    }

    return data as AssetReviewRecord;
  }

  async getReviews(assetId: string): Promise<AssetReviewRecord[]> {
    const { data, error } = await supabase
      .from('asset_reviews')
      .select('*')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get reviews: ${error.message}`);
    return (data ?? []) as AssetReviewRecord[];
  }

  async createRating(params: {
    assetId: string;
    rating: number;
    raterId?: string | null;
    raterName?: string | null;
    review?: string;
    workspaceId?: string | null;
  }): Promise<AssetRatingRecord> {
    const { data, error } = await supabase
      .from('asset_ratings')
      .insert({
        workspace_id: params.workspaceId ?? null,
        asset_id: params.assetId,
        rating: params.rating,
        rater_id: params.raterId ?? null,
        rater_name: params.raterName ?? null,
        review: params.review ?? null,
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to create rating: ${error.message}`);
    return data as AssetRatingRecord;
  }

  async getRatings(assetId: string): Promise<AssetRatingRecord[]> {
    const { data, error } = await supabase
      .from('asset_ratings')
      .select('*')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get ratings: ${error.message}`);
    return (data ?? []) as AssetRatingRecord[];
  }

  // ----------------------------------------------------------
  // Analytics
  // ----------------------------------------------------------

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
    const leastUsed = sorted.slice(-10).reverse().map((a) => ({ id: a.id, title: a.title, usage_count: a.usage_count, asset_type: a.asset_type }));
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
      duplicate_candidates: [],
    };
  }

  // ----------------------------------------------------------
  // Health
  // ----------------------------------------------------------

  async getHealth(workspaceId?: string | null): Promise<AssetLibraryHealth> {
    const analytics = await this.getAnalytics(workspaceId);

    let catQuery = supabase.from('asset_categories').select('id', { count: 'exact', head: true }).eq('is_active', true);
    if (workspaceId) catQuery = catQuery.eq('workspace_id', workspaceId);
    const { count: catCount } = await catQuery;

    let tagQuery = supabase.from('asset_tags').select('id', { count: 'exact', head: true });
    if (workspaceId) tagQuery = tagQuery.eq('workspace_id', workspaceId);
    const { count: tagCount } = await tagQuery;

    let verQuery = supabase.from('asset_versions').select('id', { count: 'exact', head: true });
    if (workspaceId) verQuery = verQuery.eq('workspace_id', workspaceId);
    const { count: verCount } = await verQuery;

    let relQuery = supabase.from('asset_relationships').select('id', { count: 'exact', head: true });
    if (workspaceId) relQuery = relQuery.eq('workspace_id', workspaceId);
    const { count: relCount } = await relQuery;

    let usageQuery = supabase.from('asset_usage_history').select('id', { count: 'exact', head: true });
    if (workspaceId) usageQuery = usageQuery.eq('workspace_id', workspaceId);
    const { count: usageCount } = await usageQuery;

    const errors: string[] = [];
    if (analytics.total_assets === 0) errors.push('No assets in library');
    if (analytics.pending_approval > 10) errors.push(`${analytics.pending_approval} assets pending approval`);
    if (analytics.unused_assets > analytics.total_assets * 0.5) errors.push('More than 50% of assets are unused');

    return {
      healthy: errors.length === 0,
      total_assets: analytics.total_assets,
      active_assets: analytics.active_assets,
      pending_approval: analytics.pending_approval,
      expired_assets: analytics.expired_assets,
      total_categories: catCount ?? 0,
      total_tags: tagCount ?? 0,
      total_versions: verCount ?? 0,
      total_relationships: relCount ?? 0,
      total_usage_events: usageCount ?? 0,
      average_confidence: analytics.average_confidence,
      average_rating: analytics.average_rating,
      errors,
    };
  }

  // ----------------------------------------------------------
  // Recommendations
  // ----------------------------------------------------------

  async getRecommendations(request: AssetRecommendationRequest): Promise<AssetRecommendation[]> {
    let query = supabase
      .from('proposal_assets')
      .select('*')
      .eq('status', 'active')
      .eq('approval_status', 'approved')
      .order('usage_count', { ascending: false });

    if (request.workspaceId) query = query.eq('workspace_id', request.workspaceId);
    if (request.industry) query = query.eq('industry', request.industry);
    if (request.service) query = query.eq('service', request.service);
    if (request.assetTypes && request.assetTypes.length > 0) {
      query = query.in('asset_type', request.assetTypes);
    }
    query = query.limit(request.limit ?? 20);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get recommendations: ${error.message}`);

    return (data ?? []).map((asset) => {
      const a = asset as ProposalAssetRecord;
      let score = a.confidence_score * 0.3 + Math.min(a.usage_count / 100, 1) * 0.3;
      let reason = 'Based on usage and confidence';

      if (request.industry && a.industry === request.industry) {
        score += 0.2;
        reason = 'Industry match';
      }
      if (request.service && a.service === request.service) {
        score += 0.15;
        reason = 'Service match';
      }
      if (request.proposalType && a.asset_type.includes(request.proposalType)) {
        score += 0.1;
        reason = 'Proposal type match';
      }

      return { asset: a, relevance_score: Math.min(score, 1.0), reason };
    }).sort((a, b) => b.relevance_score - a.relevance_score);
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  private usage_counts: Record<string, number> = {};

  private async getCurrentVersionNumber(assetId: string): Promise<number> {
    const { data } = await supabase
      .from('asset_versions')
      .select('version_number')
      .eq('asset_id', assetId)
      .order('version_number', { ascending: false })
      .limit(1);

    return (data?.[0]?.version_number as number) ?? 0;
  }

  private calculateRelevanceScore(asset: ProposalAssetRecord, query?: string): number {
    if (!query) return asset.confidence_score * 0.5 + Math.min(asset.usage_count / 100, 1) * 0.5;
    let score = 0;
    const q = query.toLowerCase();
    if (asset.title.toLowerCase().includes(q)) score += 0.4;
    if (asset.content_text?.toLowerCase().includes(q)) score += 0.3;
    if (asset.description?.toLowerCase().includes(q)) score += 0.2;
    score += asset.confidence_score * 0.1;
    return Math.min(score, 1.0);
  }

  private getMatchedFields(asset: ProposalAssetRecord, query?: string): string[] {
    if (!query) return [];
    const fields: string[] = [];
    const q = query.toLowerCase();
    if (asset.title.toLowerCase().includes(q)) fields.push('title');
    if (asset.content_text?.toLowerCase().includes(q)) fields.push('content');
    if (asset.description?.toLowerCase().includes(q)) fields.push('description');
    return fields;
  }
}

export const proposalAssetLibrary = new ProposalAssetLibrary();
