// ============================================================
// ProposalIntelligenceService — Main orchestrator Phase 11
// ============================================================
//
// Pipeline:
//   Meeting Outcome → Detect Proposal Readiness →
//   Create Proposal Request → Generate Proposal (AI) →
//   Calculate Pricing → Generate ROI → Create Packages →
//   Generate Business Case → Create Implementation Plan →
//   Generate Negotiation Guidance → Score →
//   Create Approval Workflow → Deliver → Track → Notify

import { supabase } from '@/lib/supabase';
import { aiGateway } from '@/services/ai/AIGateway';
import { knowledgeGraphService } from '@/services/knowledge-graph/KnowledgeGraphService';
import { memoryEngine } from '@/services/memory/MemoryEngine';
import { contextEngine } from '@/services/context/ContextEngine';
import type {
  ProposalIntelligenceDashboard, ProposalWithIntelligence,
  ProposalRequest,
} from '@/types/proposal-intelligence';

class ProposalIntelligenceService {
  // ----------------------------------------------------------
  // STEP 1: Detect proposal readiness from meetings
  // ----------------------------------------------------------

  async detectProposalReadiness(workspaceId: string): Promise<void> {
    // Find meetings with outcome = moved_to_opportunity
    const { data: meetings } = await supabase
      .from('meeting_scheduler')
      .select(`
        id, conversation_id, contact_id, company_id, prospect_name, prospect_title,
        company_name, meeting_type, status, revenue_estimate,
        meeting_outcomes!inner(outcome, deal_value, next_action)
      `)
      .eq('workspace_id', workspaceId)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(30);

    if (!meetings || meetings.length === 0) return;

    for (const meeting of meetings) {
      const meetingData = meeting as Record<string, unknown>;
      const outcomes = meetingData.meeting_outcomes as Array<Record<string, unknown>>;
      if (!outcomes || outcomes.length === 0) continue;

      const outcome = outcomes[0];
      const outcomeVal = outcome.outcome as string;

      // Check triggers
      const isMovedToOpportunity = outcomeVal === 'moved_to_opportunity';
      const isFollowupScheduled = outcomeVal === 'followup_scheduled';

      if (!isMovedToOpportunity && !isFollowupScheduled) continue;

      // Check if proposal request already exists
      const { data: existing } = await supabase
        .from('proposal_requests')
        .select('id')
        .eq('meeting_id', meeting.id)
        .in('status', ['pending', 'approved', 'generating', 'generated'])
        .maybeSingle();

      if (existing) continue;

      // Load meeting score for threshold check
      const { data: score } = await supabase
        .from('meeting_score')
        .select('overall_score')
        .eq('meeting_id', meeting.id)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      const meetingScore = (score as Record<string, number>)?.overall_score ?? 50;
      const dealValue = (outcome.deal_value as number) ?? (meetingData.revenue_estimate as number) ?? null;

      // Create proposal request
      const { data: request } = await supabase.from('proposal_requests').insert({
        workspace_id: workspaceId,
        meeting_id: meeting.id,
        conversation_id: meetingData.conversation_id as string | null,
        contact_id: meetingData.contact_id as string | null,
        company_id: meetingData.company_id as string | null,
        prospect_name: meetingData.prospect_name as string | null,
        company_name: meetingData.company_name as string | null,
        trigger_reason: isMovedToOpportunity ? 'meeting_outcome' : 'meeting_score',
        trigger_data: { meeting_type: meetingData.meeting_type, outcome: outcomeVal, next_action: outcome.next_action },
        buying_stage: 'decision',
        meeting_score: meetingScore,
        estimated_deal_value: dealValue,
        urgency: meetingScore > 70 ? 'high' : 'medium',
        confidence_score: 0.8,
        reasoning: `Meeting outcome: ${outcomeVal}. Meeting score: ${meetingScore}. Deal value: ${dealValue ?? 'unknown'}.`,
        status: 'pending',
      }).select('*').single();

      if (!request) continue;

      // Create notification
      await this.createNotification(workspaceId, null, 'proposal_ready',
        'Proposal Request Detected',
        `${meetingData.prospect_name ?? 'A prospect'} is ready for a proposal after meeting outcome: ${outcomeVal.replace(/_/g, ' ')}.`,
        'success');

      // Store in memory
      await this.storeMemory(workspaceId, request.id, 'proposal_detection', {
        prospect: meetingData.prospect_name,
        company: meetingData.company_name,
        trigger: outcomeVal,
        dealValue,
      });
    }
  }

  // ----------------------------------------------------------
  // STEP 2: Generate full proposal (AI)
  // ----------------------------------------------------------

