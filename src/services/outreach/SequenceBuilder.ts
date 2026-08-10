// ============================================================
// SequenceBuilder — Builds multi-step outreach sequences
// ============================================================

import type { CampaignType, ChannelType, SequencePlan, SendWindow } from '@/types/outreach';

type SequenceInput = {
  campaignType: CampaignType;
  primaryChannels: ChannelType[];
  buyingIntentScore: number;
  icpScore: number;
  followUpCadence: string;
  timezone: string | null;
  customInstructions?: string;
};

class SequenceBuilder {
  build(input: SequenceInput): SequencePlan {
    const steps = this.generateSteps(input);
    const totalDays = steps.reduce((sum, s) => sum + s.delay_days, 0);
    const windows = this.getSendWindows(input);

    return {
      sequence_name: this.generateName(input),
      total_steps: steps.length,
      total_duration_days: totalDays,
      steps,
      send_windows: windows,
      target_timezone: input.timezone ?? 'America/New_York',
    };
  }

  private generateSteps(input: SequenceInput): SequencePlan['steps'] {
    const typeSequences: Record<CampaignType, { channel: ChannelType; delay_days: number; delay_hours: number; name: string; template: string }[]> = {
      cold_outreach: [
        { channel: 'email', delay_days: 0, delay_hours: 0, name: 'Initial Outreach', template: 'Personalized cold email with icebreaker and value prop' },
        { channel: 'email', delay_days: 3, delay_hours: 0, name: 'Follow-up 1', template: 'Value-add follow-up with case study reference' },
        { channel: 'linkedin', delay_days: 5, delay_hours: 0, name: 'LinkedIn Connect', template: 'Connection request with personalized note' },
        { channel: 'email', delay_days: 7, delay_hours: 0, name: 'Follow-up 2', template: 'Breakup email with soft CTA' },
      ],
      warm_outreach: [
        { channel: 'email', delay_days: 0, delay_hours: 0, name: 'Warm Intro', template: 'Reference shared connection or prior interaction' },
        { channel: 'linkedin', delay_days: 2, delay_hours: 0, name: 'LinkedIn Connect', template: 'Connection request referencing warm intro' },
        { channel: 'email', delay_days: 5, delay_hours: 0, name: 'Follow-up', template: 'Value-add follow-up with relevant resource' },
      ],
      inbound_followup: [
        { channel: 'email', delay_days: 0, delay_hours: 0, name: 'Rapid Response', template: 'Quick response to inbound interest within 24h' },
        { channel: 'email', delay_days: 2, delay_hours: 0, name: 'Value Add', template: 'Share relevant case study or resource' },
        { channel: 'phone', delay_days: 4, delay_hours: 0, name: 'Discovery Call', template: 'Phone outreach to qualify and schedule demo' },
      ],
      proposal_followup: [
        { channel: 'email', delay_days: 0, delay_hours: 0, name: 'Proposal Follow-up', template: 'Check in on proposal and address questions' },
        { channel: 'email', delay_days: 3, delay_hours: 0, name: 'ROI Reminder', template: 'Reinforce ROI and share relevant case study' },
        { channel: 'phone', delay_days: 7, delay_hours: 0, name: 'Decision Call', template: 'Call to discuss proposal and next steps' },
      ],
      meeting_followup: [
        { channel: 'email', delay_days: 0, delay_hours: 0, name: 'Meeting Recap', template: 'Send recap with action items and next steps' },
        { channel: 'email', delay_days: 2, delay_hours: 0, name: 'Resource Share', template: 'Share promised resources or information' },
        { channel: 'email', delay_days: 5, delay_hours: 0, name: 'Next Steps', template: 'Propose concrete next steps and timeline' },
      ],
      re_engagement: [
        { channel: 'email', delay_days: 0, delay_hours: 0, name: 'Re-engagement', template: 'New value proposition referencing prior relationship' },
        { channel: 'email', delay_days: 7, delay_hours: 0, name: 'New Offer', template: 'Share new capabilities or offerings' },
        { channel: 'linkedin', delay_days: 14, delay_hours: 0, name: 'LinkedIn Reconnect', template: 'Reconnect on LinkedIn with updated context' },
      ],
      nurture: [
        { channel: 'email', delay_days: 0, delay_hours: 0, name: 'Educational Content', template: 'Share valuable industry insight or resource' },
        { channel: 'email', delay_days: 7, delay_hours: 0, name: 'Case Study', template: 'Share relevant case study' },
        { channel: 'email', delay_days: 14, delay_hours: 0, name: 'Soft CTA', template: 'Soft call-to-action for a discovery call' },
        { channel: 'email', delay_days: 21, delay_hours: 0, name: 'Check-in', template: 'Gentle check-in to gauge interest' },
      ],
      customer_expansion: [
        { channel: 'email', delay_days: 0, delay_hours: 0, name: 'Expansion Pitch', template: 'Highlight new capabilities and growth opportunities' },
        { channel: 'email', delay_days: 5, delay_hours: 0, name: 'ROI Review', template: 'Showcase results achieved and expansion benefits' },
        { channel: 'phone', delay_days: 10, delay_hours: 0, name: 'Expansion Call', template: 'Call to discuss expansion options' },
      ],
      renewal: [
        { channel: 'email', delay_days: 0, delay_hours: 0, name: 'Renewal Reminder', template: 'Remind of upcoming renewal and value delivered' },
        { channel: 'email', delay_days: 7, delay_hours: 0, name: 'Results Summary', template: 'Summarize results achieved during the period' },
        { channel: 'phone', delay_days: 14, delay_hours: 0, name: 'Renewal Call', template: 'Call to discuss renewal terms' },
      ],
      referral: [
        { channel: 'email', delay_days: 0, delay_hours: 0, name: 'Referral Request', template: 'Ask for introduction based on delivered value' },
        { channel: 'email', delay_days: 5, delay_hours: 0, name: 'Follow-up', template: 'Gentle follow-up on referral request' },
      ],
      custom: [
        { channel: 'email', delay_days: 0, delay_hours: 0, name: 'Initial Contact', template: 'Custom initial outreach' },
        { channel: 'email', delay_days: 5, delay_hours: 0, name: 'Follow-up', template: 'Custom follow-up message' },
      ],
    };

    const sequence = typeSequences[input.campaignType] ?? typeSequences.custom;

    return sequence.map((step, i) => ({
      step_number: i + 1,
      step_name: step.name,
      channel: step.channel,
      delay_days: step.delay_days,
      delay_hours: step.delay_hours,
      message_template: step.template,
      is_conditional: false,
      conditions: {},
    }));
  }

  private getSendWindows(input: SequenceInput): SendWindow[] {
    if (input.buyingIntentScore >= 0.7) {
      return [
        { day_of_week: 2, start_hour: 9, end_hour: 11 },
        { day_of_week: 3, start_hour: 10, end_hour: 12 },
        { day_of_week: 4, start_hour: 9, end_hour: 11 },
      ];
    }
    return [
      { day_of_week: 3, start_hour: 10, end_hour: 12 },
      { day_of_week: 4, start_hour: 9, end_hour: 11 },
    ];
  }

  private generateName(input: SequenceInput): string {
    return `${input.campaignType.replace(/_/g, ' ')} sequence`;
  }
}

export const sequenceBuilder = new SequenceBuilder();
