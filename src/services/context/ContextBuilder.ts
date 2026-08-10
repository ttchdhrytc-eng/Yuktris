// ============================================================
// ContextBuilder — Orchestrates the context assembly pipeline
// ============================================================

import { contextCollector } from './ContextCollector';
import { contextRanker } from './ContextRanker';
import { contextCompressor } from './ContextCompressor';
import { contextSummarizer } from './ContextSummarizer';
import { contextValidator } from './ContextValidator';
import { contextCache } from './ContextCache';
import { contextResolver } from './ContextResolver';
import { contextAssembler } from './ContextAssembler';
import { contextVersionManager } from './ContextVersionManager';
import type {
  ContextRequest,
  ContextFragment,
  AssembledContext,
  SourceContribution,
} from '@/types/context-engine';

class ContextBuilder {
  async build(request: ContextRequest): Promise<{
    context: AssembledContext;
    profileId: string;
    sourceContributions: SourceContribution[];
    cached: boolean;
  }> {
    const start = Date.now();

    // 1. Check cache
    if (request.entityId && request.entityType) {
      const cached = await contextCache.get(request.entityType, request.entityId, request.contextType);
      if (cached) {
        const profileId = await this.getOrCreateProfile(request, cached.metadata.token_count, cached.metadata.source_count, 1.0, cached.metadata.quality_score, 0);
        return {
          context: cached,
          profileId,
          sourceContributions: [],
          cached: true,
        };
      }
    }

    // 2. Resolve sources
    const sources = contextResolver.resolveSources(request);
    const tokenBudget = contextResolver.resolveTokenBudget(request);

    // 3. Collect fragments
    const fragments = await contextCollector.collect({ ...request, sources });

    // 4. Validate fragments
    const validation = contextValidator.validateFragments(fragments, request);

    // 5. Mask sensitive data
    const safeFragments = fragments.map((f) => ({
      ...f,
      content: contextValidator.maskSensitiveData(f.content),
    }));

    // 6. Rank fragments
    const ranked = contextRanker.rank(safeFragments, request);

    // 7. Allocate token budget
    const { included, usedTokens } = contextRanker.allocateTokenBudget(ranked, tokenBudget);

    // 8. Compress if needed
    let finalFragments = included;
    let compressionRatio = 1.0;
    if (usedTokens > tokenBudget * 0.9) {
      const compressed = contextCompressor.compress(included, tokenBudget);
      finalFragments = compressed.compressed;
      compressionRatio = compressed.ratio;
    }

    // 9. Assemble context
    const qualityScore = contextValidator.calculateQualityScore(finalFragments, {} as AssembledContext);
    const buildDurationMs = Date.now() - start;

    const context = contextAssembler.assemble({
      fragments: finalFragments,
      request,
      tokenCount: usedTokens,
      compressionRatio,
      qualityScore,
      buildDurationMs,
    });

    // 10. Validate assembled context
    const assembledValidation = contextValidator.validateAssembled(context);

    // 11. Create profile and snapshot
    const profileId = await contextVersionManager.createProfile({
      workspaceId: request.workspaceId,
      contextName: contextResolver.resolveContextName(request),
      contextType: request.contextType,
      entityType: request.entityType,
      entityId: request.entityId,
      tokenCount: usedTokens,
      sourceCount: finalFragments.length,
      compressionRatio,
      qualityScore,
      buildDurationMs,
    });

    const sourceContributions = contextAssembler.buildSourceContributions(finalFragments);

    await contextVersionManager.createSnapshot({
      workspaceId: request.workspaceId,
      profileId,
      version: 1,
      assembledContext: context,
      tokenCount: usedTokens,
      sourceContributions,
    });

    // 12. Cache the context
    if (request.entityId && request.entityType) {
      await contextCache.set({
        workspaceId: request.workspaceId,
        entityType: request.entityType,
        entityId: request.entityId,
        contextType: request.contextType,
        context,
        tokenCount: usedTokens,
      });
    }

    return {
      context,
      profileId,
      sourceContributions,
      cached: false,
    };
  }

  private async getOrCreateProfile(
    request: ContextRequest,
    tokenCount: number,
    sourceCount: number,
    compressionRatio: number,
    qualityScore: number,
    buildDurationMs: number
  ): Promise<string> {
    if (request.entityType && request.entityId) {
      const existing = await contextVersionManager.getProfileByEntity(request.entityType, request.entityId);
      if (existing) return existing.id;
    }

    return contextVersionManager.createProfile({
      workspaceId: request.workspaceId,
      contextName: contextResolver.resolveContextName(request),
      contextType: request.contextType,
      entityType: request.entityType,
      entityId: request.entityId,
      tokenCount,
      sourceCount,
      compressionRatio,
      qualityScore,
      buildDurationMs,
    });
  }
}

export const contextBuilder = new ContextBuilder();
