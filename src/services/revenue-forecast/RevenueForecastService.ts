// ============================================================
// RevenueForecastService — Phase 12 AI Revenue Brain
// ============================================================

import { supabase } from '@/lib/supabase';
import { aiGateway } from '@/services/ai';
import { knowledgeGraphService } from '@/services/knowledge-graph/KnowledgeGraphService';
import { memoryEngine } from '@/services/memory/MemoryEngine';
import type { RevenueCommandCenter } from '@/types/revenue-forecast';

class RevenueForecastService {
  // ----------------------------------------------------------
  // STEP 1: Sync pipeline deals from all previous phases
  // ----------------------------------------------------------

  async syncPipeline(workspaceId: string): Promise<void> {
    // Load proposal projects that have been accepted or are in negotiation
    const { data: proposals } = await supabase
      .from('proposal_projects')
      .select(`
        id, workspace_id, company_id, project_name, status, priority,
        proposal_versions!inner(executive_summary, roi_estimation),
        proposal_roi!inner(investment_amount, roi_3_year),
        proposal_score!inner(win_probability, overall_score)
      `)
      .eq('workspace_id', workspaceId)
      .in('status', ['review', 'approved', 'sent', 'negotiating', 'accepted'])
      .order('updated_at', { ascending: false })
      .limit(50);

    if (!proposals || proposals.length === 0) return;

    for (const proposal of proposals) {
      const p = proposal as Record<string, unknown>;
      const versions = p.proposal_versions as Array<Record<string, unknown>>;
      const rois = p.proposal_roi as Array<Record<string, number>>;
      const scores = p.proposal_score as Array<Record<string, number>>;

      const version = versions?.[0];
      const roi = rois?.[0];
      const score = scores?.[0];

      // Check if deal already exists
      const { data: existing } = await supabase
        .from('pipeline_deals')
        .select('id, current_stage, deal_value')
        .eq('proposal_project_id', p.id)
        .maybeSingle();

      const dealValue = roi?.investment_amount ?? 0;
      const winProb = score?.win_probability ?? 50;
      const overallScore = score?.overall_score ?? 50;

      // Map proposal status to pipeline stage
      const stageMap: Record<string, string> = {
        review: 'proposal', approved: 'proposal', sent: 'negotiation',
        negotiating: 'negotiation', accepted: 'closed_won',
      };
      const currentStage = stageMap[p.status as string] ?? 'qualification';

      if (existing) {
        const existingData = existing as Record<string, unknown>;
        if (existingData.current_stage !== currentStage) {
          await this.moveDeal(workspaceId, existingData.id as string, existingData.current_stage as string, currentStage, dealValue, winProb, 'AI stage sync from proposal status');
        }
        await supabase.from('pipeline_deals').update({
          deal_value: dealValue,
          weighted_value: dealValue * (winProb / 100),
          probability_to_close: winProb,
          health_score: overallScore,
          ai_confidence: 0.8,
          ai_reasoning: `Proposal score: ${overallScore}. Win probability: ${winProb}%. ROI: ${roi?.roi_3_year ?? 'N/A'}x.`,
          last_activity_at: new Date().toISOString(),
        }).eq('id', existingData.id);
      } else {
        const { data: company } = await supabase
          .from('companies')
          .select('name, industry')
          .eq('id', p.company_id)
          .maybeSingle();
        const companyData = company as Record<string, string> | null;

        const { data: deal } = await supabase.from('pipeline_deals').insert({
          workspace_id: workspaceId,
          company_id: p.company_id as string | null,
          proposal_project_id: p.id as string,
          deal_name: p.project_name as string,
          company_name: companyData?.name ?? null,
          current_stage: currentStage,
          deal_value: dealValue,
          weighted_value: dealValue * (winProb / 100),
          probability_to_close: winProb,
          expected_close_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          ai_confidence: 0.8,
          ai_reasoning: `Auto-created from proposal. Score: ${overallScore}. Win prob: ${winProb}%.`,
          risk_score: 100 - overallScore,
          health_score: overallScore,
          last_activity_at: new Date().toISOString(),
          industry: companyData?.industry ?? null,
          deal_type: 'new_business',
        }).select('*').single();

        if (deal) {
          await supabase.from('pipeline_movements').insert({
            workspace_id: workspaceId,
            deal_id: (deal as Record<string, string>).id,
            to_stage: currentStage,
            moved_by: 'ai',
            reason: 'Auto-created from proposal intelligence',
          });
        }
      }
    }

    // Also sync from meetings with moved_to_opportunity
    const { data: meetings } = await supabase
      .from('meeting_scheduler')
      .select('id, workspace_id, company_id, prospect_name, company_name, revenue_estimate')
      .eq('workspace_id', workspaceId)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(20);

    if (meetings) {
      for (const meeting of meetings) {
        const m = meeting as Record<string, unknown>;
        const { data: outcomes } = await supabase
          .from('meeting_outcomes')
          .select('outcome, deal_value')
          .eq('meeting_id', m.id)
          .maybeSingle();
        const outcomeData = outcomes as Record<string, unknown> | null;
        if (!outcomeData || outcomeData.outcome !== 'moved_to_opportunity') continue;

        const { data: existing } = await supabase
          .from('pipeline_deals')
          .select('id')
          .eq('meeting_id', m.id)
          .maybeSingle();
        if (existing) continue;

        const dealValue = (outcomeData.deal_value as number) ?? (m.revenue_estimate as number) ?? 0;
        await supabase.from('pipeline_deals').insert({
          workspace_id: workspaceId,
          meeting_id: m.id as string,
          company_id: m.company_id as string | null,
          deal_name: `Deal: ${m.prospect_name ?? 'Unknown'} — ${m.company_name ?? ''}`,
          company_name: m.company_name as string | null,
          current_stage: 'discovery',
          deal_value: dealValue,
          weighted_value: dealValue * 0.35,
          probability_to_close: 35,
          expected_close_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          ai_confidence: 0.7,
          ai_reasoning: 'Auto-created from meeting outcome: moved_to_opportunity.',
          health_score: 60,
          last_activity_at: new Date().toISOString(),
          deal_type: 'new_business',
        });
      }
    }
  }

