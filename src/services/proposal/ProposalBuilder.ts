// ============================================================
// ProposalBuilder — Assembles all components into a proposal
// ============================================================

import { proposalStrategyEngine } from './ProposalStrategyEngine';
import { painPointAnalyzer } from './PainPointAnalyzer';
import { solutionRecommendationEngine } from './SolutionRecommendationEngine';
import { pricingEngine } from './PricingEngine';
import { roiEngine } from './ROIEngine';
import { executiveSummaryGenerator } from './ExecutiveSummaryGenerator';
import type { ProposalContent, ProposalType, RoadmapPhase, CaseStudyRecommendation, TeamRecommendation, CompetitiveDifferentiation } from '@/types/proposal';

type BuildInput = {
  proposalType: ProposalType;
  companyName: string;
  industry: string | null;
  businessModel: string | null;
  companySize: string | null;
  summary: string | null;
  overallRevenueScore: number;
  icpScore: number;
  buyingIntentScore: number;
  riskScore: number;
  growthScore: number;
  buyingSignals: { signal_type: string; description: string; confidence: number }[];
  growthSignals: { signal_type: string; description: string; confidence: number }[];
  technologyStack: { name: string; category: string }[];
  competitors: string[];
  decisionMakers: { name: string; title: string; department: string }[];
  recommendedAction: string | null;
  customInstructions?: string;
};

class ProposalBuilder {
  build(input: BuildInput): ProposalContent {
    // 1. Strategy
    const strategy = proposalStrategyEngine.generate({
      proposalType: input.proposalType,
      companyName: input.companyName,
      industry: input.industry,
      businessModel: input.businessModel,
      overallRevenueScore: input.overallRevenueScore,
      icpScore: input.icpScore,
      buyingIntentScore: input.buyingIntentScore,
      riskScore: input.riskScore,
      growthScore: input.growthScore,
      buyingSignals: input.buyingSignals,
      growthSignals: input.growthSignals,
      competitors: input.competitors,
      recommendedAction: input.recommendedAction,
      customInstructions: input.customInstructions,
    });

    // 2. Pain Points
    const problemAnalysis = painPointAnalyzer.analyze({
      summary: input.summary,
      industry: input.industry,
      businessModel: input.businessModel,
      buyingSignals: input.buyingSignals,
      growthSignals: input.growthSignals,
      technologyStack: input.technologyStack,
      competitors: input.competitors,
      decisionMakers: input.decisionMakers,
      riskScore: input.riskScore,
    });

    // 3. Solutions
    const solutions = solutionRecommendationEngine.recommend({
      proposalType: input.proposalType,
      painPoints: problemAnalysis,
      technologyStack: input.technologyStack,
      industry: input.industry,
      growthScore: input.growthScore,
      buyingIntentScore: input.buyingIntentScore,
      competitors: input.competitors,
    });

    // 4. Pricing
    const pricing = pricingEngine.generate({
      proposalType: input.proposalType,
      solutions: solutions.map((s) => ({ service_name: s.service_name, description: s.description, timeline_weeks: s.timeline_weeks })),
      companySize: input.companySize,
      industry: input.industry,
      riskScore: input.riskScore,
      icpScore: input.icpScore,
      buyingIntentScore: input.buyingIntentScore,
    });

    // 5. ROI
    const roi = roiEngine.calculate({
      proposalType: input.proposalType,
      totalInvestment: pricing.total,
      industry: input.industry,
      companySize: input.companySize,
      growthScore: input.growthScore,
      buyingIntentScore: input.buyingIntentScore,
    });

    // 6. Roadmap
    const roadmap = this.buildRoadmap(solutions, strategy.recommended_timeline_weeks);

    // 7. Timeline
    const timeline = this.buildTimeline(roadmap);

    // 8. Competitive differentiation
    const competitiveDiff = this.buildCompetitiveDiff(input.competitors, input.proposalType);

    // 9. Case studies
    const caseStudies = this.buildCaseStudies(input.proposalType, input.industry);

    // 10. Team
    const team = this.buildTeam(input.proposalType);

    // 11. FAQs
    const faqs = this.buildFAQs(input.proposalType, pricing.total, roi.payback_period_months);

    // 12. Executive summary
    const executiveSummary = executiveSummaryGenerator.generate({
      proposalType: input.proposalType,
      companyName: input.companyName,
      industry: input.industry,
      painPoints: problemAnalysis,
      solutions,
      roi,
      pricing,
      strategy,
      timelineWeeks: strategy.recommended_timeline_weeks,
    });

    // 13. Company overview
    const companyOverview = this.buildCompanyOverview(input);

    // 14. Business objectives
    const businessObjectives = strategy.primary_objectives;

    // 15. Recommended strategy text
    const recommendedStrategy = `${strategy.approach} ${strategy.competitive_positioning}`;

    // 16. Risk assessment
    const riskAssessment = {
      overall_risk: input.riskScore >= 0.6 ? 'high' : input.riskScore >= 0.3 ? 'medium' : 'low',
      risks: strategy.risk_factors.map((risk) => ({
        risk,
        probability: Math.min(input.riskScore + 0.1, 1.0),
        impact: 0.6,
        mitigation: this.mitigateRisk(risk),
      })),
      assumptions: roi.assumptions,
    };

    // 17. Call to action
    const callToAction = this.buildCallToAction(input.companyName, input.buyingIntentScore);

    return {
      strategy,
      executive_summary: executiveSummary,
      company_overview: companyOverview,
      problem_analysis: problemAnalysis,
      business_objectives: businessObjectives,
      recommended_strategy: recommendedStrategy,
      solution_recommendations: solutions,
      implementation_roadmap: roadmap,
      timeline,
      pricing,
      roi,
      risk_assessment: riskAssessment,
      competitive_differentiation: competitiveDiff,
      case_studies: caseStudies,
      team_recommendation: team,
      faqs,
      call_to_action: callToAction,
    };
  }

