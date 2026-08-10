// ============================================================
// MemoryVersionService — Version history and snapshot management
// ============================================================

import { memoryRepository } from './MemoryRepository';
import type { MemoryEntityRecord, MemoryRecordRecord } from '@/types/memory-engine';

class MemoryVersionService {
  async getVersionHistory(memoryEntityId: string, limit?: number): Promise<MemoryRecordRecord[]> {
    return memoryRepository.getRecords(memoryEntityId, limit);
  }

  async getCurrentVersion(memoryEntityId: string): Promise<MemoryEntityRecord | null> {
    return memoryRepository.getEntity(memoryEntityId);
  }

  async createVersion(params: {
    memoryEntityId: string;
    source: string;
    content: Record<string, unknown>;
    embeddingReference?: string | null;
    workspaceId?: string | null;
  }): Promise<MemoryRecordRecord> {
    return memoryRepository.createRecord({
      workspaceId: params.workspaceId,
      memoryEntityId: params.memoryEntityId,
      source: params.source,
      content: params.content,
      embeddingReference: params.embeddingReference,
    });
  }

  async compareVersions(entityId: string): Promise<{
    current: MemoryEntityRecord | null;
    history: MemoryRecordRecord[];
  }> {
    const [current, history] = await Promise.all([
      memoryRepository.getEntity(entityId),
      memoryRepository.getRecords(entityId, 10),
    ]);

    return { current, history };
  }
}

export const memoryVersionService = new MemoryVersionService();
