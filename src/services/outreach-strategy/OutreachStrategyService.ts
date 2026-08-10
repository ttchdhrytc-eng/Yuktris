// ============================================================
// OutreachStrategyService — Architecture
// ============================================================
//
// Main orchestrator for the Outreach Strategy Agent.
// Runs after the Personalization Agent completes.
//
// Transforms personalization intelligence into complete outreach
// strategies:
//   - Loads personalization blueprint and prospect data
//   - Generates campaign structure and goals
//   - Creates 6-touchpoint sequence with channels and CTAs
//   - Prioritizes LinkedIn, email, and video channels
//   - Calculates best days, times, and intervals
//   - Estimates acceptance, reply, and meeting rates
//   - Generates AI recommendations
//
// Not implemented — uses mock data to simulate the workflow.
// Data is persisted to Supabase tables:
//   - outreach_campaigns
//   - outreach_touchpoints
//   - outreach_channel_strategy
//   - outreach_timing_strategy
//   - outreach_campaign_metrics
//   - outreach_recommendations

import { supabase } from '@/lib/supabase';
import type {
  OutreachCampaign,
  Touchpoint,
  ChannelStrategy,
  TimingStrategy,
  CampaignMetrics,
  OutreachRecommendation,
  FullOutreachCampaign,
  OutreachStage,
  OutreachTimelineEvent,
  OutreachAIRecommendations,
  MessagingFramework,
  ExportConfig,
  ExportFormat,
} from '@/types/outreach-strategy';
import { OUTREACH_STAGES, MOCK_CAMPAIGNS, MOCK_AI_RECOMMENDATIONS, type MockCampaign } from './mockData';

// ============================================================
// Service Definition
// ============================================================

export class OutreachStrategyService {
  /**
   * Generate the complete outreach campaign for a prospect.
   * Placeholder — will orchestrate all sub-services when implemented.
   */
  async generateCampaign(): Promise<unknown> {
    throw new Error('OutreachStrategyService.generateCampaign() not implemented — use saveCampaign()');
  }

  /**
   * Build the 6-touchpoint sequence.
   * Placeholder — will use OpenAIService when implemented.
   */
  async buildTouchpointSequence(_campaignData: unknown): Promise<unknown> {
    throw new Error('OutreachStrategyService.buildTouchpointSequence() not implemented');
  }

  /**
   * Recommend channels for the campaign.
   * Placeholder — will use OpenAIService when implemented.
   */
  async recommendChannels(_prospectData: unknown): Promise<unknown> {
    throw new Error('OutreachStrategyService.recommendChannels() not implemented');
  }

  /**
   * Recommend timing strategy.
   * Placeholder — will use OpenAIService + CalendarService when implemented.
   */
  async recommendTiming(_prospectData: unknown): Promise<unknown> {
    throw new Error('OutreachStrategyService.recommendTiming() not implemented');
  }

  /**
   * Generate messaging framework.
   * Placeholder — will use OpenAIService when implemented.
   */
  async generateMessagingFramework(_campaignData: unknown): Promise<unknown> {
    throw new Error('OutreachStrategyService.generateMessagingFramework() not implemented');
  }

  /**
   * Recommend CTA framework.
   * Placeholder — will use OpenAIService when implemented.
   */
  async recommendCTA(_prospectData: unknown): Promise<unknown> {
    throw new Error('OutreachStrategyService.recommendCTA() not implemented');
  }

  /**
   * Estimate success rate.
   * Placeholder — will use OpenAIService when implemented.
   */
  async estimateSuccessRate(_campaignData: unknown): Promise<unknown> {
    throw new Error('OutreachStrategyService.estimateSuccessRate() not implemented');
  }

  /**
   * Generate campaign metrics.
   * Placeholder — will use OpenAIService when implemented.
   */
  async generateCampaignMetrics(_campaignData: unknown): Promise<unknown> {
    throw new Error('OutreachStrategyService.generateCampaignMetrics() not implemented');
  }

  /**
   * Generate AI recommendations.
   * Placeholder — will use OpenAIService when implemented.
   */
  async generateRecommendations(_campaignData: unknown): Promise<unknown> {
    throw new Error('OutreachStrategyService.generateRecommendations() not implemented');
  }

  /**
   * Generate executive summary.
   * Placeholder — will use OpenAIService when implemented.
   */
  async generateExecutiveSummary(_campaignData: unknown): Promise<unknown> {
    throw new Error('OutreachStrategyService.generateExecutiveSummary() not implemented');
  }

