// ============================================================
// ResearchCache — Intelligent caching with TTL, versioning, partial updates
// ============================================================

import { supabase } from '@/lib/supabase';
import type { CacheStats } from '@/types/research-intelligence';

class ResearchCache {
  private defaultTtlMs = 1000 * 60 * 60 * 24; // 24 hours
  private version = 1;
  private cacheHits = 0;
  private cacheMisses = 0;

  private buildKey(companyName: string, requestType: string): string {
    return `research:${requestType}:${companyName.toLowerCase().replace(/\s+/g, '-')}`;
  }

  async get<T>(companyName: string, requestType: string): Promise<T | null> {
    const key = this.buildKey(companyName, requestType);

    const { data, error } = await supabase
      .from('company_intelligence')
      .select('*')
      .ilike('company_name', companyName)
      .order('last_updated', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      this.cacheMisses++;
      return null;
    }

    const updatedAt = new Date(data.last_updated).getTime();
    const now = Date.now();
    if (now - updatedAt > this.defaultTtlMs) {
      this.cacheMisses++;
      return null;
    }

    this.cacheHits++;
    return data as T;
  }

  async set(companyName: string, requestType: string, value: Record<string, unknown>, confidence: number): Promise<void> {
    const key = this.buildKey(companyName, requestType);

    const { error } = await supabase
      .from('company_intelligence')
      .upsert({
        company_name: companyName,
        ...value,
        confidence_score: confidence,
        last_updated: new Date().toISOString(),
      }, { onConflict: 'company_name' });

    if (error) console.error('[ResearchCache] Failed to cache:', error.message);
  }

  async invalidate(companyName: string): Promise<void> {
    await supabase
      .from('company_intelligence')
      .update({ last_updated: new Date(0).toISOString() })
      .ilike('company_name', companyName);
  }

  async getStats(): Promise<CacheStats> {
    const { count, error } = await supabase
      .from('company_intelligence')
      .select('*', { count: 'exact', head: true });

    if (error || count === null) {
      return {
        total_entries: 0,
        hit_count: 0,
        miss_count: 0,
        hit_rate: 0,
        oldest_entry: null,
        newest_entry: null,
      };
    }

    const { data: oldest } = await supabase
      .from('company_intelligence')
      .select('last_updated')
      .order('last_updated', { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: newest } = await supabase
      .from('company_intelligence')
      .select('last_updated')
      .order('last_updated', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      total_entries: count,
      hit_count: this.cacheHits,
      miss_count: this.cacheMisses,
      hit_rate: (this.cacheHits + this.cacheMisses) > 0 ? this.cacheHits / (this.cacheHits + this.cacheMisses) : 0,
      oldest_entry: oldest?.last_updated ?? null,
      newest_entry: newest?.last_updated ?? null,
    };
  }

  setTtl(ttlMs: number): void {
    this.defaultTtlMs = ttlMs;
  }

  setVersion(version: number): void {
    this.version = version;
  }
}

export const researchCache = new ResearchCache();
