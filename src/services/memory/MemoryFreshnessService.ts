// ============================================================
// MemoryFreshnessService — Manages memory freshness and expiration
// ============================================================

import { memoryRepository } from './MemoryRepository';
import { supabase } from '@/lib/supabase';
import type { MemoryEntityRecord } from '@/types/memory-engine';

class MemoryFreshnessService {
  private maxAgeMs = 1000 * 60 * 60 * 24 * 30; // 30 days
  private staleThresholdMs = 1000 * 60 * 60 * 24 * 7; // 7 days

  calculateFreshnessScore(entity: MemoryEntityRecord): number {
    const updatedAt = new Date(entity.updated_at).getTime();
    const ageMs = Date.now() - updatedAt;

    if (ageMs <= 0) return 1.0;
    if (ageMs >= this.maxAgeMs) return 0.0;

    // Exponential decay
    const decay = Math.exp(-ageMs / (this.maxAgeMs / 3));
    return Math.round(decay * 100) / 100;
  }

  isStale(entity: MemoryEntityRecord): boolean {
    return this.calculateFreshnessScore(entity) < 0.3;
  }

  isExpired(entity: MemoryEntityRecord): boolean {
    return this.calculateFreshnessScore(entity) < 0.1;
  }

  async refresh(memoryEntityId: string, workspaceId?: string | null): Promise<MemoryEntityRecord> {
    const entity = await memoryRepository.getEntity(memoryEntityId);
    if (!entity) throw new Error(`Memory entity not found: ${memoryEntityId}`);

    return memoryRepository.updateEntity(memoryEntityId, {
      ...entity,
      freshness_score: 1.0,
      version: entity.version,
    });
  }

  async refreshByEntity(entityType: string, entityId: string, memoryType: string, workspaceId?: string | null): Promise<MemoryEntityRecord | null> {
    const entity = await memoryRepository.getEntityByRef(entityType, entityId, memoryType, workspaceId);
    if (!entity) return null;
    return this.refresh(entity.id, workspaceId);
  }

  async expireStale(workspaceId?: string | null): Promise<number> {
    let query = supabase
      .from('memory_entities')
      .select('id, updated_at')
      .eq('is_active', true);

    if (workspaceId) query = query.eq('workspace_id', workspaceId);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load memories: ${error.message}`);

    const toExpire: string[] = [];
    for (const row of (data ?? []) as { id: string; updated_at: string }[]) {
      const ageMs = Date.now() - new Date(row.updated_at).getTime();
      if (ageMs >= this.maxAgeMs) {
        toExpire.push(row.id);
      }
    }

    if (toExpire.length > 0) {
      await supabase
        .from('memory_entities')
        .update({ is_active: false })
        .in('id', toExpire);

      // Record learning events
      for (const id of toExpire) {
        await memoryRepository.createLearningEvent({
          workspaceId,
          eventType: 'memory_expired',
          triggeredBy: 'memory_freshness_service',
          learningSummary: `Memory ${id} expired due to age`,
          confidence: 1.0,
        });
      }
    }

    return toExpire.length;
  }

  async updateFreshnessScores(workspaceId?: string | null): Promise<number> {
    let query = supabase
      .from('memory_entities')
      .select('id, updated_at')
      .eq('is_active', true);

    if (workspaceId) query = query.eq('workspace_id', workspaceId);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load memories: ${error.message}`);

    let updated = 0;
    for (const row of (data ?? []) as { id: string; updated_at: string }[]) {
      const ageMs = Date.now() - new Date(row.updated_at).getTime();
      const decay = ageMs <= 0 ? 1.0 : Math.exp(-ageMs / (this.maxAgeMs / 3));
      const freshness = Math.round(decay * 100) / 100;

      await supabase
        .from('memory_entities')
        .update({ freshness_score: freshness })
        .eq('id', row.id);
      updated++;
    }

    return updated;
  }
}

export const memoryFreshnessService = new MemoryFreshnessService();
