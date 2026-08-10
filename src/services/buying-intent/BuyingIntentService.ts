// ============================================================
// BuyingIntentService — Architecture
// ============================================================
//
// Main orchestrator for the Buying Intent Agent.
// Runs after all upstream agents complete.
//
// Analyzes signals to predict which prospects are most likely
// to purchase:
//   - Collects signals from all available sources
//   - Analyzes company, stakeholder, technology, and growth signals
//   - Calculates intent, opportunity, and urgency scores
//   - Predicts buying window, deal size, and sales cycle
//   - Generates AI-powered outreach recommendations
//
// Not implemented — uses mock data to simulate the workflow.
// Data is persisted to Supabase tables:
//   - buying_intent_analysis
//   - intent_signals
//   - stakeholder_signals
//   - intent_predictions
//   - intent_recommendations

import { supabase } from '@/lib/supabase';
import type {
  BuyingIntentAnalysis,
  IntentSignal,
  StakeholderSignal,
  IntentPrediction,
  IntentRecommendation,
  FullBuyingIntentAnalysis,
  IntentStage,
  IntentTimelineEvent,
  IntentAIRecommendations,
  PriorityQueueEntry,
  ExportConfig,
  ExportFormat,
} from '@/types/buying-intent';
import { INTENT_STAGES, MOCK_INTENT_COMPANIES, MOCK_PRIORITY_QUEUE, MOCK_AI_RECOMMENDATIONS, type MockIntentAnalysis } from './mockData';

// ============================================================
// Service Definition
// ============================================================

export class BuyingIntentService {
  /**
   * Start the full intent analysis pipeline for a company.
   * Placeholder — will orchestrate all sub-services when implemented.
   */
  async startAnalysis(): Promise<unknown> {
    throw new Error('BuyingIntentService.startAnalysis() not implemented — use saveAnalysis()');
  }

  /**
   * Collect signals from all available sources.
   * Placeholder — will use Firecrawl + Tavily + LinkedIn + Apollo when implemented.
   */
  async collectSignals(_companyName: string): Promise<unknown> {
    throw new Error('BuyingIntentService.collectSignals() not implemented');
  }

  /**
   * Analyze company-level business signals.
   * Placeholder — will use Tavily + Crunchbase when implemented.
   */
  async analyzeCompanySignals(_companyName: string): Promise<unknown> {
    throw new Error('BuyingIntentService.analyzeCompanySignals() not implemented');
  }

  /**
   * Analyze stakeholder activity and engagement signals.
   * Placeholder — will use LinkedIn + Apollo when implemented.
   */
  async analyzeStakeholderSignals(_contactIds: string[]): Promise<unknown> {
    throw new Error('BuyingIntentService.analyzeStakeholderSignals() not implemented');
  }

  /**
   * Analyze technology stack changes.
   * Placeholder — will use BuiltWith when implemented.
   */
  async analyzeTechnologySignals(_url: string): Promise<unknown> {
    throw new Error('BuyingIntentService.analyzeTechnologySignals() not implemented');
  }

  /**
   * Analyze growth signals (funding, hiring, expansion).
   * Placeholder — will use Crunchbase + Tavily when implemented.
   */
  async analyzeGrowthSignals(_companyName: string): Promise<unknown> {
    throw new Error('BuyingIntentService.analyzeGrowthSignals() not implemented');
  }

  /**
   * Calculate the overall intent score.
   * Placeholder — will use OpenAIService.predictIntent() when implemented.
   */
  async calculateIntentScore(_signals: unknown[]): Promise<unknown> {
    throw new Error('BuyingIntentService.calculateIntentScore() not implemented');
  }

  /**
   * Calculate the opportunity score.
   * Placeholder — will use OpenAI when implemented.
   */
  async calculateOpportunityScore(_companyData: unknown): Promise<unknown> {
    throw new Error('BuyingIntentService.calculateOpportunityScore() not implemented');
  }