  async generateProposal(workspaceId: string, requestId: string): Promise<string | null> {
    const { data: request } = await supabase
      .from('proposal_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();
    if (!request) return null;

    // Update request status
    await supabase.from('proposal_requests').update({ status: 'generating' }).eq('id', requestId);

    // Load context from all previous phases
    const context = await this.loadProposalContext(workspaceId, request as ProposalRequest);

    // Single AI call for full proposal
    const result = await this.callAIProposal(request as ProposalRequest, context);

    // Create proposal project
    const { data: project } = await supabase.from('proposal_projects').insert({
      workspace_id: workspaceId,
      company_id: request.company_id,
      project_name: `Proposal: ${request.prospect_name ?? 'Unknown'} — ${request.company_name ?? ''}`,
      proposal_type: 'enterprise',
      status: 'generating',
      priority: request.urgency === 'critical' ? 'critical' : request.urgency === 'high' ? 'high' : 'medium',
      strategy: result.strategy ?? {},
      metadata: { request_id: requestId },
    }).select('*').single();

    if (!project) return null;

    // Create proposal version
    const { data: version } = await supabase.from('proposal_versions').insert({
      workspace_id: workspaceId,
      proposal_project_id: project.id,
      version_number: 1,
      content: result.content ?? {},
      executive_summary: result.executive_summary ?? '',
      problem_analysis: result.problem_analysis ?? {},
      solution_recommendation: result.solution_recommendation ?? {},
      implementation_roadmap: result.implementation_roadmap ?? {},
      risk_assessment: result.risk_assessment ?? {},
      competitive_differentiation: result.competitive_differentiation ?? {},
      roi_estimation: result.roi_estimation ?? {},
      team_recommendation: result.team_recommendation ?? {},
      case_studies: result.case_studies ?? [],
      is_latest: true,
      created_by: 'ai',
    }).select('*').single();

    const versionId = version?.id ?? project.id;

    // Persist packages
    if (result.packages?.length) {
      await supabase.from('proposal_packages').insert(
        result.packages.map((p: Record<string, unknown>, i: number) => ({
          workspace_id: workspaceId,
          project_id: project.id,
          version_id: versionId,
          package_tier: p.package_tier ?? 'good',
          package_name: p.package_name ?? 'Package',
          description: p.description ?? null,
          features: p.features ?? [],
          deliverables: p.deliverables ?? [],
          timeline_weeks: p.timeline_weeks ?? null,
          price: p.price ?? null,
          roi_estimate: p.roi_estimate ?? {},
          recommended_audience: p.recommended_audience ?? null,
          is_recommended: p.is_recommended ?? (i === 1),
          sort_order: i,
        })),
      );
    }

    // Persist options
    if (result.options?.length) {
      await supabase.from('proposal_options').insert(
        result.options.map((o: Record<string, unknown>, i: number) => ({
          workspace_id: workspaceId,
          project_id: project.id,
          version_id: versionId,
          option_name: o.option_name ?? 'Option',
          option_type: o.option_type ?? 'investment',
          description: o.description ?? null,
          investment_amount: o.investment_amount ?? null,
          term_months: o.term_months ?? null,
          monthly_cost: o.monthly_cost ?? null,
          total_cost: o.total_cost ?? null,
          savings_estimate: o.savings_estimate ?? null,
          benefits: o.benefits ?? [],
          is_recommended: o.is_recommended ?? false,
          sort_order: i,
        })),
      );
    }

    // Persist ROI
    if (result.roi) {
      await supabase.from('proposal_roi').insert({
        workspace_id: workspaceId,
        project_id: project.id,
        version_id: versionId,
        investment_amount: result.roi.investment_amount ?? 0,
        annual_savings: result.roi.annual_savings ?? null,
        revenue_increase: result.roi.revenue_increase ?? null,
        productivity_gain_hours: result.roi.productivity_gain_hours ?? null,
        productivity_gain_value: result.roi.productivity_gain_value ?? null,
        payback_period_months: result.roi.payback_period_months ?? null,
        break_even_month: result.roi.break_even_month ?? null,
        roi_1_year: result.roi.roi_1_year ?? null,
        roi_3_year: result.roi.roi_3_year ?? null,
        roi_5_year: result.roi.roi_5_year ?? null,
        business_impact: result.roi.business_impact ?? null,
        total_3_year_value: result.roi.total_3_year_value ?? null,
        total_5_year_value: result.roi.total_5_year_value ?? null,
        confidence: result.roi.confidence ?? 0.7,
      });
    }

    // Persist business case
    if (result.businessCase) {
      await supabase.from('proposal_business_case').insert({
        workspace_id: workspaceId,
        project_id: project.id,
        version_id: versionId,
        problem_statement: result.businessCase.problem_statement ?? '',
        financial_impact: result.businessCase.financial_impact ?? null,
        opportunity_cost: result.businessCase.opportunity_cost ?? null,
        recommended_investment: result.businessCase.recommended_investment ?? null,
        expected_return: result.businessCase.expected_return ?? null,
        strategic_benefits: result.businessCase.strategic_benefits ?? [],
        operational_benefits: result.businessCase.operational_benefits ?? [],
        executive_summary: result.businessCase.executive_summary ?? null,
      });
    }

    // Persist timeline phases
    if (result.timeline?.length) {
      await supabase.from('proposal_timeline').insert(
        result.timeline.map((t: Record<string, unknown>, i: number) => ({
          workspace_id: workspaceId,
          project_id: project.id,
          version_id: versionId,
          phase_name: t.phase_name ?? 'Phase',
          phase_description: t.phase_description ?? null,
          start_week: t.start_week ?? null,
          end_week: t.end_week ?? null,
          milestones: t.milestones ?? [],
          deliverables: t.deliverables ?? [],
          dependencies: t.dependencies ?? [],
          sort_order: i,
        })),
      );
    }

    // Persist scope items
    if (result.scope?.length) {
      await supabase.from('proposal_scope').insert(
        result.scope.map((s: Record<string, unknown>, i: number) => ({
          workspace_id: workspaceId,
          project_id: project.id,
          version_id: versionId,
          scope_item: s.scope_item ?? 'Scope item',
          scope_type: s.scope_type ?? 'included',
          description: s.description ?? null,
          sort_order: i,
        })),
      );
    }

    // Persist deliverables
    if (result.deliverables?.length) {
      await supabase.from('proposal_deliverables').insert(
        result.deliverables.map((d: Record<string, unknown>, i: number) => ({
          workspace_id: workspaceId,
          project_id: project.id,
          version_id: versionId,
          deliverable_name: d.deliverable_name ?? 'Deliverable',
          description: d.description ?? null,
          delivery_week: d.delivery_week ?? null,
          acceptance_criteria: d.acceptance_criteria ?? null,
          dependencies: d.dependencies ?? [],
          sort_order: i,
        })),
      );
    }

    // Persist risks
    if (result.risks?.length) {
      await supabase.from('proposal_risks').insert(
        result.risks.map((r: Record<string, unknown>) => ({
          workspace_id: workspaceId,
          project_id: project.id,
          version_id: versionId,
          risk_text: r.risk_text ?? 'Risk',
          risk_type: r.risk_type ?? 'general',
          probability: r.probability ?? 'medium',
          impact: r.impact ?? 'medium',
          mitigation: r.mitigation ?? null,
        })),
      );
    }

    // Persist case studies
    if (result.caseStudiesSelected?.length) {
      await supabase.from('proposal_case_studies').insert(
        result.caseStudiesSelected.map((c: Record<string, unknown>, i: number) => ({
          workspace_id: workspaceId,
          project_id: project.id,
          version_id: versionId,
          case_study_name: c.case_study_name ?? 'Case Study',
          industry: c.industry ?? null,
          company_size: c.company_size ?? null,
          challenge: c.challenge ?? null,
          solution: c.solution ?? null,
          results: c.results ?? [],
          relevance_score: c.relevance_score ?? 0.7,
          sort_order: i,
        })),
      );
    }

    // Persist testimonials
    if (result.testimonials?.length) {
      await supabase.from('proposal_testimonials').insert(
        result.testimonials.map((t: Record<string, unknown>, i: number) => ({
          workspace_id: workspaceId,
          project_id: project.id,
          version_id: versionId,
          quote: t.quote ?? '',
          author_name: t.author_name ?? null,
          author_title: t.author_title ?? null,
          author_company: t.author_company ?? null,
          industry: t.industry ?? null,
          relevance_score: t.relevance_score ?? 0.7,
          sort_order: i,
        })),
      );
    }

    // Persist contract terms
    if (result.contractTerms?.length) {
      await supabase.from('proposal_contract_terms').insert(
        result.contractTerms.map((c: Record<string, unknown>, i: number) => ({
          workspace_id: workspaceId,
          project_id: project.id,
          version_id: versionId,
          term_name: c.term_name ?? 'Term',
          term_type: c.term_type ?? 'custom',
          term_text: c.term_text ?? '',
          is_negotiable: c.is_negotiable ?? true,
          sort_order: i,
        })),
      );
    }

    // Persist payment plans
    if (result.paymentPlans?.length) {
      await supabase.from('proposal_payment_plans').insert(
        result.paymentPlans.map((p: Record<string, unknown>, i: number) => ({
          workspace_id: workspaceId,
          project_id: project.id,
          version_id: versionId,
          plan_name: p.plan_name ?? 'Plan',
          plan_type: p.plan_type ?? 'monthly',
          total_amount: p.total_amount ?? null,
          installment_count: p.installment_count ?? null,
          installment_amount: p.installment_amount ?? null,
          payment_terms: p.payment_terms ?? null,
          discount_percentage: p.discount_percentage ?? null,
          is_recommended: p.is_recommended ?? (i === 0),
          sort_order: i,
        })),
      );
    }

    // Persist negotiation guidance
    if (result.negotiation) {
      await supabase.from('proposal_negotiation').insert({
        workspace_id: workspaceId,
        project_id: project.id,
        version_id: versionId,
        negotiation_round: 1,
        predicted_objections: result.negotiation.predicted_objections ?? [],
        pricing_concerns: result.negotiation.pricing_concerns ?? [],
        competitor_comparison: result.negotiation.competitor_comparison ?? [],
        discount_requests: result.negotiation.discount_requests ?? [],
        risk_concerns: result.negotiation.risk_concerns ?? [],
        negotiation_guidance: result.negotiation.negotiation_guidance ?? null,
        fallback_offers: result.negotiation.fallback_offers ?? [],
        alternative_packages: result.negotiation.alternative_packages ?? [],
        concessions: result.negotiation.concessions ?? [],
        red_lines: result.negotiation.red_lines ?? [],
        confidence: result.negotiation.confidence ?? 0.7,
      });
    }

    // Persist score
    if (result.score) {
      await supabase.from('proposal_score').insert({
        workspace_id: workspaceId,
        project_id: project.id,
        win_probability: result.score.win_probability ?? 50,
        pricing_strength: result.score.pricing_strength ?? 60,
        competitive_position: result.score.competitive_position ?? 65,
        roi_quality: result.score.roi_quality ?? 70,
        proposal_quality: result.score.proposal_quality ?? 75,
        relationship_strength: result.score.relationship_strength ?? 60,
        decision_confidence: result.score.decision_confidence ?? 55,
        overall_score: result.score.overall_score ?? 62,
        score_explanation: result.score.score_explanation ?? {},
        confidence: result.score.confidence ?? 0.75,
      });
    }

    // Persist AI reasoning
    if (result.reasoning?.length) {
      await supabase.from('proposal_ai_reasoning').insert(
        result.reasoning.map((r: Record<string, unknown>) => ({
          workspace_id: workspaceId,
          project_id: project.id,
          reasoning_type: r.reasoning_type ?? 'structure',
          reasoning_text: r.reasoning_text ?? '',
          reasoning_data: r.reasoning_data ?? {},
          confidence: r.confidence ?? 0.7,
        })),
      );
    }

    // Update project status
    await supabase.from('proposal_projects').update({ status: 'review' }).eq('id', project.id);

    // Create status record
    await supabase.from('proposal_status').insert({
      workspace_id: workspaceId,
      project_id: project.id,
      status: 'review',
      status_reason: 'AI-generated proposal ready for review',
      changed_by: 'ai',
    });

    // Update request status
    await supabase.from('proposal_requests').update({ status: 'generated', project_id: project.id }).eq('id', requestId);

    // Create approval workflow
    await this.createApprovalWorkflow(workspaceId, project.id, versionId);

    // Populate knowledge graph
    await this.populateKnowledgeGraph(workspaceId, project.id, result);

    // Store in memory
    await this.storeMemory(workspaceId, project.id, 'proposal_generated', {
      prospect: request.prospect_name,
      company: request.company_name,
      dealValue: request.estimated_deal_value,
    });

    // Create notification
    await this.createNotification(workspaceId, project.id, 'proposal_ready',
      'Proposal Generated',
      `I've prepared the proposal for ${request.prospect_name ?? 'the prospect'}. It includes pricing, ROI, packages, and negotiation guidance.`,
      'success');

    return project.id;
  }

  // ----------------------------------------------------------
  // AI Proposal Generation call
  // ----------------------------------------------------------

  private async callAIProposal(request: ProposalRequest, context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are an elite proposal generation AI for enterprise B2B sales. You generate comprehensive proposals with executive summaries, pricing, ROI, packages, business cases, implementation plans, negotiation guidance, and scoring. You always respond with valid JSON.';

    const userPrompt = `Generate a complete proposal for this opportunity.

REQUEST:
${JSON.stringify({
  prospect: request.prospect_name,
  company: request.company_name,
  trigger: request.trigger_reason,
  dealValue: request.estimated_deal_value,
  urgency: request.urgency,
  buyingStage: request.buying_stage,
}, null, 2)}

CONTEXT FROM PREVIOUS PHASES:
${JSON.stringify(context, null, 2)}

Return ONLY valid JSON (no markdown, no code blocks) with this structure:

{
  "strategy": {"approach": "value-based", "differentiator": "AI-powered"},
  "content": {"sections": ["executive_summary", "problem", "solution", "pricing", "roi", "timeline", "next_steps"]},
  "executive_summary": "1-paragraph executive summary",
  "problem_analysis": {"challenges": ["Manual processes", "No visibility"], "current_situation": "Using spreadsheets"},
  "solution_recommendation": {"recommended": "Platform X", "features": ["AI automation", "Analytics"], "differentiators": ["10x faster", "Better UX"]},
  "implementation_roadmap": {"phases": [{"name": "Phase 1", "weeks": "1-2"}]},
  "risk_assessment": {"risks": [{"risk": "Adoption", "mitigation": "Training"}]},
  "competitive_differentiation": {"our_strengths": ["AI", "Speed"], "competitor_weaknesses": ["No AI"]},
  "roi_estimation": {"investment": 50000, "annual_savings": 52000, "payback_months": 11.5},
  "team_recommendation": {"team": [{"role": "Project Manager", "name": "TBD"}]},
  "case_studies": [{"name": "Acme Corp", "industry": "SaaS", "result": "50% efficiency"}],
  "packages": [
    {"package_tier": "good", "package_name": "Starter", "features": ["Core features"], "price": 1000, "timeline_weeks": 4, "is_recommended": false},
    {"package_tier": "better", "package_name": "Professional", "features": ["Core + Advanced"], "price": 2500, "timeline_weeks": 6, "is_recommended": true},
    {"package_tier": "best", "package_name": "Enterprise", "features": ["All features"], "price": 5000, "timeline_weeks": 8, "is_recommended": false}
  ],
  "options": [
    {"option_name": "Annual Commit", "option_type": "term", "investment_amount": 30000, "monthly_cost": 2500, "benefits": ["20% savings"], "is_recommended": true},
    {"option_name": "Monthly", "option_type": "payment", "monthly_cost": 3000, "benefits": ["Flexibility"]}
  ],
  "roi": {
    "investment_amount": 50000,
    "annual_savings": 52000,
    "revenue_increase": 100000,
    "productivity_gain_hours": 500,
    "productivity_gain_value": 75000,
    "payback_period_months": 11.5,
    "break_even_month": 12,
    "roi_1_year": 1.04,
    "roi_3_year": 3.12,
    "roi_5_year": 5.20,
    "business_impact": "Significant efficiency and revenue gains",
    "total_3_year_value": 156000,
    "total_5_year_value": 260000,
    "confidence": 0.8
  },
  "businessCase": {
    "problem_statement": "The prospect lacks automation",
    "financial_impact": "$500K annual loss from inefficiency",
    "opportunity_cost": "Each month of delay costs $40K",
    "recommended_investment": "$50K investment for $260K 5-year return",
    "expected_return": "520% 5-year ROI",
    "strategic_benefits": ["Market differentiation", "Faster growth"],
    "operational_benefits": ["50% efficiency gain", "10 hours saved per week"],
    "executive_summary": "This investment delivers 520% ROI over 5 years"
  },
  "timeline": [
    {"phase_name": "Discovery", "start_week": 1, "end_week": 2, "milestones": ["Requirements gathered"]},
    {"phase_name": "Implementation", "start_week": 3, "end_week": 6, "milestones": ["Platform configured"]},
    {"phase_name": "Go-Live", "start_week": 7, "end_week": 8, "milestones": ["System live", "Training complete"]}
  ],
  "scope": [
    {"scope_item": "Platform setup", "scope_type": "included"},
    {"scope_item": "Custom integrations", "scope_type": "optional"},
    {"scope_item": "Data migration", "scope_type": "included"}
  ],
  "deliverables": [
    {"deliverable_name": "Configured platform", "delivery_week": 6, "acceptance_criteria": "All features working"},
    {"deliverable_name": "Training materials", "delivery_week": 7, "acceptance_criteria": "All users trained"}
  ],
  "risks": [
    {"risk_text": "Low adoption", "risk_type": "general", "probability": "medium", "impact": "high", "mitigation": "Training and change management"},
    {"risk_text": "Integration delays", "risk_type": "technical", "probability": "low", "impact": "medium", "mitigation": "Phased approach"}
  ],
  "caseStudiesSelected": [
    {"case_study_name": "Acme Corp", "industry": "SaaS", "challenge": "Manual processes", "solution": "Platform X", "results": ["50% efficiency", "$100K saved"], "relevance_score": 0.9}
  ],
  "testimonials": [
    {"quote": "This platform transformed our operations", "author_name": "VP Sales", "author_company": "TechCorp", "relevance_score": 0.8}
  ],
  "contractTerms": [
    {"term_name": "Payment Terms", "term_type": "payment", "term_text": "Net 30", "is_negotiable": true},
    {"term_name": "Warranty", "term_type": "warranty", "term_text": "90-day warranty", "is_negotiable": false}
  ],
  "paymentPlans": [
    {"plan_name": "Monthly", "plan_type": "monthly", "total_amount": 30000, "installment_count": 12, "installment_amount": 2500, "is_recommended": false},
    {"plan_name": "Annual", "plan_type": "annual", "total_amount": 30000, "installment_count": 1, "installment_amount": 30000, "discount_percentage": 10, "is_recommended": true}
  ],
  "negotiation": {
    "predicted_objections": [{"objection": "Too expensive", "response": "Focus on ROI"}],
    "pricing_concerns": [{"concern": "Budget constraints", "response": "Offer monthly plan"}],
    "competitor_comparison": [{"competitor": "Competitor A", "our_advantage": "Better AI"}],
    "discount_requests": [{"scenario": "Asks for 20% off", "response": "Offer 10% for annual commit"}],
    "risk_concerns": [{"concern": "Implementation risk", "response": "Phased approach with milestones"}],
    "negotiation_guidance": "Lead with ROI, offer annual discount, emphasize AI differentiation",
    "fallback_offers": [{"offer": "Reduced scope at lower price"}],
    "alternative_packages": [{"package": "Starter instead of Professional"}],
    "concessions": [{"concession": "10% discount for annual commit", "condition": "Signed within 30 days"}],
    "red_lines": [{"red_line": "No more than 15% total discount"}],
    "confidence": 0.75
  },
  "score": {
    "win_probability": 65,
    "pricing_strength": 70,
    "competitive_position": 75,
    "roi_quality": 80,
    "proposal_quality": 85,
    "relationship_strength": 60,
    "decision_confidence": 55,
    "overall_score": 70,
    "score_explanation": {
      "win_probability": "Strong buying signals from meeting",
      "pricing": "Competitive with good margin"
    },
    "confidence": 0.78
  },
  "reasoning": [
    {"reasoning_type": "pricing", "reasoning_text": "I recommend the Professional package at $2,500/mo because it matches their budget signals", "confidence": 0.8},
    {"reasoning_type": "roi", "reasoning_text": "I calculated a 520% 5-year ROI based on their stated challenges", "confidence": 0.85},
    {"reasoning_type": "package", "reasoning_text": "I believe the Better package is ideal for their team size and use case", "confidence": 0.75},
    {"reasoning_type": "discount", "reasoning_text": "I believe a 10% discount is acceptable for annual commitment", "confidence": 0.7},
    {"reasoning_type": "negotiation", "reasoning_text": "I predict procurement will ask about implementation timeline", "confidence": 0.65}
  ]
}

Return ONLY the JSON object.`;

    const response = await aiGateway.generateStructured({
      systemPrompt,
      userPrompt,
      temperature: 0.3,
      maxTokens: 10000,
      workspaceId: request.workspace_id,
      agentName: 'proposal_intelligence_agent',
      schema: { type: 'object' },
    });

    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }

  // ----------------------------------------------------------
  // Create approval workflow
  // ----------------------------------------------------------

  async createApprovalWorkflow(workspaceId: string, projectId: string, versionId: string): Promise<void> {
    const approvals = [
      { approval_type: 'internal', approver_name: 'Sales Lead', approver_role: 'VP Sales' },
      { approval_type: 'pricing', approver_name: 'Finance', approver_role: 'CFO' },
      { approval_type: 'legal', approver_name: 'Legal', approver_role: 'General Counsel' },
    ];

    await supabase.from('proposal_approvals').insert(
      approvals.map((a) => ({
        workspace_id: workspaceId,
        project_id: projectId,
        version_id: versionId,
        approval_type: a.approval_type,
        approver_name: a.approver_name,
        approver_role: a.approver_role,
        approval_status: 'pending',
      })),
    );

    await this.createNotification(workspaceId, projectId, 'approval_needed',
      'Approval Needed',
      'The proposal requires internal approvals from Sales, Finance, and Legal.',
      'warning');
  }

  // ----------------------------------------------------------
  // Send proposal (delivery)
  // ----------------------------------------------------------

  async sendProposal(workspaceId: string, projectId: string, recipientEmail: string, recipientName: string): Promise<void> {
    const { data: version } = await supabase
      .from('proposal_versions')
      .select('id')
      .eq('proposal_project_id', projectId)
      .eq('is_latest', true)
      .maybeSingle();

    await supabase.from('proposal_delivery').insert({
      workspace_id: workspaceId,
      project_id: projectId,
      version_id: version?.id ?? null,
      delivery_method: 'email',
      delivery_url: `/proposals/${projectId}`,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      sent_at: new Date().toISOString(),
    });

    await supabase.from('proposal_projects').update({ status: 'sent' }).eq('id', projectId);
    await supabase.from('proposal_status').insert({
      workspace_id: workspaceId,
      project_id: projectId,
      status: 'sent',
      status_reason: 'Proposal sent to prospect',
      changed_by: 'ai',
    });

    await this.createNotification(workspaceId, projectId, 'proposal_sent',
      'Proposal Sent',
      `Proposal sent to ${recipientName} (${recipientEmail}).`,
      'success');
  }

  // ----------------------------------------------------------
  // Record outcome
  // ----------------------------------------------------------

  async recordOutcome(workspaceId: string, projectId: string, outcome: {
    outcome: string;
    outcome_reason?: string;
    final_deal_value?: number;
    final_discount_percentage?: number;
    negotiation_rounds?: number;
  }): Promise<void> {
    const { data: existing } = await supabase
      .from('proposal_outcomes')
      .select('id, version')
      .eq('project_id', projectId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase.from('proposal_outcomes').update({
        outcome: outcome.outcome,
        outcome_reason: outcome.outcome_reason ?? null,
        final_deal_value: outcome.final_deal_value ?? null,
        final_discount_percentage: outcome.final_discount_percentage ?? null,
        negotiation_rounds: outcome.negotiation_rounds ?? 0,
      }).eq('id', existing.id);
    } else {
      await supabase.from('proposal_outcomes').insert({
        workspace_id: workspaceId,
        project_id: projectId,
        outcome: outcome.outcome,
        outcome_reason: outcome.outcome_reason ?? null,
        final_deal_value: outcome.final_deal_value ?? null,
        final_discount_percentage: outcome.final_discount_percentage ?? null,
        negotiation_rounds: outcome.negotiation_rounds ?? 0,
      });
    }

    await supabase.from('proposal_projects').update({ status: outcome.outcome }).eq('id', projectId);
    await supabase.from('proposal_status').insert({
      workspace_id: workspaceId,
      project_id: projectId,
      status: outcome.outcome as 'accepted' | 'rejected' | 'negotiating' | 'expired' | 'withdrawn' | 'revised',
      status_reason: outcome.outcome_reason ?? null,
      changed_by: 'ai',
    });
  }

  // ----------------------------------------------------------
  // Load dashboard
  // ----------------------------------------------------------

  async loadDashboard(workspaceId: string): Promise<ProposalIntelligenceDashboard> {
    const [projectsData, requestsData, notificationsData] = await Promise.all([
      supabase.from('proposal_projects').select('*').eq('workspace_id', workspaceId).order('updated_at', { ascending: false }).limit(50),
      supabase.from('proposal_requests').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(30),
      supabase.from('proposal_notifications').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20),
    ]);

    const projects = (projectsData.data ?? []) as Array<Record<string, unknown>>;
    const fullProposals: ProposalWithIntelligence[] = [];

    for (const p of projects) {
      const intel = await this.loadProposalIntelligence(workspaceId, p.id as string);
      if (intel) fullProposals.push(intel);
    }

    const awaitingApproval = fullProposals.filter((p) => p.approvals.some((a) => a.approval_status === 'pending')).length;
    const sent = fullProposals.filter((p) => p.deliveries.length > 0).length;
    const viewed = fullProposals.filter((p) => p.deliveries.some((d) => d.view_count > 0)).length;
    const negotiating = fullProposals.filter((p) => p.negotiation !== null || p.project.status === 'negotiating').length;
    const accepted = fullProposals.filter((p) => p.outcome?.outcome === 'accepted').length;
    const rejected = fullProposals.filter((p) => p.outcome?.outcome === 'rejected').length;
    const avgWinProb = fullProposals.length > 0 ? Math.round(fullProposals.reduce((s, p) => s + (p.score?.win_probability ?? 0), 0) / fullProposals.length) : 0;
    const forecastRev = fullProposals.reduce((s, p) => {
      const val = p.outcome?.final_deal_value ?? p.roi?.investment_amount ?? 0;
      return s + val;
    }, 0);

    return {
      totalProposals: projects.length,
      awaitingApproval,
      sent,
      viewed,
      negotiating,
      accepted,
      rejected,
      avgWinProbability: avgWinProb,
      forecastRevenue: forecastRev,
      proposals: fullProposals,
      pendingRequests: (requestsData.data ?? []) as ProposalRequest[],
      notifications: (notificationsData.data ?? []) as never[],
      topProposals: fullProposals.sort((a, b) => (b.score?.overall_score ?? 0) - (a.score?.overall_score ?? 0)).slice(0, 10),
    };
  }

