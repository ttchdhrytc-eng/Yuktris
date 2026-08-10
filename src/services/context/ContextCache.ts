// ============================================================
// ContextCache — Smart caching with TTL, invalidation, and warming
// ============================================================

import { supabase } from '@/lib/supabase';
import type { AssembledContext, ContextCacheRecord } from '@/types/context-engine';

class ContextCache {
  private defaultTtlMs = 1000 * 60 * 30; // 30 minutes

  private buildCacheKey(entityType: string, entityId: string, contextType: string): string {
    return `context:${contextType}:${entityType}:${entityId}`;
  }

  async get(entityType: string, entityId: string, contextType: string): Promise<AssembledContext | null> {
    const cacheKey = this.buildCacheKey(entityType, entityId, contextType);

    const { data, error } = await supabase
      .from('context_cache')
      .select('*')
      .eq('cache_key', cacheKey)
      .maybeSingle();

    if (error || !data) return null;

    const record = data as ContextCacheRecord;
    const expiresAt = new Date(record.expires_at).getTime();
    if (Date.now() > expiresAt) {
      await this.invalidate(cacheKey);
      return null;
    }

    return record.context;
  }

  async set(params: {
    workspaceId?: string | null;
    entityType: string;
    entityId: string;
    contextType: string;
    context: AssembledContext;
    tokenCount: number;
    ttlMs?: number;
  }): Promise<void> {
    const cacheKey = this.buildCacheKey(params.entityType, params.entityId, params.contextType);
    const expiresAt = new Date(Date.now() + (params.ttlMs ?? this.defaultTtlMs)).toISOString();

    // Delete existing entry
    await supabase.from('context_cache').delete().eq('cache_key', cacheKey);

    // Insert new entry
    await supabase.from('context_cache').insert({
      workspace_id: params.workspaceId ?? null,
      cache_key: cacheKey,
      entity_type: params.entityType,
      entity_id: params.entityId,
      context: params.context,
      token_count: params.tokenCount,
      expires_at: expiresAt,
    });
  }

  async invalidate(cacheKey: string): Promise<void> {
    await supabase.from('context_cache').delete().eq('cache_key', cacheKey);
  }

  async invalidateEntity(entityType: string, entityId: string): Promise<void> {
    await supabase
      .from('context_cache')
      .delete()
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);
  }

  async invalidateWorkspace(workspaceId: string): Promise<void> {
    await supabase.from('context_cache').delete().eq('workspace_id', workspaceId);
  }

  async warm(params: {
    workspaceId?: string | null;
    entityType: string;
    entityId: string;
    contextType: string;
    context: AssembledContext;
    tokenCount: number;
  }): Promise<void> {
    await this.set({
      ...params,
      ttlMs: this.defaultTtlMs,
    });
  }

  async getStats(workspaceId?: string | null): Promise<{
    total_entries: number;
    expired_entries: number;
    avg_token_count: number;
  }> {
    let query = supabase.from('context_cache').select('token_count, expires_at');
    if (workspaceId) query = query.eq('workspace_id', workspaceId);

    const { data, error } = await query;
    if (error || !data) return { total_entries: 0, expired_entries: 0, avg_token_count: 0 };

    const now = Date.now();
    const expired = data.filter((r) => new Date((r as { expires_at: string }).expires_at).getTime() < now).length;
    const avgTokens = data.length > 0
      ? data.reduce((sum, r) => sum + ((r as { token_count: number }).token_count ?? 0), 0) / data.length
      : 0;

    return {
      total_entries: data.length,
      expired_entries: expired,
      avg_token_count: Math.round(avgTokens),
    };
  }

  async cleanup(): Promise<number> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('context_cache')
      .delete()
      .lt('expires_at', now)
      .select('id');

    if (error) return 0;
    return data?.length ?? 0;
  }

  setTtl(ttlMs: number): void {
    this.defaultTtlMs = ttlMs;
  }
}

export const contextCache = new ContextCache();