  /**
   * Calculate the urgency score.
   * Placeholder — will use OpenAI when implemented.
   */
  async calculateUrgency(_signals: unknown[]): Promise<unknown> {
    throw new Error('BuyingIntentService.calculateUrgency() not implemented');
  }

  /**
   * Predict the buying window.
   * Placeholder — will use OpenAIService.predictBuyingWindow() when implemented.
   */
  async predictBuyingWindow(_signals: unknown[]): Promise<unknown> {
    throw new Error('BuyingIntentService.predictBuyingWindow() not implemented');
  }

  /**
   * Predict the estimated deal size.
   * Placeholder — will use OpenAI when implemented.
   */
  async predictDealSize(_companyData: unknown): Promise<unknown> {
    throw new Error('BuyingIntentService.predictDealSize() not implemented');
  }

  /**
   * Estimate the sales cycle length.
   * Placeholder — will use OpenAI when implemented.
   */
  async estimateSalesCycle(_companyData: unknown): Promise<unknown> {
    throw new Error('BuyingIntentService.estimateSalesCycle() not implemented');
  }

  /**
   * Generate a priority ranking for this prospect.
   * Placeholder — will use OpenAIService.recommendPriority() when implemented.
   */
  async generatePriority(_analysisData: unknown): Promise<unknown> {
    throw new Error('BuyingIntentService.generatePriority() not implemented');
  }

  /**
   * Generate AI-powered outreach recommendations.
   * Placeholder — will use OpenAIService when implemented.
   */
  async generateRecommendations(_analysisData: unknown): Promise<unknown> {
    throw new Error('BuyingIntentService.generateRecommendations() not implemented');
  }

  /**
   * Generate an executive summary of the intent analysis.
   * Placeholder — will use OpenAIService.generateSummary() when implemented.
   */
  async generateExecutiveSummary(_analysisData: unknown): Promise<unknown> {
    throw new Error('BuyingIntentService.generateExecutiveSummary() not implemented');
  }

  /**
   * Save a complete intent analysis (with all child records) to the database.
   */
  async saveAnalysis(workspaceId: string, companyIndex: number): Promise<string> {
    const mock = MOCK_INTENT_COMPANIES[companyIndex] ?? MOCK_INTENT_COMPANIES[0];

    const { data: analysisRow, error: analysisError } = await supabase
      .from('buying_intent_analysis')
      .insert({
        workspace_id: workspaceId,
        intent_score: mock.analysis.intent_score,
        opportunity_score: mock.analysis.opportunity_score,
        urgency_score: mock.analysis.urgency_score,
        confidence_score: mock.analysis.confidence_score,
        intent_level: mock.analysis.intent_level,
        buying_window: mock.analysis.buying_window,
        recommended_priority: mock.analysis.recommended_priority,
        status: 'completed',
      })
      .select('*')
      .single();

    if (analysisError) throw new Error(analysisError.message);
    const analysisId = (analysisRow as BuyingIntentAnalysis).id;

    // Insert signals
    if (mock.signals.length > 0) {
      const { error: sigError } = await supabase.from('intent_signals').insert(
        mock.signals.map((s) => ({ ...s, analysis_id: analysisId })),
      );
      if (sigError) throw new Error(sigError.message);
    }

    // Insert stakeholder signals
    if (mock.stakeholder_signals.length > 0) {
      const { error: ssError } = await supabase.from('stakeholder_signals').insert(
        mock.stakeholder_signals.map((s) => ({ ...s, analysis_id: analysisId })),
      );
      if (ssError) throw new Error(ssError.message);
    }

    // Insert prediction
    const { error: predError } = await supabase.from('intent_predictions').insert({
      ...mock.prediction,
      analysis_id: analysisId,
    });
    if (predError) throw new Error(predError.message);

    // Insert recommendations
    if (mock.recommendations.length > 0) {
      const { error: recError } = await supabase.from('intent_recommendations').insert(
        mock.recommendations.map((r) => ({ ...r, analysis_id: analysisId })),
      );
      if (recError) throw new Error(recError.message);
    }

    return analysisId;
  }

