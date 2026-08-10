// ============================================================
// ProposalEngine — Central facade for all proposal operations
// ============================================================
//
// This is the single entry point for proposal generation.
// It orchestrates the full pipeline: load context → load revenue
// intelligence → load memory → analyze → generate → save version.

import { supabase } from '@/lib/supabase';
import { proposalBuilder } from './ProposalBuilder';
import { proposalVersionService } from './ProposalVersionService';
import { proposalTemplateService } from './ProposalTemplateService';
import { proposalReviewService } from './ProposalReviewService';
import { proposalFormatter } from './ProposalFormatter';
import { memoryEngine } from '@/services/memory';
import type {
  ProposalGenerateRequest,
  ProposalGenerationResult,
  ProposalContent,
  ProposalProjectRecord,
  ProposalVersionRecord,
  ProposalHealth,
  ProposalMonitorSummary,
  ExportFormat,
  ProposalType,
} from '@/types/proposal';

class ProposalEngine {
  // ----------------------------------------------------------
  // Generate — Main pipeline
  // ----------------------------------------------------------

  async generate(request: ProposalGenerateRequest): Promise<ProposalGenerationResult> {
    const start = Date.now();

    // 1. Load company intelligence
    const { data: companyData, error: companyError } = await supabase
      .from('company_intelligence')
      .select('*')
      .eq('id', request.companyId)
      .maybeSingle();

    if (companyError || !companyData) {
      throw new Error(`Company intelligence not found: ${request.companyId}`);
    }

    // 2. Load revenue intelligence
    const { data: revenueProfile } = await supabase
      .from('revenue_profiles')
      .select('*')
      .eq('company_id', request.companyId)
      .maybeSingle();

    // 3. Load signals
    const { data: signals } = await supabase
      .from('intelligence_signals')
      .select('*')
      .eq('company_id', request.companyId)
      .order('detected_at', { ascending: false })
      .limit(20);

    // 4. Load recommendations
    const { data: recommendations } = await supabase
      .from('revenue_recommendations')
      .select('*')
      .eq('company_id', request.companyId)
      .order('created_at', { ascending: false })
      .limit(10);

    // 5. Store in memory that we're generating a proposal
    await memoryEngine.store({
      entityType: 'company',
      entityId: request.companyId,
      memoryType: 'proposal',
      title: `Proposal generation started for ${companyData.company_name}`,
      summary: `Generating ${request.proposalType} proposal for ${companyData.company_name}`,
      content: { proposal_type: request.proposalType, company_name: companyData.company_name },
      confidenceScore: 0.8,
      importanceScore: 0.8,
      workspaceId: request.workspaceId,
    });

    // 6. Build the proposal content
    const content = proposalBuilder.build({
      proposalType: request.proposalType,
      companyName: companyData.company_name,
      industry: companyData.industry,
      businessModel: companyData.business_model,
      companySize: companyData.company_size,
      summary: companyData.summary,
      overallRevenueScore: revenueProfile?.overall_score ?? 0.5,
      icpScore: revenueProfile?.icp_score ?? 0.5,
      buyingIntentScore: revenueProfile?.buying_intent_score ?? 0.3,
      riskScore: revenueProfile?.risk_score ?? 0.3,
      growthScore: revenueProfile?.growth_score ?? 0.5,
      buyingSignals: (companyData.buying_signals ?? []).map((s: { signal_type: string; description: string; confidence: number }) => ({
        signal_type: s.signal_type,
        description: s.description,
        confidence: s.confidence,
      })),
      growthSignals: (companyData.growth_signals ?? []).map((s: { signal_type: string; description: string; confidence: number }) => ({
        signal_type: s.signal_type,
        description: s.description,
        confidence: s.confidence,
      })),
      technologyStack: (companyData.technology_stack ?? []).map((t: { name: string; category: string }) => ({
        name: t.name,
        category: t.category,
      })),
      competitors: ((companyData.competitive_positioning as { competitors?: string[] }) ?? {}).competitors ?? [],
      decisionMakers: (companyData.decision_makers ?? []).map((dm: { name: string; title: string; department: string }) => ({
        name: dm.name,
        title: dm.title,
        department: dm.department,
      })),
      recommendedAction: revenueProfile?.recommended_action ?? null,
      customInstructions: request.customInstructions,
    });

    // 7. Create proposal project
    const { data: projectData, error: projectError } = await supabase
      .from('proposal_projects')
      .insert({
        workspace_id: request.workspaceId ?? null,
        company_id: request.companyId,
        project_name: request.projectName ?? `${request.proposalType.replace(/_/g, ' ')} Proposal for ${companyData.company_name}`,
        proposal_type: request.proposalType,
        status: 'draft',
        priority: content.strategy.recommended_timeline_weeks > 16 ? 'high' : 'medium',
        strategy: content.strategy,
      })
      .select('*')
      .maybeSingle();

    if (projectError) throw new Error(`Failed to create proposal project: ${projectError.message}`);
    const projectId = (projectData as ProposalProjectRecord)?.id;

    // 8. Create version
    const tokenCount = Math.ceil(JSON.stringify(content).length / 4);
    const { versionId, versionNumber } = await proposalVersionService.createVersion({
      workspaceId: request.workspaceId,
      projectId,
      content,
      tokenCount,
      generationDurationMs: Date.now() - start,
    });

    // 9. Store in memory
    await memoryEngine.store({
      entityType: 'company',
      entityId: request.companyId,
      memoryType: 'proposal',
      title: `Proposal generated for ${companyData.company_name}`,
      summary: content.executive_summary.slice(0, 200),
      content: { project_id: projectId, version_id: versionId, proposal_type: request.proposalType, total: content.pricing.total },
      confidenceScore: 0.9,
      importanceScore: 0.9,
      workspaceId: request.workspaceId,
    });

    return {
      projectId,
      versionId,
      versionNumber,
      content,
      tokenCount,
      durationMs: Date.now() - start,
    };
  }

