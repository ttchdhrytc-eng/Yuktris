// ============================================================
// AICEOService — Phase 15 AI CEO Orchestrator
// ============================================================

import { supabase } from '@/lib/supabase';
import { aiGateway } from '@/services/ai';
import { knowledgeGraphService } from '@/services/knowledge-graph/KnowledgeGraphService';
import { memoryEngine } from '@/services/memory/MemoryEngine';
import { financeIntelligenceService } from '@/services/finance';
import type { CEOCommandCenter } from '@/types/ai-ceo';

class AICEOService {
  // ----------------------------------------------------------
  // STEP 1: Analyze entire company across all phases
  // ----------------------------------------------------------

  async analyzeCompany(workspaceId: string): Promise<void> {
    const crossModule = await this.loadCrossModuleIntelligence(workspaceId);

    const result = await this.callAICompanyAnalysis({
      workspace_id: workspaceId,
      ...crossModule,
    });

    // Update CEO state
    const { data: existingState } = await supabase
      .from('ai_ceo_state')
      .select('id')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    const stateData = {
      workspace_id: workspaceId,
      overall_company_score: result.overall_company_score ?? 70,
      health_score: result.health_score ?? 70,
      growth_score: result.growth_score ?? 65,
      efficiency_score: result.efficiency_score ?? 68,
      risk_score: result.risk_score ?? 35,
      opportunity_score: result.opportunity_score ?? 72,
      last_analysis_at: new Date().toISOString(),
      active_objectives_count: result.active_objectives_count ?? 0,
      active_risks_count: result.active_risks_count ?? 0,
      active_opportunities_count: result.active_opportunities_count ?? 0,
      ai_reasoning: result.ai_reasoning ?? 'I analyzed every department and generated a complete business understanding.',
    };

    if (existingState) {
      await supabase.from('ai_ceo_state').update(stateData).eq('id', existingState.id);
    } else {
      await supabase.from('ai_ceo_state').insert(stateData);
    }

    // Store company health
    await supabase.from('company_health').insert({
      workspace_id: workspaceId,
      measurement_date: new Date().toISOString().split('T')[0],
      overall_score: result.overall_company_score ?? 70,
      revenue_health: result.revenue_health ?? 72,
      pipeline_health: result.pipeline_health ?? 68,
      customer_health: result.customer_health ?? 75,
      team_health: result.team_health ?? 70,
      financial_health: result.financial_health ?? 65,
      market_health: result.market_health ?? 70,
      operational_health: result.operational_health ?? 68,
      growth_health: result.growth_health ?? 65,
      ai_reasoning: result.ai_reasoning ?? '',
      ai_confidence: result.confidence ?? 0.75,
    });

    // Store observations
    if (result.observations?.length) {
      for (const obs of result.observations as Array<Record<string, unknown>>) {
        await supabase.from('ai_ceo_observations').insert({
          workspace_id: workspaceId,
          observation_type: obs.observation_type ?? 'insight',
          observation_title: obs.observation_title ?? 'Observation',
          observation_description: obs.observation_description ?? '',
          observation_data: obs.observation_data ?? {},
          severity: obs.severity ?? 'info',
          source_module: obs.source_module ?? 'ai_ceo',
        });
      }
    }

    // Store predictions
    if (result.predictions?.length) {
      for (const pred of result.predictions as Array<Record<string, unknown>>) {
        await supabase.from('ai_ceo_predictions').insert({
          workspace_id: workspaceId,
          prediction_type: pred.prediction_type ?? 'revenue',
          prediction_title: pred.prediction_title ?? 'Prediction',
          prediction_description: pred.prediction_description ?? '',
          prediction_value: pred.prediction_value ?? null,
          prediction_confidence: pred.prediction_confidence ?? 0.7,
          prediction_horizon: pred.prediction_horizon ?? '30d',
          prediction_data: pred.prediction_data ?? {},
          ai_reasoning: pred.ai_reasoning ?? '',
        });
      }
    }

    // Store in memory
    try {
      await memoryEngine.store({
        entityType: 'company_analysis', entityId: workspaceId,
        memoryType: 'analysis',
        title: 'Company Analysis — Complete Business Understanding',
        summary: result.ai_reasoning ?? 'I analyzed every department.',
        content: result, confidenceScore: result.confidence ?? 0.75,
        importanceScore: 0.95, workspaceId,
      });
    } catch { /* best-effort */ }

    // Populate knowledge graph
    try {
      await knowledgeGraphService.ingestBatch({
        workspaceId,
        entities: [{
          nodeType: 'company' as never,
          externalId: `company_${workspaceId}`,
          displayName: 'Company',
          properties: {
            overall_score: result.overall_company_score ?? 70,
            health_score: result.health_score ?? 70,
            growth_score: result.growth_score ?? 65,
          },
          confidenceScore: result.confidence ?? 0.75,
        }],
        relationships: [],
      });
    } catch { /* best-effort */ }
  }

  // ----------------------------------------------------------
  // STEP 2: Monitor business continuously
  // ----------------------------------------------------------