  // ----------------------------------------------------------
  // Load full intelligence for a single proposal
  // ----------------------------------------------------------

  async loadProposalIntelligence(workspaceId: string, projectId: string): Promise<ProposalWithIntelligence | null> {
    const { data: project } = await supabase.from('proposal_projects').select('*').eq('id', projectId).maybeSingle();
    if (!project) return null;

    const [version, packages, options, roi, businessCase, timeline, scope, deliverables, assumptions, dependencies, risks, team, caseStudies, testimonials, contractTerms, paymentPlans, approvals, negotiation, signatures, statusHistory, deliveries, activity, score, reasoning, outcome] = await Promise.all([
      supabase.from('proposal_versions').select('*').eq('proposal_project_id', projectId).eq('is_latest', true).maybeSingle(),
      supabase.from('proposal_packages').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }),
      supabase.from('proposal_options').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }),
      supabase.from('proposal_roi').select('*').eq('project_id', projectId).order('version', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('proposal_business_case').select('*').eq('project_id', projectId).order('version', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('proposal_timeline').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }),
      supabase.from('proposal_scope').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }),
      supabase.from('proposal_deliverables').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }),
      supabase.from('proposal_assumptions').select('*').eq('project_id', projectId),
      supabase.from('proposal_dependencies').select('*').eq('project_id', projectId),
      supabase.from('proposal_risks').select('*').eq('project_id', projectId),
      supabase.from('proposal_team').select('*').eq('project_id', projectId),
      supabase.from('proposal_case_studies').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }),
      supabase.from('proposal_testimonials').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }),
      supabase.from('proposal_contract_terms').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }),
      supabase.from('proposal_payment_plans').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }),
      supabase.from('proposal_approvals').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('proposal_negotiation').select('*').eq('project_id', projectId).order('negotiation_round', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('proposal_signatures').select('*').eq('project_id', projectId),
      supabase.from('proposal_status').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('proposal_delivery').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('proposal_activity').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(20),
      supabase.from('proposal_score').select('*').eq('project_id', projectId).order('version', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('proposal_ai_reasoning').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('proposal_outcomes').select('*').eq('project_id', projectId).order('version', { ascending: false }).limit(1).maybeSingle(),
    ]);

    return {
      project: project as ProposalWithIntelligence['project'],
      latestVersion: (version.data ?? null) as ProposalWithIntelligence['latestVersion'],
      packages: (packages.data ?? []) as never[],
      options: (options.data ?? []) as never[],
      roi: (roi.data ?? null) as never,
      businessCase: (businessCase.data ?? null) as never,
      timeline: (timeline.data ?? []) as never[],
      scope: (scope.data ?? []) as never[],
      deliverables: (deliverables.data ?? []) as never[],
      assumptions: (assumptions.data ?? []) as never[],
      dependencies: (dependencies.data ?? []) as never[],
      risks: (risks.data ?? []) as never[],
      team: (team.data ?? []) as never[],
      caseStudies: (caseStudies.data ?? []) as never[],
      testimonials: (testimonials.data ?? []) as never[],
      contractTerms: (contractTerms.data ?? []) as never[],
      paymentPlans: (paymentPlans.data ?? []) as never[],
      approvals: (approvals.data ?? []) as never[],
      negotiation: (negotiation.data ?? null) as never,
      signatures: (signatures.data ?? []) as never[],
      statusHistory: (statusHistory.data ?? []) as never[],
      deliveries: (deliveries.data ?? []) as never[],
      activity: (activity.data ?? []) as never[],
      score: (score.data ?? null) as never,
      reasoning: (reasoning.data ?? []) as never[],
      outcome: (outcome.data ?? null) as never,
    };
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  private async loadProposalContext(workspaceId: string, request: ProposalRequest): Promise<Record<string, unknown>> {
    const [company, meetingBrief, personalization, revenueDNA, competitorIntel] = await Promise.all([
      request.company_id ? supabase.from('companies').select('*').eq('id', request.company_id).maybeSingle() : Promise.resolve({ data: null }),
      request.meeting_id ? supabase.from('meeting_briefs').select('*').eq('meeting_id', request.meeting_id).order('version', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('personalization_profiles').select('communication_style, tone, value_proposition, pain_point_references, trust_signals').eq('workspace_id', workspaceId).order('version', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('revenue_dna_profiles').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      request.meeting_id ? supabase.from('meeting_competitor_intel').select('*').eq('meeting_id', request.meeting_id) : Promise.resolve({ data: null }),
    ]);

    let memoryContext: Record<string, unknown> = {};
    try {
      const memories = await memoryEngine.getMemoriesByEntity('proposal', request.id, workspaceId);
      memoryContext = { memoryCount: memories.length };
    } catch { /* best-effort */ }

    return {
      company: company.data,
      meetingBrief: meetingBrief.data,
      personalization: personalization.data,
      revenueDNA: revenueDNA.data,
      competitorIntel: competitorIntel.data,
      memory: memoryContext,
      estimatedDealValue: request.estimated_deal_value,
    };
  }

  private async createNotification(workspaceId: string, projectId: string | null, type: string, title: string, message: string, severity: 'info' | 'warning' | 'error' | 'success'): Promise<void> {
    await supabase.from('proposal_notifications').insert({
      workspace_id: workspaceId,
      project_id: projectId,
      notification_type: type,
      notification_title: title,
      notification_message: message,
      severity,
    });
  }

  private async storeMemory(workspaceId: string, entityId: string, memoryType: string, content: Record<string, unknown>): Promise<void> {
    try {
      await memoryEngine.store({
        entityType: 'proposal',
        entityId,
        memoryType,
        title: `Proposal: ${content.prospect ?? 'Unknown'}`,
        summary: `Proposal for ${content.company ?? 'company'}`,
        content,
        confidenceScore: 0.8,
        importanceScore: 0.9,
        workspaceId,
      });
    } catch { /* best-effort */ }
  }

  private async populateKnowledgeGraph(workspaceId: string, projectId: string, result: Record<string, unknown>): Promise<void> {
    try {
      await knowledgeGraphService.ingestBatch({
        workspaceId,
        entities: [{
          nodeType: 'proposal' as never,
          externalId: `proposal_${projectId}`,
          displayName: `Proposal: ${projectId}`,
          properties: {
            overallScore: (result.score as Record<string, unknown>)?.overall_score ?? 0,
            winProbability: (result.score as Record<string, unknown>)?.win_probability ?? 0,
          },
          confidenceScore: 0.8,
        }],
        relationships: [],
      });
    } catch { /* best-effort */ }
  }
}

export const proposalIntelligenceService = new ProposalIntelligenceService();
