// ============================================================
// CustomerSuccessService — Phase 13 AI Customer Success Brain
// ============================================================

import { supabase } from '@/lib/supabase';
import { aiGateway } from '@/services/ai/AIGateway';
import { knowledgeGraphService } from '@/services/knowledge-graph/KnowledgeGraphService';
import { memoryEngine } from '@/services/memory/MemoryEngine';
import type { CustomerSuccessCommandCenter } from '@/types/customer-success';

class CustomerSuccessService {
  // ----------------------------------------------------------
  // STEP 1: Sync customers from closed-won deals (Phase 12)
  // ----------------------------------------------------------

  async syncCustomers(workspaceId: string): Promise<void> {
    // Find closed-won deals that don't have a customer account yet
    const { data: wonDeals } = await supabase
      .from('pipeline_deals')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_closed', true)
      .eq('closed_status', 'won')
      .order('actual_close_date', { ascending: false })
      .limit(50);

    if (!wonDeals || wonDeals.length === 0) return;

    for (const deal of wonDeals) {
      const d = deal as Record<string, unknown>;
      const { data: existing } = await supabase
        .from('customer_accounts')
        .select('id')
        .eq('deal_id', d.id)
        .maybeSingle();
      if (existing) continue;

      const { data: company } = await supabase
        .from('companies')
        .select('name, industry, country, employee_count')
        .eq('id', d.company_id)
        .maybeSingle();
      const companyData = company as Record<string, unknown> | null;

      const contractValue = d.deal_value as number;
      const mrr = contractValue / 12;
      const arr = contractValue;
      const contractEnd = new Date();
      contractEnd.setFullYear(contractEnd.getFullYear() + 1);

      const { data: account } = await supabase.from('customer_accounts').insert({
        workspace_id: workspaceId,
        company_id: d.company_id as string | null,
        deal_id: d.id as string,
        account_name: d.company_name as string ?? d.deal_name as string,
        account_status: 'onboarding',
        contract_start_date: (d.actual_close_date as string) ?? new Date().toISOString().split('T')[0],
        contract_end_date: contractEnd.toISOString().split('T')[0],
        contract_value: contractValue,
        mrr, arr,
        industry: (companyData?.industry as string) ?? (d.industry as string) ?? null,
        geography: (companyData?.country as string) ?? (d.geography as string) ?? null,
        employee_count: (companyData?.employee_count as number) ?? null,
        executive_sponsor: d.contact_name as string ?? null,
        health_score: 60,
        churn_risk_score: 10,
        expansion_score: 40,
        renewal_probability: 80,
        ai_reasoning: 'Auto-created from closed-won deal. Customer is in onboarding phase.',
        ai_confidence: 0.8,
      }).select('*').single();

      if (account) {
        const acct = account as Record<string, string>;
        // Create journey entry
        await supabase.from('customer_journey').insert({
          workspace_id: workspaceId,
          customer_account_id: acct.id,
          journey_stage: 'onboarding',
          stage_entered_at: new Date().toISOString(),
        });

        // Create lifecycle entry
        await supabase.from('customer_lifecycle').insert({
          workspace_id: workspaceId,
          customer_account_id: acct.id,
          lifecycle_stage: 'onboarding',
          stage_start_date: new Date().toISOString().split('T')[0],
          is_current: true,
        });

        // Auto-start onboarding
        await this.startOnboarding(workspaceId, acct.id);

        // Create renewal pipeline entry
        await supabase.from('renewal_pipeline').insert({
          workspace_id: workspaceId,
          customer_account_id: acct.id,
          renewal_date: contractEnd.toISOString().split('T')[0],
          renewal_value: contractValue,
          renewal_probability: 80,
          renewal_status: 'pending',
          renewal_health: 'healthy',
          days_to_renewal: 365,
          ai_reasoning: 'Auto-created from closed-won deal. Renewal due in 12 months.',
          ai_confidence: 0.8,
        });

        // Populate knowledge graph
        try {
          await knowledgeGraphService.ingestBatch({
            workspaceId,
            entities: [{
              nodeType: 'customer' as never,
              externalId: `customer_${acct.id}`,
              displayName: d.company_name as string ?? d.deal_name as string,
              properties: { arr, mrr, healthScore: 60, status: 'onboarding' },
              confidenceScore: 0.8,
            }],
            relationships: [],
          });
        } catch { /* best-effort */ }
      }
    }
  }

  // ----------------------------------------------------------
  // STEP 2: Start onboarding for a new customer
  // ----------------------------------------------------------

  async startOnboarding(workspaceId: string, accountId: string): Promise<void> {
    const { data: existing } = await supabase
      .from('onboarding_projects')
      .select('id')
      .eq('customer_account_id', accountId)
      .maybeSingle();
    if (existing) return;

    const { data: account } = await supabase
      .from('customer_accounts')
      .select('account_name, contract_value, industry')
      .eq('id', accountId)
      .maybeSingle();
    const acct = account as Record<string, unknown> | null;

    const { data: project } = await supabase.from('onboarding_projects').insert({
      workspace_id: workspaceId,
      customer_account_id: accountId,
      project_name: `Onboarding: ${acct?.account_name ?? 'New Customer'}`,
      project_status: 'in_progress',
      start_date: new Date().toISOString().split('T')[0],
      target_completion_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      progress_percentage: 0,
      priority: 'high',
      ai_reasoning: 'Auto-started onboarding for new customer.',
    }).select('*').single();

    if (project) {
      const proj = project as Record<string, string>;
      // Create default onboarding tasks
      const defaultTasks = [
        { task_name: 'Welcome call & kickoff meeting', task_type: 'meeting', order: 1, milestone: true },
        { task_name: 'Product setup & configuration', task_type: 'setup', order: 2, milestone: false },
        { task_name: 'User training session', task_type: 'training', order: 3, milestone: false },
        { task_name: 'Data migration & integration', task_type: 'setup', order: 4, milestone: false },
        { task_name: 'First value realization check', task_type: 'review', order: 5, milestone: true },
        { task_name: 'Executive sponsor alignment', task_type: 'meeting', order: 6, milestone: false },
        { task_name: '30-day success review', task_type: 'review', order: 7, milestone: true },
      ];
      for (const t of defaultTasks) {
        await supabase.from('onboarding_tasks').insert({
          workspace_id: workspaceId,
          onboarding_project_id: proj.id,
          task_name: t.task_name,
          task_status: 'pending',
          task_order: t.order,
          is_milestone: t.milestone,
          due_date: new Date(Date.now() + t.order * 5 * 86400000).toISOString().split('T')[0],
        });
      }

      // Create default milestones
      const defaultMilestones = [
        { name: 'Contract Signed', order: 1 },
        { name: 'Kickoff Complete', order: 2 },
        { name: 'Product Deployed', order: 3 },
        { name: 'First Value Realized', order: 4 },
        { name: 'Onboarding Complete', order: 5 },
      ];
      for (const m of defaultMilestones) {
        await supabase.from('onboarding_milestones').insert({
          workspace_id: workspaceId,
          onboarding_project_id: proj.id,
          milestone_name: m.name,
          milestone_order: m.order,
          is_achieved: m.order === 1,
          achieved_date: m.order === 1 ? new Date().toISOString() : null,
        });
      }
    }
  }