  private buildRoadmap(solutions: { service_name: string; timeline_weeks: number }[], totalWeeks: number): RoadmapPhase[] {
    const phases: RoadmapPhase[] = [];

    phases.push({
      phase: 1,
      title: 'Discovery & Planning',
      description: 'Initial discovery, stakeholder alignment, and detailed project planning.',
      duration_weeks: 2,
      deliverables: ['Project kickoff', 'Requirements document', 'Success metrics definition'],
      milestones: ['Project charter approved', 'Stakeholders aligned'],
      dependencies: ['Access to key stakeholders', 'Historical data access'],
    });

    let currentWeek = 2;
    solutions.forEach((sol, i) => {
      currentWeek += sol.timeline_weeks;
      phases.push({
        phase: i + 2,
        title: sol.service_name,
        description: `Implementation of ${sol.service_name}.`,
        duration_weeks: sol.timeline_weeks,
        deliverables: [`Deliverable ${i + 1}`],
        milestones: [`${sol.service_name} delivered`],
        dependencies: [],
      });
    });

    phases.push({
      phase: phases.length + 1,
      title: 'Review & Optimization',
      description: 'Post-implementation review, optimization, and handover.',
      duration_weeks: 2,
      deliverables: ['Performance report', 'Optimization recommendations', 'Documentation'],
      milestones: ['Project sign-off', 'Knowledge transfer complete'],
      dependencies: ['All prior phases complete'],
    });

    return phases;
  }

  private buildTimeline(roadmap: RoadmapPhase[]): { phase: string; start_week: number; end_week: number; milestone: string }[] {
    let currentWeek = 0;
    return roadmap.map((phase) => {
      const start = currentWeek + 1;
      const end = currentWeek + phase.duration_weeks;
      currentWeek = end;
      return {
        phase: `Phase ${phase.phase}: ${phase.title}`,
        start_week: start,
        end_week: end,
        milestone: phase.milestones[0] ?? phase.title,
      };
    });
  }

  private buildCompetitiveDiff(competitors: string[], type: ProposalType): CompetitiveDifferentiation[] {
    return competitors.slice(0, 5).map((comp) => ({
      competitor: comp,
      their_approach: 'Traditional service delivery with limited data-driven optimization.',
      our_advantage: 'AI-powered, data-driven approach with continuous optimization and transparent reporting.',
      key_difference: 'We leverage proprietary intelligence and automation to deliver superior results.',
    }));
  }

  private buildCaseStudies(type: ProposalType, industry: string | null): CaseStudyRecommendation[] {
    const caseStudies: CaseStudyRecommendation[] = [];

    const baseStudy: CaseStudyRecommendation = {
      title: `${type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Success Story`,
      client: 'Confidential Client',
      industry: industry ?? 'Technology',
      challenge: 'The client needed a comprehensive solution to improve their business performance and competitive positioning.',
      solution: `We implemented a tailored ${type.replace(/_/g, ' ')} program with data-driven optimization and continuous improvement.`,
      results: ['150% increase in key metrics', '60% reduction in operational costs', '3x improvement in efficiency'],
      relevance: 'This case study demonstrates our ability to deliver measurable results in a similar context.',
    };

    caseStudies.push(baseStudy);

    if (type === 'seo' || type === 'digital_marketing') {
      caseStudies.push({
        title: 'Organic Growth Success',
        client: 'SaaS Company',
        industry: industry ?? 'SaaS',
        challenge: 'Stagnant organic traffic and declining search visibility.',
        solution: 'Comprehensive SEO program with technical optimization, content strategy, and link building.',
        results: ['250% increase in organic traffic', 'Top 3 rankings for 50+ keywords', '40% increase in organic leads'],
        relevance: 'Demonstrates our ability to drive sustained organic growth.',
      });
    }

    return caseStudies;
  }

