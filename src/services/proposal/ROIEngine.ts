// ============================================================
// ROIEngine — Calculates expected return on investment
// ============================================================

import type { ROIEstimation, ProposalType } from '@/types/proposal';

type ROIInput = {
  proposalType: ProposalType;
  totalInvestment: number;
  industry: string | null;
  companySize: string | null;
  growthScore: number;
  buyingIntentScore: number;
};

class ROIEngine {
  calculate(input: ROIInput): ROIEstimation {
    const investment = input.totalInvestment;

    const revenueMultiplier = this.getRevenueMultiplier(input.proposalType);
    const projectedRevenue = Math.round(investment * revenueMultiplier);

    const costSavings = Math.round(investment * this.getCostSavingsMultiplier(input.proposalType));

    const efficiencyGain = Math.round(investment * this.getEfficiencyMultiplier(input));

    const totalValue = projectedRevenue + costSavings + efficiencyGain;
    const roiPercentage = investment > 0 ? Math.round((totalValue / investment) * 100) / 100 : 0;
    const paybackMonths = this.estimatePaybackPeriod(input.proposalType, investment, totalValue);

    return {
      investment,
      projected_revenue: projectedRevenue,
      projected_cost_savings: costSavings,
      projected_efficiency_gain: efficiencyGain,
      total_projected_value: totalValue,
      roi_percentage: roiPercentage,
      payback_period_months: paybackMonths,
      assumptions: this.generateAssumptions(input),
      confidence: this.calculateConfidence(input),
    };
  }

  private getRevenueMultiplier(type: ProposalType): number {
    const multipliers: Record<ProposalType, number> = {
      executive: 3,
      sales: 5,
      seo: 4,
      google_ads: 6,
      meta_ads: 5,
      linkedin_ads: 4,
      digital_marketing: 5,
      website: 3,
      software: 4,
      ai_solution: 7,
      custom: 4,
    };
    return multipliers[type] ?? 3;
  }

  private getCostSavingsMultiplier(type: ProposalType): number {
    const multipliers: Record<ProposalType, number> = {
      executive: 1.5,
      sales: 1,
      seo: 0.5,
      google_ads: 0.3,
      meta_ads: 0.3,
      linkedin_ads: 0.3,
      digital_marketing: 0.8,
      website: 1,
      software: 2,
      ai_solution: 3,
      custom: 1,
    };
    return multipliers[type] ?? 1;
  }

  private getEfficiencyMultiplier(input: ROIInput): number {
    let base = 1.0;
    if (input.growthScore >= 0.7) base += 0.5;
    if (input.buyingIntentScore >= 0.7) base += 0.3;
    return base;
  }

  private estimatePaybackPeriod(type: ProposalType, investment: number, totalValue: number): number {
    if (totalValue <= 0) return 0;

    const monthlyValue = totalValue / 12;
    if (monthlyValue <= 0) return 0;

    const baseMonths = investment / monthlyValue;

    // Some types have faster payback
    const adjustment: Record<ProposalType, number> = {
      google_ads: 0.5,
      meta_ads: 0.5,
      linkedin_ads: 0.6,
      sales: 0.7,
      seo: 1.2,
      ai_solution: 1.5,
    };

    const adjusted = baseMonths * (adjustment[type] ?? 1);
    return Math.max(1, Math.round(adjusted));
  }

  private generateAssumptions(input: ROIInput): string[] {
    const assumptions: string[] = [
      'ROI projections are based on industry benchmarks and historical performance data.',
      'Revenue projections assume consistent execution and client-side resource availability.',
      'Cost savings estimates are based on process automation and efficiency gains.',
      `Calculations assume ${input.companySize ?? 'mid-market'} company operational baseline.`,
    ];

    if (input.growthScore >= 0.7) {
      assumptions.push('Growth signals suggest above-average revenue potential.');
    }
    if (input.buyingIntentScore >= 0.7) {
      assumptions.push('High buying intent may accelerate ROI realization.');
    }

    return assumptions;
  }

  private calculateConfidence(input: ROIInput): number {
    let confidence = 0.6;
    if (input.growthScore >= 0.6) confidence += 0.1;
    if (input.buyingIntentScore >= 0.6) confidence += 0.1;
    if (input.industry) confidence += 0.05;
    return Math.min(confidence, 0.9);
  }
}

export const roiEngine = new ROIEngine();