  /**
   * Save a complete outreach campaign (with all child records) to the database.
   */
  async saveCampaign(workspaceId: string, prospectIndex: number): Promise<string> {
    const mock = MOCK_CAMPAIGNS[prospectIndex] ?? MOCK_CAMPAIGNS[0];

    const { data: campaignRow, error: campaignError } = await supabase
      .from('outreach_campaigns')
      .insert({
        workspace_id: workspaceId,
        campaign_name: mock.campaign.campaign_name,
        campaign_type: mock.campaign.campaign_type,
        campaign_status: 'completed',
        campaign_score: mock.campaign.campaign_score,
        success_probability: mock.campaign.success_probability,
      })
      .select('*')
      .single();

    if (campaignError) throw new Error(campaignError.message);
    const campaignId = (campaignRow as OutreachCampaign).id;

    // Insert touchpoints
    if (mock.touchpoints.length > 0) {
      const { error: tpError } = await supabase.from('outreach_touchpoints').insert(
        mock.touchpoints.map((t) => ({ ...t, campaign_id: campaignId })),
      );
      if (tpError) throw new Error(tpError.message);
    }

    // Insert channel strategy
    if (mock.channel_strategy.length > 0) {
      const { error: csError } = await supabase.from('outreach_channel_strategy').insert(
        mock.channel_strategy.map((c) => ({ ...c, campaign_id: campaignId })),
      );
      if (csError) throw new Error(csError.message);
    }

    // Insert timing strategy
    const { error: tsError } = await supabase.from('outreach_timing_strategy').insert({
      ...mock.timing_strategy,
      campaign_id: campaignId,
    });
    if (tsError) throw new Error(tsError.message);

    // Insert campaign metrics
    const { error: cmError } = await supabase.from('outreach_campaign_metrics').insert({
      ...mock.campaign_metrics,
      campaign_id: campaignId,
    });
    if (cmError) throw new Error(cmError.message);

    // Insert recommendations
    if (mock.recommendations.length > 0) {
      const { error: recError } = await supabase.from('outreach_recommendations').insert(
        mock.recommendations.map((r) => ({ ...r, campaign_id: campaignId })),
      );
      if (recError) throw new Error(recError.message);
    }

    return campaignId;
  }