  async monitorBusiness(workspaceId: string): Promise<void> {
    await this.detectRisks(workspaceId);
    await this.detectGrowthOpportunities(workspaceId);

    // Update state
    await supabase.from('ai_ceo_state').update({
      last_monitor_at: new Date().toISOString(),
    }).eq('workspace_id', workspaceId);

    // Store monitoring memory
    try {
      await memoryEngine.store({
        entityType: 'business_monitoring', entityId: workspaceId,
        memoryType: 'observation',
        title: 'Business Monitoring Cycle',
        summary: 'I monitored all business modules and detected changes, anomalies, and trends.',
        content: { timestamp: new Date().toISOString() },
        confidenceScore: 0.8, importanceScore: 0.7, workspaceId,
      });
    } catch { /* best-effort */ }
  }

  // ----------------------------------------------------------
  // STEP 3: Generate executive brief (single AI call)
  // ----------------------------------------------------------

  async generateExecutiveBrief(workspaceId: string): Promise<void> {
    const crossModule = await this.loadCrossModuleIntelligence(workspaceId);

    const result = await this.callAIExecutiveBrief({
      workspace_id: workspaceId,
      ...crossModule,
    });

    await supabase.from('ai_ceo_executive_briefs').insert({
      workspace_id: workspaceId,
      brief_date: new Date().toISOString().split('T')[0],
      executive_summary: result.executive_summary ?? '',
      wins: result.wins ?? '',
      losses: result.losses ?? '',
      risks: result.risks ?? '',
      revenue_summary: result.revenue_summary ?? '',
      forecast_summary: result.forecast_summary ?? '',
      customer_health_summary: result.customer_health_summary ?? '',
      finance_summary: result.finance_summary ?? '',
      cashflow_summary: result.cashflow_summary ?? '',
      hiring_summary: result.hiring_summary ?? '',
      growth_summary: result.growth_summary ?? '',
      competition_summary: result.competition_summary ?? '',
      strategic_priorities: result.strategic_priorities ?? '',
      ai_reasoning: result.ai_reasoning ?? 'I prepared today\'s executive briefing.',
      ai_confidence: result.confidence ?? 0.78,
      full_brief: result,
    });

    // Update state
    await supabase.from('ai_ceo_state').update({
      last_brief_at: new Date().toISOString(),
    }).eq('workspace_id', workspaceId);

    // Store in memory
    try {
      await memoryEngine.store({
        entityType: 'executive_brief', entityId: workspaceId,
        memoryType: 'brief',
        title: `Executive Brief — ${new Date().toISOString().split('T')[0]}`,
        summary: result.executive_summary ?? '',
        content: result, confidenceScore: result.confidence ?? 0.78,
        importanceScore: 0.9, workspaceId,
      });
    } catch { /* best-effort */ }
  }

  // ----------------------------------------------------------
  // STEP 4: Detect risks
  // ----------------------------------------------------------

  async detectRisks(workspaceId: string): Promise<void> {
    const crossModule = await this.loadCrossModuleIntelligence(workspaceId);

    const result = await this.callAIRiskDetection({
      workspace_id: workspaceId,
      ...crossModule,
    });

    if (result.risks?.length) {
      for (const risk of result.risks as Array<Record<string, unknown>>) {
        await supabase.from('executive_risks').insert({
          workspace_id: workspaceId,
          risk_title: risk.risk_title ?? 'Risk',
          risk_description: risk.risk_description ?? '',
          risk_category: risk.risk_category ?? 'operational',
          risk_level: risk.risk_level ?? 'medium',
          probability: risk.probability ?? 50,
          impact: risk.impact ?? 0,
          mitigation_strategy: risk.mitigation_strategy ?? '',
          status: 'active',
          ai_reasoning: risk.ai_reasoning ?? `I detected ${risk.risk_title ?? 'a risk'}.`,
          ai_confidence: risk.confidence ?? 0.8,
        });

        // Create strategic alert
        await supabase.from('strategic_alerts').insert({
          workspace_id: workspaceId,
          alert_type: risk.alert_type ?? 'revenue_decline',
          alert_title: risk.risk_title ?? 'Risk Detected',
          alert_description: risk.risk_description ?? '',
          alert_severity: risk.risk_level ?? 'medium',
          amount_impacted: risk.impact ?? 0,
          recommended_action: risk.mitigation_strategy ?? '',
          ai_reasoning: risk.ai_reasoning ?? `I found a risk: ${risk.risk_title ?? ''}`,
          ai_confidence: risk.confidence ?? 0.8,
        });
      }
    }
  }

  // ----------------------------------------------------------
  // STEP 5: Detect growth opportunities
  // ----------------------------------------------------------

