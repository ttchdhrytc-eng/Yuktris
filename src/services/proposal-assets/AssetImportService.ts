// ============================================================
// AssetImportService — Bulk import assets from JSON/CSV
// ============================================================

import { supabase } from '@/lib/supabase';
import type { AssetCreateRequest, ProposalAssetRecord, AssetType } from '@/types/proposal-assets';

type ImportRow = {
  title: string;
  description?: string;
  asset_type: string;
  industry?: string;
  service?: string;
  content?: Record<string, unknown>;
  content_text?: string;
  language?: string;
  owner?: string;
  tags?: string[];
};

class AssetImportService {
  async import(params: {
    assets: ImportRow[];
    workspaceId?: string | null;
    createdBy?: string;
  }): Promise<{ imported: number; failed: number; errors: string[] }> {
    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of params.assets) {
      try {
        if (!row.title || !row.asset_type) {
          failed++;
          errors.push(`Missing required fields for: ${row.title ?? 'unnamed'}`);
          continue;
        }

        const { data, error } = await supabase
          .from('proposal_assets')
          .insert({
            workspace_id: params.workspaceId ?? null,
            title: row.title,
            description: row.description ?? null,
            asset_type: row.asset_type as AssetType,
            industry: row.industry ?? null,
            service: row.service ?? null,
            content: row.content ?? {},
            content_text: row.content_text ?? null,
            language: row.language ?? 'en',
            status: 'draft',
            approval_status: 'pending',
            owner: row.owner ?? null,
            created_by: params.createdBy ?? null,
          })
          .select('*')
          .maybeSingle();

        if (error) {
          failed++;
          errors.push(`Failed to import "${row.title}": ${error.message}`);
          continue;
        }

        const asset = data as ProposalAssetRecord;

        // Create initial version
        await supabase.from('asset_versions').insert({
          workspace_id: params.workspaceId ?? null,
          asset_id: asset.id,
          version_number: 1,
          content: row.content ?? {},
          content_text: row.content_text ?? null,
          change_summary: 'Imported',
          created_by: params.createdBy ?? null,
        });

        // Handle tags
        if (row.tags && row.tags.length > 0) {
          for (const tagName of row.tags) {
            const slug = tagName.toLowerCase().replace(/\s+/g, '-');
            const { data: existingTag } = await supabase
              .from('asset_tags')
              .select('id')
              .eq('slug', slug)
              .maybeSingle();

            let tagId = (existingTag as { id: string })?.id;

            if (!tagId) {
              const { data: newTag } = await supabase
                .from('asset_tags')
                .insert({
                  workspace_id: params.workspaceId ?? null,
                  name: tagName,
                  slug,
                  color: 'gray',
                })
                .select('id')
                .maybeSingle();
              tagId = (newTag as { id: string })?.id;
            }

            if (tagId) {
              await supabase.from('asset_tag_map').insert({
                asset_id: asset.id,
                tag_id: tagId,
              });
            }
          }
        }

        imported++;
      } catch (err) {
        failed++;
        errors.push(`Error importing "${row.title}": ${(err as Error).message}`);
      }
    }

    return { imported, failed, errors };
  }

  async importFromJson(jsonContent: string, workspaceId?: string | null, createdBy?: string): Promise<{ imported: number; failed: number; errors: string[] }> {
    try {
      const assets = JSON.parse(jsonContent) as ImportRow[];
      return this.import({ assets, workspaceId, createdBy });
    } catch {
      return { imported: 0, failed: 1, errors: ['Invalid JSON format'] };
    }
  }
}

export const assetImportService = new AssetImportService();
