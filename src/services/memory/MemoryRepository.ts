// ============================================================
// MemoryRepository — Data access layer for memory entities
// ============================================================

import { supabase } from '@/lib/supabase';
import type {
  MemoryEntityRecord,
  MemoryRecordRecord,
  MemoryRelationshipRecord,
  LearningEventRecord,
  MemoryStoreRequest,
  EntityType,
  MemoryType,
  LearningEventType,
  MemoryRelationshipType,
} from '@/types/memory-engine';

class MemoryRepository {
  // ----------------------------------------------------------
  // Memory Entities
  // ----------------------------------------------------------

  async createEntity(params: {
    workspaceId?: string | null;
    entityType: EntityType;
    entityId: string;
    memoryType: MemoryType;
    title: string;
    summary?: string | null;
    content?: Record<string, unknown>;
    confidenceScore?: number;
    freshnessScore?: number;
    importanceScore?: number;
  }): Promise<MemoryEntityRecord> {
    const { data, error } = await supabase
      .from('memory_entities')
      .insert({
        workspace_id: params.workspaceId ?? null,
        entity_type: params.entityType,
        entity_id: params.entityId,
        memory_type: params.memoryType,
        title: params.title,
        summary: params.summary ?? null,
        content: params.content ?? {},
        confidence_score: params.confidenceScore ?? 0.5,
        freshness_score: params.freshnessScore ?? 1.0,
        importance_score: params.importanceScore ?? 0.5,
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to create memory entity: ${error.message}`);
    return data as MemoryEntityRecord;
  }

  async getEntity(id: string): Promise<MemoryEntityRecord | null> {
    const { data, error } = await supabase
      .from('memory_entities')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to get memory entity: ${error.message}`);
    return data as MemoryEntityRecord | null;
  }

  async getEntityByRef(entityType: string, entityId: string, memoryType: string, workspaceId?: string | null): Promise<MemoryEntityRecord | null> {
    let query = supabase
      .from('memory_entities')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('memory_type', memoryType)
      .eq('is_active', true);

    if (workspaceId) query = query.eq('workspace_id', workspaceId);

    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`Failed to get memory entity: ${error.message}`);
    return data as MemoryEntityRecord | null;
  }

