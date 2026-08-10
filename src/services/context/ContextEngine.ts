// ============================================================
// ContextEngine — Central facade for all context operations
// ============================================================
//
// This is the single entry point for all AI agents requesting context.
// No agent should directly query databases, integrations, research
// services, CRM, Gmail, Calendar, or the Knowledge Graph.
// They all request context through this engine.

import { contextBuilder } from './ContextBuilder';
import { contextCollector } from './ContextCollector';
import { contextCache } from './ContextCache';
import { contextVersionManager } from './ContextVersionManager';
import { promptContextBuilder } from './PromptContextBuilder';
import { contextValidator } from './ContextValidator';
import { supabase } from '@/lib/supabase';
import type {
  ContextRequest,
  AssembledContext,
  ContextProfileRecord,
  ContextSnapshotRecord,
  ContextHealth,
  ContextMonitorSummary,
  SourceContribution,
} from '@/types/context-engine';

class ContextEngine {
  // ----------------------------------------------------------
  // Build — Main pipeline entry point
  // ----------------------------------------------------------

  async build(request: ContextRequest): Promise<{
    context: AssembledContext;
    profileId: string;
    sourceContributions: SourceContribution[];
    cached: boolean;
  }> {
    return contextBuilder.build(request);
  }

  // ----------------------------------------------------------
  // Build Prompt — Generate AI-ready prompt string
  // ----------------------------------------------------------

  async buildPrompt(request: ContextRequest): Promise<{
    prompt: string;
    context: AssembledContext;
    tokenCount: number;
  }> {
    const result = await this.build(request);
    const prompt = promptContextBuilder.buildPromptContext(result.context);
    return {
      prompt,
      context: result.context,
      tokenCount: result.context.metadata.token_count,
    };
  }

  // ----------------------------------------------------------
  // Refresh — Invalidate cache and rebuild
  // ----------------------------------------------------------

  async refresh(request: ContextRequest): Promise<{
    context: AssembledContext;
    profileId: string;
    sourceContributions: SourceContribution[];
    cached: boolean;
  }> {
    if (request.entityId && request.entityType) {
      await contextCache.invalidateEntity(request.entityType, request.entityId);
    }
    return this.build(request);
  }

  // ----------------------------------------------------------
  // Get Context — Retrieve existing context (from cache or profile)
  // ----------------------------------------------------------

  async getContext(entityType: string, entityId: string, contextType: string): Promise<AssembledContext | null> {
    // Try cache first
    const cached = await contextCache.get(entityType, entityId, contextType);
    if (cached) return cached;

    // Try to find profile and get latest snapshot
    const profile = await contextVersionManager.getProfileByEntity(entityType, entityId);
    if (!profile) return null;

    const snapshots = await contextVersionManager.getSnapshots(profile.id, 1);
    if (snapshots.length === 0) return null;

    return snapshots[0].assembled_context;
  }

  // ----------------------------------------------------------
  // History — Get snapshot history for an entity
  // ----------------------------------------------------------

  async getHistory(entityType: string, entityId: string, limit?: number): Promise<ContextSnapshotRecord[]> {
    const profile = await contextVersionManager.getProfileByEntity(entityType, entityId);
    if (!profile) return [];
    return contextVersionManager.getSnapshots(profile.id, limit);
  }

  async getProfileHistory(profileId: string, limit?: number): Promise<ContextSnapshotRecord[]> {
    return contextVersionManager.getSnapshots(profileId, limit);
  }

  // ----------------------------------------------------------
  // Profiles
  // ----------------------------------------------------------

  async getProfiles(workspaceId?: string | null, limit?: number): Promise<ContextProfileRecord[]> {
    return contextVersionManager.getAllProfiles(workspaceId, limit);
  }

  async getProfile(profileId: string): Promise<ContextProfileRecord | null> {
    return contextVersionManager.getProfile(profileId);
  }

  // ----------------------------------------------------------
  // Cache Management
  // ----------------------------------------------------------

  async invalidateCache(entityType: string, entityId: string): Promise<void> {
    await contextCache.invalidateEntity(entityType, entityId);
  }

  async invalidateWorkspaceCache(workspaceId: string): Promise<void> {
    await contextCache.invalidateWorkspace(workspaceId);
  }

  async cleanupCache(): Promise<number> {
    return contextCache.cleanup();
  }

  async getCacheStats(workspaceId?: string | null) {
    return contextCache.getStats(workspaceId);
  }

  // ----------------------------------------------------------
  // Sources
  // ----------------------------------------------------------

  getAvailableSources() {
    return contextCollector.getAllSourceLabels();
  }

  // ----------------------------------------------------------
  // Health
  // ----------------------------------------------------------

