// ============================================================
// OutreachEngine — Central facade for all outreach operations
// ============================================================

import { supabase } from '@/lib/supabase';
import { audienceSegmentationEngine } from './AudienceSegmentationEngine';
import { channelRecommendationEngine } from './ChannelRecommendationEngine';
import { timingRecommendationEngine } from './TimingRecommendationEngine';
import { messageStrategyEngine } from './MessageStrategyEngine';
import { personalizationEngine } from './PersonalizationEngine';
import { sequenceBuilder } from './SequenceBuilder';
import { engagementScoringEngine } from './EngagementScoringEngine';
import type {
  OutreachGenerateRequest,
  OutreachGenerationResult,
  CampaignStrategy,
  GeneratedMessage,
  ChannelType,
} from '@/types/outreach';

class OutreachEngine {
  async generate(request: OutreachGenerateRequest): Promise<OutreachGenerationResult> {
    // 1. Load company intelligence
    const { data: companyData } = await supabase
      .from('company_intelligence')
      .select('*')
      .eq('id', request.companyId)
      .maybeSingle();

    if (!companyData) throw new Error(`Company not found: ${request.companyId}`);
    const company = companyData as Record<string, unknown>;

    // 2. Load revenue profile
    const { data: revenueProfile } = await supabase
      .from('revenue_profiles')
      .select('*')
      .eq('company_id', request.companyId)
      .maybeSingle();

    const buyingIntentScore = (revenueProfile as { buying_intent_score?: number })?.buying_intent_score ?? 0.3;
    const icpScore = (revenueProfile as { icp_score?: number })?.icp_score ?? 0.5;
    const growthScore = (revenueProfile as { growth_score?: number })?.growth_score ?? 0.5;
    const riskScore = (revenueProfile as { risk_score?: number })?.risk_score ?? 0.3;

    // 3. Load signals
    const buyingSignals = ((company.buying_signals as { signal_type: string; description: string; confidence: number }[]) ?? []).map((s) => ({
      signal_type: s.signal_type, description: s.description, confidence: s.confidence,
    }));
    const growthSignals = ((company.growth_signals as { signal_type: string; description: string; confidence: number }[]) ?? []).map((s) => ({
      signal_type: s.signal_type, description: s.description, confidence: s.confidence,
    }));
    const competitors = (((company.competitive_positioning as { competitors?: string[] }) ?? {}).competitors) ?? [];
    const decisionMakers = ((company.decision_makers as { name: string; title: string; department: string }[]) ?? []).map((dm) => ({
      name: dm.name, title: dm.title, department: dm.department,
    }));

    // 4. Audience segmentation
    const audienceSegment = audienceSegmentationEngine.segment({
      campaignType: request.campaignType,
      industry: (company.industry as string) ?? null,
      companySize: (company.company_size as string) ?? null,
      buyingIntentScore, icpScore, growthScore, riskScore,
      decisionMakers, competitors, buyingSignals,
      customInstructions: request.customInstructions,
    });

    // 5. Channel recommendation
    const channelRecommendations = channelRecommendationEngine.recommend({
      campaignType: request.campaignType,
      buyingIntentScore, icpScore, decisionMakers,
      industry: (company.industry as string) ?? null,
      availableChannels: request.targetChannels ?? (['email', 'linkedin', 'phone'] as ChannelType[]),
    });

    const primaryChannel = channelRecommendations[0]?.channel ?? 'email';

    // 6. Strategy
    const strategyResult = messageStrategyEngine.generate({
      campaignType: request.campaignType,
      primaryChannel,
      industry: (company.industry as string) ?? null,
      buyingIntentScore, icpScore, growthScore, riskScore,
      competitors, decisionMakers,
      customInstructions: request.customInstructions,
    });

    const strategy: CampaignStrategy = {
      approach: strategyResult.approach,
      primary_channels: channelRecommendations.slice(0, 3).map((c) => c.channel),
      message_tone: strategyResult.message_tone,
      personalization_level: strategyResult.personalization_level,
      follow_up_cadence: strategyResult.follow_up_cadence,
      success_probability: Math.min(buyingIntentScore * 0.4 + icpScore * 0.3 + growthScore * 0.3, 1.0),
    };

    // 7. Timing recommendation
    const timingRecommendation = timingRecommendationEngine.recommend({
      campaignType: request.campaignType,
      industry: (company.industry as string) ?? null,
      timezone: null,
      buyingIntentScore,
    });

    // 8. Sequence
    const sequence = sequenceBuilder.build({
      campaignType: request.campaignType,
      primaryChannels: strategy.primary_channels,
      buyingIntentScore, icpScore,
      followUpCadence: strategy.follow_up_cadence,
      timezone: timingRecommendation.timezone,
      customInstructions: request.customInstructions,
    });

    // 9. Generate messages
    const messages: GeneratedMessage[] = sequence.steps.map((step) => {
      const content = personalizationEngine.generate({
        campaignType: request.campaignType,
        channel: step.channel,
        companyName: (company.company_name as string) ?? 'Unknown',
        contactName: request.contactName ?? null,
        contactTitle: decisionMakers[0]?.title ?? null,
        industry: (company.industry as string) ?? null,
        businessModel: (company.business_model as string) ?? null,
        buyingIntentScore, icpScore, growthScore,
        competitors, buyingSignals, growthSignals,
        strategy: strategyResult,
        customInstructions: request.customInstructions,
      });

      const variants = personalizationEngine.generateVariants({
        campaignType: request.campaignType,
        channel: step.channel,
        companyName: (company.company_name as string) ?? 'Unknown',
        contactName: request.contactName ?? null,
        contactTitle: decisionMakers[0]?.title ?? null,
        industry: (company.industry as string) ?? null,
        businessModel: (company.business_model as string) ?? null,
        buyingIntentScore, icpScore, growthScore,
        competitors, buyingSignals, growthSignals,
        strategy: strategyResult,
        customInstructions: request.customInstructions,
      }, 3);

      return {
        channel: step.channel,
        step_number: step.step_number,
        subject_line: content.subject_line,
        message_body: content.message_body,
        cta: content.cta,
        icebreaker: content.icebreaker,
        personalization: content.personalization,
        score: this.scoreMessage(content, buyingIntentScore, icpScore),
        variants,
      };
    });

    // 10. Engagement score
    const engagementScore = engagementScoringEngine.score({
      buyingIntentScore, icpScore, growthScore,
      previousOpens: 0, previousReplies: 0, previousClicks: 0,
      daysSinceLastContact: null, meetingHistoryCount: 0,
    });

    // 11. Create campaign in DB
    const { data: campaignRow, error: campaignError } = await supabase
      .from('outreach_campaigns')
      .insert({
        workspace_id: request.workspaceId ?? null,
        company_id: request.companyId,
        contact_id: request.contactId ?? null,
        campaign_name: request.campaignName ?? `${request.campaignType.replace(/_/g, ' ')} — ${(company.company_name as string) ?? 'Unknown'}`,
        campaign_type: request.campaignType,
        campaign_status: 'draft',
        priority: request.priority ?? audienceSegment.priority_level,
        target_channels: strategy.primary_channels,
        strategy: strategy as unknown as Record<string, unknown>,
        metadata: { custom_instructions: request.customInstructions },
        created_by: null,
      })
      .select('*')
      .maybeSingle();

    if (campaignError) throw new Error(`Failed to create campaign: ${campaignError.message}`);
    const campaignId = (campaignRow as { id: string }).id;

    // 12. Create sequence
    const { data: seqRow } = await supabase
      .from('campaign_sequences')
      .insert({
        workspace_id: request.workspaceId ?? null,
        campaign_id: campaignId,
        sequence_name: sequence.sequence_name,
        total_steps: sequence.total_steps,
        total_duration_days: sequence.total_duration_days,
        target_timezone: sequence.target_timezone,
        send_windows: sequence.send_windows,
      })
      .select('*')
      .maybeSingle();
    const sequenceId = (seqRow as { id: string }).id;

    // 13. Create steps and messages
    for (const step of sequence.steps) {
      const { data: stepRow } = await supabase
        .from('campaign_steps')
        .insert({
          workspace_id: request.workspaceId ?? null,
          sequence_id: sequenceId,
          step_number: step.step_number,
          step_name: step.step_name,
          channel: step.channel,
          delay_days: step.delay_days,
          delay_hours: step.delay_hours,
          message_template: step.message_template,
          conditions: step.conditions,
          is_conditional: step.is_conditional,
        })
        .select('*')
        .maybeSingle();
      const stepId = (stepRow as { id: string }).id;

      const msg = messages.find((m) => m.step_number === step.step_number);
      if (msg) {
        const { data: msgRow } = await supabase
          .from('outreach_messages')
          .insert({
            workspace_id: request.workspaceId ?? null,
            campaign_id: campaignId,
            sequence_id: sequenceId,
            step_id: stepId,
            contact_id: request.contactId ?? null,
            contact_name: request.contactName ?? null,
            contact_email: request.contactEmail ?? null,
            channel: msg.channel,
            subject_line: msg.subject_line,
            message_body: msg.message_body,
            cta: msg.cta,
            personalization: msg.personalization,
            icebreaker: msg.icebreaker,
            status: 'prepared',
            score: msg.score,
          })
          .select('*')
          .maybeSingle();
        const messageId = (msgRow as { id: string }).id;

        if (messageId && msg.variants.length > 0) {
          for (const variant of msg.variants) {
            await supabase.from('message_variants').insert({
              workspace_id: request.workspaceId ?? null,
              message_id: messageId,
              variant_type: variant.type,
              variant_content: variant.content,
              variant_label: variant.label,
              score: variant.score,
            });
          }
        }

        await supabase.from('engagement_events').insert({
          workspace_id: request.workspaceId ?? null,
          message_id: messageId,
          campaign_id: campaignId,
          event_type: 'prepared',
          event_data: { score: msg.score, channel: msg.channel },
        });
      }
    }

    // 14. Create audience segment
    await supabase.from('audience_segments').insert({
      workspace_id: request.workspaceId ?? null,
      campaign_id: campaignId,
      segment_name: audienceSegment.segment_name,
      segment_type: audienceSegment.segment_type,
      criteria: audienceSegment.criteria,
      contact_count: audienceSegment.contact_count,
      priority_level: audienceSegment.priority_level,
    });

    return {
      campaignId, sequenceId, strategy, sequence, messages,
      audienceSegment, channelRecommendations, timingRecommendation, engagementScore,
    };
  }