  // ----------------------------------------------------------
  // STEP 2: Move deal between stages
  // ----------------------------------------------------------

  async moveDeal(workspaceId: string, dealId: string, fromStage: string, toStage: string, dealValue: number, probability: number, reason: string): Promise<void> {
    const daysInPrev = Math.floor((Date.now() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    await supabase.from('pipeline_deals').update({
      previous_stage: fromStage,
      current_stage: toStage,
      stage_entered_at: new Date().toISOString(),
      probability_to_close: probability,
      weighted_value: dealValue * (probability / 100),
    }).eq('id', dealId);

    await supabase.from('pipeline_movements').insert({
      workspace_id: workspaceId,
      deal_id: dealId,
      from_stage: fromStage,
      to_stage: toStage,
      probability_after: probability,
      value_after: dealValue,
      reason,
      moved_by: 'ai',
      days_in_previous_stage: daysInPrev,
    });

    if (toStage === 'closed_won') {
      await supabase.from('pipeline_deals').update({
        is_closed: true, closed_status: 'won', actual_close_date: new Date().toISOString().split('T')[0],
      }).eq('id', dealId);
      await supabase.from('booked_revenue').insert({
        workspace_id: workspaceId, deal_id: dealId, amount: dealValue, revenue_date: new Date().toISOString().split('T')[0], revenue_type: 'new_business',
      });
      await this.createAlert(workspaceId, dealId, 'large_deal_won', 'Deal Won!', `A deal worth $${dealValue.toLocaleString()} has been won.`, 'high');
    }
  }

  // ----------------------------------------------------------
  // STEP 3: Generate Revenue Forecast (AI)
  // ----------------------------------------------------------

  async generateRevenueForecast(workspaceId: string, forecastType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' = 'quarterly'): Promise<RevenueCommandCenter['currentQuarterForecast'] | null> {
    // Load all open deals
    const { data: deals } = await supabase
      .from('pipeline_deals')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_closed', false)
      .order('deal_value', { ascending: false });

    // Load booked revenue for context
    const { data: booked } = await supabase
      .from('booked_revenue')
      .select('amount, revenue_date, revenue_type')
      .eq('workspace_id', workspaceId)
      .order('revenue_date', { ascending: false })
      .limit(30);

    // Load previous forecasts for accuracy context
    const { data: prevForecasts } = await supabase
      .from('revenue_forecasts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Load memory
    let memoryContext: Record<string, unknown> = {};
    try {
      const memories = await memoryEngine.getMemoriesByEntity('forecast', workspaceId, workspaceId);
      memoryContext = { previousForecastCount: memories.length };
    } catch { /* best-effort */ }

    const period = this.getForecastPeriod(forecastType);

    // Single AI call for full forecast
    const result = await this.callAIForecast({
      deals: deals ?? [],
      bookedRevenue: booked ?? [],
      prevForecasts: prevForecasts ?? [],
      memory: memoryContext,
      forecastType,
      period,
    });

    // Persist forecast
    const { data: forecast } = await supabase.from('revenue_forecasts').insert({
      workspace_id: workspaceId,
      forecast_type: forecastType,
      period_start: period.start,
      period_end: period.end,
      expected_revenue: result.expected_revenue ?? 0,
      weighted_revenue: result.weighted_revenue ?? 0,
      best_case_revenue: result.best_case_revenue ?? 0,
      worst_case_revenue: result.worst_case_revenue ?? 0,
      committed_revenue: result.committed_revenue ?? 0,
      pipeline_revenue: result.pipeline_revenue ?? 0,
      forecast_confidence: result.confidence ?? 0.7,
      deal_count: deals?.length ?? 0,
      ai_reasoning: result.ai_reasoning ?? '',
      supporting_signals: result.supporting_signals ?? [],
    }).select('*').single();

    if (forecast) {
      // Store in memory
      try {
        await memoryEngine.store({
          entityType: 'forecast', entityId: (forecast as Record<string, string>).id,
          memoryType: 'revenue_forecast',
          title: `${forecastType} forecast: $${result.expected_revenue?.toLocaleString() ?? 0}`,
          summary: result.ai_reasoning ?? '',
          content: result, confidenceScore: result.confidence ?? 0.7,
          importanceScore: 0.9, workspaceId,
        });
      } catch { /* best-effort */ }

      // Store in forecast history
      await supabase.from('forecast_history').insert({
        workspace_id: workspaceId,
        snapshot_date: new Date().toISOString().split('T')[0],
        forecast_type: forecastType,
        expected_revenue: result.expected_revenue ?? 0,
        weighted_revenue: result.weighted_revenue ?? 0,
        confidence: result.confidence ?? 0.7,
      });

      // Populate knowledge graph
      try {
        await knowledgeGraphService.ingestBatch({
          workspaceId,
          entities: [{
            nodeType: 'revenue_forecast' as never,
            externalId: `forecast_${(forecast as Record<string, string>).id}`,
            displayName: `${forecastType} Forecast: $${result.expected_revenue?.toLocaleString() ?? 0}`,
            properties: { expectedRevenue: result.expected_revenue, confidence: result.confidence },
            confidenceScore: result.confidence ?? 0.7,
          }],
          relationships: [],
        });
      } catch { /* best-effort */ }
    }

    return forecast as RevenueCommandCenter['currentQuarterForecast'];
  }

  // ----------------------------------------------------------
  // STEP 4: Calculate Pipeline Health
  // ----------------------------------------------------------

  async calculatePipelineHealth(workspaceId: string): Promise<void> {
    const { data: deals } = await supabase
      .from('pipeline_deals')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_closed', false);

    const openDeals = (deals ?? []) as Array<Record<string, unknown>>;
    const now = Date.now();

    let staleCount = 0;
    let atRiskCount = 0;
    const healthFactors: Record<string, unknown> = {};

    for (const deal of openDeals) {
      const lastActivity = deal.last_activity_at as string | null;
      const daysSinceActivity = lastActivity ? Math.floor((now - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)) : 999;
      const riskScore = deal.risk_score as number;
      const daysInStage = deal.days_in_stage as number;

      if (daysSinceActivity > 14) staleCount++;
      if (riskScore > 50 || daysInStage > 30) atRiskCount++;

      // Detect leakage
      if (daysSinceActivity > 14) {
        await this.createLeakage(workspaceId, deal.id as string, 'no_activity', `No activity for ${daysSinceActivity} days`, riskScore as number, `Follow up with ${deal.company_name ?? 'this prospect'} immediately.`);
      }
      if (daysInStage > 30) {
        await this.createLeakage(workspaceId, deal.id as string, 'stalled', `Stuck in ${deal.current_stage} for ${daysInStage} days`, riskScore as number, `Advance or remove this deal from the pipeline.`);
      }
    }

    // Calculate win/loss rates
    const { data: closedDeals } = await supabase
      .from('pipeline_deals')
      .select('closed_status, deal_value')
      .eq('workspace_id', workspaceId)
      .eq('is_closed', true);

    const closed = (closedDeals ?? []) as Array<Record<string, unknown>>;
    const wonCount = closed.filter((d) => d.closed_status === 'won').length;
    const lostCount = closed.filter((d) => d.closed_status === 'lost').length;
    const totalClosed = wonCount + lostCount;
    const winRate = totalClosed > 0 ? (wonCount / totalClosed) * 100 : 0;
    const lossRate = totalClosed > 0 ? (lostCount / totalClosed) * 100 : 0;

    const totalPipelineValue = openDeals.reduce((s, d) => s + (d.deal_value as number), 0);
    const weightedPipelineValue = openDeals.reduce((s, d) => s + (d.weighted_value as number), 0);
    const avgDays = openDeals.length > 0 ? openDeals.reduce((s, d) => s + (d.days_in_stage as number), 0) / openDeals.length : 0;

    // AI health assessment
    const healthResult = await this.callAIHealth({
      openDeals: openDeals.length,
      totalPipelineValue,
      weightedPipelineValue,
      staleCount,
      atRiskCount,
      winRate,
      lossRate,
      avgDays,
    });

    // Find bottleneck stage
    const stageCounts: Record<string, number> = {};
    for (const d of openDeals) {
      const stage = d.current_stage as string;
      stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;
    }
    const bottleneckStage = Object.entries(stageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const healthScore = healthResult.overall_health_score ?? Math.max(0, 100 - staleCount * 5 - atRiskCount * 3);

    await supabase.from('pipeline_health').insert({
      workspace_id: workspaceId,
      health_date: new Date().toISOString().split('T')[0],
      overall_health_score: healthScore,
      pipeline_coverage: totalPipelineValue,
      coverage_ratio: 0,
      stale_deal_count: staleCount,
      at_risk_count: atRiskCount,
      bottleneck_stage: bottleneckStage,
      avg_days_in_pipeline: avgDays,
      win_rate: winRate,
      loss_rate: lossRate,
      health_factors: healthFactors,
      recommendations: healthResult.recommendations ?? [],
    });

    // Create snapshot
    const dealsByStage: Record<string, number> = {};
    const dealsByType: Record<string, number> = {};
    const dealsByChannel: Record<string, number> = {};
    const dealsByIndustry: Record<string, number> = {};
    for (const d of openDeals) {
      const stage = d.current_stage as string;
      dealsByStage[stage] = (dealsByStage[stage] ?? 0) + 1;
      const type = d.deal_type as string;
      dealsByType[type] = (dealsByType[type] ?? 0) + 1;
      const channel = d.source_channel as string;
      if (channel) dealsByChannel[channel] = (dealsByChannel[channel] ?? 0) + 1;
      const industry = d.industry as string;
      if (industry) dealsByIndustry[industry] = (dealsByIndustry[industry] ?? 0) + 1;
    }

    await supabase.from('pipeline_snapshots').upsert({
      workspace_id: workspaceId,
      snapshot_date: new Date().toISOString().split('T')[0],
      total_deals: openDeals.length,
      total_pipeline_value: totalPipelineValue,
      weighted_pipeline_value: weightedPipelineValue,
      deals_by_stage: dealsByStage,
      deals_by_type: dealsByType,
      deals_by_channel: dealsByChannel,
      deals_by_industry: dealsByIndustry,
      avg_deal_size: openDeals.length > 0 ? totalPipelineValue / openDeals.length : 0,
      avg_probability: openDeals.length > 0 ? openDeals.reduce((s, d) => s + (d.probability_to_close as number), 0) / openDeals.length : 0,
      snapshot_data: {},
    }, { onConflict: 'workspace_id,snapshot_date' });
  }

  // ----------------------------------------------------------
  // STEP 5: Calculate MRR / ARR
  // ----------------------------------------------------------

  async calculateMRR(workspaceId: string): Promise<void> {
    const { data: booked } = await supabase
      .from('booked_revenue')
      .select('amount, revenue_date, revenue_type')
      .eq('workspace_id', workspaceId)
      .order('revenue_date', { ascending: false })
      .limit(90);

    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    const thisMonthRev = (booked ?? []).filter((b) => new Date((b as Record<string, string>).revenue_date) >= monthStart);
    const lastMonthRev = (booked ?? []).filter((b) => {
      const d = new Date((b as Record<string, string>).revenue_date);
      return d >= lastMonthStart && d < monthStart;
    });

    const newMRR = thisMonthRev.filter((b) => (b as Record<string, string>).revenue_type === 'new_business').reduce((s, b) => s + (b as Record<string, number>).amount, 0) / 12;
    const expansionMRR = thisMonthRev.filter((b) => ['upsell', 'cross_sell', 'expansion'].includes((b as Record<string, string>).revenue_type)).reduce((s, b) => s + (b as Record<string, number>).amount, 0) / 12;
    const prevTotalMRR = lastMonthRev.reduce((s, b) => s + (b as Record<string, number>).amount, 0) / 12;
    const netNewMRR = newMRR + expansionMRR;

    const { data: existingMRR } = await supabase
      .from('monthly_recurring_revenue')
      .select('id, total_mrr')
      .eq('workspace_id', workspaceId)
      .eq('mrr_date', monthStart.toISOString().split('T')[0])
      .maybeSingle();

    const totalMRR = (existingMRR as Record<string, number> | null)?.total_mrr ?? (prevTotalMRR + netNewMRR);

    await supabase.from('monthly_recurring_revenue').upsert({
      workspace_id: workspaceId,
      mrr_date: monthStart.toISOString().split('T')[0],
      new_mrr: newMRR,
      expansion_mrr: expansionMRR,
      net_new_mrr: netNewMRR,
      total_mrr: totalMRR,
    }, { onConflict: 'workspace_id,mrr_date' });

    // ARR = MRR * 12
    await supabase.from('annual_recurring_revenue').upsert({
      workspace_id: workspaceId,
      arr_date: monthStart.toISOString().split('T')[0],
      new_arr: newMRR * 12,
      expansion_arr: expansionMRR * 12,
      net_new_arr: netNewMRR * 12,
      total_arr: totalMRR * 12,
    }, { onConflict: 'workspace_id,arr_date' });
  }

  // ----------------------------------------------------------
  // STEP 6: Generate Executive Summary (AI)
  // ----------------------------------------------------------

  async generateExecutiveSummary(workspaceId: string, summaryType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'board' = 'weekly'): Promise<void> {
    const [deals, forecast, health, booked, mrr, arr] = await Promise.all([
      supabase.from('pipeline_deals').select('*').eq('workspace_id', workspaceId).eq('is_closed', false).order('deal_value', { ascending: false }).limit(20),
      supabase.from('revenue_forecasts').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('pipeline_health').select('*').eq('workspace_id', workspaceId).order('health_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('booked_revenue').select('amount, revenue_date, revenue_type').eq('workspace_id', workspaceId).order('revenue_date', { ascending: false }).limit(30),
      supabase.from('monthly_recurring_revenue').select('*').eq('workspace_id', workspaceId).order('mrr_date', { ascending: false }).limit(2),
      supabase.from('annual_recurring_revenue').select('*').eq('workspace_id', workspaceId).order('arr_date', { ascending: false }).limit(2),
    ]);

    const period = this.getForecastPeriod(summaryType === 'board' ? 'quarterly' : summaryType);

    const result = await this.callAIExecutive({
      deals: deals.data ?? [],
      forecast: forecast.data ?? null,
      health: health.data ?? null,
      bookedRevenue: booked.data ?? [],
      mrr: mrr.data ?? [],
      arr: arr.data ?? [],
      summaryType,
    });

    await supabase.from('executive_summaries').insert({
      workspace_id: workspaceId,
      summary_type: summaryType,
      period_start: period.start,
      period_end: period.end,
      summary_text: result.summary_text ?? '',
      key_metrics: result.key_metrics ?? {},
      highlights: result.highlights ?? [],
      risks: result.risks ?? [],
      recommendations: result.recommendations ?? [],
      ai_confidence: result.confidence ?? 0.8,
    });

    // Also create executive brief
    await supabase.from('executive_briefs').insert({
      workspace_id: workspaceId,
      brief_date: new Date().toISOString().split('T')[0],
      brief_type: summaryType === 'board' ? 'quarterly' : summaryType,
      headline: result.headline ?? `${summaryType} Executive Brief`,
      summary: result.summary_text ?? '',
      key_points: result.highlights ?? [],
      action_items: result.recommendations ?? [],
      metrics: result.key_metrics ?? {},
      ai_confidence: result.confidence ?? 0.8,
    });

    // Store in memory
    try {
      await memoryEngine.store({
        entityType: 'executive_summary', entityId: workspaceId,
        memoryType: 'executive_summary',
        title: `${summaryType} Executive Summary`,
        summary: result.summary_text ?? '',
        content: result, confidenceScore: result.confidence ?? 0.8,
        importanceScore: 0.95, workspaceId,
      });
    } catch { /* best-effort */ }
  }

  // ----------------------------------------------------------
  // STEP 7: Generate Revenue Alerts
  // ----------------------------------------------------------

  async generateRevenueAlerts(workspaceId: string): Promise<void> {
    const { data: deals } = await supabase
      .from('pipeline_deals')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_closed', false);

    const openDeals = (deals ?? []) as Array<Record<string, unknown>>;

    for (const deal of openDeals) {
      const riskScore = deal.risk_score as number;
      const dealValue = deal.deal_value as number;
      const daysInStage = deal.days_in_stage as number;

      // Large deal at risk
      if (riskScore > 60 && dealValue > 50000) {
        await this.createAlert(workspaceId, deal.id as string, 'large_deal_at_risk',
          'Large Deal At Risk',
          `Deal "${deal.deal_name}" worth $${dealValue.toLocaleString()} has a risk score of ${riskScore}.`,
          'critical');
      }

      // Deal stalled
      if (daysInStage > 45) {
        await this.createAlert(workspaceId, deal.id as string, 'pipeline_bottleneck',
          'Deal Stalled',
          `Deal "${deal.deal_name}" has been in ${deal.current_stage} for ${daysInStage} days.`,
          'high');
      }
    }

    // Check forecast changes
    const { data: recentForecasts } = await supabase
      .from('revenue_forecasts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(2);

    if (recentForecasts && recentForecasts.length >= 2) {
      const latest = recentForecasts[0] as Record<string, number>;
      const prev = recentForecasts[1] as Record<string, number>;
      if (latest.expected_revenue > prev.expected_revenue * 1.05) {
        await this.createAlert(workspaceId, null, 'forecast_increased',
          'Forecast Increased',
          `Revenue forecast increased from $${prev.expected_revenue?.toLocaleString()} to $${latest.expected_revenue?.toLocaleString()}.`,
          'medium');
      } else if (latest.expected_revenue < prev.expected_revenue * 0.95) {
        await this.createAlert(workspaceId, null, 'forecast_decreased',
          'Forecast Decreased',
          `Revenue forecast decreased from $${prev.expected_revenue?.toLocaleString()} to $${latest.expected_revenue?.toLocaleString()}.`,
          'high');
      }
    }
  }

  // ----------------------------------------------------------
  // STEP 8: Generate Revenue Insights (AI)
  // ----------------------------------------------------------

  async generateRevenueInsights(workspaceId: string): Promise<void> {
    const [deals, booked, forecasts, health, campaignPerf, industryPerf, channelPerf] = await Promise.all([
      supabase.from('pipeline_deals').select('*').eq('workspace_id', workspaceId),
      supabase.from('booked_revenue').select('*').eq('workspace_id', workspaceId).order('revenue_date', { ascending: false }).limit(30),
      supabase.from('revenue_forecasts').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(5),
      supabase.from('pipeline_health').select('*').eq('workspace_id', workspaceId).order('health_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('campaign_performance').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(10),
      supabase.from('industry_performance').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(10),
      supabase.from('channel_performance').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(10),
    ]);

    const result = await this.callAIInsights({
      deals: deals.data ?? [],
      bookedRevenue: booked.data ?? [],
      forecasts: forecasts.data ?? [],
      health: health.data ?? null,
      campaignPerformance: campaignPerf.data ?? [],
      industryPerformance: industryPerf.data ?? [],
      channelPerformance: channelPerf.data ?? [],
    });

    if (result.insights?.length) {
      await supabase.from('revenue_insights').insert(
        result.insights.map((ins: Record<string, unknown>) => ({
          workspace_id: workspaceId,
          insight_type: ins.insight_type ?? 'trend',
          insight_title: ins.insight_title ?? 'Insight',
          insight_text: ins.insight_text ?? '',
          insight_data: ins.insight_data ?? {},
          severity: ins.severity ?? 'info',
          confidence: ins.confidence ?? 0.7,
        })),
      );
    }

    if (result.opportunities?.length) {
      await supabase.from('revenue_opportunities').insert(
        result.opportunities.map((opp: Record<string, unknown>) => ({
          workspace_id: workspaceId,
          opportunity_type: opp.opportunity_type ?? 'upsell',
          opportunity_title: opp.opportunity_title ?? 'Opportunity',
          opportunity_description: opp.opportunity_description ?? null,
          estimated_value: opp.estimated_value ?? null,
          probability: opp.probability ?? 50,
          timeframe: opp.timeframe ?? null,
          ai_confidence: opp.ai_confidence ?? 0.7,
          ai_reasoning: opp.ai_reasoning ?? null,
        })),
      );
    }
  }

  // ----------------------------------------------------------
  // STEP 9: Load full Command Center dashboard
  // ----------------------------------------------------------

  async loadCommandCenter(workspaceId: string): Promise<RevenueCommandCenter> {
    const [deals, stages, forecastQ, forecastM, health, mrr, arr, salesPerf, campaignPerf, proposalPerf, meetingPerf, channelPerf, industryPerf, latestSummary, latestBrief, insights, alerts, opportunities, anomalies, leakage, velocity, forecastAccuracy, forecastHistory, cashflow] = await Promise.all([
      supabase.from('pipeline_deals').select('*').eq('workspace_id', workspaceId).order('deal_value', { ascending: false }),
      supabase.from('pipeline_stages').select('*').eq('workspace_id', workspaceId).order('stage_order', { ascending: true }),
      supabase.from('revenue_forecasts').select('*').eq('workspace_id', workspaceId).eq('forecast_type', 'quarterly').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('revenue_forecasts').select('*').eq('workspace_id', workspaceId).eq('forecast_type', 'monthly').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('pipeline_health').select('*').eq('workspace_id', workspaceId).order('health_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('monthly_recurring_revenue').select('*').eq('workspace_id', workspaceId).order('mrr_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('annual_recurring_revenue').select('*').eq('workspace_id', workspaceId).order('arr_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('sales_performance').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(10),
      supabase.from('campaign_performance').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(10),
      supabase.from('proposal_performance').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('meeting_performance').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('channel_performance').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(10),
      supabase.from('industry_performance').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(10),
      supabase.from('executive_summaries').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('executive_briefs').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('revenue_insights').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20),
      supabase.from('revenue_alerts').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20),
      supabase.from('revenue_opportunities').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20),
      supabase.from('revenue_anomalies').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(10),
      supabase.from('pipeline_leakage').select('*').eq('workspace_id', workspaceId).eq('resolved', false).order('detected_at', { ascending: false }).limit(20),
      supabase.from('pipeline_velocity').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(10),
      supabase.from('forecast_accuracy').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(10),
      supabase.from('forecast_history').select('*').eq('workspace_id', workspaceId).order('snapshot_date', { ascending: false }).limit(30),
      supabase.from('cashflow_projection').select('*').eq('workspace_id', workspaceId).order('projection_date', { ascending: true }).limit(12),
    ]);

    const allDeals = (deals.data ?? []) as Array<Record<string, unknown>>;
    const openDeals = allDeals.filter((d) => !d.is_closed);
    const totalPipelineValue = openDeals.reduce((s, d) => s + (d.deal_value as number), 0);
    const weightedPipelineValue = openDeals.reduce((s, d) => s + (d.weighted_value as number), 0);
    const avgDealSize = openDeals.length > 0 ? totalPipelineValue / openDeals.length : 0;
    const avgProbability = openDeals.length > 0 ? openDeals.reduce((s, d) => s + (d.probability_to_close as number), 0) / openDeals.length : 0;

    return {
      deals: allDeals as never[],
      stages: (stages.data ?? []) as never[],
      totalPipelineValue,
      weightedPipelineValue,
      dealCount: openDeals.length,
      avgDealSize,
      avgProbability,
      currentQuarterForecast: (forecastQ.data ?? null) as never,
      currentMonthForecast: (forecastM.data ?? null) as never,
      pipelineHealth: (health.data ?? null) as never,
      latestMRR: (mrr.data ?? null) as never,
      latestARR: (arr.data ?? null) as never,
      salesPerformance: (salesPerf.data ?? []) as never[],
      campaignPerformance: (campaignPerf.data ?? []) as never[],
      proposalPerformance: (proposalPerf.data ?? null) as never,
      meetingPerformance: (meetingPerf.data ?? null) as never,
      channelPerformance: (channelPerf.data ?? []) as never[],
      industryPerformance: (industryPerf.data ?? []) as never[],
      latestSummary: (latestSummary.data ?? null) as never,
      latestBrief: (latestBrief.data ?? null) as never,
      insights: (insights.data ?? []) as never[],
      alerts: (alerts.data ?? []) as never[],
      opportunities: (opportunities.data ?? []) as never[],
      anomalies: (anomalies.data ?? []) as never[],
      leakage: (leakage.data ?? []) as never[],
      velocity: (velocity.data ?? []) as never[],
      forecastAccuracy: (forecastAccuracy.data ?? []) as never[],
      forecastHistory: (forecastHistory.data ?? []) as never[],
      cashflowProjections: (cashflow.data ?? []) as never[],
    };
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  private getForecastPeriod(type: string): { start: string; end: string } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    let end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    if (type === 'quarterly') end = new Date(now.getFullYear(), now.getMonth() + 3, 0);
    if (type === 'annual') end = new Date(now.getFullYear() + 1, now.getMonth(), 0);
    if (type === 'weekly') end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (type === 'daily') end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  }

  private async createLeakage(workspaceId: string, dealId: string, type: string, desc: string, riskScore: number, action: string): Promise<void> {
    const { data: existing } = await supabase
      .from('pipeline_leakage')
      .select('id')
      .eq('deal_id', dealId)
      .eq('leakage_type', type)
      .eq('resolved', false)
      .maybeSingle();
    if (existing) return;
    await supabase.from('pipeline_leakage').insert({
      workspace_id: workspaceId, deal_id: dealId, leakage_type: type as never,
      leakage_description: desc, risk_score: riskScore, confidence: 0.8,
      expected_impact: 'Deal may stall or be lost', recommended_action: action,
    });
  }

  private async createAlert(workspaceId: string, dealId: string | null, type: string, title: string, message: string, severity: 'low' | 'medium' | 'high' | 'critical'): Promise<void> {
    await supabase.from('revenue_alerts').insert({
      workspace_id: workspaceId, deal_id: dealId, alert_type: type as never,
      alert_title: title, alert_message: message, severity,
    });
  }

  // ----------------------------------------------------------
  // AI Calls
  // ----------------------------------------------------------

  private async callAIForecast(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are an elite revenue forecasting AI. You predict revenue based on pipeline data, historical performance, and market signals. You always respond with valid JSON.';
    const userPrompt = `Generate a revenue forecast for this period.

PIPELINE DATA:
${JSON.stringify(context.deals ?? [], null, 2)}

BOOKED REVENUE (last 30 entries):
${JSON.stringify(context.bookedRevenue ?? [], null, 2)}

PREVIOUS FORECASTS:
${JSON.stringify(context.prevForecasts ?? [], null, 2)}

FORECAST TYPE: ${context.forecastType}
PERIOD: ${JSON.stringify(context.period)}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "expected_revenue": 250000,
  "weighted_revenue": 180000,
  "best_case_revenue": 350000,
  "worst_case_revenue": 120000,
  "committed_revenue": 150000,
  "pipeline_revenue": 500000,
  "confidence": 0.75,
  "ai_reasoning": "I predict this quarter will deliver $250K based on 15 open deals with average probability of 45%...",
  "supporting_signals": [{"signal": "3 deals in negotiation stage", "impact": "high"}, {"signal": "Win rate trending up 12%", "impact": "medium"}]
}`;

    const response = await aiGateway.generateStructured({
      systemPrompt, userPrompt, temperature: 0.3, maxTokens: 4000,
      workspaceId: context.workspaceId as string, agentName: 'revenue_forecast_agent',
      schema: { type: 'object' },
    });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }

  private async callAIHealth(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are a pipeline health analysis AI. You assess pipeline health and recommend actions. Respond with valid JSON.';
    const userPrompt = `Assess pipeline health.

${JSON.stringify(context, null, 2)}

Return ONLY valid JSON:
{
  "overall_health_score": 72,
  "recommendations": [{"action": "Follow up with 5 stalled deals", "priority": "high"}, {"action": "Advance 3 deals from discovery to proposal", "priority": "medium"}]
}`;

    const response = await aiGateway.generateStructured({
      systemPrompt, userPrompt, temperature: 0.3, maxTokens: 2000,
      workspaceId: context.workspaceId as string, agentName: 'pipeline_health_agent',
      schema: { type: 'object' },
    });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }

  private async callAIExecutive(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are an elite executive AI assistant for revenue operations. You generate executive summaries and briefs for leadership. You speak in first person. Respond with valid JSON.';
    const userPrompt = `Generate an executive summary.

DATA:
${JSON.stringify(context, null, 2)}

Return ONLY valid JSON:
{
  "headline": "I predict this quarter will exceed target by 14%",
  "summary_text": "I analyzed the pipeline and identified 3 enterprise opportunities worth over $620K. The pipeline is healthy with 72% coverage...",
  "key_metrics": {"total_pipeline": 500000, "weighted_pipeline": 180000, "win_rate": 42, "mrr": 15000, "arr": 180000},
  "highlights": [{"point": "3 deals in final negotiation worth $620K"}, {"point": "Win rate improved 12% this quarter"}],
  "risks": [{"risk": "5 deals stalled for over 30 days", "impact": "high"}, {"risk": "Forecast confidence at 65%", "impact": "medium"}],
  "recommendations": [{"action": "Follow up with Acme Corp - proposal viewed 6 times", "priority": "high"}, {"action": "Advance 3 deals from discovery to proposal stage", "priority": "medium"}],
  "confidence": 0.82
}`;

    const response = await aiGateway.generateStructured({
      systemPrompt, userPrompt, temperature: 0.3, maxTokens: 4000,
      workspaceId: context.workspaceId as string, agentName: 'executive_summary_agent',
      schema: { type: 'object' },
    });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }

  private async callAIInsights(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are a revenue intelligence AI. You generate insights, opportunities, and recommendations. Respond with valid JSON.';
    const userPrompt = `Generate revenue insights from this data.

${JSON.stringify(context, null, 2)}

Return ONLY valid JSON:
{
  "insights": [
    {"insight_type": "trend", "insight_title": "Win rate improving", "insight_text": "Win rate has increased 12% over last quarter", "severity": "info", "confidence": 0.85},
    {"insight_type": "risk", "insight_title": "5 deals stalled", "insight_text": "5 deals have been in the same stage for over 30 days", "severity": "high", "confidence": 0.9},
    {"insight_type": "opportunity", "insight_title": "Enterprise segment converting well", "insight_text": "Enterprise deals have 65% win rate vs 35% for SMB", "severity": "info", "confidence": 0.8}
  ],
  "opportunities": [
    {"opportunity_type": "upsell", "opportunity_title": "Upsell Acme Corp", "estimated_value": 50000, "probability": 65, "timeframe": "Q4", "ai_reasoning": "Acme Corp has been a customer for 2 years and their usage has grown 40%"},
    {"opportunity_type": "expansion", "opportunity_title": "Expand into EMEA", "estimated_value": 200000, "probability": 45, "timeframe": "Q1 2027", "ai_reasoning": "3 enterprise deals in EMEA pipeline with 45% avg probability"}
  ]
}`;

    const response = await aiGateway.generateStructured({
      systemPrompt, userPrompt, temperature: 0.3, maxTokens: 4000,
      workspaceId: context.workspaceId as string, agentName: 'revenue_insights_agent',
      schema: { type: 'object' },
    });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }
}

export const revenueForecastService = new RevenueForecastService();