  private buildTeam(type: ProposalType): TeamRecommendation[] {
    const team: TeamRecommendation[] = [
      {
        role: 'Project Director',
        responsibility: 'Overall project strategy, client relationship, and quality assurance.',
        allocation: '20% time commitment',
        expertise: '10+ years in industry, proven track record with similar projects.',
      },
      {
        role: 'Project Manager',
        responsibility: 'Day-to-day project management, timeline, and deliverable coordination.',
        allocation: '50% time commitment',
        expertise: 'Certified PMP with experience in agile and waterfall methodologies.',
      },
    ];

    if (type === 'seo' || type === 'digital_marketing') {
      team.push({
        role: 'SEO Specialist',
        responsibility: 'Technical SEO, content optimization, and link building strategy.',
        allocation: '100% time commitment',
        expertise: '5+ years of SEO experience with proven ranking improvements.',
      });
    }

    if (type === 'google_ads' || type === 'meta_ads' || type === 'linkedin_ads') {
      team.push({
        role: 'Paid Media Specialist',
        responsibility: 'Campaign setup, optimization, and performance reporting.',
        allocation: '100% time commitment',
        expertise: 'Certified in Google Ads and Meta Ads with proven ROAS improvements.',
      });
    }

    if (type === 'website' || type === 'software') {
      team.push({
        role: 'Lead Developer',
        responsibility: 'Technical architecture, development, and code quality.',
        allocation: '100% time commitment',
        expertise: 'Senior full-stack developer with 8+ years of experience.',
      });
    }

    if (type === 'ai_solution') {
      team.push({
        role: 'AI/ML Engineer',
        responsibility: 'Model development, training, and deployment.',
        allocation: '100% time commitment',
        expertise: 'PhD-level expertise in machine learning and AI deployment.',
      });
    }

    team.push({
      role: 'Data Analyst',
      responsibility: 'Performance tracking, reporting, and data-driven optimization.',
      allocation: '30% time commitment',
      expertise: 'Expert in analytics platforms and data visualization.',
    });

    return team;
  }

  private buildFAQs(type: ProposalType, totalCost: number, paybackMonths: number): { question: string; answer: string }[] {
    return [
      {
        question: 'What is the total investment?',
        answer: `The total investment for this ${type.replace(/_/g, ' ')} proposal is $${totalCost.toLocaleString()}. This includes all deliverables, project management, and ongoing optimization.`,
      },
      {
        question: 'What is the expected ROI?',
        answer: `Based on our projections, the expected payback period is ${paybackMonths} months. ROI projections are based on industry benchmarks and historical performance data.`,
      },
      {
        question: 'How long will the project take?',
        answer: 'The project timeline is outlined in the implementation roadmap. Each phase has clear deliverables and milestones to ensure on-time delivery.',
      },
      {
        question: 'What happens after the project is completed?',
        answer: 'We provide a 30-day post-launch support period. Ongoing maintenance and optimization packages are available as add-on services.',
      },
      {
        question: 'How do we get started?',
        answer: 'Simply approve this proposal and we will schedule a kickoff call within 5 business days to begin the discovery phase.',
      },
    ];
  }

  private buildCompanyOverview(input: BuildInput): string {
    const parts: string[] = [];
    parts.push(`${input.companyName} is a ${input.companySize ?? 'mid-market'} company${input.industry ? ` in the ${input.industry} industry` : ''}.`);
    if (input.businessModel) parts.push(`The company operates on a ${input.businessModel} business model.`);
    if (input.summary) parts.push(input.summary);
    if (input.technologyStack.length > 0) {
      parts.push(`The company's technology stack includes ${input.technologyStack.length} tools, indicating ${input.technologyStack.length > 10 ? 'a mature' : 'a developing'} technology infrastructure.`);
    }
    return parts.join(' ');
  }

  private mitigateRisk(risk: string): string {
    return `We mitigate this risk through proactive planning, regular communication, and contingency planning. Our team has experience handling similar challenges and will apply best practices to ensure project success.`;
  }

  private buildCallToAction(companyName: string, buyingIntentScore: number): string {
    if (buyingIntentScore >= 0.7) {
      return `Given the strong alignment between our solution and ${companyName}'s current needs, we recommend moving forward immediately. Contact us today to schedule a kickoff call and begin the discovery phase within 5 business days.`;
    }
    return `We are excited about the opportunity to partner with ${companyName}. To proceed, please review and approve this proposal. Our team is available for any questions and ready to begin upon your approval.`;
  }
}

export const proposalBuilder = new ProposalBuilder();
