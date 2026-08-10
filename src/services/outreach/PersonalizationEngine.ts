// ============================================================
// PersonalizationEngine — Generates personalized message content
// ============================================================

import type { CampaignType, ChannelType, MessageContent, VariantType } from '@/types/outreach';

type PersonalizationInput = {
  campaignType: CampaignType;
  channel: ChannelType;
  companyName: string;
  contactName: string | null;
  contactTitle: string | null;
  industry: string | null;
  businessModel: string | null;
  buyingIntentScore: number;
  icpScore: number;
  growthScore: number;
  competitors: string[];
  buyingSignals: { signal_type: string; description: string }[];
  growthSignals: { signal_type: string; description: string }[];
  strategy: { message_tone: string; personalization_level: string; cta_strategy: string; key_messages: string[] };
  customInstructions?: string;
};

class PersonalizationEngine {
  generate(input: PersonalizationInput): MessageContent {
    return {
      subject_line: this.generateSubjectLine(input),
      message_body: this.generateBody(input),
      cta: this.generateCTA(input),
      icebreaker: this.generateIcebreaker(input),
      personalization: this.buildPersonalizationData(input),
    };
  }

  generateVariants(input: PersonalizationInput, count: number): { type: VariantType; content: string; label: string; score: number }[] {
    const variants: { type: VariantType; content: string; label: string; score: number }[] = [];
    for (const subj of this.generateSubjectVariants(input, count)) {
      variants.push({ type: 'subject', content: subj.content, label: subj.label, score: subj.score });
    }
    for (const cta of this.generateCTAVariants(input, Math.min(count, 3))) {
      variants.push({ type: 'cta', content: cta.content, label: cta.label, score: cta.score });
    }
    for (const ib of this.generateIcebreakerVariants(input, Math.min(count, 3))) {
      variants.push({ type: 'icebreaker', content: ib.content, label: ib.label, score: ib.score });
    }
    return variants;
  }

  private generateSubjectLine(input: PersonalizationInput): string {
    const company = input.companyName;
    const subjects: Record<CampaignType, string> = {
      cold_outreach: `Quick idea for ${company}`,
      warm_outreach: `Following up — ${company}`,
      inbound_followup: `Thanks for your interest, ${company}`,
      proposal_followup: `${company} proposal — next steps`,
      meeting_followup: `Great meeting — ${company} next steps`,
      re_engagement: `New developments for ${company}`,
      nurture: `Insights for ${company}`,
      customer_expansion: `Growth opportunity for ${company}`,
      renewal: `${company} renewal — time to review`,
      referral: `Introduction opportunity for ${company}`,
      custom: `Ideas for ${company}`,
    };
    return subjects[input.campaignType] ?? subjects.custom;
  }

  private generateSubjectVariants(input: PersonalizationInput, count: number): { content: string; label: string; score: number }[] {
    const company = input.companyName;
    return [
      { content: `Quick idea for ${company}`, label: 'A', score: 0.7 },
      { content: `${company} — question about your growth`, label: 'B', score: 0.75 },
      { content: `Helping ${company} scale faster`, label: 'C', score: 0.72 },
      { content: `15 minutes that could change ${company} trajectory`, label: 'D', score: 0.68 },
      { content: `${company} + our approach = results`, label: 'E', score: 0.65 },
    ].slice(0, count);
  }

  private generateBody(input: PersonalizationInput): string {
    const firstName = input.contactName ? input.contactName.split(' ')[0] : null;
    const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
    const icebreaker = this.generateIcebreaker(input);
    const valueProp = this.generateValueProp(input);
    const cta = this.generateCTA(input);

    return `${greeting}\n\n${icebreaker}\n\n${valueProp}\n\n${cta}\n\nBest regards`;
  }

  private generateIcebreaker(input: PersonalizationInput): string {
    const company = input.companyName;
    if (input.growthSignals.length > 0) {
      const signal = input.growthSignals[0];
      return `I noticed ${company} ${signal.description.toLowerCase()}. Congratulations on the momentum!`;
    }
    if (input.buyingSignals.length > 0) {
      const signal = input.buyingSignals[0];
      return `I saw that ${company} ${signal.description.toLowerCase()}. That is exactly the kind of initiative we help companies accelerate.`;
    }
    if (input.industry) {
      return `I have been following the ${input.industry} space and ${company} keeps coming up as a company to watch.`;
    }
    return `I came across ${company} and was impressed by what you are building.`;
  }

  private generateIcebreakerVariants(input: PersonalizationInput, count: number): { content: string; label: string; score: number }[] {
    const company = input.companyName;
    const variants: { content: string; label: string; score: number }[] = [];
    if (input.growthSignals.length > 0) {
      variants.push({ content: `Noticed ${company} recent growth — impressive trajectory!`, label: 'Growth', score: 0.8 });
    }
    if (input.competitors.length > 0) {
      variants.push({ content: `Saw ${company} is competing in a crowded ${input.industry ?? 'market'} space.`, label: 'Competition', score: 0.65 });
    }
    variants.push({ content: `Been following ${company} journey in the ${input.industry ?? 'industry'} space.`, label: 'Industry', score: 0.7 });
    if (input.businessModel) {
      variants.push({ content: `Love what ${company} is doing with your ${input.businessModel} model.`, label: 'Business Model', score: 0.72 });
    }
    return variants.slice(0, count);
  }

  private generateValueProp(input: PersonalizationInput): string {
    const messages = input.strategy.key_messages.slice(0, 2);
    if (messages.length === 0) {
      return `We help companies like ${input.companyName} achieve measurable results through data-driven strategies and proven methodologies.`;
    }
    return messages.join('. ') + '.';
  }

  private generateCTA(input: PersonalizationInput): string {
    if (input.buyingIntentScore >= 0.8) return 'Would you be open to a 15-minute call this week to explore this further?';
    if (input.icpScore >= 0.7) return 'I would be happy to share a relevant case study. Should I send it over?';
    return 'Would it be helpful if I sent over some resources on this topic?';
  }

  private generateCTAVariants(_input: PersonalizationInput, count: number): { content: string; label: string; score: number }[] {
    return [
      { content: 'Open to a 15-min call this week?', label: 'Direct', score: 0.8 },
      { content: 'Should I send over a relevant case study?', label: 'Soft', score: 0.7 },
      { content: 'Want me to share some resources on this?', label: 'Educational', score: 0.6 },
    ].slice(0, count);
  }

  private buildPersonalizationData(input: PersonalizationInput): Record<string, unknown> {
    return {
      company_name: input.companyName,
      contact_name: input.contactName,
      contact_title: input.contactTitle,
      industry: input.industry,
      business_model: input.businessModel,
      growth_signals_count: input.growthSignals.length,
      buying_signals_count: input.buyingSignals.length,
      icp_score: input.icpScore,
      intent_score: input.buyingIntentScore,
      tone: input.strategy.message_tone,
      personalization_level: input.strategy.personalization_level,
    };
  }
}

export const personalizationEngine = new PersonalizationEngine();
