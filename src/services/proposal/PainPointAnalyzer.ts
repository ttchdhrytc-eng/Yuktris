// ============================================================
// PainPointAnalyzer — Analyzes business pain points from research
// ============================================================

import type { PainPoint } from '@/types/proposal';

type PainPointInput = {
  summary: string | null;
  industry: string | null;
  businessModel: string | null;
  buyingSignals: { signal_type: string; description: string; confidence: number }[];
  growthSignals: { signal_type: string; description: string; confidence: number }[];
  technologyStack: { name: string; category: string }[];
  competitors: string[];
  decisionMakers: { name: string; title: string; department: string }[];
  riskScore: number;
};

class PainPointAnalyzer {
  analyze(input: PainPointInput): PainPoint[] {
    const painPoints: PainPoint[] = [];

    // Technology gaps
    if (input.technologyStack.length < 5) {
      painPoints.push({
        pain_point: 'Limited Technology Stack',
        description: `The company has only ${input.technologyStack.length} technologies in their stack, suggesting potential gaps in tooling and infrastructure.`,
        severity: input.technologyStack.length < 3 ? 'high' : 'medium',
        impact: 'May limit operational efficiency and competitive advantage',
        evidence: `Technology stack contains ${input.technologyStack.length} tools`,
        proposed_solution: 'Implement a comprehensive technology stack modernization plan with integrated tools for improved workflow.',
      });
    }

    // Competitive pressure
    if (input.competitors.length > 5) {
      painPoints.push({
        pain_point: 'Intense Competitive Pressure',
        description: `The company faces ${input.competitors.length} competitors, indicating a crowded market with high competitive intensity.`,
        severity: 'high',
        impact: 'May struggle to differentiate and maintain market share',
        evidence: `${input.competitors.length} competitors identified in research`,
        proposed_solution: 'Develop a differentiated positioning strategy with unique value propositions and targeted messaging.',
      });
    }

    // Growth challenges
    if (input.growthSignals.length > 0) {
      const highGrowth = input.growthSignals.filter((s) => s.confidence >= 0.7);
      if (highGrowth.length > 0) {
        painPoints.push({
          pain_point: 'Scaling Challenges During Growth',
          description: 'Growth signals indicate the company is expanding, which often brings operational and infrastructure scaling challenges.',
          severity: 'medium',
          impact: 'Rapid growth without proper systems can lead to operational bottlenecks',
          evidence: `${highGrowth.length} high-confidence growth signals detected`,
          proposed_solution: 'Implement scalable systems and processes designed to handle growth without proportional overhead increase.',
        });
      }
    }

    // Decision maker gaps
    if (input.decisionMakers.length < 2) {
      painPoints.push({
        pain_point: 'Limited Decision-Maker Visibility',
        description: `Only ${input.decisionMakers.length} decision maker(s) identified, which may indicate a bottleneck in the buying process.`,
        severity: 'medium',
        impact: 'Single point of failure in decision-making process',
        evidence: `${input.decisionMakers.length} decision makers identified`,
        proposed_solution: 'Multi-thread the relationship by engaging additional stakeholders across departments.',
      });
    }

    // Risk factors
    if (input.riskScore >= 0.6) {
      painPoints.push({
        pain_point: 'Data and Intelligence Gaps',
        description: 'High risk score suggests incomplete company data, which may indicate the company lacks proper intelligence systems.',
        severity: 'high',
        impact: 'Decisions made without complete data lead to suboptimal outcomes',
        evidence: `Risk score: ${Math.round(input.riskScore * 100)}%`,
        proposed_solution: 'Implement a business intelligence system to centralize data and provide actionable insights.',
      });
    }

    // Industry-specific pain points
    if (input.industry) {
      const industryLower = input.industry.toLowerCase();
      if (industryLower.includes('saas') || industryLower.includes('software')) {
        painPoints.push({
          pain_point: 'Customer Acquisition and Retention',
          description: 'SaaS companies typically face challenges with customer acquisition cost (CAC) and retention rates.',
          severity: 'high',
          impact: 'High CAC and churn rates directly impact revenue and valuation',
          evidence: `Industry: ${input.industry}`,
          proposed_solution: 'Implement data-driven acquisition and retention strategies with clear funnel metrics and lifecycle automation.',
        });
      }
      if (industryLower.includes('ecommerce') || industryLower.includes('retail')) {
        painPoints.push({
          pain_point: 'Conversion Rate Optimization',
          description: 'E-commerce businesses need continuous optimization of conversion funnels to maximize revenue per visitor.',
          severity: 'medium',
          impact: 'Low conversion rates mean wasted traffic spend and lost revenue',
          evidence: `Industry: ${input.industry}`,
          proposed_solution: 'Implement a CRO program with A/B testing, personalization, and funnel analysis.',
        });
      }
    }

    // Buying signal urgency
    const urgentSignals = input.buyingSignals.filter((s) => s.confidence >= 0.8);
    if (urgentSignals.length > 0) {
      painPoints.push({
        pain_point: 'Time-Sensitive Opportunity',
        description: 'Multiple high-confidence buying signals suggest the company has an urgent need that requires immediate attention.',
        severity: 'critical',
        impact: 'Delaying action may result in losing the opportunity to a competitor',
        evidence: `${urgentSignals.length} high-confidence buying signals detected`,
        proposed_solution: 'Accelerate the proposal process with a rapid deployment plan and quick-win deliverables.',
      });
    }

    return painPoints;
  }
}

export const painPointAnalyzer = new PainPointAnalyzer();
