// ============================================================
// ContextVersionManager — Versioning and snapshot management
// ============================================================

import { supabase } from '@/lib/supabase';
import type {
  ContextProfileRecord,
  ContextSnapshotRecord,
  AssembledContext,
  SourceContribution,
} from '@/types/context-engine';

class ContextVersionManager {
  async createProfile(params: {
    workspaceId?: string | null;
    contextName: string;
    contextType: string;
    entityType?: string | null;
    entityId?: string | null;
    tokenCount: number;
    sourceCount: number;
    compressionRatio: number;
    qualityScore: number;
    buildDurationMs: number;
  }): Promise<string> {
    const { data, error } = await supabase
      .from('context_profiles')
      .insert({
        workspace_id: params.workspaceId ?? null,
        context_name: params.contextName,
        context_type: params.contextType,
        entity_type: params.entityType ?? null,
        entity_id: params.entityId ?? null,
        version: 1,
        status: 'active',
        token_count: params.tokenCount,
        source_count: params.sourceCount,
        compression_ratio: params.compressionRatio,
        quality_score: params.qualityScore,
        build_duration_ms: params.buildDurationMs,
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to create context profile: ${error.message}`);
    return (data as ContextProfileRecord)?.id ?? '';
  }

  async updateProfile(profileId: string, updates: Partial<ContextProfileRecord>): Promise<void> {
    const updateFields: Record<string, unknown> = {};
    if (updates.status !== undefined) updateFields.status = updates.status;
    if (updates.token_count !== undefined) updateFields.token_count = updates.token_count;
    if (updates.source_count !== undefined) updateFields.source_count = updates.source_count;
    if (updates.compression_ratio !== undefined) updateFields.compression_ratio = updates.compression_ratio;
    if (updates.quality_score !== undefined) updateFields.quality_score = updates.quality_score;
    if (updates.build_duration_ms !== undefined) updateFields.build_duration_ms = updates.build_duration_ms;
    updateFields.version = (updates.version ?? 0) + 1;

    await supabase.from('context_profiles').update(updateFields).eq('id', profileId);
  }

  async createSnapshot(params: {
    workspaceId?: string | null;
    profileId: string;
    version: number;
    assembledContext: AssembledContext;
    tokenCount: number;
    sourceContributions: SourceContribution[];
  }): Promise<string> {
    const { data, error } = await supabase
      .from('context_snapshots')
      .insert({
        workspace_id: params.workspaceId ?? null,
        context_profile_id: params.profileId,
        snapshot_version: params.version,
        assembled_context: params.assembledContext,
        token_count: params.tokenCount,
        source_contributions: params.sourceContributions,
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to create snapshot: ${error.message}`);
    return (data as ContextSnapshotRecord)?.id ?? '';
  }

  async getProfile(profileId: string): Promise<ContextProfileRecord | null> {
    const { data, error } = await supabase
      .from('context_profiles')
      .select('*')
      .eq('id', profileId)
      .maybeSingle();

    if (error) throw new Error(`Failed to get profile: ${error.message}`);
    return data as ContextProfileRecord | null;
  }

  async getProfileByEntity(entityType: string, entityId: string): Promise<ContextProfileRecord | null> {
    const { data, error } = await supabase
      .from('context_profiles')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Failed to get profile: ${error.message}`);
    return data as ContextProfileRecord | null;
  }

  async getSnapshots(profileId: string, limit?: number): Promise<ContextSnapshotRecord[]> {
    let query = supabase
      .from('context_snapshots')
      .select('*')
      .eq('context_profile_id', profileId)
      .order('created_at', { ascending: false });

    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get snapshots: ${error.message}`);
    return (data ?? []) as ContextSnapshotRecord[];
  }

  async getAllProfiles(workspaceId?: string | null, limit?: number): Promise<ContextProfileRecord[]> {
    let query = supabase
      .from('context_profiles')
      .select('*')
      .order('updated_at', { ascending: false });

    if (workspaceId) query = query.eq('workspace_id', workspaceId);
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get profiles: ${error.message}`);
    return (data ?? []) as ContextProfileRecord[];
  }

  async markStale(profileId: string): Promise<void> {
    await this.updateProfile(profileId, { status: 'stale' });
  }

  async markActive(profileId: string): Promise<void> {
    await this.updateProfile(profileId, { status: 'active' });
  }
}

export const contextVersionManager = new ContextVersionManager();
