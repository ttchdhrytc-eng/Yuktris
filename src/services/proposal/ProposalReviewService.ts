// ============================================================
// ProposalReviewService — Review and approval workflow
// ============================================================

import { supabase } from '@/lib/supabase';
import type { ProposalReviewRecord, ProposalApprovalRecord } from '@/types/proposal';

class ProposalReviewService {
  async createReview(params: {
    workspaceId?: string | null;
    versionId: string;
    reviewerId?: string | null;
    reviewerName?: string | null;
  }): Promise<ProposalReviewRecord> {
    const { data, error } = await supabase
      .from('proposal_reviews')
      .insert({
        workspace_id: params.workspaceId ?? null,
        proposal_version_id: params.versionId,
        reviewer_id: params.reviewerId ?? null,
        reviewer_name: params.reviewerName ?? null,
        review_status: 'in_review',
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to create review: ${error.message}`);
    return data as ProposalReviewRecord;
  }

  async updateReview(reviewId: string, updates: {
    review_status?: string;
    review_notes?: string;
    section_feedback?: { section: string; feedback: string }[];
    overall_score?: number;
  }): Promise<void> {
    const updateFields: Record<string, unknown> = {};
    if (updates.review_status) updateFields.review_status = updates.review_status;
    if (updates.review_notes !== undefined) updateFields.review_notes = updates.review_notes;
    if (updates.section_feedback !== undefined) updateFields.section_feedback = updates.section_feedback;
    if (updates.overall_score !== undefined) updateFields.overall_score = updates.overall_score;

    await supabase
      .from('proposal_reviews')
      .update(updateFields)
      .eq('id', reviewId);
  }

  async getReviews(versionId: string): Promise<ProposalReviewRecord[]> {
    const { data, error } = await supabase
      .from('proposal_reviews')
      .select('*')
      .eq('proposal_version_id', versionId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get reviews: ${error.message}`);
    return (data ?? []) as ProposalReviewRecord[];
  }

  async createApproval(params: {
    workspaceId?: string | null;
    versionId: string;
    approverId?: string | null;
    approverName?: string | null;
  }): Promise<ProposalApprovalRecord> {
    const { data, error } = await supabase
      .from('proposal_approvals')
      .insert({
        workspace_id: params.workspaceId ?? null,
        proposal_version_id: params.versionId,
        approver_id: params.approverId ?? null,
        approver_name: params.approverName ?? null,
        approval_status: 'pending',
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to create approval: ${error.message}`);
    return data as ProposalApprovalRecord;
  }

  async updateApproval(approvalId: string, updates: {
    approval_status?: string;
    approval_notes?: string;
    conditions?: string[];
  }): Promise<void> {
    const updateFields: Record<string, unknown> = {};
    if (updates.approval_status) {
      updateFields.approval_status = updates.approval_status;
      if (updates.approval_status === 'approved' || updates.approval_status === 'conditionally_approved') {
        updateFields.approved_at = new Date().toISOString();
      }
    }
    if (updates.approval_notes !== undefined) updateFields.approval_notes = updates.approval_notes;
    if (updates.conditions !== undefined) updateFields.conditions = updates.conditions;

    await supabase
      .from('proposal_approvals')
      .update(updateFields)
      .eq('id', approvalId);
  }

  async getApprovals(versionId: string): Promise<ProposalApprovalRecord[]> {
    const { data, error } = await supabase
      .from('proposal_approvals')
      .select('*')
      .eq('proposal_version_id', versionId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get approvals: ${error.message}`);
    return (data ?? []) as ProposalApprovalRecord[];
  }

  async getPendingApprovals(workspaceId?: string | null): Promise<ProposalApprovalRecord[]> {
    let query = supabase
      .from('proposal_approvals')
      .select('*')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });

    if (workspaceId) query = query.eq('workspace_id', workspaceId);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get pending approvals: ${error.message}`);
    return (data ?? []) as ProposalApprovalRecord[];
  }
}

export const proposalReviewService = new ProposalReviewService();
