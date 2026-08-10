// ============================================================
// AssetExportService — Export assets in various formats
// ============================================================

import { supabase } from '@/lib/supabase';
import type { ProposalAssetRecord, AssetType } from '@/types/proposal-assets';

class AssetExportService {
  async exportToJson(params: {
    assetIds?: string[];
    assetType?: AssetType;
    workspaceId?: string | null;
  }): Promise<string> {
    const assets = await this.loadAssets(params);
    return JSON.stringify(assets, null, 2);
  }

  async exportToCsv(params: {
    assetIds?: string[];
    assetType?: AssetType;
    workspaceId?: string | null;
  }): Promise<string> {
    const assets = await this.loadAssets(params);

    const headers = ['id', 'title', 'description', 'asset_type', 'industry', 'service', 'status', 'approval_status', 'version', 'confidence_score', 'usage_count', 'language', 'owner', 'created_at', 'updated_at'];
    const rows = assets.map((a) => [
      a.id,
      `"${a.title.replace(/"/g, '""')}"`,
      `"${(a.description ?? '').replace(/"/g, '""')}"`,
      a.asset_type,
      a.industry ?? '',
      a.service ?? '',
      a.status,
      a.approval_status,
      String(a.version),
      String(a.confidence_score),
      String(a.usage_count),
      a.language,
      a.owner ?? '',
      a.created_at,
      a.updated_at,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  async exportToMarkdown(params: {
    assetIds?: string[];
    assetType?: AssetType;
    workspaceId?: string | null;
  }): Promise<string> {
    const assets = await this.loadAssets(params);

    const lines: string[] = ['# Proposal Asset Library Export', ''];

    for (const asset of assets) {
      lines.push(`## ${asset.title}`);
      lines.push(`- **Type:** ${asset.asset_type.replace(/_/g, ' ')}`);
      lines.push(`- **Industry:** ${asset.industry ?? 'N/A'}`);
      lines.push(`- **Service:** ${asset.service ?? 'N/A'}`);
      lines.push(`- **Status:** ${asset.status}`);
      lines.push(`- **Approval:** ${asset.approval_status}`);
      lines.push(`- **Version:** ${asset.version}`);
      lines.push(`- **Confidence:** ${Math.round(asset.confidence_score * 100)}%`);
      lines.push(`- **Usage Count:** ${asset.usage_count}`);

      if (asset.description) {
        lines.push(`\n**Description:** ${asset.description}`);
      }

      if (asset.content_text) {
        lines.push(`\n### Content\n\`\`\`\n${asset.content_text}\n\`\`\``);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  private async loadAssets(params: {
    assetIds?: string[];
    assetType?: AssetType;
    workspaceId?: string | null;
  }): Promise<ProposalAssetRecord[]> {
    let query = supabase.from('proposal_assets').select('*').order('title', { ascending: true });

    if (params.workspaceId) query = query.eq('workspace_id', params.workspaceId);
    if (params.assetType) query = query.eq('asset_type', params.assetType);
    if (params.assetIds && params.assetIds.length > 0) query = query.in('id', params.assetIds);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load assets: ${error.message}`);
    return (data ?? []) as ProposalAssetRecord[];
  }
}

export const assetExportService = new AssetExportService();