  async getHealth(workspaceId?: string | null): Promise<ContextHealth> {
    const profiles = await this.getProfiles(workspaceId);
    const activeProfiles = profiles.filter((p) => p.status === 'active');
    const staleProfiles = profiles.filter((p) => p.status === 'stale');
    const cacheStats = await this.getCacheStats(workspaceId);

    let totalSnapshots = 0;
    for (const profile of profiles) {
      const snapshots = await this.getProfileHistory(profile.id, 1);
      totalSnapshots += snapshots.length;
    }

    const avgTokenCount = profiles.length > 0
      ? profiles.reduce((sum, p) => sum + p.token_count, 0) / profiles.length
      : 0;

    const avgBuildDuration = profiles.length > 0
      ? profiles.reduce((sum, p) => sum + (p.build_duration_ms ?? 0), 0) / profiles.length
      : 0;

    const avgQuality = profiles.length > 0
      ? profiles.reduce((sum, p) => sum + p.quality_score, 0) / profiles.length
      : 0;

    const avgCompression = profiles.length > 0
      ? profiles.reduce((sum, p) => sum + p.compression_ratio, 0) / profiles.length
      : 0;

    const errors: string[] = [];
    if (profiles.length === 0) errors.push('No context profiles generated');
    if (staleProfiles.length > activeProfiles.length) errors.push('More stale profiles than active');

    return {
      healthy: errors.length === 0,
      total_profiles: profiles.length,
      active_profiles: activeProfiles.length,
      stale_profiles: staleProfiles.length,
      total_snapshots: totalSnapshots,
      cache_entries: cacheStats.total_entries,
      cache_hit_rate: 0,
      average_token_count: Math.round(avgTokenCount),
      average_build_duration_ms: Math.round(avgBuildDuration),
      average_quality_score: Math.round(avgQuality * 100) / 100,
      average_compression_ratio: Math.round(avgCompression * 100) / 100,
      errors,
    };
  }

  // ----------------------------------------------------------
  // Monitoring Summary
  // ----------------------------------------------------------

  async getSummary(workspaceId?: string | null): Promise<ContextMonitorSummary> {
    const profiles = await this.getProfiles(workspaceId);
    const cacheStats = await this.getCacheStats(workspaceId);

    const avgTokenCount = profiles.length > 0
      ? profiles.reduce((sum, p) => sum + p.token_count, 0) / profiles.length
      : 0;

    const avgBuildDuration = profiles.length > 0
      ? profiles.reduce((sum, p) => sum + (p.build_duration_ms ?? 0), 0) / profiles.length
      : 0;

    const avgQuality = profiles.length > 0
      ? profiles.reduce((sum, p) => sum + p.quality_score, 0) / profiles.length
      : 0;

    const avgCompression = profiles.length > 0
      ? profiles.reduce((sum, p) => sum + p.compression_ratio, 0) / profiles.length
      : 0;

    const avgSources = profiles.length > 0
      ? profiles.reduce((sum, p) => sum + p.source_count, 0) / profiles.length
      : 0;

    const typeDist: Record<string, number> = {};
    for (const p of profiles) {
      typeDist[p.context_type] = (typeDist[p.context_type] ?? 0) + 1;
    }

    const sourceUsage: Record<string, number> = {};
    for (const p of profiles) {
      const snapshots = await this.getProfileHistory(p.id, 1);
      for (const snap of snapshots) {
        for (const contrib of (snap.source_contributions ?? [])) {
          sourceUsage[contrib.source] = (sourceUsage[contrib.source] ?? 0) + 1;
        }
      }
    }

    return {
      total_profiles: profiles.length,
      active_profiles: profiles.filter((p) => p.status === 'active').length,
      stale_profiles: profiles.filter((p) => p.status === 'stale').length,
      total_snapshots: 0,
      cache_entries: cacheStats.total_entries,
      cache_hit_rate: 0,
      average_token_count: Math.round(avgTokenCount),
      average_build_duration_ms: Math.round(avgBuildDuration),
      average_quality_score: Math.round(avgQuality * 100) / 100,
      average_compression_ratio: Math.round(avgCompression * 100) / 100,
      average_sources_used: Math.round(avgSources),
      context_type_distribution: typeDist,
      source_usage: sourceUsage,
    };
  }

  // ----------------------------------------------------------
  // Preview — Build context without persisting (for inspector)
  // ----------------------------------------------------------

  async preview(request: ContextRequest): Promise<{
    context: AssembledContext;
    fragments: { source: string; source_label: string; priority: string; token_estimate: number; confidence: number }[];
    validation: { valid: boolean; errors: string[]; warnings: string[] };
  }> {
    const sources = contextCollector.getAllSourceLabels().map((s) => s.id);
    const fragments = await contextCollector.collect({ ...request, sources });
    const validation = contextValidator.validateFragments(fragments, request);

    const safeFragments = fragments.map((f) => ({
      ...f,
      content: contextValidator.maskSensitiveData(f.content),
    }));

    const ranked = contextRanker.rank(safeFragments, request);
    const tokenBudget = request.tokenBudget ?? 8000;
    const { included, usedTokens } = contextRanker.allocateTokenBudget(ranked, tokenBudget);

    const qualityScore = contextValidator.calculateQualityScore(included, {} as AssembledContext);
    const context = contextAssembler.assemble({
      fragments: included,
      request,
      tokenCount: usedTokens,
      compressionRatio: 1.0,
      qualityScore,
      buildDurationMs: 0,
    });

    return {
      context,
      fragments: included.map((f) => ({
        source: f.source,
        source_label: f.source_label,
        priority: f.priority,
        token_estimate: f.token_estimate,
        confidence: f.confidence,
      })),
      validation,
    };
  }
}

// Import at the bottom to avoid circular dependency issues
import { contextRanker } from './ContextRanker';
import { contextAssembler } from './ContextAssembler';

export const contextEngine = new ContextEngine();