  /**
   * Refresh an existing campaign.
   */
  async refreshCampaign(campaignId: string): Promise<void> {
    const { error } = await supabase
      .from('outreach_campaigns')
      .update({ campaign_status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', campaignId);

    if (error) throw new Error(error.message);
  }

  /**
   * Load a complete campaign from the database.
   */
  async loadCampaign(campaignId: string): Promise<FullOutreachCampaign | null> {
    const { data: campaign, error } = await supabase
      .from('outreach_campaigns')
      .select('*')
      .eq('id', campaignId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!campaign) return null;

    const [tpRes, csRes, tsRes, cmRes, recRes] = await Promise.all([
      supabase.from('outreach_touchpoints').select('*').eq('campaign_id', campaignId).order('sequence', { ascending: true }),
      supabase.from('outreach_channel_strategy').select('*').eq('campaign_id', campaignId),
      supabase.from('outreach_timing_strategy').select('*').eq('campaign_id', campaignId).maybeSingle(),
      supabase.from('outreach_campaign_metrics').select('*').eq('campaign_id', campaignId).maybeSingle(),
      supabase.from('outreach_recommendations').select('*').eq('campaign_id', campaignId),
    ]);

    return {
      ...(campaign as OutreachCampaign),
      touchpoints: (tpRes.data as Touchpoint[] | null) ?? [],
      channel_strategy: (csRes.data as ChannelStrategy[] | null) ?? [],
      timing_strategy: (tsRes.data as TimingStrategy | null) ?? null,
      campaign_metrics: (cmRes.data as CampaignMetrics | null) ?? null,
      recommendations: (recRes.data as OutreachRecommendation[] | null) ?? [],
    };
  }

  /**
   * Load the latest campaign for a workspace.
   */
  async loadLatestCampaign(workspaceId: string): Promise<FullOutreachCampaign | null> {
    const { data, error } = await supabase
      .from('outreach_campaigns')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return this.loadCampaign((data as OutreachCampaign).id);
  }

  /**
   * Load all campaigns for a workspace.
   */
  async loadAllCampaigns(workspaceId: string): Promise<FullOutreachCampaign[]> {
    const { data: rows, error } = await supabase
      .from('outreach_campaigns')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return [];

    const all = await Promise.all(
      (rows as OutreachCampaign[]).map((r) => this.loadCampaign(r.id)),
    );
    return all.filter((r): r is FullOutreachCampaign => r !== null);
  }

  /**
   * Delete a campaign (cascades to all child tables).
   */
  async deleteCampaign(campaignId: string): Promise<void> {
    const { error } = await supabase.from('outreach_campaigns').delete().eq('id', campaignId);
    if (error) throw new Error(error.message);
  }

  /**
   * Get AI recommendations for a prospect by index.
   */
  getAIRecommendations(prospectIndex: number): OutreachAIRecommendations {
    return (MOCK_CAMPAIGNS[prospectIndex] ?? MOCK_CAMPAIGNS[0]).ai_recommendations;
  }

  /**
   * Get messaging framework for a prospect by index.
   */
  getMessagingFramework(prospectIndex: number): MessagingFramework {
    return (MOCK_CAMPAIGNS[prospectIndex] ?? MOCK_CAMPAIGNS[0]).messaging_framework;
  }

  /**
   * Export campaign data in various formats.
   */
  exportConfiguration(campaign: FullOutreachCampaign, format: ExportFormat): ExportConfig {
    const data = {
      campaign_name: campaign.campaign_name,
      campaign_type: campaign.campaign_type,
      campaign_score: campaign.campaign_score,
      success_probability: campaign.success_probability,
      touchpoints: campaign.touchpoints,
      channel_strategy: campaign.channel_strategy,
      timing_strategy: campaign.timing_strategy,
      campaign_metrics: campaign.campaign_metrics,
      recommendations: campaign.recommendations,
    };

    switch (format) {
      case 'json':
        return { format, data: JSON.stringify(data, null, 2), filename: `outreach-campaign-${campaign.id.slice(0, 8)}.json` };
      case 'csv': {
        const rows: string[][] = [
          ['Field', 'Value'],
          ['Campaign Name', campaign.campaign_name],
          ['Campaign Type', campaign.campaign_type],
          ['Campaign Score', String(campaign.campaign_score)],
          ['Success Probability', String(campaign.success_probability)],
          ['Status', campaign.campaign_status],
          ['Touchpoints', campaign.touchpoints.map((t) => `T${t.sequence}: ${t.channel} — ${t.purpose}`).join('; ')],
          ['Channel Strategy', campaign.channel_strategy.map((c) => `${c.channel}: ${c.priority}`).join('; ')],
          ['Timing', campaign.timing_strategy ? `${campaign.timing_strategy.best_day} ${campaign.timing_strategy.best_time}` : 'N/A'],
          ['Metrics', campaign.campaign_metrics ? `Acc: ${campaign.campaign_metrics.expected_acceptance_rate}%, Reply: ${campaign.campaign_metrics.expected_reply_rate}%, Meeting: ${campaign.campaign_metrics.expected_meeting_rate}%` : 'N/A'],
          ['Recommendations', campaign.recommendations.map((r) => `${r.priority}: ${r.recommendation}`).join('; ')],
        ];
        const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
        return { format, data: csv, filename: `outreach-campaign-${campaign.id.slice(0, 8)}.csv` };
      }
    }
  }

  /**
   * Generate timeline events for the campaign workflow.
   */
  getTimelineEvents(campaign: OutreachCampaign): OutreachTimelineEvent[] {
    const isCompleted = campaign.campaign_status === 'completed';

    return [
      { id: 'loading_blueprint', label: 'Prospect Loaded', description: 'Loaded personalization blueprint and prospect data', timestamp: campaign.created_at, completed: true },
      { id: 'building_campaign', label: 'Blueprint Loaded', description: 'Generated campaign structure and goals', timestamp: isCompleted ? campaign.updated_at : null, completed: isCompleted },
      { id: 'generating_touchpoints', label: 'Campaign Generated', description: 'Created 6-touchpoint sequence with channels and CTAs', timestamp: isCompleted ? campaign.updated_at : null, completed: isCompleted },
      { id: 'selecting_channels', label: 'Touchpoints Created', description: 'Prioritized LinkedIn, email, and video channels', timestamp: isCompleted ? campaign.updated_at : null, completed: isCompleted },
      { id: 'optimizing_timing', label: 'Channel Strategy Built', description: 'Calculated best days, times, and intervals', timestamp: isCompleted ? campaign.updated_at : null, completed: isCompleted },
      { id: 'generating_ctas', label: 'CTA Strategy Built', description: 'Created call-to-action framework', timestamp: isCompleted ? campaign.updated_at : null, completed: isCompleted },
      { id: 'calculating_success', label: 'Campaign Ready', description: 'Estimated acceptance, reply, and meeting rates', timestamp: isCompleted ? campaign.updated_at : null, completed: isCompleted },
      { id: 'saving_campaign', label: 'Saved', description: 'Campaign saved and ready for LinkedIn Execution Agent', timestamp: isCompleted ? campaign.updated_at : null, completed: isCompleted },
    ];
  }

  /**
   * Get the current pipeline stage.
   */
  getCurrentStage(): OutreachStage {
    return 'loading_blueprint';
  }

  /**
   * Get mock campaign data by index.
   */
  getMockCampaign(index: number): MockCampaign {
    return MOCK_CAMPAIGNS[index] ?? MOCK_CAMPAIGNS[0];
  }
}

// Singleton instance
export const outreachStrategyService = new OutreachStrategyService();
export { OUTREACH_STAGES, MOCK_CAMPAIGNS, MOCK_AI_RECOMMENDATIONS };