  // ----------------------------------------------------------
  // STEP 3: Calculate Health Score (AI)
  // ----------------------------------------------------------

  async calculateHealthScore(workspaceId: string, accountId: string): Promise<void> {
    const [account, engagements, meetings, conversations, feedback, renewals, onboarding] = await Promise.all([
      supabase.from('customer_accounts').select('*').eq('id', accountId).maybeSingle(),
      supabase.from('customer_engagement').select('*').eq('customer_account_id', accountId).order('engagement_date', { ascending: false }).limit(20),
      supabase.from('meeting_scheduler').select('*').eq('company_id', (await supabase.from('customer_accounts').select('company_id').eq('id', accountId).maybeSingle()).data?.[0] as never ?? null).order('created_at', { ascending: false }).limit(10),
      supabase.from('conversations').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('customer_feedback').select('*').eq('customer_account_id', accountId).order('feedback_date', { ascending: false }).limit(10),
      supabase.from('renewal_pipeline').select('*').eq('customer_account_id', accountId).limit(1).maybeSingle(),
      supabase.from('onboarding_projects').select('*').eq('customer_account_id', accountId).limit(1).maybeSingle(),
    ]);

    const acct = account.data as Record<string, unknown> | null;
    if (!acct) return;

    const now = Date.now();
    const lastContact = acct.last_contact_at as string | null;
    const daysSinceContact = lastContact ? Math.floor((now - new Date(lastContact).getTime()) / 86400000) : 999;
    const lastMeeting = acct.last_meeting_at as string | null;
    const daysSinceMeeting = lastMeeting ? Math.floor((now - new Date(lastMeeting).getTime()) / 86400000) : 999;

    // Engagement score: based on recent interactions
    const recentEngagements = (engagements.data ?? []) as Array<Record<string, unknown>>;
    const engagementScore = Math.min(100, Math.max(0, 100 - daysSinceContact * 3));

    // Communication score: based on response patterns
    const communicationScore = Math.min(100, Math.max(0, 100 - daysSinceContact * 2));

    // Product adoption: proxy from onboarding progress
    const onboardingData = onboarding.data as Record<string, unknown> | null;
    const adoptionScore = onboardingData ? (onboardingData.progress_percentage as number) : 50;

    // Relationship score: based on meeting frequency
    const relationshipScore = Math.min(100, Math.max(0, 100 - daysSinceMeeting * 2));

    // Renewal probability
    const renewalData = renewals.data as Record<string, unknown> | null;
    const renewalProbability = (renewalData?.renewal_probability as number) ?? 50;

    // Sentiment from feedback
    const feedbackData = (feedback.data ?? []) as Array<Record<string, unknown>>;
    const positiveCount = feedbackData.filter((f) => f.sentiment === 'positive').length;
    const negativeCount = feedbackData.filter((f) => f.sentiment === 'negative').length;
    const satisfactionScore = feedbackData.length > 0 ? 50 + (positiveCount - negativeCount) * 10 : 50;

    // Churn probability
    const churnProbability = Math.max(0, Math.min(100, (100 - engagementScore) * 0.3 + (100 - satisfactionScore) * 0.3 + (100 - adoptionScore) * 0.2 + (daysSinceContact > 30 ? 20 : 0)));

    // AI health assessment
    const result = await this.callAIHealth({
      account: acct,
      engagements: recentEngagements,
      daysSinceContact,
      daysSinceMeeting,
      engagementScore,
      communicationScore,
      adoptionScore,
      relationshipScore,
      satisfactionScore,
      churnProbability,
      renewalProbability,
    });

    const overallHealth = result.overall_health_score ?? Math.round((engagementScore + relationshipScore + adoptionScore + communicationScore + satisfactionScore) / 5);

    // Store health record
    await supabase.from('customer_health').insert({
      workspace_id: workspaceId,
      customer_account_id: accountId,
      health_date: new Date().toISOString().split('T')[0],
      overall_health_score: overallHealth,
      relationship_score: relationshipScore,
      engagement_score: engagementScore,
      product_adoption_score: adoptionScore,
      communication_score: communicationScore,
      expansion_score: acct.expansion_score as number,
      renewal_probability: renewalProbability,
      churn_probability: churnProbability,
      executive_relationship_score: 50,
      customer_satisfaction_score: satisfactionScore,
      health_factors: { daysSinceContact, daysSinceMeeting, engagementCount: recentEngagements.length },
      ai_reasoning: result.ai_reasoning ?? '',
      ai_confidence: result.confidence ?? 0.7,
      supporting_evidence: result.supporting_evidence ?? [],
      recommended_actions: result.recommended_actions ?? [],
    });

    // Update account
    await supabase.from('customer_accounts').update({
      health_score: overallHealth,
      churn_risk_score: Math.round(churnProbability),
      renewal_probability: renewalProbability,
      last_health_check: new Date().toISOString(),
      ai_reasoning: result.ai_reasoning ?? '',
      ai_confidence: result.confidence ?? 0.7,
    }).eq('id', accountId);

    // Store in memory
    try {
      await memoryEngine.store({
        entityType: 'customer_health', entityId: accountId,
        memoryType: 'customer_health',
        title: `Health score for ${acct.account_name as string}: ${overallHealth}/100`,
        summary: result.ai_reasoning ?? '',
        content: { overallHealth, churnProbability, engagementScore, satisfactionScore },
        confidenceScore: result.confidence ?? 0.7, importanceScore: 0.85, workspaceId,
      });
    } catch { /* best-effort */ }

    // Detect churn signals
    if (daysSinceContact > 21) {
      await this.createChurnSignal(workspaceId, accountId, 'declining_engagement', `No contact for ${daysSinceContact} days`, 70);
    }
    if (daysSinceMeeting > 60) {
      await this.createChurnSignal(workspaceId, accountId, 'no_meetings', `No meeting for ${daysSinceMeeting} days`, 60);
    }
    if (negativeCount > positiveCount && feedbackData.length > 0) {
      await this.createChurnSignal(workspaceId, accountId, 'negative_sentiment', 'Negative sentiment detected in recent feedback', 65);
    }
    if (churnProbability > 50) {
      await this.createChurnSignal(workspaceId, accountId, 'executive_disengagement', 'High churn probability detected', 80);
    }
  }

  // ----------------------------------------------------------
  // STEP 4: Predict Churn (AI)
  // ----------------------------------------------------------