  /**
   * Refresh an existing intent analysis.
   */
  async refreshAnalysis(analysisId: string): Promise<void> {
    const { error } = await supabase
      .from('buying_intent_analysis')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', analysisId);

    if (error) throw new Error(error.message);
  }

  /**
   * Load a complete intent analysis from the database.
   */
  async loadAnalysis(analysisId: string): Promise<FullBuyingIntentAnalysis | null> {
    const { data: analysis, error } = await supabase
      .from('buying_intent_analysis')
      .select('*')
      .eq('id', analysisId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!analysis) return null;

    const [sigRes, ssRes, predRes, recRes] = await Promise.all([
      supabase.from('intent_signals').select('*').eq('analysis_id', analysisId),
      supabase.from('stakeholder_signals').select('*').eq('analysis_id', analysisId),
      supabase.from('intent_predictions').select('*').eq('analysis_id', analysisId).maybeSingle(),
      supabase.from('intent_recommendations').select('*').eq('analysis_id', analysisId),
    ]);

    return {
      ...(analysis as BuyingIntentAnalysis),
      signals: (sigRes.data as IntentSignal[] | null) ?? [],
      stakeholder_signals: (ssRes.data as StakeholderSignal[] | null) ?? [],
      prediction: (predRes.data as IntentPrediction | null) ?? null,
      recommendations: (recRes.data as IntentRecommendation[] | null) ?? [],
    };
  }

  /**
   * Load the latest intent analysis for a workspace.
   */
  async loadLatestAnalysis(workspaceId: string): Promise<FullBuyingIntentAnalysis | null> {
    const { data, error } = await supabase
      .from('buying_intent_analysis')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return this.loadAnalysis((data as BuyingIntentAnalysis).id);
  }

  /**
   * Load all intent analyses for a workspace.
   */
  async loadAllAnalyses(workspaceId: string): Promise<FullBuyingIntentAnalysis[]> {
    const { data: rows, error } = await supabase
      .from('buying_intent_analysis')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return [];

    const all = await Promise.all(
      (rows as BuyingIntentAnalysis[]).map((r) => this.loadAnalysis(r.id)),
    );
    return all.filter((r): r is FullBuyingIntentAnalysis => r !== null);
  }

  /**
   * Delete an intent analysis (cascades to all child tables).
   */
  async deleteAnalysis(analysisId: string): Promise<void> {
    const { error } = await supabase.from('buying_intent_analysis').delete().eq('id', analysisId);
    if (error) throw new Error(error.message);
  }

  /**
   * Get the priority queue for a workspace.
   */
  getPriorityQueue(): PriorityQueueEntry[] {
    return MOCK_PRIORITY_QUEUE;
  }

  /**
   * Get AI recommendations for a company by index.
   */
  getAIRecommendations(companyIndex: number): IntentAIRecommendations {
    return (MOCK_INTENT_COMPANIES[companyIndex] ?? MOCK_INTENT_COMPANIES[0]).ai_recommendations;
  }

