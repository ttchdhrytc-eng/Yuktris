// ============================================================
// ProposalVersionService — Version management for proposals
// ============================================================

import { supabase } from '@/lib/supabase';
import type { ProposalVersionRecord, ProposalContent } from '@/types/proposal';

class ProposalVersionService {
  async createVersion(params: {
    workspaceId?: string | null;
    projectId: string;
    content: ProposalContent;
    tokenCount: number;
    generationDurationMs: number;
    createdBy?: string | null;
  }): Promise<{ versionId: string; versionNumber: number }> {
    // Get current latest version number
    const { data: existingVersions } = await supabase
      .from('proposal_versions')
      .select('version_number')
      .eq('proposal_project_id', params.projectId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersionNumber = (existingVersions?.[0]?.version_number ?? 0) + 1;

    // Mark existing latest as not latest
    await supabase
      .from('proposal_versions')
      .update({ is_latest: false })
      .eq('proposal_project_id', params.projectId)
      .eq('is_latest', true);

    // Insert new version
    const { data, error } = await supabase
      .from('proposal_versions')
      .insert({
        workspace_id: params.workspaceId ?? null,
        proposal_project_id: params.projectId,
        version_number: nextVersionNumber,
        content: params.content,
        executive_summary: params.content.executive_summary,
        problem_analysis: params.content.problem_analysis,
        solution_recommendation: params.content.solution_recommendations,
        implementation_roadmap: params.content.implementation_roadmap,
        risk_assessment: params.content.risk_assessment,
        competitive_differentiation: params.content.competitive_differentiation,
        roi_estimation: params.content.roi,
        team_recommendation: params.content.team_recommendation,
        case_studies: params.content.case_studies,
        token_count: params.tokenCount,
        generation_duration_ms: params.generationDurationMs,
        is_latest: true,
        created_by: params.createdBy ?? null,
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to create proposal version: ${error.message}`);
    return { versionId: (data as ProposalVersionRecord)?.id ?? '', versionNumber: nextVersionNumber };
  }

  async getLatestVersion(projectId: string): Promise<ProposalVersionRecord | null> {
    const { data, error } = await supabase
      .from('proposal_versions')
      .select('*')
      .eq('proposal_project_id', projectId)
      .eq('is_latest', true)
      .maybeSingle();

    if (error) throw new Error(`Failed to get latest version: ${error.message}`);
    return data as ProposalVersionRecord | null;
  }

  async getVersion(versionId: string): Promise<ProposalVersionRecord | null> {
    const { data, error } = await supabase
      .from('proposal_versions')
      .select('*')
      .eq('id', versionId)
      .maybeSingle();

    if (error) throw new Error(`Failed to get version: ${error.message}`);
    return data as ProposalVersionRecord | null;
  }

  async getHistory(projectId: string, limit?: number): Promise<ProposalVersionRecord[]> {
    let query = supabase
      .from('proposal_versions')
      .select('*')
      .eq('proposal_project_id', projectId)
      .order('version_number', { ascending: false });

    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get version history: ${error.message}`);
    return (data ?? []) as ProposalVersionRecord[];
  }

  async compareVersions(versionIdA: string, versionIdB: string): Promise<{
    versionA: ProposalVersionRecord;
    versionB: ProposalVersionRecord;
    differences: { field: string; versionA: unknown; versionB: unknown }[];
  }> {
    const [versionA, versionB] = await Promise.all([
      this.getVersion(versionIdA),
      this.getVersion(versionIdB),
    ]);

    if (!versionA || !versionB) throw new Error('One or both versions not found');

    const differences: { field: string; versionA: unknown; versionB: unknown }[] = [];
    const fieldsToCompare = ['executive_summary', 'problem_analysis', 'solution_recommendation', 'implementation_roadmap', 'risk_assessment', 'competitive_differentiation', 'roi_estimation', 'team_recommendation', 'case_studies'];

    for (const field of fieldsToCompare) {
      const aVal = versionA[field as keyof ProposalVersionRecord];
      const bVal = versionB[field as keyof ProposalVersionRecord];
      if (JSON.stringify(aVal) !== JSON.stringify(bVal)) {
        differences.push({ field, versionA: aVal, versionB: bVal });
      }
    }

    return { versionA, versionB, differences };
  }
}

export const proposalVersionService = new ProposalVersionService();