  async predictChurn(workspaceId: string, accountId: string): Promise<void> {
    const [account, health, signals, engagements] = await Promise.all([
      supabase.from('customer_accounts').select('*').eq('id', accountId).maybeSingle(),
      supabase.from('customer_health').select('*').eq('customer_account_id', accountId).order('health_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('churn_signals').select('*').eq('customer_account_id', accountId).eq('is_active', true),
      supabase.from('customer_engagement').select('*').eq('customer_account_id', accountId).order('engagement_date', { ascending: false }).limit(30),
    ]);

    const acct = account.data as Record<string, unknown> | null;
    if (!acct) return;

    const healthData = health.data as Record<string, unknown> | null;
    const activeSignals = (signals.data ?? []) as Array<Record<string, unknown>>;

    const result = await this.callAIChurn({
      account: acct,
      health: healthData,
      activeSignals,
      engagementCount: (engagements.data ?? []).length,
    });

    const risk30 = result.churn_probability_30d ?? 0;
    const risk60 = result.churn_probability_60d ?? 0;
    const risk90 = result.churn_probability_90d ?? 0;
    const riskAnnual = result.churn_probability_annual ?? 0;
    const maxRisk = Math.max(risk30, risk60, risk90, riskAnnual);
    const riskLevel = maxRisk > 70 ? 'critical' : maxRisk > 50 ? 'high' : maxRisk > 25 ? 'medium' : 'low';

    await supabase.from('churn_predictions').insert({
      workspace_id: workspaceId,
      customer_account_id: accountId,
      prediction_date: new Date().toISOString().split('T')[0],
      churn_probability_30d: risk30,
      churn_probability_60d: risk60,
      churn_probability_90d: risk90,
      churn_probability_annual: riskAnnual,
      churn_risk_level: riskLevel,
      ai_reasoning: result.ai_reasoning ?? '',
      ai_confidence: result.confidence ?? 0.7,
      supporting_signals: result.supporting_signals ?? [],
      mitigation_plan: result.mitigation_plan ?? '',
      recommended_actions: result.recommended_actions ?? [],
    });

    // Update account churn risk
    await supabase.from('customer_accounts').update({
      churn_risk_score: Math.round(maxRisk * 100),
    }).eq('id', accountId);

    // Create customer risk record if high
    if (riskLevel === 'high' || riskLevel === 'critical') {
      await supabase.from('customer_risk').insert({
        workspace_id: workspaceId,
        customer_account_id: accountId,
        risk_type: 'churn',
        risk_level: riskLevel,
        risk_score: Math.round(maxRisk * 100),
        risk_description: result.ai_reasoning ?? 'High churn risk detected',
        mitigation_plan: result.mitigation_plan ?? '',
        recommended_actions: result.recommended_actions ?? [],
        ai_confidence: result.confidence ?? 0.7,
      });
    }

    // Store in memory
    try {
      await memoryEngine.store({
        entityType: 'churn_prediction', entityId: accountId,
        memoryType: 'churn_prediction',
        title: `Churn prediction for ${acct.account_name as string}: ${riskLevel} (${Math.round(maxRisk * 100)}%)`,
        summary: result.ai_reasoning ?? '',
        content: { risk30, risk60, risk90, riskAnnual, riskLevel, mitigation: result.mitigation_plan },
        confidenceScore: result.confidence ?? 0.7, importanceScore: 0.9, workspaceId,
      });
    } catch { /* best-effort */ }
  }

  // ----------------------------------------------------------
  // STEP 5: Detect Expansion Opportunities (AI)
  // ----------------------------------------------------------

  async detectExpansionOpportunity(workspaceId: string, accountId: string): Promise<void> {
    const [account, health, booked, meetings] = await Promise.all([
      supabase.from('customer_accounts').select('*').eq('id', accountId).maybeSingle(),
      supabase.from('customer_health').select('*').eq('customer_account_id', accountId).order('health_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('booked_revenue').select('*').eq('company_id', (await supabase.from('customer_accounts').select('company_id').eq('id', accountId).maybeSingle()).data?.[0] as never ?? null).order('revenue_date', { ascending: false }).limit(10),
      supabase.from('meeting_scheduler').select('*').order('created_at', { ascending: false }).limit(10),
    ]);

    const acct = account.data as Record<string, unknown> | null;
    if (!acct) return;
    const healthData = health.data as Record<string, unknown> | null;

    // Only detect expansion for healthy accounts
    if ((acct.health_score as number) < 60) return;

    const result = await this.callAIExpansion({
      account: acct,
      health: healthData,
      bookedRevenue: booked.data ?? [],
      meetings: meetings.data ?? [],
    });

    // Store expansion scores
    await supabase.from('expansion_scores').insert({
      workspace_id: workspaceId,
      customer_account_id: accountId,
      score_date: new Date().toISOString().split('T')[0],
      overall_expansion_score: result.overall_expansion_score ?? 50,
      upsell_score: result.upsell_score ?? 50,
      cross_sell_score: result.cross_sell_score ?? 50,
      new_department_score: result.new_department_score ?? 50,
      new_geography_score: result.new_geography_score ?? 50,
      enterprise_score: result.enterprise_score ?? 50,
      scoring_factors: result.scoring_factors ?? {},
      ai_reasoning: result.ai_reasoning ?? '',
      ai_confidence: result.confidence ?? 0.7,
    });

    // Create expansion opportunities
    if (result.opportunities?.length) {
      for (const opp of result.opportunities as Array<Record<string, unknown>>) {
        await supabase.from('expansion_opportunities').insert({
          workspace_id: workspaceId,
          customer_account_id: accountId,
          expansion_type: opp.expansion_type ?? 'upsell',
          opportunity_name: opp.opportunity_name ?? 'Expansion Opportunity',
          opportunity_description: opp.opportunity_description ?? null,
          estimated_value: opp.estimated_value ?? 0,
          probability: opp.probability ?? 50,
          likelihood_to_close: opp.likelihood_to_close ?? 50,
          recommended_timing: opp.recommended_timing ?? null,
          decision_makers: opp.decision_makers ?? [],
          supporting_reasons: opp.supporting_reasons ?? [],
          ai_reasoning: opp.ai_reasoning ?? result.ai_reasoning ?? '',
          ai_confidence: result.confidence ?? 0.7,
        });

        // Also create specific upsell or cross-sell
        if (opp.expansion_type === 'upsell') {
          await supabase.from('upsell_opportunities').insert({
            workspace_id: workspaceId,
            customer_account_id: accountId,
            opportunity_name: opp.opportunity_name as string,
            opportunity_description: opp.opportunity_description as string,
            estimated_value: opp.estimated_value as number,
            probability: opp.probability as number,
            likelihood_to_close: opp.likelihood_to_close as number,
            recommended_timing: opp.recommended_timing as string,
            decision_makers: opp.decision_makers ?? [],
            supporting_reasons: opp.supporting_reasons ?? [],
            expansion_score: result.upsell_score as number,
            ai_reasoning: opp.ai_reasoning as string ?? result.ai_reasoning ?? '',
            ai_confidence: result.confidence as number ?? 0.7,
          });
        } else if (opp.expansion_type === 'cross_sell') {
          await supabase.from('cross_sell_opportunities').insert({
            workspace_id: workspaceId,
            customer_account_id: accountId,
            opportunity_name: opp.opportunity_name as string,
            opportunity_description: opp.opportunity_description as string,
            estimated_value: opp.estimated_value as number,
            probability: opp.probability as number,
            likelihood_to_close: opp.likelihood_to_close as number,
            recommended_timing: opp.recommended_timing as string,
            decision_makers: opp.decision_makers ?? [],
            supporting_reasons: opp.supporting_reasons ?? [],
            expansion_score: result.cross_sell_score as number,
            ai_reasoning: opp.ai_reasoning as string ?? result.ai_reasoning ?? '',
            ai_confidence: result.confidence as number ?? 0.7,
          });
        }
      }
    }

    // Update account expansion score
    await supabase.from('customer_accounts').update({
      expansion_score: result.overall_expansion_score ?? 50,
    }).eq('id', accountId);

    // Store in memory
    try {
      await memoryEngine.store({
        entityType: 'expansion_opportunity', entityId: accountId,
        memoryType: 'expansion_opportunity',
        title: `Expansion score for ${acct.account_name as string}: ${result.overall_expansion_score ?? 50}/100`,
        summary: result.ai_reasoning ?? '',
        content: { opportunities: result.opportunities, scores: { upsell: result.upsell_score, cross_sell: result.cross_sell_score } },
        confidenceScore: result.confidence ?? 0.7, importanceScore: 0.85, workspaceId,
      });
    } catch { /* best-effort */ }
  }

  // ----------------------------------------------------------
  // STEP 6: Detect Renewal Risk
  // ----------------------------------------------------------

  async detectRenewalRisk(workspaceId: string): Promise<void> {
    const { data: renewals } = await supabase
      .from('renewal_pipeline')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('renewal_status', ['pending', 'in_progress', 'at_risk'])
      .order('renewal_date', { ascending: true });

    if (!renewals) return;

    for (const renewal of renewals) {
      const r = renewal as Record<string, unknown>;
      const renewalDate = new Date(r.renewal_date as string);
      const daysToRenewal = Math.floor((renewalDate.getTime() - Date.now()) / 86400000);

      // Update days to renewal
      await supabase.from('renewal_pipeline').update({
        days_to_renewal: daysToRenewal,
      }).eq('id', r.id);

      // Check health score of the account
      const { data: account } = await supabase
        .from('customer_accounts')
        .select('health_score, churn_risk_score, account_name')
        .eq('id', r.customer_account_id)
        .maybeSingle();
      const acct = account as Record<string, unknown> | null;

      if (!acct) continue;

      let renewalHealth = 'healthy';
      let renewalProbability = r.renewal_probability as number;

      if ((acct.health_score as number) < 40 || (acct.churn_risk_score as number) > 50) {
        renewalHealth = 'critical';
        renewalProbability = Math.min(renewalProbability, 30);
      } else if ((acct.health_score as number) < 60) {
        renewalHealth = 'at_risk';
        renewalProbability = Math.min(renewalProbability, 50);
      } else if ((acct.health_score as number) < 75) {
        renewalHealth = 'watch';
      }

      await supabase.from('renewal_pipeline').update({
        renewal_health: renewalHealth,
        renewal_probability: renewalProbability,
      }).eq('id', r.id);

      // Create renewal reminder if approaching
      if (daysToRenewal <= 90 && daysToRenewal > 0) {
        const reminderType = daysToRenewal <= 14 ? 'final' : daysToRenewal <= 30 ? 'urgent' : daysToRenewal <= 60 ? 'upcoming' : 'upcoming';
        await supabase.from('renewal_reminders').insert({
          workspace_id: workspaceId,
          renewal_pipeline_id: r.id as string,
          reminder_date: new Date().toISOString().split('T')[0],
          reminder_type: reminderType,
          reminder_message: `Renewal for ${acct.account_name as string} due in ${daysToRenewal} days. Value: $${(r.renewal_value as number).toLocaleString()}.`,
        });
      }

      // Create renewal tasks if at risk
      if (renewalHealth === 'at_risk' || renewalHealth === 'critical') {
        await supabase.from('renewal_tasks').insert({
          workspace_id: workspaceId,
          renewal_pipeline_id: r.id as string,
          task_name: `Executive renewal review for ${acct.account_name as string}`,
          task_type: 'executive',
          task_status: 'pending',
          priority: renewalHealth === 'critical' ? 'critical' : 'high',
          due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        });
      }
    }
  }

  // ----------------------------------------------------------
  // STEP 7: Generate Customer Success Plan (AI)
  // ----------------------------------------------------------

  async generateCustomerSuccessPlan(workspaceId: string, accountId: string): Promise<void> {
    const [account, health, onboarding, renewals, goals] = await Promise.all([
      supabase.from('customer_accounts').select('*').eq('id', accountId).maybeSingle(),
      supabase.from('customer_health').select('*').eq('customer_account_id', accountId).order('health_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('onboarding_projects').select('*').eq('customer_account_id', accountId).limit(1).maybeSingle(),
      supabase.from('renewal_pipeline').select('*').eq('customer_account_id', accountId).limit(1).maybeSingle(),
      supabase.from('success_goals').select('*').eq('customer_account_id', accountId),
    ]);

    const acct = account.data as Record<string, unknown> | null;
    if (!acct) return;

    const result = await this.callAISuccessPlan({
      account: acct,
      health: health.data,
      onboarding: onboarding.data,
      renewals: renewals.data,
      existingGoals: goals.data ?? [],
    });

    await supabase.from('customer_success_plans').insert({
      workspace_id: workspaceId,
      customer_account_id: accountId,
      plan_type: (acct.account_tier as string) === 'enterprise' ? 'enterprise' : (acct.health_score as number) < 50 ? 'at_risk' : 'standard',
      plan_status: 'active',
      plan_summary: result.plan_summary ?? '',
      success_criteria: result.success_criteria ?? [],
      key_objectives: result.key_objectives ?? [],
      action_items: result.action_items ?? [],
      ai_generated: true,
      ai_reasoning: result.ai_reasoning ?? '',
      ai_confidence: result.confidence ?? 0.8,
      review_frequency: (acct.account_tier as string) === 'enterprise' ? 'monthly' : 'quarterly',
      next_review_date: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
    });

    // Store in memory
    try {
      await memoryEngine.store({
        entityType: 'success_plan', entityId: accountId,
        memoryType: 'customer_success_plan',
        title: `Success plan for ${acct.account_name as string}`,
        summary: result.plan_summary ?? '',
        content: result, confidenceScore: result.confidence ?? 0.8,
        importanceScore: 0.85, workspaceId,
      });
    } catch { /* best-effort */ }
  }

  // ----------------------------------------------------------
  // STEP 8: Generate Executive Business Review (AI)
  // ----------------------------------------------------------

  async generateExecutiveBusinessReview(workspaceId: string, accountId: string): Promise<void> {
    const [account, health, booked, meetings, renewals, expansion, churn] = await Promise.all([
      supabase.from('customer_accounts').select('*').eq('id', accountId).maybeSingle(),
      supabase.from('customer_health').select('*').eq('customer_account_id', accountId).order('health_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('booked_revenue').select('*').eq('company_id', (await supabase.from('customer_accounts').select('company_id').eq('id', accountId).maybeSingle()).data?.[0] as never ?? null).order('revenue_date', { ascending: false }).limit(30),
      supabase.from('meeting_scheduler').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('renewal_pipeline').select('*').eq('customer_account_id', accountId).limit(1).maybeSingle(),
      supabase.from('expansion_opportunities').select('*').eq('customer_account_id', accountId).limit(5),
      supabase.from('churn_predictions').select('*').eq('customer_account_id', accountId).order('prediction_date', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const acct = account.data as Record<string, unknown> | null;
    if (!acct) return;

    const result = await this.callAIExecutiveReview({
      account: acct,
      health: health.data,
      bookedRevenue: booked.data ?? [],
      meetings: meetings.data ?? [],
      renewals: renewals.data,
      expansion: expansion.data ?? [],
      churn: churn.data,
    });

    await supabase.from('executive_business_reviews').insert({
      workspace_id: workspaceId,
      customer_account_id: accountId,
      review_date: new Date().toISOString().split('T')[0],
      review_status: 'completed',
      review_type: 'qbr',
      executive_summary: result.executive_summary ?? '',
      key_achievements: result.key_achievements ?? [],
      key_challenges: result.key_challenges ?? [],
      roi_analysis: result.roi_analysis ?? {},
      value_delivered: result.value_delivered ?? '',
      future_roadmap: result.future_roadmap ?? [],
      action_items: result.action_items ?? [],
      attendees: result.attendees ?? [],
      ai_generated: true,
      ai_reasoning: result.ai_reasoning ?? '',
      ai_confidence: result.confidence ?? 0.85,
      next_review_date: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
    });

    // Update last QBR date
    await supabase.from('customer_accounts').update({
      last_qbr_at: new Date().toISOString(),
    }).eq('id', accountId);

    // Store in memory
    try {
      await memoryEngine.store({
        entityType: 'executive_review', entityId: accountId,
        memoryType: 'executive_business_review',
        title: `EBR for ${acct.account_name as string}`,
        summary: result.executive_summary ?? '',
        content: result, confidenceScore: result.confidence ?? 0.85,
        importanceScore: 0.9, workspaceId,
      });
    } catch { /* best-effort */ }
  }

  // ----------------------------------------------------------
  // STEP 9: Generate Referral Recommendations (AI)
  // ----------------------------------------------------------

  async generateReferralRecommendations(workspaceId: string, accountId: string): Promise<void> {
    const { data: account } = await supabase
      .from('customer_accounts')
      .select('*')
      .eq('id', accountId)
      .maybeSingle();
    const acct = account as Record<string, unknown> | null;
    if (!acct || (acct.health_score as number) < 70) return;

    const result = await this.callAIReferral({ account: acct });

    if (result.referrals?.length) {
      for (const ref of result.referrals as Array<Record<string, unknown>>) {
        await supabase.from('referral_opportunities').insert({
          workspace_id: workspaceId,
          customer_account_id: accountId,
          referral_target_company: ref.target_company ?? null,
          referral_target_contact: ref.target_contact ?? null,
          referral_value: ref.estimated_value ?? 0,
          referral_probability: ref.probability ?? 50,
          ai_reasoning: ref.reasoning ?? '',
          ai_confidence: result.confidence ?? 0.7,
        });
      }
    }

    // Identify champions
    if (result.champions?.length) {
      for (const ch of result.champions as Array<Record<string, unknown>>) {
        await supabase.from('customer_champions').insert({
          workspace_id: workspaceId,
          customer_account_id: accountId,
          champion_name: ch.name ?? '',
          champion_title: ch.title ?? null,
          champion_email: ch.email ?? null,
          champion_score: ch.score ?? 70,
          advocacy_type: ch.advocacy_type ?? 'reference',
          engagement_level: ch.engagement_level ?? 'high',
          ai_reasoning: ch.reasoning ?? '',
        });
      }
    }
  }

  // ----------------------------------------------------------
  // STEP 10: Generate Case Study Recommendations (AI)
  // ----------------------------------------------------------

  async generateCaseStudyRecommendations(workspaceId: string, accountId: string): Promise<void> {
    const { data: account } = await supabase
      .from('customer_accounts')
      .select('*')
      .eq('id', accountId)
      .maybeSingle();
    const acct = account as Record<string, unknown> | null;
    if (!acct || (acct.health_score as number) < 75) return;

    const result = await this.callAICaseStudy({ account: acct });

    if (result.case_study) {
      await supabase.from('case_studies_generated').insert({
        workspace_id: workspaceId,
        customer_account_id: accountId,
        case_study_title: result.case_study.title ?? `Case Study: ${acct.account_name as string}`,
        case_study_content: result.case_study.content ?? '',
        case_study_summary: result.case_study.summary ?? '',
        key_results: result.case_study.key_results ?? [],
        industry: acct.industry as string,
        company_size: acct.employee_count as unknown as string,
        use_case: result.case_study.use_case ?? null,
        ai_generated: true,
        ai_reasoning: result.case_study.reasoning ?? '',
        ai_confidence: result.confidence ?? 0.8,
      });
    }

    if (result.testimonial) {
      await supabase.from('customer_testimonials').insert({
        workspace_id: workspaceId,
        customer_account_id: accountId,
        testimonial_text: result.testimonial.text ?? '',
        testimonial_author: result.testimonial.author ?? acct.executive_sponsor,
        testimonial_title: result.testimonial.title ?? null,
        testimonial_type: 'written',
        ai_generated: true,
        ai_reasoning: result.testimonial.reasoning ?? '',
      });
    }
  }

  // ----------------------------------------------------------
  // STEP 11: Generate Customer Insights (AI)
  // ----------------------------------------------------------

  async generateCustomerInsights(workspaceId: string): Promise<void> {
    const { data: accounts } = await supabase
      .from('customer_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('health_score', { ascending: true });

    if (!accounts || accounts.length === 0) return;

    const result = await this.callAICustomerInsights({
      accounts,
    });

    // Store insights as revenue insights (reusing existing table)
    if (result.insights?.length) {
      for (const ins of result.insights as Array<Record<string, unknown>>) {
        await supabase.from('revenue_insights').insert({
          workspace_id: workspaceId,
          insight_type: ins.insight_type ?? 'recommendation',
          insight_title: ins.insight_title ?? 'Customer Insight',
          insight_text: ins.insight_text ?? '',
          insight_data: ins.insight_data ?? {},
          severity: ins.severity ?? 'info',
          confidence: ins.confidence ?? 0.7,
        });
      }
    }
  }

  // ----------------------------------------------------------
  // STEP 12: Generate Renewal Forecast (AI)
  // ----------------------------------------------------------

  async generateRenewalForecast(workspaceId: string): Promise<void> {
    const { data: renewals } = await supabase
      .from('renewal_pipeline')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('renewal_status', ['pending', 'in_progress', 'at_risk'])
      .order('renewal_date', { ascending: true });

    if (!renewals) return;

    const now = new Date();
    const quarterEnd = new Date(now.getFullYear(), now.getMonth() + 3, 0);

    const quarterRenewals = renewals.filter((r) => {
      const rd = new Date((r as Record<string, string>).renewal_date);
      return rd >= now && rd <= quarterEnd;
    });

    const totalValue = quarterRenewals.reduce((s, r) => s + (r as Record<string, number>).renewal_value, 0);
    const expectedValue = quarterRenewals.reduce((s, r) => s + (r as Record<string, number>).renewal_value * ((r as Record<string, number>).renewal_probability / 100), 0);
    const atRiskValue = quarterRenewals.filter((r) => ['at_risk', 'critical'].includes((r as Record<string, string>).renewal_health)).reduce((s, r) => s + (r as Record<string, number>).renewal_value, 0);
    const avgProb = quarterRenewals.length > 0 ? quarterRenewals.reduce((s, r) => s + (r as Record<string, number>).renewal_probability, 0) / quarterRenewals.length : 0;

    const result = await this.callAIRenewalForecast({
      renewals: quarterRenewals,
      totalValue,
      expectedValue,
      atRiskValue,
    });

    await supabase.from('renewal_forecasts').insert({
      workspace_id: workspaceId,
      forecast_period: 'quarterly',
      period_start: now.toISOString().split('T')[0],
      period_end: quarterEnd.toISOString().split('T')[0],
      total_renewal_value: totalValue,
      expected_renewal_value: expectedValue,
      at_risk_value: atRiskValue,
      renewal_count: quarterRenewals.length,
      avg_renewal_probability: avgProb,
      ai_reasoning: result.ai_reasoning ?? '',
      ai_confidence: result.confidence ?? 0.75,
    });
  }

  // ----------------------------------------------------------
  // STEP 13: Load full Command Center dashboard
  // ----------------------------------------------------------

  async loadCommandCenter(workspaceId: string): Promise<CustomerSuccessCommandCenter> {
    const [accounts, healthRecords, journey, onboardingProjects, onboardingTasks, onboardingMilestones, successPlans, successGoals, executiveReviews, risks, sentiment, feedback, engagement, renewals, renewalForecasts, renewalTasks, renewalReminders, renewalHistory, upsell, crossSell, expansion, expansionScores, churnPredictions, churnSignals, referrals, testimonials, caseStudies, champions] = await Promise.all([
      supabase.from('customer_accounts').select('*').eq('workspace_id', workspaceId).order('health_score', { ascending: true }),
      supabase.from('customer_health').select('*').eq('workspace_id', workspaceId).order('health_date', { ascending: false }).limit(50),
      supabase.from('customer_journey').select('*').eq('workspace_id', workspaceId).order('stage_entered_at', { ascending: false }).limit(50),
      supabase.from('onboarding_projects').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      supabase.from('onboarding_tasks').select('*').eq('workspace_id', workspaceId).order('task_order', { ascending: true }).limit(50),
      supabase.from('onboarding_milestones').select('*').eq('workspace_id', workspaceId).order('milestone_order', { ascending: true }),
      supabase.from('customer_success_plans').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      supabase.from('success_goals').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      supabase.from('executive_business_reviews').select('*').eq('workspace_id', workspaceId).order('review_date', { ascending: false }).limit(20),
      supabase.from('customer_risk').select('*').eq('workspace_id', workspaceId).eq('is_resolved', false).order('detected_at', { ascending: false }).limit(20),
      supabase.from('customer_sentiment').select('*').eq('workspace_id', workspaceId).order('sentiment_date', { ascending: false }).limit(20),
      supabase.from('customer_feedback').select('*').eq('workspace_id', workspaceId).order('feedback_date', { ascending: false }).limit(20),
      supabase.from('customer_engagement').select('*').eq('workspace_id', workspaceId).order('engagement_date', { ascending: false }).limit(30),
      supabase.from('renewal_pipeline').select('*').eq('workspace_id', workspaceId).order('renewal_date', { ascending: true }),
      supabase.from('renewal_forecasts').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(5),
      supabase.from('renewal_tasks').select('*').eq('workspace_id', workspaceId).eq('task_status', 'pending').order('due_date', { ascending: true }).limit(20),
      supabase.from('renewal_reminders').select('*').eq('workspace_id', workspaceId).eq('is_sent', false).order('reminder_date', { ascending: true }).limit(20),
      supabase.from('renewal_history').select('*').eq('workspace_id', workspaceId).order('renewal_date', { ascending: false }).limit(20),
      supabase.from('upsell_opportunities').select('*').eq('workspace_id', workspaceId).order('estimated_value', { ascending: false }).limit(20),
      supabase.from('cross_sell_opportunities').select('*').eq('workspace_id', workspaceId).order('estimated_value', { ascending: false }).limit(20),
      supabase.from('expansion_opportunities').select('*').eq('workspace_id', workspaceId).order('estimated_value', { ascending: false }).limit(20),
      supabase.from('expansion_scores').select('*').eq('workspace_id', workspaceId).order('score_date', { ascending: false }).limit(20),
      supabase.from('churn_predictions').select('*').eq('workspace_id', workspaceId).order('prediction_date', { ascending: false }).limit(20),
      supabase.from('churn_signals').select('*').eq('workspace_id', workspaceId).eq('is_active', true).order('detected_at', { ascending: false }).limit(30),
      supabase.from('referral_opportunities').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20),
      supabase.from('customer_testimonials').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20),
      supabase.from('case_studies_generated').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20),
      supabase.from('customer_champions').select('*').eq('workspace_id', workspaceId).order('champion_score', { ascending: false }).limit(20),
    ]);

    const allAccounts = (accounts.data ?? []) as Array<Record<string, unknown>>;
    const totalARR = allAccounts.reduce((s, a) => s + (a.arr as number), 0);
    const totalMRR = allAccounts.reduce((s, a) => s + (a.mrr as number), 0);
    const healthyAccounts = allAccounts.filter((a) => (a.health_score as number) >= 70).length;
    const atRiskAccounts = allAccounts.filter((a) => (a.account_status as string) === 'at_risk' || (a.churn_risk_score as number) > 50).length;
    const churnedAccounts = allAccounts.filter((a) => (a.account_status as string) === 'churned').length;
    const avgHealth = allAccounts.length > 0 ? allAccounts.reduce((s, a) => s + (a.health_score as number), 0) / allAccounts.length : 0;
    const avgChurnRisk = allAccounts.length > 0 ? allAccounts.reduce((s, a) => s + (a.churn_risk_score as number), 0) / allAccounts.length : 0;
    const avgExpansion = allAccounts.length > 0 ? allAccounts.reduce((s, a) => s + (a.expansion_score as number), 0) / allAccounts.length : 0;

    const allRenewals = (renewals.data ?? []) as Array<Record<string, unknown>>;
    const upcomingRenewals = allRenewals.filter((r) => {
      const days = (r.days_to_renewal as number) ?? 999;
      return days > 0 && days <= 180;
    }).length;
    const atRiskRenewalValue = allRenewals.filter((r) => ['at_risk', 'critical'].includes(r.renewal_health as string)).reduce((s, r) => s + (r.renewal_value as number), 0);

    const allExpansion = (expansion.data ?? []) as Array<Record<string, unknown>>;
    const totalExpansionValue = allExpansion.reduce((s, e) => s + (e.estimated_value as number), 0);

    const allReferrals = (referrals.data ?? []) as Array<Record<string, unknown>>;
    const totalReferralValue = allReferrals.reduce((s, r) => s + (r.referral_value as number), 0);

    return {
      accounts: allAccounts as never[],
      healthRecords: (healthRecords.data ?? []) as never[],
      journey: (journey.data ?? []) as never[],
      onboardingProjects: (onboardingProjects.data ?? []) as never[],
      onboardingTasks: (onboardingTasks.data ?? []) as never[],
      onboardingMilestones: (onboardingMilestones.data ?? []) as never[],
      successPlans: (successPlans.data ?? []) as never[],
      successGoals: (successGoals.data ?? []) as never[],
      executiveReviews: (executiveReviews.data ?? []) as never[],
      risks: (risks.data ?? []) as never[],
      sentiment: (sentiment.data ?? []) as never[],
      feedback: (feedback.data ?? []) as never[],
      engagement: (engagement.data ?? []) as never[],
      renewals: allRenewals as never[],
      renewalForecasts: (renewalForecasts.data ?? []) as never[],
      renewalTasks: (renewalTasks.data ?? []) as never[],
      renewalReminders: (renewalReminders.data ?? []) as never[],
      renewalHistory: (renewalHistory.data ?? []) as never[],
      upsellOpportunities: (upsell.data ?? []) as never[],
      crossSellOpportunities: (crossSell.data ?? []) as never[],
      expansionOpportunities: allExpansion as never[],
      expansionScores: (expansionScores.data ?? []) as never[],
      churnPredictions: (churnPredictions.data ?? []) as never[],
      churnSignals: (churnSignals.data ?? []) as never[],
      referrals: allReferrals as never[],
      testimonials: (testimonials.data ?? []) as never[],
      caseStudies: (caseStudies.data ?? []) as never[],
      champions: (champions.data ?? []) as never[],
      totalAccounts: allAccounts.length,
      healthyAccounts,
      atRiskAccounts,
      churnedAccounts,
      totalARR,
      totalMRR,
      avgHealthScore: avgHealth,
      avgChurnRisk,
      avgExpansionScore: avgExpansion,
      upcomingRenewals,
      atRiskRenewalValue,
      totalExpansionValue,
      totalReferralValue,
    };
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  private async createChurnSignal(workspaceId: string, accountId: string, type: string, desc: string, strength: number): Promise<void> {
    const { data: existing } = await supabase
      .from('churn_signals')
      .select('id')
      .eq('customer_account_id', accountId)
      .eq('signal_type', type)
      .eq('is_active', true)
      .maybeSingle();
    if (existing) return;
    await supabase.from('churn_signals').insert({
      workspace_id: workspaceId, customer_account_id: accountId, signal_type: type as never,
      signal_description: desc, signal_strength: strength, ai_confidence: 0.8,
    });
  }

  // ----------------------------------------------------------
  // AI Calls
  // ----------------------------------------------------------

  private async callAIHealth(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are an elite customer success AI. You assess customer health and recommend actions. Respond with valid JSON.';
    const userPrompt = `Assess customer health.\n\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{\n  "overall_health_score": 72,\n  "ai_reasoning": "I assess this customer as healthy based on strong engagement and positive sentiment...",\n  "confidence": 0.8,\n  "supporting_evidence": [{"evidence": "5 meetings in last 30 days", "impact": "positive"}, {"evidence": "Positive feedback score 8/10", "impact": "positive"}],\n  "recommended_actions": [{"action": "Schedule QBR within 30 days", "priority": "medium"}, {"action": "Introduce expansion conversation", "priority": "low"}]\n}`;
    const response = await aiGateway.generateStructured({ systemPrompt, userPrompt, temperature: 0.3, maxTokens: 3000, workspaceId: context.workspace_id as string, agentName: 'customer_health_agent', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }

  private async callAIChurn(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are an elite churn prediction AI. You predict churn probability and generate mitigation plans. Respond with valid JSON.';
    const userPrompt = `Predict churn for this customer.\n\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{\n  "churn_probability_30d": 0.15,\n  "churn_probability_60d": 0.22,\n  "churn_probability_90d": 0.30,\n  "churn_probability_annual": 0.35,\n  "ai_reasoning": "I identified declining engagement and no recent meetings as key churn indicators...",\n  "confidence": 0.78,\n  "supporting_signals": [{"signal": "No contact for 21 days", "strength": "high"}, {"signal": "Negative sentiment in last feedback", "strength": "medium"}],\n  "mitigation_plan": "Schedule executive check-in within 7 days, address feedback concerns, and assign dedicated CSM...",\n  "recommended_actions": [{"action": "Schedule executive check-in", "priority": "critical"}, {"action": "Address negative feedback", "priority": "high"}]\n}`;
    const response = await aiGateway.generateStructured({ systemPrompt, userPrompt, temperature: 0.3, maxTokens: 3000, workspaceId: context.workspace_id as string, agentName: 'churn_prediction_agent', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }

  private async callAIExpansion(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are an elite expansion intelligence AI. You detect upsell, cross-sell, and expansion opportunities. Respond with valid JSON.';
    const userPrompt = `Detect expansion opportunities.\n\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{\n  "overall_expansion_score": 75,\n  "upsell_score": 80,\n  "cross_sell_score": 65,\n  "new_department_score": 70,\n  "new_geography_score": 40,\n  "enterprise_score": 60,\n  "scoring_factors": {"usage_growth": "high", "engagement": "strong"},\n  "ai_reasoning": "I found two enterprise expansion opportunities worth $180,000 based on strong adoption and engagement...",\n  "confidence": 0.78,\n  "opportunities": [\n    {"expansion_type": "upsell", "opportunity_name": "Premium upgrade", "estimated_value": 50000, "probability": 65, "likelihood_to_close": 60, "recommended_timing": "Q4", "decision_makers": [], "supporting_reasons": [{"reason": "Usage has grown 40% in 3 months"}], "ai_reasoning": "Customer is ready for premium tier"},\n    {"expansion_type": "cross_sell", "opportunity_name": "Add analytics module", "estimated_value": 30000, "probability": 55, "likelihood_to_close": 50, "recommended_timing": "Q1 2027", "decision_makers": [], "supporting_reasons": [{"reason": "Customer has expressed interest in analytics"}], "ai_reasoning": "Natural cross-sell based on product usage patterns"}\n  ]\n}`;
    const response = await aiGateway.generateStructured({ systemPrompt, userPrompt, temperature: 0.3, maxTokens: 4000, workspaceId: context.workspace_id as string, agentName: 'expansion_agent', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }

  private async callAISuccessPlan(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are an elite customer success planning AI. You generate success plans for customers. Respond with valid JSON.';
    const userPrompt = `Generate a customer success plan.\n\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{\n  "plan_summary": "I recommend focusing on product adoption and executive engagement for this enterprise customer...",\n  "success_criteria": [{"criteria": "80% product adoption within 90 days"}, {"criteria": "Executive QBR within 60 days"}],\n  "key_objectives": [{"objective": "Complete onboarding within 30 days", "priority": "high"}, {"objective": "Achieve first value realization", "priority": "high"}],\n  "action_items": [{"action": "Schedule weekly check-ins during onboarding", "priority": "high"}, {"action": "Assign dedicated CSM", "priority": "medium"}],\n  "ai_reasoning": "This customer has strong potential but needs focused onboarding support...",\n  "confidence": 0.82\n}`;
    const response = await aiGateway.generateStructured({ systemPrompt, userPrompt, temperature: 0.3, maxTokens: 3000, workspaceId: context.workspace_id as string, agentName: 'success_plan_agent', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }

  private async callAIExecutiveReview(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are an elite executive business review generator AI. You create QBRs for customers. Speak in first person. Respond with valid JSON.';
    const userPrompt = `Generate an executive business review.\n\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{\n  "executive_summary": "I reviewed the account and found strong value delivery with $250K in realized ROI...",\n  "key_achievements": [{"achievement": "95% onboarding completion"}, {"achievement": "3 departments using the platform"}],\n  "key_challenges": [{"challenge": "Low adoption in EMEA team", "impact": "medium"}],\n  "roi_analysis": {"investment": 120000, "realized_value": 250000, "roi_percentage": 108},\n  "value_delivered": "The customer has achieved 108% ROI through improved efficiency and cost savings...",\n  "future_roadmap": [{"item": "Expand to EMEA in Q1"}, {"item": "Add analytics module in Q2"}],\n  "action_items": [{"action": "Schedule EMEA training", "priority": "high"}, {"action": "Prepare expansion proposal", "priority": "medium"}],\n  "attendees": [{"name": "John Smith", "role": "VP Sales"}],\n  "ai_reasoning": "This customer is healthy and ready for expansion. I recommend prioritizing the EMEA rollout...",\n  "confidence": 0.85\n}`;
    const response = await aiGateway.generateStructured({ systemPrompt, userPrompt, temperature: 0.3, maxTokens: 4000, workspaceId: context.workspace_id as string, agentName: 'executive_review_agent', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }

  private async callAIReferral(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are an elite referral and advocacy AI. You identify referral opportunities and customer champions. Respond with valid JSON.';
    const userPrompt = `Identify referral opportunities and champions.\n\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{\n  "referrals": [\n    {"target_company": "TechCorp Inc", "target_contact": "CTO", "estimated_value": 80000, "probability": 60, "reasoning": "This customer has strong network in SaaS space and is a vocal advocate"}\n  ],\n  "champions": [\n    {"name": "Jane Doe", "title": "VP Operations", "email": "jane@example.com", "score": 85, "advocacy_type": "reference", "engagement_level": "very_high", "reasoning": "Jane has been a vocal advocate and has spoken at our events"}\n  ],\n  "confidence": 0.75\n}`;
    const response = await aiGateway.generateStructured({ systemPrompt, userPrompt, temperature: 0.3, maxTokens: 3000, workspaceId: context.workspace_id as string, agentName: 'referral_agent', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }

  private async callAICaseStudy(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are an elite case study generator AI. You create compelling case studies from customer data. Respond with valid JSON.';
    const userPrompt = `Generate a case study recommendation.\n\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{\n  "case_study": {\n    "title": "How [Company] Achieved 108% ROI in 6 Months",\n    "content": "Full case study content...",\n    "summary": "This case study highlights how the customer achieved 108% ROI through improved efficiency...",\n    "key_results": [{"result": "108% ROI in 6 months"}, {"result": "40% efficiency improvement"}, {"result": "$250K in cost savings"}],\n    "use_case": "Enterprise operations optimization",\n    "reasoning": "This customer has strong results and is willing to participate in a case study"\n  },\n  "testimonial": {\n    "text": "This platform transformed our operations and delivered 108% ROI in just 6 months.",\n    "author": "Jane Doe, VP Operations",\n    "title": "VP Operations",\n    "reasoning": "Jane is a vocal champion and has expressed willingness to provide a testimonial"\n  },\n  "confidence": 0.8\n}`;
    const response = await aiGateway.generateStructured({ systemPrompt, userPrompt, temperature: 0.3, maxTokens: 4000, workspaceId: context.workspace_id as string, agentName: 'case_study_agent', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }

  private async callAICustomerInsights(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are an elite customer success intelligence AI. You generate insights about the customer portfolio. Speak in first person. Respond with valid JSON.';
    const userPrompt = `Generate customer insights.\n\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{\n  "insights": [\n    {"insight_type": "risk", "insight_title": "5 customers with high churn risk", "insight_text": "I identified five customers with a high churn risk based on declining engagement and negative sentiment.", "severity": "high", "confidence": 0.85},\n    {"insight_type": "opportunity", "insight_title": "2 enterprise expansion opportunities", "insight_text": "I found two enterprise expansion opportunities worth $180,000 based on strong adoption patterns.", "severity": "info", "confidence": 0.8},\n    {"insight_type": "recommendation", "insight_title": "Schedule executive review with ABC Corp", "insight_text": "I recommend scheduling an executive review with ABC Corp because their health score has dropped 15 points.", "severity": "medium", "confidence": 0.78}\n  ]\n}`;
    const response = await aiGateway.generateStructured({ systemPrompt, userPrompt, temperature: 0.3, maxTokens: 3000, workspaceId: context.workspace_id as string, agentName: 'customer_insights_agent', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }

  private async callAIRenewalForecast(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are an elite renewal forecasting AI. You predict renewal outcomes and recommend strategies. Respond with valid JSON.';
    const userPrompt = `Generate a renewal forecast.\n\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{\n  "ai_reasoning": "I forecast 85% renewal probability for this quarter based on health scores and engagement patterns...",\n  "confidence": 0.78\n}`;
    const response = await aiGateway.generateStructured({ systemPrompt, userPrompt, temperature: 0.3, maxTokens: 2000, workspaceId: context.workspace_id as string, agentName: 'renewal_forecast_agent', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }
}

export const customerSuccessService = new CustomerSuccessService();
