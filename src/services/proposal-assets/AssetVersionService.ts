// ============================================================
// AssetVersionService — Version management for assets
// ============================================================

import { supabase } from '@/lib/supabase';
import type { AssetVersionRecord } from '@/types/proposal-assets';

class AssetVersionService {
  async createVersion(params: {
    workspaceId?: string | null;
    assetId: string;
    content: Record<string, unknown>;
    contentText?: string;
    changeSummary?: string;
    createdBy?: string;
  }): Promise<AssetVersionRecord> {
    const versionNumber = await this.getNextVersionNumber(params.assetId);

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

  async compareVersions(versionIdA: string, versionIdB: string): Promise<{
    versionA: AssetVersionRecord;
    versionB: AssetVersionRecord;
    differences: string[];
  }> {
    const [aRes, bRes] = await Promise.all([
      supabase.from('asset_versions').select('*').eq('id', versionIdA).maybeSingle(),
      supabase.from('asset_versions').select('*').eq('id', versionIdB).maybeSingle(),
    ]);

    const versionA = aRes.data as AssetVersionRecord;
    const versionB = bRes.data as AssetVersionRecord;

    if (!versionA || !versionB) throw new Error('One or both versions not found');

    const differences: string[] = [];
    if (JSON.stringify(versionA.content) !== JSON.stringify(versionB.content)) {
      differences.push('Content changed');
    }
    if (versionA.content_text !== versionB.content_text) {
      differences.push('Text content changed');
    }

    return { versionA, versionB, differences };
  }

  private async getNextVersionNumber(assetId: string): Promise<number> {
    const { data } = await supabase
      .from('asset_versions')
      .select('version_number')
      .eq('asset_id', assetId)
      .order('version_number', { ascending: false })
      .limit(1);

    return ((data?.[0]?.version_number as number) ?? 0) + 1;
  }
}

export const assetVersionService = new AssetVersionService();