  // ----------------------------------------------------------
  // Retrieve
  // ----------------------------------------------------------

  async getProject(projectId: string): Promise<ProposalProjectRecord | null> {
    const { data, error } = await supabase
      .from('proposal_projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();

    if (error) throw new Error(`Failed to get project: ${error.message}`);
    return data as ProposalProjectRecord | null;
  }

  async getLatestVersion(projectId: string): Promise<ProposalVersionRecord | null> {
    return proposalVersionService.getLatestVersion(projectId);
  }

  async getVersion(versionId: string): Promise<ProposalVersionRecord | null> {
    return proposalVersionService.getVersion(versionId);
  }

  async getHistory(projectId: string, limit?: number): Promise<ProposalVersionRecord[]> {
    return proposalVersionService.getHistory(projectId, limit);
  }

  async getProjects(workspaceId?: string | null, limit?: number): Promise<(ProposalProjectRecord & { company_name: string })[]> {
    let query = supabase
      .from('proposal_projects')
      .select('*, company_intelligence!inner(company_name)')
      .order('updated_at', { ascending: false });

    if (workspaceId) query = query.eq('workspace_id', workspaceId);
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get projects: ${error.message}`);

    return (data ?? []).map((row) => {
      const { company_intelligence, ...project } = row as Record<string, unknown>;
      return {
        ...(project as Record<string, unknown>),
        company_name: (company_intelligence as { company_name: string })?.company_name ?? 'Unknown',
      } as ProposalProjectRecord & { company_name: string };
    });
  }

  // ----------------------------------------------------------
  // Export
  // ----------------------------------------------------------

  async export(versionId: string, format: ExportFormat): Promise<{ content: string; mimeType: string; fileExtension: string; companyName: string }> {
    const version = await this.getVersion(versionId);
    if (!version) throw new Error(`Version not found: ${versionId}`);

    const project = await supabase
      .from('proposal_projects')
      .select('*, company_intelligence!inner(company_name)')
      .eq('id', version.proposal_project_id)
      .maybeSingle();

    const companyName = (project.data as { company_intelligence?: { company_name: string } })?.company_intelligence?.company_name ?? 'Unknown';

    const formatted = proposalFormatter.format(version.content, format, companyName);

    // Save asset
    await supabase.from('proposal_assets').insert({
      workspace_id: version.workspace_id,
      proposal_version_id: versionId,
      asset_type: format,
      content: formatted.content,
      file_size: formatted.content.length,
      metadata: { company_name: companyName, version_number: version.version_number },
    });

    return { ...formatted, companyName };
  }

  // ----------------------------------------------------------
  // Review & Approval
  // ----------------------------------------------------------

  async createReview(params: {
    versionId: string;
    reviewerId?: string | null;
    reviewerName?: string | null;
    workspaceId?: string | null;
  }): Promise<void> {
    await proposalReviewService.createReview(params);

    // Update project status
    const version = await this.getVersion(params.versionId);
    if (version) {
      await supabase
        .from('proposal_projects')
        .update({ status: 'in_review' })
        .eq('id', version.proposal_project_id);
    }
  }

  async submitReview(reviewId: string, params: {
    review_status: string;
    review_notes?: string;
    overall_score?: number;
    versionId: string;
  }): Promise<void> {
    await proposalReviewService.updateReview(reviewId, params);

    if (params.review_status === 'approved') {
      const version = await this.getVersion(params.versionId);
      if (version) {
        await supabase
          .from('proposal_projects')
          .update({ status: 'approved' })
          .eq('id', version.proposal_project_id);
      }
    } else if (params.review_status === 'rejected' || params.review_status === 'changes_requested') {
      const version = await this.getVersion(params.versionId);
      if (version) {
        await supabase
          .from('proposal_projects')
          .update({ status: params.review_status === 'changes_requested' ? 'draft' : 'rejected' })
          .eq('id', version.proposal_project_id);
      }
    }
  }

  async createApproval(params: {
    versionId: string;
    approverId?: string | null;
    approverName?: string | null;
    workspaceId?: string | null;
  }): Promise<void> {
    await proposalReviewService.createApproval(params);
  }

  async submitApproval(approvalId: string, params: {
    approval_status: string;
    approval_notes?: string;
    conditions?: string[];
    versionId: string;
  }): Promise<void> {
    await proposalReviewService.updateApproval(approvalId, params);

    if (params.approval_status === 'approved' || params.approval_status === 'conditionally_approved') {
      const version = await this.getVersion(params.versionId);
      if (version) {
        await supabase
          .from('proposal_projects')
          .update({ status: 'approved' })
          .eq('id', version.proposal_project_id);
      }
    }
  }

  // ----------------------------------------------------------
  // Templates
  // ----------------------------------------------------------

  getTemplateSections(type: ProposalType) {
    return proposalTemplateService.getDefaultTemplate(type);
  }

  async getTemplates(workspaceId?: string | null) {
    return proposalTemplateService.getTemplates(workspaceId);
  }

  // ----------------------------------------------------------
  // Health & Monitoring
  // ----------------------------------------------------------

  async getHealth(workspaceId?: string | null): Promise<ProposalHealth> {
    const summary = await this.getSummary(workspaceId);
    const errors: string[] = [];

    if (summary.total_projects === 0) errors.push('No proposal projects created');
    if (summary.pending_approvals > 5) errors.push(`${summary.pending_approvals} pending approvals need attention`);

    return {
      healthy: errors.length === 0,
      total_projects: summary.total_projects,
      total_versions: summary.total_versions,
      draft_count: summary.status_distribution.draft ?? 0,
      in_review_count: summary.status_distribution.in_review ?? 0,
      approved_count: summary.status_distribution.approved ?? 0,
      sent_count: summary.status_distribution.sent ?? 0,
      rejected_count: summary.status_distribution.rejected ?? 0,
      total_assets: summary.total_assets,
      total_reviews: summary.total_reviews,
      total_approvals: summary.total_approvals,
      errors,
    };
  }

  async getSummary(workspaceId?: string | null): Promise<ProposalMonitorSummary> {
    let projectQuery = supabase.from('proposal_projects').select('*');
    if (workspaceId) projectQuery = projectQuery.eq('workspace_id', workspaceId);
    const { data: projects } = await projectQuery;
    const projectList = (projects ?? []) as ProposalProjectRecord[];

    let versionQuery = supabase.from('proposal_versions').select('token_count, generation_duration_ms');
    if (workspaceId) versionQuery = versionQuery.eq('workspace_id', workspaceId);
    const { data: versions } = await versionQuery;
    const versionList = (versions ?? []) as { token_count: number; generation_duration_ms: number | null }[];

    let assetQuery = supabase.from('proposal_assets').select('id', { count: 'exact', head: true });
    if (workspaceId) assetQuery = assetQuery.eq('workspace_id', workspaceId);
    const { count: assetCount } = await assetQuery;

    let reviewQuery = supabase.from('proposal_reviews').select('id', { count: 'exact', head: true });
    if (workspaceId) reviewQuery = reviewQuery.eq('workspace_id', workspaceId);
    const { count: reviewCount } = await reviewQuery;

    let approvalQuery = supabase.from('proposal_approvals').select('approval_status');
    if (workspaceId) approvalQuery = approvalQuery.eq('workspace_id', workspaceId);
    const { data: approvalData } = await approvalQuery;
    const approvalList = (approvalData ?? []) as { approval_status: string }[];
    const pendingApprovals = approvalList.filter((a) => a.approval_status === 'pending').length;

    const statusDist: Record<string, number> = {};
    for (const p of projectList) {
      statusDist[p.status] = (statusDist[p.status] ?? 0) + 1;
    }

    const typeDist: Record<string, number> = {};
    for (const p of projectList) {
      typeDist[p.proposal_type] = (typeDist[p.proposal_type] ?? 0) + 1;
    }

    const avgDuration = versionList.length > 0
      ? versionList.reduce((s, v) => s + (v.generation_duration_ms ?? 0), 0) / versionList.length
      : 0;

    const avgTokens = versionList.length > 0
      ? versionList.reduce((s, v) => s + (v.token_count ?? 0), 0) / versionList.length
      : 0;

    const recentProjects = projectList
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10);

    return {
      total_projects: projectList.length,
      total_versions: versionList.length,
      status_distribution: statusDist,
      type_distribution: typeDist,
      total_assets: assetCount ?? 0,
      total_reviews: reviewCount ?? 0,
      total_approvals: approvalList.length,
      pending_approvals: pendingApprovals,
      average_generation_duration_ms: Math.round(avgDuration),
      average_token_count: Math.round(avgTokens),
      recent_projects: recentProjects,
    };
  }
}

export const proposalEngine = new ProposalEngine();
