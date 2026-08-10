// ============================================================
// ExecutiveSummaryGenerator — Generates executive summaries
// ============================================================

import type { ProposalType, PainPoint, SolutionRecommendation, ROIEstimation, PricingRecommendation } from '@/types/proposal';

type SummaryInput = {
  proposalType: ProposalType;
  companyName: string;
  industry: string | null;
  painPoints: PainPoint[];
  solutions: SolutionRecommendation[];
  roi: ROIEstimation;
  pricing: PricingRecommendation;
  strategy: { approach: string; competitive_positioning: string };
  timelineWeeks: number;
};

class ExecutiveSummaryGenerator {
  generate(input: SummaryInput): string {
    const parts: string[] = [];

    // Opening
    parts.push(this.generateOpening(input));

    // Problem statement
    parts.push(this.generateProblemStatement(input));

    // Solution overview
    parts.push(this.generateSolutionOverview(input));

    // ROI highlight
    parts.push(this.generateROIHighlight(input));

    // Timeline
    parts.push(this.generateTimelineStatement(input));

    // Closing
    parts.push(this.generateClosing(input));

    return parts.join('\n\n');
  }

  private generateOpening(input: SummaryInput): string {
    const industryPart = input.industry ? ` in the ${input.industry} industry` : '';
    return `This proposal outlines a comprehensive ${input.proposalType.replace(/_/g, ' ')} strategy for ${input.companyName}${industryPart}. ` +
      `Our approach is designed to address the company's specific challenges while delivering measurable business outcomes.`;
  }

  private generateProblemStatement(input: SummaryInput): string {
    const criticalPains = input.painPoints.filter((p) => p.severity === 'critical' || p.severity === 'high');
    if (criticalPains.length === 0) {
      return `Based on our analysis, we have identified several areas where ${input.companyName} can improve operational efficiency and competitive positioning.`;
    }

    const painList = criticalPains.slice(0, 3).map((p) => p.pain_point).join(', ');
    return `Our research has identified key challenges facing ${input.companyName}, including: ${painList}. ` +
      `These challenges present significant opportunities for improvement and growth through targeted interventions.`;
  }

  private generateSolutionOverview(input: SummaryInput): string {
    const solutionNames = input.solutions.slice(0, 3).map((s) => s.service_name).join(', ');
    return `We recommend a ${input.strategy.approach.toLowerCase()} ` +
      `Our proposed solution includes: ${solutionNames}. ` +
      `Each component is designed to address specific business challenges while building a foundation for sustainable growth.`;
  }

  private generateROIHighlight(input: SummaryInput): string {
    const roi = input.roi;
    return `With a total investment of $${roi.investment.toLocaleString()}, ` +
      `we project a total value of $${roi.total_projected_value.toLocaleString()} ` +
      `representing a ${roi.roi_percentage.toFixed(1)}x return on investment. ` +
      `The estimated payback period is ${roi.payback_period_months} months, ` +
      `with projected revenue impact of $${roi.projected_revenue.toLocaleString()} ` +
      `and cost savings of $${roi.projected_cost_savings.toLocaleString()}.`;
  }

  private generateTimelineStatement(input: SummaryInput): string {
    const months = Math.ceil(input.timelineWeeks / 4);
    return `The proposed implementation timeline spans approximately ${input.timelineWeeks} weeks (${months} months), ` +
      `with clear milestones and deliverables at each phase. ` +
      `This timeline is designed to deliver quick wins early while building toward long-term strategic objectives.`;
  }

  private generateClosing(input: SummaryInput): string {
    return `We are confident that this proposal represents a significant opportunity for ${input.companyName} ` +
      `to achieve measurable business growth and operational excellence. ` +
      `${input.strategy.competitive_positioning} ` +
      `We look forward to partnering with your team to deliver exceptional results.`;
  }
}

export const executiveSummaryGenerator = new ExecutiveSummaryGenerator();
