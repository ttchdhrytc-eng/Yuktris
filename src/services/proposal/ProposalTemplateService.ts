// ============================================================
// ProposalTemplateService — Manages proposal templates
// ============================================================

import { supabase } from '@/lib/supabase';
import type { ProposalTemplateRecord, ProposalType, SectionType } from '@/types/proposal';

class ProposalTemplateService {
  private defaultTemplates: Record<ProposalType, { section_type: SectionType; title: string; display_order: number }[]> = {
    executive: [
      { section_type: 'executive_summary', title: 'Executive Summary', display_order: 1 },
      { section_type: 'company_overview', title: 'Company Overview', display_order: 2 },
      { section_type: 'problem_analysis', title: 'Problem Analysis', display_order: 3 },
      { section_type: 'business_objectives', title: 'Business Objectives', display_order: 4 },
      { section_type: 'recommended_strategy', title: 'Recommended Strategy', display_order: 5 },
      { section_type: 'solution_recommendation', title: 'Solution Recommendations', display_order: 6 },
      { section_type: 'implementation_roadmap', title: 'Implementation Roadmap', display_order: 7 },
      { section_type: 'pricing', title: 'Investment', display_order: 8 },
      { section_type: 'expected_roi', title: 'Expected ROI', display_order: 9 },
      { section_type: 'risk_assessment', title: 'Risk Assessment', display_order: 10 },
      { section_type: 'competitive_differentiation', title: 'Competitive Differentiation', display_order: 11 },
      { section_type: 'case_studies', title: 'Case Studies', display_order: 12 },
      { section_type: 'team_recommendation', title: 'Team', display_order: 13 },
      { section_type: 'faqs', title: 'FAQs', display_order: 14 },
      { section_type: 'call_to_action', title: 'Next Steps', display_order: 15 },
    ],
    sales: [
      { section_type: 'executive_summary', title: 'Executive Summary', display_order: 1 },
      { section_type: 'problem_analysis', title: 'Challenges', display_order: 2 },
      { section_type: 'solution_recommendation', title: 'Our Solution', display_order: 3 },
      { section_type: 'pricing', title: 'Pricing', display_order: 4 },
      { section_type: 'expected_roi', title: 'Expected ROI', display_order: 5 },
      { section_type: 'call_to_action', title: 'Next Steps', display_order: 6 },
    ],
    seo: [
      { section_type: 'executive_summary', title: 'Executive Summary', display_order: 1 },
      { section_type: 'company_overview', title: 'Current State', display_order: 2 },
      { section_type: 'problem_analysis', title: 'SEO Challenges', display_order: 3 },
      { section_type: 'recommended_strategy', title: 'SEO Strategy', display_order: 4 },
      { section_type: 'solution_recommendation', title: 'Deliverables', display_order: 5 },
      { section_type: 'implementation_roadmap', title: 'Implementation Plan', display_order: 6 },
      { section_type: 'pricing', title: 'Investment', display_order: 7 },
      { section_type: 'expected_roi', title: 'Expected Results', display_order: 8 },
      { section_type: 'case_studies', title: 'Case Studies', display_order: 9 },
      { section_type: 'call_to_action', title: 'Next Steps', display_order: 10 },
    ],
    google_ads: [
      { section_type: 'executive_summary', title: 'Executive Summary', display_order: 1 },
      { section_type: 'problem_analysis', title: 'Current Performance', display_order: 2 },
      { section_type: 'recommended_strategy', title: 'Google Ads Strategy', display_order: 3 },
      { section_type: 'solution_recommendation', title: 'Campaign Plan', display_order: 4 },
      { section_type: 'pricing', title: 'Management Fee', display_order: 5 },
      { section_type: 'expected_roi', title: 'Expected ROAS', display_order: 6 },
      { section_type: 'call_to_action', title: 'Next Steps', display_order: 7 },
    ],
    meta_ads: [
      { section_type: 'executive_summary', title: 'Executive Summary', display_order: 1 },
      { section_type: 'problem_analysis', title: 'Current Performance', display_order: 2 },
      { section_type: 'recommended_strategy', title: 'Meta Ads Strategy', display_order: 3 },
      { section_type: 'solution_recommendation', title: 'Campaign Plan', display_order: 4 },
      { section_type: 'pricing', title: 'Management Fee', display_order: 5 },
      { section_type: 'expected_roi', title: 'Expected ROAS', display_order: 6 },
      { section_type: 'call_to_action', title: 'Next Steps', display_order: 7 },
    ],
    linkedin_ads: [
      { section_type: 'executive_summary', title: 'Executive Summary', display_order: 1 },
      { section_type: 'problem_analysis', title: 'Current Performance', display_order: 2 },
      { section_type: 'recommended_strategy', title: 'LinkedIn Ads Strategy', display_order: 3 },
      { section_type: 'solution_recommendation', title: 'ABM Campaign Plan', display_order: 4 },
      { section_type: 'pricing', title: 'Management Fee', display_order: 5 },
      { section_type: 'expected_roi', title: 'Expected Results', display_order: 6 },
      { section_type: 'call_to_action', title: 'Next Steps', display_order: 7 },
    ],
    digital_marketing: [
      { section_type: 'executive_summary', title: 'Executive Summary', display_order: 1 },
      { section_type: 'company_overview', title: 'Current State', display_order: 2 },
      { section_type: 'problem_analysis', title: 'Challenges', display_order: 3 },
      { section_type: 'recommended_strategy', title: 'Integrated Strategy', display_order: 4 },
      { section_type: 'solution_recommendation', title: 'Channel Plan', display_order: 5 },
      { section_type: 'implementation_roadmap', title: 'Roadmap', display_order: 6 },
      { section_type: 'pricing', title: 'Investment', display_order: 7 },
      { section_type: 'expected_roi', title: 'Expected ROI', display_order: 8 },
      { section_type: 'case_studies', title: 'Case Studies', display_order: 9 },
      { section_type: 'call_to_action', title: 'Next Steps', display_order: 10 },
    ],
    website: [
      { section_type: 'executive_summary', title: 'Executive Summary', display_order: 1 },
      { section_type: 'problem_analysis', title: 'Current Website Issues', display_order: 2 },
      { section_type: 'recommended_strategy', title: 'Website Strategy', display_order: 3 },
      { section_type: 'solution_recommendation', title: 'Deliverables', display_order: 4 },
      { section_type: 'implementation_roadmap', title: 'Development Plan', display_order: 5 },
      { section_type: 'pricing', title: 'Investment', display_order: 6 },
      { section_type: 'team_recommendation', title: 'Team', display_order: 7 },
      { section_type: 'call_to_action', title: 'Next Steps', display_order: 8 },
    ],
    software: [
      { section_type: 'executive_summary', title: 'Executive Summary', display_order: 1 },
      { section_type: 'problem_analysis', title: 'Business Requirements', display_order: 2 },
      { section_type: 'recommended_strategy', title: 'Technical Strategy', display_order: 3 },
      { section_type: 'solution_recommendation', title: 'Solution Architecture', display_order: 4 },
      { section_type: 'implementation_roadmap', title: 'Development Roadmap', display_order: 5 },
      { section_type: 'pricing', title: 'Investment', display_order: 6 },
      { section_type: 'risk_assessment', title: 'Risk Assessment', display_order: 7 },
      { section_type: 'team_recommendation', title: 'Team', display_order: 8 },
      { section_type: 'call_to_action', title: 'Next Steps', display_order: 9 },
    ],
    ai_solution: [
      { section_type: 'executive_summary', title: 'Executive Summary', display_order: 1 },
      { section_type: 'problem_analysis', title: 'Business Challenges', display_order: 2 },
      { section_type: 'recommended_strategy', title: 'AI Strategy', display_order: 3 },
      { section_type: 'solution_recommendation', title: 'AI Solution', display_order: 4 },
      { section_type: 'implementation_roadmap', title: 'Implementation Roadmap', display_order: 5 },
      { section_type: 'pricing', title: 'Investment', display_order: 6 },
      { section_type: 'expected_roi', title: 'Expected ROI', display_order: 7 },
      { section_type: 'risk_assessment', title: 'Risk Assessment', display_order: 8 },
      { section_type: 'team_recommendation', title: 'Team', display_order: 9 },
      { section_type: 'call_to_action', title: 'Next Steps', display_order: 10 },
    ],
    custom: [
      { section_type: 'executive_summary', title: 'Executive Summary', display_order: 1 },
      { section_type: 'problem_analysis', title: 'Requirements', display_order: 2 },
      { section_type: 'solution_recommendation', title: 'Proposed Solution', display_order: 3 },
      { section_type: 'pricing', title: 'Investment', display_order: 4 },
      { section_type: 'call_to_action', title: 'Next Steps', display_order: 5 },
    ],
  };

  getDefaultTemplate(type: ProposalType): { section_type: SectionType; title: string; display_order: number }[] {
    return this.defaultTemplates[type] ?? this.defaultTemplates.custom;
  }

  async getTemplates(workspaceId?: string | null): Promise<ProposalTemplateRecord[]> {
    let query = supabase
      .from('proposal_templates')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (workspaceId) query = query.eq('workspace_id', workspaceId);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get templates: ${error.message}`);
    return (data ?? []) as ProposalTemplateRecord[];
  }

  async createTemplate(params: {
    workspaceId?: string | null;
    templateName: string;
    proposalType: ProposalType;
    sections?: { section_type: SectionType; title: string; display_order: number }[];
    isDefault?: boolean;
  }): Promise<ProposalTemplateRecord> {
    const sections = params.sections ?? this.getDefaultTemplate(params.proposalType);

    const { data, error } = await supabase
      .from('proposal_templates')
      .insert({
        workspace_id: params.workspaceId ?? null,
        template_name: params.templateName,
        proposal_type: params.proposalType,
        sections,
        is_default: params.isDefault ?? false,
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to create template: ${error.message}`);
    return data as ProposalTemplateRecord;
  }
}

export const proposalTemplateService = new ProposalTemplateService();