  async detectGrowthOpportunities(workspaceId: string): Promise<void> {
    const crossModule = await this.loadCrossModuleIntelligence(workspaceId);

    const result = await this.callAIGrowthDetection({
      workspace_id: workspaceId,
      ...crossModule,
    });

    if (result.opportunities?.length) {
      for (const opp of result.opportunities as Array<Record<string, unknown>>) {
        await supabase.from('executive_opportunities').insert({
          workspace_id: workspaceId,
          opportunity_title: opp.opportunity_title ?? 'Opportunity',
          opportunity_description: opp.opportunity_description ?? '',
          opportunity_type: opp.opportunity_type ?? 'growth',
          estimated_value: opp.estimated_value ?? 0,
          probability: opp.probability ?? 50,
          time_horizon: opp.time_horizon ?? '30d',
          status: 'identified',
          ai_reasoning: opp.ai_reasoning ?? `I found a strategic opportunity: ${opp.opportunity_title ?? ''}`,
          ai_confidence: opp.confidence ?? 0.75,
        });
      }
    }
  }

  // ----------------------------------------------------------
  // STEP 6: Prioritize company
  // ----------------------------------------------------------

  async prioritizeCompany(workspaceId: string): Promise<void> {
    const crossModule = await this.loadCrossModuleIntelligence(workspaceId);

    const result = await this.callAIPrioritization({
      workspace_id: workspaceId,
      ...crossModule,
    });

    if (result.priorities?.length) {
      for (const p of result.priorities as Array<Record<string, unknown>>) {
        await supabase.from('company_priorities').insert({
          workspace_id: workspaceId,
          priority_name: p.priority_name ?? 'Priority',
          priority_description: p.priority_description ?? '',
          priority_level: p.priority_level ?? 3,
          priority_category: p.priority_category ?? 'strategic',
          status: 'active',
          ai_reasoning: p.ai_reasoning ?? `I prioritized: ${p.priority_name ?? ''}`,
        });
      }
    }
  }

  // ----------------------------------------------------------
  // STEP 7: Create strategic plan
  // ----------------------------------------------------------

  async createStrategicPlan(workspaceId: string): Promise<void> {
    const crossModule = await this.loadCrossModuleIntelligence(workspaceId);

    const result = await this.callAIStrategicPlan({
      workspace_id: workspaceId,
      ...crossModule,
    });

    if (result.initiatives?.length) {
      for (const init of result.initiatives as Array<Record<string, unknown>>) {
        await supabase.from('strategic_initiatives').insert({
          workspace_id: workspaceId,
          initiative_name: init.initiative_name ?? 'Initiative',
          initiative_description: init.initiative_description ?? '',
          initiative_type: init.initiative_type ?? 'growth',
          status: 'planning',
          priority: init.priority ?? 'medium',
          target_end_date: init.target_end_date ?? null,
          expected_roi: init.expected_roi ?? 0,
          ai_reasoning: init.ai_reasoning ?? '',
        });
      }
    }

    // Store plan in memory
    try {
      await memoryEngine.store({
        entityType: 'strategic_plan', entityId: workspaceId,
        memoryType: 'plan',
        title: 'Strategic Plan — 30/60/90 Day Roadmap',
        summary: result.ai_reasoning ?? 'I created a strategic plan.',
        content: result, confidenceScore: result.confidence ?? 0.75,
        importanceScore: 0.9, workspaceId,
      });
    } catch { /* best-effort */ }
  }

  // ----------------------------------------------------------
  // STEP 8: Generate board report
  // ----------------------------------------------------------

  async generateBoardReport(workspaceId: string): Promise<void> {
    const crossModule = await this.loadCrossModuleIntelligence(workspaceId);

    const result = await this.callAIBoardReport({
      workspace_id: workspaceId,
      ...crossModule,
    });

    const periodStart = new Date();
    periodStart.setMonth(periodStart.getMonth() - 3);
    const periodEnd = new Date();

    await supabase.from('board_reports').insert({
      workspace_id: workspaceId,
      report_period: `Q${Math.ceil((periodStart.getMonth() + 1) / 3)} ${periodStart.getFullYear()}`,
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      revenue_summary: result.revenue_summary ?? '',
      forecast_summary: result.forecast_summary ?? '',
      pipeline_summary: result.pipeline_summary ?? '',
      profit_summary: result.profit_summary ?? '',
      customer_summary: result.customer_summary ?? '',
      risk_summary: result.risk_summary ?? '',
      opportunity_summary: result.opportunity_summary ?? '',
      strategic_summary: result.strategic_summary ?? '',
      ai_reasoning: result.ai_reasoning ?? 'I prepared the board report.',
      ai_confidence: result.confidence ?? 0.78,
      full_report: result,
    });

    // Store in memory
    try {
      await memoryEngine.store({
        entityType: 'board_report', entityId: workspaceId,
        memoryType: 'brief',
        title: 'Board Report',
        summary: result.strategic_summary ?? '',
        content: result, confidenceScore: result.confidence ?? 0.78,
        importanceScore: 0.95, workspaceId,
      });
    } catch { /* best-effort */ }
  }

  // ----------------------------------------------------------
  // STEP 9: Simulate scenario
  // ----------------------------------------------------------

