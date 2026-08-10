// ============================================================
// PricingEngine — Generates pricing recommendations
// ============================================================

import type { PricingRecommendation, PricingLineItem, PricingModel, ProposalType } from '@/types/proposal';

type PricingInput = {
  proposalType: ProposalType;
  solutions: { service_name: string; description: string; timeline_weeks: number }[];
  companySize: string | null;
  industry: string | null;
  riskScore: number;
  icpScore: number;
  buyingIntentScore: number;
};

class PricingEngine {
  generate(input: PricingInput): PricingRecommendation {
    const model = this.determinePricingModel(input.proposalType);
    const lineItems = this.generateLineItems(input);
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const discount = this.calculateDiscount(input, subtotal);
    const tax = Math.round((subtotal - discount) * 0.0 * 100) / 100;
    const total = subtotal - discount + tax;

    return {
      model,
      line_items: lineItems,
      subtotal: Math.round(subtotal * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      tax,
      total: Math.round(total * 100) / 100,
      currency: 'USD',
      payment_terms: this.determinePaymentTerms(model),
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      rationale: this.generateRationale(input, model, total),
    };
  }

  private determinePricingModel(type: ProposalType): PricingModel {
    const models: Record<ProposalType, PricingModel> = {
      executive: 'milestone',
      sales: 'one_time',
      seo: 'monthly',
      google_ads: 'monthly',
      meta_ads: 'monthly',
      linkedin_ads: 'monthly',
      digital_marketing: 'monthly',
      website: 'milestone',
      software: 'milestone',
      ai_solution: 'milestone',
      custom: 'milestone',
    };
    return models[type] ?? 'one_time';
  }

  private generateLineItems(input: PricingInput): PricingLineItem[] {
    const items: PricingLineItem[] = [];

    for (const solution of input.solutions) {
      const price = this.estimatePrice(solution.service_name, input);
      items.push({
        name: solution.service_name,
        description: solution.description,
        quantity: 1,
        unit_price: price,
        total: price,
        category: this.categorize(solution.service_name),
      });
    }

    // Add standard items
    items.push({
      name: 'Project Management',
      description: 'Dedicated project management and coordination throughout the engagement.',
      quantity: 1,
      unit_price: 2500,
      total: 2500,
      category: 'Management',
    });

    items.push({
      name: 'Onboarding & Discovery',
      description: 'Initial discovery, stakeholder interviews, and requirements gathering.',
      quantity: 1,
      unit_price: 1500,
      total: 1500,
      category: 'Setup',
    });

    return items;
  }

  private estimatePrice(serviceName: string, input: PricingInput): number {
    const name = serviceName.toLowerCase();
    let base = 5000;

    if (name.includes('strategy') || name.includes('consultation')) base = 7500;
    if (name.includes('technical') || name.includes('audit')) base = 5000;
    if (name.includes('content')) base = 4000;
    if (name.includes('link')) base = 3000;
    if (name.includes('ads') || name.includes('campaign')) base = 3500;
    if (name.includes('website') || name.includes('development')) base = 15000;
    if (name.includes('software')) base = 25000;
    if (name.includes('ai') || name.includes('model')) base = 30000;
    if (name.includes('dashboard') || name.includes('bi')) base = 8000;
    if (name.includes('optimization')) base = 4500;

    // Adjust for company size
    if (input.companySize) {
      const size = input.companySize.toLowerCase();
      if (size.includes('enterprise') || size.includes('large')) base *= 1.5;
      if (size.includes('small') || size.includes('startup')) base *= 0.8;
    }

    // Adjust for ICP score
    if (input.icpScore >= 0.7) base *= 1.1;

    return Math.round(base);
  }

  private categorize(serviceName: string): string {
    const name = serviceName.toLowerCase();
    if (name.includes('strategy') || name.includes('consultation')) return 'Strategy';
    if (name.includes('seo') || name.includes('content') || name.includes('link')) return 'SEO';
    if (name.includes('ads') || name.includes('campaign')) return 'Paid Media';
    if (name.includes('website') || name.includes('development') || name.includes('software')) return 'Development';
    if (name.includes('ai') || name.includes('model')) return 'AI';
    if (name.includes('dashboard') || name.includes('bi')) return 'Analytics';
    return 'Services';
  }

  private calculateDiscount(input: PricingInput, subtotal: number): number {
    let discountRate = 0;

    // High ICP score = higher discount to win the deal
    if (input.icpScore >= 0.8) discountRate += 0.05;
    if (input.buyingIntentScore >= 0.7) discountRate += 0.05;

    // High risk = lower discount (more effort needed)
    if (input.riskScore >= 0.6) discountRate -= 0.03;

    discountRate = Math.max(discountRate, 0);
    return Math.round(subtotal * discountRate * 100) / 100;
  }

  private determinePaymentTerms(model: PricingModel): string {
    const terms: Record<PricingModel, string> = {
      one_time: '50% upfront, 50% upon completion. Net 15.',
      monthly: 'Monthly billing. Cancel with 30 days notice.',
      quarterly: 'Quarterly billing. 5% discount for annual commitment.',
      annual: 'Annual billing. 10% discount for annual prepayment.',
      milestone: '25% upfront, 25% at midpoint, 25% at delivery, 25% at acceptance. Net 15 per milestone.',
      retainer: 'Monthly retainer. Unused hours roll over for 30 days.',
      performance: 'Base fee plus performance bonus tied to agreed KPIs.',
    };
    return terms[model] ?? terms.one_time;
  }

  private generateRationale(input: PricingInput, model: PricingModel, total: number): string {
    return `Pricing is based on ${model} model reflecting the ${input.proposalType.replace(/_/g, ' ')} engagement type. ` +
      `Total investment of $${total.toLocaleString()} is aligned with ${input.companySize ?? 'mid-market'} company expectations ` +
      `and includes all deliverables, project management, and ongoing optimization.`;
  }
}

export const pricingEngine = new PricingEngine();
