// ============================================================
// AudienceSegmentationEngine — Segments prospects for outreach
// ============================================================

import type { AudienceSegment, Priority, CampaignType } from '@/types/outreach';

type SegmentationInput = {
  campaignType: CampaignType;
  industry: string | null;
  companySize: string | null;
  buyingIntentScore: number;
  icpScore: number;
  growthScore: number;
  riskScore: number;
  decisionMakers: { name: string; title: string; department: string }[];
  competitors: string[];
  buyingSignals: { signal_type: string; confidence: number }[];
  customInstructions?: string;
};

class AudienceSegmentationEngine {
  segment(input: SegmentationInput): AudienceSegment {
    const priority = this.determinePriority(input);
    const segmentType = this.determineSegmentType(input);
    const criteria = this.buildCriteria(input);
    const contactCount = this.estimateContactCount(input);

    return {
      segment_name: this.generateSegmentName(input, segmentType),
      segment_type: segmentType,
      criteria,
      priority_level: priority,
      contact_count: contactCount,
    };
  }

  private determinePriority(input: SegmentationInput): Priority {
    if (input.buyingIntentScore >= 0.8 && input.icpScore >= 0.7) return 'critical';
    if (input.buyingIntentScore >= 0.6 || input.icpScore >= 0.7) return 'high';
    if (input.icpScore >= 0.5 || input.growthScore >= 0.6) return 'medium';
    return 'low';
  }

  private determineSegmentType(input: SegmentationInput): string {
    if (input.buyingIntentScore >= 0.7) return 'high_intent';
    if (input.icpScore >= 0.7) return 'icp_match';
    if (input.growthScore >= 0.6) return 'growth_signal';
    if (input.competitors.length > 5) return 'competitive_market';
    return 'general';
  }

  private buildCriteria(input: SegmentationInput): Record<string, unknown> {
    const criteria: Record<string, unknown> = {};
    if (input.industry) criteria.industry = input.industry;
    if (input.companySize) criteria.company_size = input.companySize;
    criteria.min_icp_score = input.icpScore;
    criteria.min_buying_intent = input.buyingIntentScore;
    criteria.growth_score = input.growthScore;
    criteria.competitor_count = input.competitors.length;
    criteria.signal_count = input.buyingSignals.length;
    if (input.customInstructions) criteria.custom = input.customInstructions;
    return criteria;
  }

  private estimateContactCount(input: SegmentationInput): number {
    let count = input.decisionMakers.length;
    if (count === 0) count = 1;
    if (input.companySize) {
      const size = input.companySize.toLowerCase();
      if (size.includes('enterprise') || size.includes('large')) count += 3;
      if (size.includes('mid') || size.includes('medium')) count += 2;
    }
    return Math.min(count, 10);
  }

  private generateSegmentName(input: SegmentationInput, segmentType: string): string {
    const parts: string[] = [];
    if (input.industry) parts.push(input.industry);
    parts.push(segmentType.replace(/_/g, ' '));
    parts.push(input.campaignType.replace(/_/g, ' '));
    return parts.join(' — ');
  }
}

export const audienceSegmentationEngine = new AudienceSegmentationEngine();