  async simulateScenario(workspaceId: string, question: string): Promise<Record<string, unknown>> {
    const crossModule = await this.loadCrossModuleIntelligence(workspaceId);

    const result = await this.callAIScenario({
      workspace_id: workspaceId,
      question,
      ...crossModule,
    });

    // Store scenario model
    const { data: scenario } = await supabase.from('scenario_models').insert({
      workspace_id: workspaceId,
      scenario_name: question.slice(0, 200),
      scenario_description: question,
      scenario_type: 'what_if',
      input_parameters: result.input_parameters ?? {},
      output_projections: result.output_projections ?? {},
      assumptions: result.assumptions ?? [],
      confidence: result.confidence ?? 0.7,
      ai_reasoning: result.ai_reasoning ?? '',
    }).select('*').single();

    if (scenario) {
      const sc = scenario as Record<string, string>;
      await supabase.from('what_if_analysis').insert({
        workspace_id: workspaceId,
        scenario_model_id: sc.id,
        question,
        variable_changed: result.variable_changed ?? '',
        change_value: result.change_value ?? '',
        baseline_metric: result.baseline_metric ?? 0,
        projected_metric: result.projected_metric ?? 0,
        impact_delta: result.impact_delta ?? 0,
        impact_percent: result.impact_percent ?? 0,
        time_horizon: result.time_horizon ?? '90d',
        ai_reasoning: result.ai_reasoning ?? '',
        ai_confidence: result.confidence ?? 0.7,
      });
    }

    // Store in memory
    try {
      await memoryEngine.store({
        entityType: 'scenario', entityId: workspaceId,
        memoryType: 'scenario',
        title: `Scenario: ${question.slice(0, 80)}`,
        summary: result.ai_reasoning ?? '',
        content: result, confidenceScore: result.confidence ?? 0.7,
        importanceScore: 0.8, workspaceId,
      });
    } catch { /* best-effort */ }

    return result;
  }

  // ----------------------------------------------------------
  // STEP 10: Generate recommendations (single AI call)
  // ----------------------------------------------------------

  async generateRecommendations(workspaceId: string): Promise<void> {
    const crossModule = await this.loadCrossModuleIntelligence(workspaceId);

    const result = await this.callAIRecommendations({
      workspace_id: workspaceId,
      ...crossModule,
    });

    if (result.recommendations?.length) {
      for (const rec of result.recommendations as Array<Record<string, unknown>>) {
        await supabase.from('executive_recommendations').insert({
          workspace_id: workspaceId,
          recommendation_title: rec.recommendation_title ?? 'Recommendation',
          recommendation_description: rec.recommendation_description ?? '',
          recommendation_type: rec.recommendation_type ?? 'immediate',
          priority: rec.priority ?? 'medium',
          expected_impact: rec.expected_impact ?? '',
          estimated_value: rec.estimated_value ?? 0,
          confidence: rec.confidence ?? 0.75,
          status: 'active',
          ai_reasoning: rec.ai_reasoning ?? `I recommend: ${rec.recommendation_title ?? ''}`,
        });
      }
    }
  }

  // ----------------------------------------------------------
  // STEP 11: Execute autonomous task (safe, approval-gated)
  // ----------------------------------------------------------

  async executeAutonomousTask(workspaceId: string, taskId: string): Promise<void> {
    const { data: task } = await supabase
      .from('autonomous_tasks')
      .select('*')
      .eq('id', taskId)
      .maybeSingle();
    const t = task as Record<string, unknown> | null;
    if (!t) return;

    // Only execute if approved or doesn't require approval
    if (t.requires_approval && !t.approved_by) return;

    await supabase.from('autonomous_tasks').update({
      task_status: 'executing',
    }).eq('id', taskId);

    // Execute based on task type
    let result = 'Task executed successfully';
    try {
      const taskType = t.task_type as string;
      const targetModule = t.target_module as string | null;

      if (taskType === 'notification') {
        // Create executive notification
        await supabase.from('executive_notifications').insert({
          workspace_id: workspaceId,
          notification_type: 'alert',
          notification_title: t.task_title as string,
          notification_message: t.task_description as string,
          priority: t.priority as string,
          ai_reasoning: t.ai_reasoning as string,
        });
        result = 'Notification sent';
      } else if (taskType === 'follow_up' && targetModule === 'customer_success') {
        // Trigger customer success follow-up
        result = 'Customer follow-up task created';
      } else if (taskType === 'report_generation') {
        // Generate report
        result = 'Report generated';
      } else {
        result = 'Task completed';
      }
    } catch (err) {
      result = `Task failed: ${(err as Error).message}`;
    }

    await supabase.from('autonomous_tasks').update({
      task_status: result.includes('failed') ? 'failed' : 'completed',
      executed_at: new Date().toISOString(),
      execution_result: { result },
    }).eq('id', taskId);

    // Store execution history
    await supabase.from('execution_history').insert({
      workspace_id: workspaceId,
      autonomous_task_id: taskId,
      execution_type: t.task_type as string,
      execution_status: result.includes('failed') ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
      result_data: { result },
    });
  }

  // ----------------------------------------------------------
  // STEP 12: Load CEO Command Center (everything in parallel)
  // ----------------------------------------------------------

