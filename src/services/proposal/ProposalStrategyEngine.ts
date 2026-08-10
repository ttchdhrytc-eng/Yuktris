// ============================================================
// ProposalStrategyEngine — Determines proposal strategy from context
// ============================================================

import type { ProposalStrategy, ProposalType, Priority } from '@/types/proposal';

type StrategyInput = {
  proposalType: ProposalType;
  companyName: string;
  industry: string | null;
  businessModel: string | null;
  overallRevenueScore: number;
  icpScore: number;
  buyingIntentScore: number;
  riskScore: number;
  growthScore: number;
  buyingSignals: { signal_type: string; description: string; confidence: number }[];
  growthSignals: { signal_type: string; description: string; confidence: number }[];
  competitors: string[];
  recommendedAction: string | null;
  customInstructions?: string;
};

class ProposalStrategyEngine {
  generate(input: StrategyInput): ProposalStrategy {
    const approach = this.determineApproach(input);
    const objectives = this.determineObjectives(input);
    const differentiators = this.determineDifferentiators(input);
    const risks = this.determineRisks(input);
    const metrics = this.determineMetrics(input);
    const timeline = this.determineTimeline(input);

    return {
      approach,
      primary_objectives: objectives,
      key_differentiators: differentiators,
      risk_factors: risks,
      success_metrics: metrics,
      competitive_positioning: this.determinePositioning(input),
      recommended_timeline_weeks: timeline,
    };
  }

  private determineApproach(input: StrategyInput): string {
    const approaches: Record<ProposalType, string> = {
      executive: 'Strategic executive partnership approach focused on long-term business transformation and measurable ROI.',
      sales: 'Consultative sales approach emphasizing value-driven solutions and rapid time-to-value.',
      seo: 'Data-driven SEO strategy focused on organic growth, technical optimization, and content authority building.',
      google_ads: 'Performance-focused Google Ads strategy optimizing for ROAS, conversion rate, and scalable lead generation.',
      meta_ads: 'Creative-driven Meta Ads approach leveraging audience targeting, retargeting, and conversion optimization.',
      linkedin_ads: 'B2B-focused LinkedIn Ads strategy targeting decision-makers, account-based marketing, and lead quality.',
      digital_marketing: 'Integrated digital marketing approach combining SEO, paid media, content, and conversion optimization.',
      website: 'Conversion-optimized website development approach focused on user experience, performance, and lead generation.',
      software: 'Agile software development approach with iterative delivery, continuous integration, and scalable architecture.',
      ai_solution: 'AI-native solution approach emphasizing data strategy, model deployment, and measurable business outcomes.',
      custom: 'Tailored strategic approach based on specific business requirements and objectives.',
    };
    return approaches[input.proposalType] ?? approaches.custom;
  }

  private determineObjectives(input: StrategyInput): string[] {
    const objectives: string[] = [];

    if (input.buyingIntentScore >= 0.7) {
      objectives.push('Capitalize on current buying intent by accelerating the decision process');
    }
    if (input.growthScore >= 0.6) {
      objectives.push('Support company growth trajectory with scalable solutions');
    }
    if (input.icpScore >= 0.7) {
      objectives.push('Deliver a tailored solution aligned with the company\'s specific industry needs');
    }
    if (input.competitors.length > 5) {
      objectives.push('Differentiate from competitors through superior value and service');
    }
    objectives.push('Establish clear ROI expectations and measurable success criteria');

    if (input.customInstructions) {
      objectives.push(`Address specific requirement: ${input.customInstructions}`);
    }

    return objectives;
  }

  private determineDifferentiators(input: StrategyInput): string[] {
    const diffs: string[] = [];
    if (input.icpScore >= 0.7) diffs.push('Deep industry expertise and proven track record in similar companies');
    if (input.growthScore >= 0.6) diffs.push('Scalable solutions designed to grow with the business');
    if (input.buyingIntentScore >= 0.6) diffs.push('Rapid deployment capability to meet urgent business needs');
    diffs.push('Data-driven approach with measurable outcomes');
    diffs.push('Dedicated account team with senior-level expertise');
    return diffs;
  }

  private determineRisks(input: StrategyInput): string[] {
    const risks: string[] = [];
    if (input.riskScore >= 0.6) risks.push('Incomplete company data may require additional discovery');
    if (input.competitors.length > 5) risks.push('Highly competitive market may require aggressive pricing');
    if (input.buyingIntentScore < 0.4) risks.push('Low buying intent may require longer sales cycle');
    risks.push('Timeline may be impacted by client-side resource availability');
    return risks;
  }

  private determineMetrics(input: StrategyInput): { metric: string; target: string; timeframe: string }[] {
    const baseMetrics: { metric: string; target: string; timeframe: string }[] = [
      { metric: 'Project kickoff', target: 'Within 2 weeks of approval', timeframe: '2 weeks' },
      { metric: 'First deliverable', target: 'Within 4 weeks of kickoff', timeframe: '4 weeks' },
      { metric: 'Full deployment', target: 'On schedule per roadmap', timeframe: 'Per roadmap' },
    ];

    if (input.proposalType === 'seo' || input.proposalType === 'digital_marketing') {
      baseMetrics.push({ metric: 'Organic traffic growth', target: '25%+ increase', timeframe: '6 months' });
    }
    if (input.proposalType === 'google_ads' || input.proposalType === 'meta_ads' || input.proposalType === 'linkedin_ads') {
      baseMetrics.push({ metric: 'ROAS', target: '3x+ return on ad spend', timeframe: '3 months' });
    }
    if (input.proposalType === 'website' || input.proposalType === 'software') {
      baseMetrics.push({ metric: 'Page load time', target: '< 2 seconds', timeframe: 'At launch' });
    }
    if (input.proposalType === 'ai_solution') {
      baseMetrics.push({ metric: 'Model accuracy', target: '90%+ accuracy', timeframe: '3 months post-deployment' });
    }

    return baseMetrics;
  }

  private determinePositioning(input: StrategyInput): string {
    if (input.icpScore >= 0.7 && input.buyingIntentScore >= 0.6) {
      return 'Position as a strategic partner with deep industry expertise, ready to capitalize on the company\'s current momentum.';
    }
    if (input.riskScore >= 0.6) {
      return 'Position as a trusted advisor who can help navigate the company\'s challenges with a proven, low-risk approach.';
    }
    return 'Position as a results-driven partner focused on delivering measurable business outcomes.';
  }

  private determineTimeline(input: StrategyInput): number {
    const baseTimelines: Record<ProposalType, number> = {
      executive: 16,
      sales: 8,
      seo: 12,
      google_ads: 4,
      meta_ads: 4,
      linkedin_ads: 4,
      digital_marketing: 16,
      website: 12,
      software: 20,
      ai_solution: 24,
      custom: 12,
    };
    return baseTimelines[input.proposalType] ?? 12;
  }
}

export const proposalStrategyEngine = new ProposalStrategyEngine();