  /**
   * Export intent analysis data in various formats.
   */
  exportConfiguration(analysis: FullBuyingIntentAnalysis, format: ExportFormat): ExportConfig {
    const data = {
      intent_score: analysis.intent_score,
      opportunity_score: analysis.opportunity_score,
      urgency_score: analysis.urgency_score,
      confidence_score: analysis.confidence_score,
      intent_level: analysis.intent_level,
      buying_window: analysis.buying_window,
      recommended_priority: analysis.recommended_priority,
      status: analysis.status,
      signals: analysis.signals,
      stakeholder_signals: analysis.stakeholder_signals,
      prediction: analysis.prediction,
      recommendations: analysis.recommendations,
    };

    switch (format) {
      case 'json':
        return { format, data: JSON.stringify(data, null, 2), filename: `buying-intent-${analysis.id.slice(0, 8)}.json` };
      case 'csv': {
        const rows: string[][] = [
          ['Field', 'Value'],
          ['Intent Score', String(analysis.intent_score)],
          ['Opportunity Score', String(analysis.opportunity_score)],
          ['Urgency Score', String(analysis.urgency_score)],
          ['Confidence Score', String(analysis.confidence_score)],
          ['Intent Level', analysis.intent_level],
          ['Buying Window', analysis.buying_window ?? ''],
          ['Recommended Priority', analysis.recommended_priority],
          ['Purchase Probability', String(analysis.prediction?.purchase_probability ?? '')],
          ['Estimated Deal Size', analysis.prediction?.estimated_deal_size ?? ''],
          ['Estimated Sales Cycle', analysis.prediction?.estimated_sales_cycle ?? ''],
          ['Expected Close Rate', String(analysis.prediction?.expected_close_rate ?? '')],
          ['Risk Score', String(analysis.prediction?.risk_score ?? '')],
          ['Signals', analysis.signals.map((s) => `${s.signal_name} (${s.signal_type})`).join('; ')],
          ['Recommendations', analysis.recommendations.map((r) => r.recommendation).join('; ')],
        ];
        const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
        return { format, data: csv, filename: `buying-intent-${analysis.id.slice(0, 8)}.csv` };
      }
    }
  }

  /**
   * Generate timeline events for the intent analysis workflow.
   */
  getTimelineEvents(analysis: BuyingIntentAnalysis): IntentTimelineEvent[] {
    const isCompleted = analysis.status === 'completed';

    return [
      { id: 'loading_research', label: 'Loading Research', description: 'Loading company and decision maker research', timestamp: analysis.created_at, completed: true },
      { id: 'collecting_signals', label: 'Collecting Signals', description: 'Gathering signals from all available sources', timestamp: isCompleted ? analysis.updated_at : null, completed: isCompleted },
      { id: 'analyzing_companies', label: 'Analyzing Companies', description: 'Analyzing company-level business signals', timestamp: isCompleted ? analysis.updated_at : null, completed: isCompleted },
      { id: 'analyzing_stakeholders', label: 'Analyzing Stakeholders', description: 'Analyzing stakeholder activity and engagement', timestamp: isCompleted ? analysis.updated_at : null, completed: isCompleted },
      { id: 'calculating_scores', label: 'Calculating Scores', description: 'Computing intent, opportunity, and urgency scores', timestamp: isCompleted ? analysis.updated_at : null, completed: isCompleted },
      { id: 'predicting_intent', label: 'Predicting Buying Intent', description: 'Predicting buying window and purchase probability', timestamp: isCompleted ? analysis.updated_at : null, completed: isCompleted },
      { id: 'generating_recommendations', label: 'Generating Recommendations', description: 'Creating AI-powered outreach recommendations', timestamp: isCompleted ? analysis.updated_at : null, completed: isCompleted },
      { id: 'saving_results', label: 'Completed', description: 'Analysis completed and saved', timestamp: isCompleted ? analysis.updated_at : null, completed: isCompleted },
    ];
  }

  /**
   * Get the current pipeline stage.
   */
  getCurrentStage(): IntentStage {
    return 'loading_research';
  }

  /**
   * Get mock intent company data by index.
   */
  getMockCompany(index: number): MockIntentAnalysis {
    return MOCK_INTENT_COMPANIES[index] ?? MOCK_INTENT_COMPANIES[0];
  }
}

// Singleton instance
export const buyingIntentService = new BuyingIntentService();
export { INTENT_STAGES, MOCK_INTENT_COMPANIES, MOCK_PRIORITY_QUEUE, MOCK_AI_RECOMMENDATIONS };