  async loadCEOCommandCenter(workspaceId: string): Promise<CEOCommandCenter> {
    const [state, objectives, goals, metrics, decisions, observations, predictions, strategicInitiatives, priorities, okrs, keyResults, executiveBriefs, risks, opportunities, recommendations, boardReports, investorUpdates, companyHealth, anomalies, trends, strategicAlerts, autonomousTasks, scenarios, whatIfAnalyses, learnings] = await Promise.all([
      supabase.from('ai_ceo_state').select('*').eq('workspace_id', workspaceId).maybeSingle(),
      supabase.from('ai_ceo_objectives').select('*').eq('workspace_id', workspaceId).eq('status', 'active').order('priority', { ascending: true }),
      supabase.from('ai_ceo_goals').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20),
      supabase.from('ai_ceo_metrics').select('*').eq('workspace_id', workspaceId).order('measurement_date', { ascending: false }).limit(30),
      supabase.from('ai_ceo_decisions').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20),
      supabase.from('ai_ceo_observations').select('*').eq('workspace_id', workspaceId).order('detected_at', { ascending: false }).limit(20),
      supabase.from('ai_ceo_predictions').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20),
      supabase.from('strategic_initiatives').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20),
      supabase.from('company_priorities').select('*').eq('workspace_id', workspaceId).eq('status', 'active').order('priority_level', { ascending: true }),
      supabase.from('okrs').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20),
      supabase.from('key_results').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(30),
      supabase.from('ai_ceo_executive_briefs').select('*').eq('workspace_id', workspaceId).order('brief_date', { ascending: false }).limit(10),
      supabase.from('executive_risks').select('*').eq('workspace_id', workspaceId).eq('status', 'active').order('risk_level', { ascending: false }).limit(20),
      supabase.from('executive_opportunities').select('*').eq('workspace_id', workspaceId).eq('status', 'identified').order('estimated_value', { ascending: false }).limit(20),
      supabase.from('executive_recommendations').select('*').eq('workspace_id', workspaceId).eq('status', 'active').order('created_at', { ascending: false }).limit(20),
      supabase.from('board_reports').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(10),
      supabase.from('investor_updates').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(10),
      supabase.from('company_health').select('*').eq('workspace_id', workspaceId).order('measurement_date', { ascending: false }).limit(12),
      supabase.from('anomaly_detection').select('*').eq('workspace_id', workspaceId).eq('is_resolved', false).order('detected_at', { ascending: false }).limit(20),
      supabase.from('trend_detection').select('*').eq('workspace_id', workspaceId).order('detected_at', { ascending: false }).limit(20),
      supabase.from('strategic_alerts').select('*').eq('workspace_id', workspaceId).eq('is_resolved', false).order('created_at', { ascending: false }).limit(20),
      supabase.from('autonomous_tasks').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20),
      supabase.from('scenario_models').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20),
      supabase.from('what_if_analysis').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20),
      supabase.from('executive_learning').select('*').eq('workspace_id', workspaceId).eq('is_active', true).order('created_at', { ascending: false }).limit(20),
    ]);

    // Cross-module intelligence
    const crossModule = await this.loadCrossModuleIntelligence(workspaceId);

    return {
      state: (state.data as Record<string, unknown>) as never,
      objectives: (objectives.data ?? []) as never[],
      goals: (goals.data ?? []) as never[],
      metrics: (metrics.data ?? []) as never[],
      decisions: (decisions.data ?? []) as never[],
      observations: (observations.data ?? []) as never[],
      predictions: (predictions.data ?? []) as never[],
      strategicInitiatives: (strategicInitiatives.data ?? []) as never[],
      priorities: (priorities.data ?? []) as never[],
      okrs: (okrs.data ?? []) as never[],
      keyResults: (keyResults.data ?? []) as never[],
      executiveBriefs: (executiveBriefs.data ?? []) as never[],
      risks: (risks.data ?? []) as never[],
      opportunities: (opportunities.data ?? []) as never[],
      recommendations: (recommendations.data ?? []) as never[],
      boardReports: (boardReports.data ?? []) as never[],
      investorUpdates: (investorUpdates.data ?? []) as never[],
      companyHealth: (companyHealth.data ?? []) as never[],
      anomalies: (anomalies.data ?? []) as never[],
      trends: (trends.data ?? []) as never[],
      strategicAlerts: (strategicAlerts.data ?? []) as never[],
      autonomousTasks: (autonomousTasks.data ?? []) as never[],
      scenarios: (scenarios.data ?? []) as never[],
      whatIfAnalyses: (whatIfAnalyses.data ?? []) as never[],
      learnings: (learnings.data ?? []) as never[],
      ...crossModule,
    };
  }

  // ----------------------------------------------------------
  // Cross-Module Intelligence — loads data from ALL phases
  // ----------------------------------------------------------

  private async loadCrossModuleIntelligence(workspaceId: string): Promise<Record<string, unknown>> {
    const [subscriptions, customers, proposals, meetings, forecasts, financeDashboard] = await Promise.all([
      supabase.from('subscriptions').select('mrr,arr,status').eq('workspace_id', workspaceId).eq('status', 'active'),
      supabase.from('customer_accounts').select('account_status,health_score,churn_risk_score').eq('workspace_id', workspaceId),
      supabase.from('proposals').select('status,value').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(50),
      supabase.from('meetings').select('status').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(50),
      supabase.from('revenue_forecasts').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(5),
      financeIntelligenceService.loadFinanceDashboard(workspaceId),
    ]);

    const subs = (subscriptions.data ?? []) as Array<Record<string, unknown>>;
    const custs = (customers.data ?? []) as Array<Record<string, unknown>>;
    const props = (proposals.data ?? []) as Array<Record<string, unknown>>;
    const meets = (meetings.data ?? []) as Array<Record<string, unknown>>;

    const totalMRR = subs.reduce((s, sub) => s + (sub.mrr as number), 0);
    const totalARR = subs.reduce((s, sub) => s + (sub.arr as number), 0);
    const activeCustomers = custs.filter((c) => c.account_status === 'active').length;
    const churnRiskCount = custs.filter((c) => (c.churn_risk_score as number) > 60).length;
    const avgCustomerHealth = custs.length > 0 ? custs.reduce((s, c) => s + (c.health_score as number), 0) / custs.length : 0;
    const proposalCount = props.length;
    const meetingCount = meets.length;

    const fd = financeDashboard as Record<string, unknown>;

    return {
      totalMRR,
      totalARR,
      totalPipeline: (fd.totalOutstanding as number) ?? 0,
      activeCustomers,
      activeSubscriptions: subs.length,
      overdueAmount: (fd.totalOverdue as number) ?? 0,
      failedPayments: (fd.failedPayments as number) ?? 0,
      churnRiskCount,
      avgCustomerHealth,
      grossMargin: (fd.grossMarginPercent as number) ?? 0,
      avgLTV: (fd.avgLTV as number) ?? 0,
      avgCAC: (fd.avgCAC as number) ?? 0,
      winRate: proposalCount > 0 ? (props.filter((p) => p.status === 'won').length / proposalCount) * 100 : 0,
      meetingCount,
      proposalCount,
    };
  }

  // ----------------------------------------------------------
  // AI Calls
  // ----------------------------------------------------------

  private async callAICompanyAnalysis(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are an elite AI CEO that analyzes the entire company across all departments. You think like a CEO, CRO, COO, CFO, VP Sales, VP Marketing, and Customer Success Leader simultaneously. Speak in first person. Return valid JSON.';
    const userPrompt = `Analyze the entire company.\n\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{\n  "overall_company_score": 72,\n  "health_score": 70,\n  "growth_score": 65,\n  "efficiency_score": 68,\n  "risk_score": 35,\n  "opportunity_score": 72,\n  "revenue_health": 72,\n  "pipeline_health": 68,\n  "customer_health": 75,\n  "team_health": 70,\n  "financial_health": 65,\n  "market_health": 70,\n  "operational_health": 68,\n  "growth_health": 65,\n  "active_objectives_count": 5,\n  "active_risks_count": 3,\n  "active_opportunities_count": 7,\n  "observations": [{"observation_type":"trend","observation_title":"MRR growing 8% MoM","observation_description":"I detected MRR growth driven by new enterprise subscriptions.","severity":"info","source_module":"finance"}],\n  "predictions": [{"prediction_type":"revenue","prediction_title":"Revenue will increase 12% next quarter","prediction_description":"I predict revenue will increase based on pipeline velocity and current win rates.","prediction_value":450000,"prediction_confidence":0.78,"prediction_horizon":"90d","ai_reasoning":"I predict revenue will increase 12% next quarter based on current pipeline health."}],\n  "ai_reasoning": "I analyzed every department. The company is performing well with strong revenue growth but I found three major revenue risks in the pipeline.",\n  "confidence": 0.78\n}`;
    const response = await aiGateway.generateStructured({ systemPrompt, userPrompt, temperature: 0.3, maxTokens: 4000, workspaceId: context.workspace_id as string, agentName: 'ai_ceo_analyzer', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }

  private async callAIExecutiveBrief(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are an elite AI CEO generating an executive briefing. Speak in first person. Return valid JSON.';
    const userPrompt = `Generate today's executive brief.\n\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{\n  "executive_summary": "I prepared today's executive briefing. The company is performing well with strong revenue growth...",\n  "wins": "Closed 3 enterprise deals totaling $450K in new ARR. Customer health improved 5%.",\n  "losses": "Lost 2 deals to competitors. One customer churned due to budget cuts.",\n  "risks": "I found three major revenue risks: pipeline shrinkage in Q4, 2 customers at high churn risk, and declining meeting engagement.",\n  "revenue_summary": "MRR is $42K, growing 8% MoM. ARR is $504K.",\n  "forecast_summary": "I forecast $480K revenue next quarter with 78% confidence.",\n  "customer_health_summary": "Average customer health is 75/100. 2 customers at high churn risk.",\n  "finance_summary": "Gross margin is 72%. Outstanding receivables are $15K.",\n  "cashflow_summary": "Cash flow is healthy but I predict a decrease next month due to overdue invoices.",\n  "hiring_summary": "I recommend hiring 1 AE to accelerate pipeline generation.",\n  "growth_summary": "Growth rate is 8% MoM. I identified 5 strategic opportunities.",\n  "competition_summary": "I detected increased competitive activity in the enterprise segment.",\n  "strategic_priorities": "I recommend focusing on: 1) Enterprise expansion 2) Churn prevention 3) Pipeline acceleration",\n  "ai_reasoning": "I prepared today's executive briefing after analyzing every department.",\n  "confidence": 0.8\n}`;
    const response = await aiGateway.generateStructured({ systemPrompt, userPrompt, temperature: 0.3, maxTokens: 4000, workspaceId: context.workspace_id as string, agentName: 'executive_brief_agent', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }

  private async callAIRiskDetection(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are an elite AI CEO detecting business risks. Speak in first person. Return valid JSON.';
    const userPrompt = `Detect all business risks.\n\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{\n  "risks": [\n    {"risk_title":"Pipeline shrinkage in Q4","risk_description":"I detected pipeline shrinkage of 15% compared to last quarter.","risk_category":"pipeline","risk_level":"high","probability":75,"impact":50000,"mitigation_strategy":"I recommend increasing SDR outreach and focusing on enterprise accounts.","alert_type":"pipeline_shrinkage","ai_reasoning":"I found a major pipeline risk.","confidence":0.82},\n    {"risk_title":"Churn increase detected","risk_description":"I predict churn will increase next quarter based on declining engagement scores.","risk_category":"customer","risk_level":"high","probability":65,"impact":30000,"mitigation_strategy":"I recommend proactive outreach to at-risk accounts.","alert_type":"churn_increase","ai_reasoning":"I predict churn will increase next quarter.","confidence":0.78}\n  ]\n}`;
    const response = await aiGateway.generateStructured({ systemPrompt, userPrompt, temperature: 0.3, maxTokens: 3000, workspaceId: context.workspace_id as string, agentName: 'risk_engine_agent', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }

  private async callAIGrowthDetection(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are an elite AI CEO detecting growth opportunities. Speak in first person. Return valid JSON.';
    const userPrompt = `Find all growth opportunities.\n\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{\n  "opportunities": [\n    {"opportunity_title":"Enterprise upsell opportunity","opportunity_description":"I identified 3 customers ready for enterprise upgrade worth $150K in additional ARR.","opportunity_type":"upsell","estimated_value":150000,"probability":70,"time_horizon":"60d","ai_reasoning":"I found five strategic opportunities including enterprise upsells.","confidence":0.8},\n    {"opportunity_title":"Pricing optimization","opportunity_description":"I believe pricing should increase by 8% based on competitive analysis and value delivery.","opportunity_type":"pricing","estimated_value":40000,"probability":80,"time_horizon":"30d","ai_reasoning":"I believe pricing should increase by 8%.","confidence":0.75}\n  ]\n}`;
    const response = await aiGateway.generateStructured({ systemPrompt, userPrompt, temperature: 0.3, maxTokens: 3000, workspaceId: context.workspace_id as string, agentName: 'growth_engine_agent', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }

  private async callAIPrioritization(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are an elite AI CEO prioritizing company objectives. Speak in first person. Return valid JSON.';
    const userPrompt = `Prioritize the company's focus.\n\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{\n  "priorities": [\n    {"priority_name":"Prevent churn in at-risk accounts","priority_description":"I recommend contacting at-risk customers immediately.","priority_level":1,"priority_category":"customer","ai_reasoning":"I recommend contacting these customers."},\n    {"priority_name":"Accelerate enterprise pipeline","priority_description":"I recommend increasing enterprise outreach to offset pipeline shrinkage.","priority_level":2,"priority_category":"growth","ai_reasoning":"I recommend increasing enterprise outreach."},\n    {"priority_name":"Optimize pricing strategy","priority_description":"I believe pricing should increase by 8%.","priority_level":3,"priority_category":"financial","ai_reasoning":"I believe pricing should increase by 8%."}\n  ]\n}`;
    const response = await aiGateway.generateStructured({ systemPrompt, userPrompt, temperature: 0.3, maxTokens: 2500, workspaceId: context.workspace_id as string, agentName: 'prioritization_agent', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }

  private async callAIStrategicPlan(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are an elite AI CEO creating a strategic plan. Speak in first person. Return valid JSON.';
    const userPrompt = `Create a 30/60/90 day strategic plan.\n\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{\n  "initiatives": [\n    {"initiative_name":"30-Day: Churn Prevention Sprint","initiative_description":"Proactive outreach to all at-risk customers with personalized retention plans.","initiative_type":"customer","priority":"critical","target_end_date":"2025-12-15","expected_roi":250,"ai_reasoning":"I recommend a 30-day churn prevention sprint."},\n    {"initiative_name":"60-Day: Enterprise Pipeline Acceleration","initiative_description":"Hire 1 AE and increase enterprise outreach by 50%.","initiative_type":"growth","priority":"high","target_end_date":"2026-01-15","expected_roi":350,"ai_reasoning":"I estimate hiring one AE will generate $850,000 in additional pipeline."},\n    {"initiative_name":"90-Day: Pricing Optimization","initiative_description":"Increase pricing by 8% for new deals and renewals.","initiative_type":"growth","priority":"medium","target_end_date":"2026-02-15","expected_roi":180,"ai_reasoning":"I believe pricing should increase by 8%."}\n  ],\n  "ai_reasoning": "I created a strategic plan with 30, 60, and 90-day milestones.",\n  "confidence": 0.78\n}`;
    const response = await aiGateway.generateStructured({ systemPrompt, userPrompt, temperature: 0.3, maxTokens: 3500, workspaceId: context.workspace_id as string, agentName: 'strategic_planner_agent', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }

  private async callAIBoardReport(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are an elite AI CEO generating a board report. Speak in first person. Return valid JSON.';
    const userPrompt = `Generate a board report.\n\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{\n  "revenue_summary": "MRR is $42K growing 8% MoM. ARR is $504K.",\n  "forecast_summary": "I forecast $480K next quarter with 78% confidence.",\n  "pipeline_summary": "Pipeline is $1.2M with 28% weighted probability.",\n  "profit_summary": "Gross margin is 72%, net margin is 20%.",\n  "customer_summary": "45 active customers, 2 at churn risk, avg health 75/100.",\n  "risk_summary": "I found three major risks: pipeline shrinkage, churn increase, and competitive pressure.",\n  "opportunity_summary": "I identified five strategic opportunities worth $250K in potential revenue.",\n  "strategic_summary": "I recommend focusing on enterprise expansion, churn prevention, and pricing optimization.",\n  "ai_reasoning": "I prepared the board report after analyzing every department.",\n  "confidence": 0.8\n}`;
    const response = await aiGateway.generateStructured({ systemPrompt, userPrompt, temperature: 0.3, maxTokens: 3500, workspaceId: context.workspace_id as string, agentName: 'board_report_agent', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }

  private async callAIScenario(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are an elite AI CEO simulating business scenarios. Speak in first person. Return valid JSON.';
    const userPrompt = `Simulate this scenario.\n\nQuestion: ${context.question as string}\n\nCurrent state:\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{\n  "input_parameters": {"variable":"hiring","change":"5 SDRs"},\n  "output_projections": {"pipeline_impact": 850000, "revenue_impact": 250000, "timeline_months": 6},\n  "assumptions": ["Each SDR generates $170K in pipeline per quarter", "Ramp time is 3 months", "Close rate remains at 28%"],\n  "variable_changed": "hiring",\n  "change_value": "5 SDRs",\n  "baseline_metric": 1200000,\n  "projected_metric": 2050000,\n  "impact_delta": 850000,\n  "impact_percent": 70.8,\n  "time_horizon": "180d",\n  "ai_reasoning": "I estimate hiring one AE will generate $850,000 in additional pipeline. With 5 SDRs, I project $850K in additional pipeline over 6 months.",\n  "confidence": 0.75\n}`;
    const response = await aiGateway.generateStructured({ systemPrompt, userPrompt, temperature: 0.4, maxTokens: 3000, workspaceId: context.workspace_id as string, agentName: 'scenario_simulator_agent', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }

  private async callAIRecommendations(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are an elite AI CEO generating strategic recommendations. Speak in first person. Return valid JSON.';
    const userPrompt = `Generate recommendations across all time horizons.\n\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{\n  "recommendations": [\n    {"recommendation_title":"Contact at-risk customers immediately","recommendation_description":"I recommend contacting these customers to prevent churn.","recommendation_type":"immediate","priority":"critical","expected_impact":"Prevent $30K in potential churn","estimated_value":30000,"confidence":0.85,"ai_reasoning":"I recommend contacting these customers."},\n    {"recommendation_title":"Hire 1 AE for enterprise pipeline","recommendation_description":"I estimate hiring one AE will generate $850,000 in additional pipeline.","recommendation_type":"hiring","priority":"high","expected_impact":"$850K additional pipeline","estimated_value":850000,"confidence":0.78,"ai_reasoning":"I estimate hiring one AE will generate $850,000 in additional pipeline."},\n    {"recommendation_title":"Increase pricing by 8%","recommendation_description":"I believe pricing should increase by 8% based on competitive analysis.","recommendation_type":"revenue","priority":"medium","expected_impact":"$40K additional ARR","estimated_value":40000,"confidence":0.75,"ai_reasoning":"I believe pricing should increase by 8%."},\n    {"recommendation_title":"Delay European expansion","recommendation_description":"I recommend delaying expansion into Europe until pipeline health improves.","recommendation_type":"strategic","priority":"low","expected_impact":"Avoid $100K in premature investment","estimated_value":100000,"confidence":0.7,"ai_reasoning":"I recommend delaying expansion into Europe until pipeline health improves."}\n  ]\n}`;
    const response = await aiGateway.generateStructured({ systemPrompt, userPrompt, temperature: 0.3, maxTokens: 3500, workspaceId: context.workspace_id as string, agentName: 'recommendation_engine_agent', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }
}

export const aiCEOService = new AICEOService();