  async getCampaign(campaignId: string) {
    const { data: campaign } = await supabase.from('outreach_campaigns').select('*').eq('id', campaignId).maybeSingle();
    const { data: sequences } = await supabase.from('campaign_sequences').select('*').eq('campaign_id', campaignId);
    const { data: messages } = await supabase.from('outreach_messages').select('*').eq('campaign_id', campaignId).order('prepared_at', { ascending: true });
    const { data: segments } = await supabase.from('audience_segments').select('*').eq('campaign_id', campaignId);
    return { campaign, sequences: sequences ?? [], messages: messages ?? [], segments: segments ?? [] };
  }

  async getCampaigns(workspaceId?: string | null, limit?: number) {
    let query = supabase.from('outreach_campaigns').select('*').order('updated_at', { ascending: false });
    if (workspaceId) query = query.eq('workspace_id', workspaceId);
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to get campaigns: ${error.message}`);
    return data ?? [];
  }

  async getHistory(campaignId: string) {
    const { data: events } = await supabase.from('engagement_events').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false });
    const { data: messages } = await supabase.from('outreach_messages').select('*').eq('campaign_id', campaignId).order('prepared_at', { ascending: false });
    return { events: events ?? [], messages: messages ?? [] };
  }

  async getMetrics(campaignId: string) {
    const { data: metrics } = await supabase.from('campaign_metrics').select('*').eq('campaign_id', campaignId).order('calculated_at', { ascending: false }).limit(1).maybeSingle();
    if (metrics) return metrics;

    const { data: messages } = await supabase.from('outreach_messages').select('status, channel, subject_line, cta').eq('campaign_id', campaignId);
    const msgList = (messages ?? []) as { status: string; channel: string; subject_line: string | null; cta: string | null }[];
    const total = msgList.length;
    const sent = msgList.filter((m) => ['sent', 'delivered', 'opened', 'replied'].includes(m.status)).length;
    const opened = msgList.filter((m) => ['opened', 'replied'].includes(m.status)).length;
    const replied = msgList.filter((m) => m.status === 'replied').length;
    const bounced = msgList.filter((m) => m.status === 'bounced').length;

    return {
      total_messages: total, total_sent: sent, total_opened: opened, total_replied: replied,
      total_positive_replies: 0, total_meetings_booked: 0, total_proposals_sent: 0,
      total_bounced: bounced, total_failed: msgList.filter((m) => m.status === 'failed').length,
      open_rate: sent > 0 ? Math.round((opened / sent) * 100) / 100 : 0,
      reply_rate: sent > 0 ? Math.round((replied / sent) * 100) / 100 : 0,
      positive_reply_rate: 0, meeting_rate: 0, conversion_rate: 0,
      bounce_rate: sent > 0 ? Math.round((bounced / sent) * 100) / 100 : 0,
    };
  }

  async getAnalytics(workspaceId?: string | null) {
    let campaignQuery = supabase.from('outreach_campaigns').select('*');
    if (workspaceId) campaignQuery = campaignQuery.eq('workspace_id', workspaceId);
    const { data: campaigns } = await campaignQuery;
    const campaignList = campaigns ?? [];

    let msgQuery = supabase.from('outreach_messages').select('status, channel');
    if (workspaceId) msgQuery = msgQuery.eq('workspace_id', workspaceId);
    const { data: messages } = await msgQuery;
    const msgList = (messages ?? []) as { status: string; channel: string }[];

    const totalSent = msgList.filter((m) => ['sent', 'delivered', 'opened', 'replied'].includes(m.status)).length;
    const totalOpened = msgList.filter((m) => ['opened', 'replied'].includes(m.status)).length;
    const totalReplied = msgList.filter((m) => m.status === 'replied').length;

    const typeDist: Record<string, number> = {};
    for (const c of campaignList) typeDist[(c as { campaign_type: string }).campaign_type] = (typeDist[(c as { campaign_type: string }).campaign_type] ?? 0) + 1;

    const channelDist: Record<string, number> = {};
    for (const m of msgList) channelDist[m.channel] = (channelDist[m.channel] ?? 0) + 1;

    const statusDist: Record<string, number> = {};
    for (const c of campaignList) statusDist[(c as { campaign_status: string }).campaign_status] = (statusDist[(c as { campaign_status: string }).campaign_status] ?? 0) + 1;

    return {
      total_campaigns: campaignList.length,
      active_campaigns: campaignList.filter((c: { campaign_status: string }) => c.campaign_status === 'active').length,
      total_messages: msgList.length,
      total_sent: totalSent, total_opened: totalOpened, total_replied: totalReplied,
      total_positive_replies: 0, total_meetings_booked: 0,
      open_rate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) / 100 : 0,
      reply_rate: totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) / 100 : 0,
      positive_reply_rate: 0, meeting_rate: 0, conversion_rate: 0, bounce_rate: 0,
      campaign_type_distribution: typeDist, channel_distribution: channelDist, status_distribution: statusDist,
      recent_campaigns: campaignList.slice(0, 10), best_performing_campaigns: [],
    };
  }

  async getHealth(workspaceId?: string | null) {
    const analytics = await this.getAnalytics(workspaceId);
    const errors: string[] = [];
    if (analytics.total_campaigns === 0) errors.push('No campaigns created');

    let seqQuery = supabase.from('campaign_sequences').select('id', { count: 'exact', head: true });
    if (workspaceId) seqQuery = seqQuery.eq('workspace_id', workspaceId);
    const { count: seqCount } = await seqQuery;

    let segQuery = supabase.from('audience_segments').select('id', { count: 'exact', head: true });
    if (workspaceId) segQuery = segQuery.eq('workspace_id', workspaceId);
    const { count: segCount } = await segQuery;

    let msgQuery = supabase.from('outreach_messages').select('status', { count: 'exact', head: true }).eq('status', 'prepared');
    if (workspaceId) msgQuery = msgQuery.eq('workspace_id', workspaceId);
    const { count: pendingCount } = await msgQuery;

    return {
      healthy: errors.length === 0,
      total_campaigns: analytics.total_campaigns,
      active_campaigns: analytics.active_campaigns,
      draft_campaigns: analytics.status_distribution.draft ?? 0,
      completed_campaigns: analytics.status_distribution.completed ?? 0,
      total_messages: analytics.total_messages,
      total_sequences: seqCount ?? 0,
      total_segments: segCount ?? 0,
      pending_messages: pendingCount ?? 0,
      errors,
    };
  }

  private scoreMessage(content: { subject_line: string; message_body: string; cta: string; icebreaker: string }, buyingIntent: number, icp: number): number {
    let score = 0.4;
    if (content.icebreaker.length > 20) score += 0.15;
    if (content.message_body.length < 500) score += 0.1;
    if (content.cta.includes('?')) score += 0.1;
    if (content.subject_line.length < 50) score += 0.1;
    score += buyingIntent * 0.1;
    score += icp * 0.05;
    return Math.min(Math.round(score * 100) / 100, 1.0);
  }
}

export const outreachEngine = new OutreachEngine();