  async updateEntity(id: string, updates: Partial<MemoryEntityRecord>): Promise<MemoryEntityRecord> {
    const updateFields: Record<string, unknown> = {};
    if (updates.title !== undefined) updateFields.title = updates.title;
    if (updates.summary !== undefined) updateFields.summary = updates.summary;
    if (updates.content !== undefined) updateFields.content = updates.content;
    if (updates.confidence_score !== undefined) updateFields.confidence_score = updates.confidence_score;
    if (updates.freshness_score !== undefined) updateFields.freshness_score = updates.freshness_score;
    if (updates.importance_score !== undefined) updateFields.importance_score = updates.importance_score;
    if (updates.is_active !== undefined) updateFields.is_active = updates.is_active;
    updateFields.version = (updates.version ?? 0) + 1;

    const { data, error } = await supabase
      .from('memory_entities')
      .update(updateFields)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to update memory entity: ${error.message}`);
    return data as MemoryEntityRecord;
  }

  async deactivateEntity(id: string): Promise<void> {
    await supabase
      .from('memory_entities')
      .update({ is_active: false })
      .eq('id', id);
  }

  async searchEntities(params: {
    query?: string;
    entityType?: string;
    entityId?: string;
    memoryType?: string;
    minConfidence?: number;
    minImportance?: number;
    minFreshness?: number;
    limit?: number;
    workspaceId?: string | null;
  }): Promise<MemoryEntityRecord[]> {
    let query = supabase
      .from('memory_entities')
      .select('*')
      .eq('is_active', true)
      .order('importance_score', { ascending: false });

    if (params.workspaceId) query = query.eq('workspace_id', params.workspaceId);
    if (params.entityType) query = query.eq('entity_type', params.entityType);
    if (params.entityId) query = query.eq('entity_id', params.entityId);
    if (params.memoryType) query = query.eq('memory_type', params.memoryType);
    if (params.minConfidence !== undefined) query = query.gte('confidence_score', params.minConfidence);
    if (params.minImportance !== undefined) query = query.gte('importance_score', params.minImportance);
    if (params.minFreshness !== undefined) query = query.gte('freshness_score', params.minFreshness);
    if (params.query) query = query.or(`title.ilike.%${params.query}%,summary.ilike.%${params.query}%`);
    if (params.limit) query = query.limit(params.limit);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to search memory entities: ${error.message}`);
    return (data ?? []) as MemoryEntityRecord[];
  }

  async count(workspaceId?: string | null): Promise<number> {
    let query = supabase
      .from('memory_entities')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (workspaceId) query = query.eq('workspace_id', workspaceId);

    const { count, error } = await query;
    if (error) throw new Error(`Failed to count memory entities: ${error.message}`);
    return count ?? 0;
  }

  // ----------------------------------------------------------
  // Memory Records (version history)
  // ----------------------------------------------------------

  async createRecord(params: {
    workspaceId?: string | null;
    memoryEntityId: string;
    source: string;
    content?: Record<string, unknown>;
    embeddingReference?: string | null;
  }): Promise<MemoryRecordRecord> {
    const { data, error } = await supabase
      .from('memory_records')
      .insert({
        workspace_id: params.workspaceId ?? null,
        memory_entity_id: params.memoryEntityId,
        source: params.source,
        content: params.content ?? {},
        embedding_reference: params.embeddingReference ?? null,
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to create memory record: ${error.message}`);
    return data as MemoryRecordRecord;
  }

  async getRecords(memoryEntityId: string, limit?: number): Promise<MemoryRecordRecord[]> {
    let query = supabase
      .from('memory_records')
      .select('*')
      .eq('memory_entity_id', memoryEntityId)
      .order('created_at', { ascending: false });

    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get memory records: ${error.message}`);
    return (data ?? []) as MemoryRecordRecord[];
  }

  // ----------------------------------------------------------
  // Memory Relationships
  // ----------------------------------------------------------

  async createRelationship(params: {
    workspaceId?: string | null;
    sourceMemoryId: string;
    targetMemoryId: string;
    relationshipType: MemoryRelationshipType;
    strength?: number;
  }): Promise<MemoryRelationshipRecord> {
    const { data, error } = await supabase
      .from('memory_relationships')
      .insert({
        workspace_id: params.workspaceId ?? null,
        source_memory_id: params.sourceMemoryId,
        target_memory_id: params.targetMemoryId,
        relationship_type: params.relationshipType,
        strength: params.strength ?? 0.5,
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to create memory relationship: ${error.message}`);
    return data as MemoryRelationshipRecord;
  }

  async getRelationships(memoryId: string): Promise<MemoryRelationshipRecord[]> {
    const { data, error } = await supabase
      .from('memory_relationships')
      .select('*')
      .or(`source_memory_id.eq.${memoryId},target_memory_id.eq.${memoryId}`)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get memory relationships: ${error.message}`);
    return (data ?? []) as MemoryRelationshipRecord[];
  }

  async relocateRelationships(oldMemoryId: string, newMemoryId: string): Promise<number> {
    // Update source relationships
    const { data: sourceUpdates, error: sourceError } = await supabase
      .from('memory_relationships')
      .update({ source_memory_id: newMemoryId })
      .eq('source_memory_id', oldMemoryId)
      .select('id');

    if (sourceError) throw new Error(`Failed to relocate source relationships: ${sourceError.message}`);

    // Update target relationships
    const { data: targetUpdates, error: targetError } = await supabase
      .from('memory_relationships')
      .update({ target_memory_id: newMemoryId })
      .eq('target_memory_id', oldMemoryId)
      .select('id');

    if (targetError) throw new Error(`Failed to relocate target relationships: ${targetError.message}`);

    return (sourceUpdates?.length ?? 0) + (targetUpdates?.length ?? 0);
  }

  // ----------------------------------------------------------
  // Learning Events
  // ----------------------------------------------------------

  async createLearningEvent(params: {
    workspaceId?: string | null;
    eventType: LearningEventType;
    entityType?: string | null;
    entityId?: string | null;
    triggeredBy?: string;
    learningSummary?: string | null;
    confidence?: number;
  }): Promise<LearningEventRecord> {
    const { data, error } = await supabase
      .from('learning_events')
      .insert({
        workspace_id: params.workspaceId ?? null,
        event_type: params.eventType,
        entity_type: params.entityType ?? null,
        entity_id: params.entityId ?? null,
        triggered_by: params.triggeredBy ?? 'system',
        learning_summary: params.learningSummary ?? null,
        confidence: params.confidence ?? 0.5,
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to create learning event: ${error.message}`);
    return data as LearningEventRecord;
  }

  async getLearningEvents(limit?: number, workspaceId?: string | null): Promise<LearningEventRecord[]> {
    let query = supabase
      .from('learning_events')
      .select('*')
      .order('created_at', { ascending: false });

    if (workspaceId) query = query.eq('workspace_id', workspaceId);
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get learning events: ${error.message}`);
    return (data ?? []) as LearningEventRecord[];
  }

  async countLearningEvents(workspaceId?: string | null): Promise<number> {
    let query = supabase
      .from('learning_events')
      .select('*', { count: 'exact', head: true });

    if (workspaceId) query = query.eq('workspace_id', workspaceId);

    const { count } = await query;
    return count ?? 0;
  }
}

export const memoryRepository = new MemoryRepository();
