// ============================================================
// PersonalizationService — Architecture
// ============================================================
//
// Main orchestrator for the Personalization Agent.
// Runs after all upstream agents complete.
//
// Generates deep personalization intelligence for every decision
// maker before outreach begins:
//   - Loads Buying Intent, Company Research, and Decision Maker data
//   - Analyzes prospect background and company context
//   - Identifies pain points and business challenges
//   - Generates communication style and tone recommendations
//   - Matches value proposition to prospect needs
//   - Creates personalized opening hooks
//   - Generates CTA strategy
//   - Assembles complete personalization blueprint
//
// Not implemented — uses mock data to simulate the workflow.
// Data is persisted to Supabase tables:
//   - personalization_profiles
//   - pain_points
//   - opening_hooks
//   - recommended_assets
//   - cta_recommendations

import { supabase } from '@/lib/supabase';
import type {
  PersonalizationProfile,
  PainPoint,
  OpeningHook,
  RecommendedAsset,
  CTARecommendation,
  FullPersonalizationProfile,
  PersonalizationStage,
  PersonalizationTimelineEvent,
  PersonalizationAIRecommendations,
  ExportConfig,
  ExportFormat,
} from '@/types/personalization';
import { PERSONALIZATION_STAGES, MOCK_PROSPECTS, MOCK_AI_RECOMMENDATIONS, type MockPersonalization } from './mockData';

// ============================================================
// Service Definition
// ============================================================

export class PersonalizationService {
  /**
   * Generate the complete personalization blueprint for a prospect.
   * Placeholder — will orchestrate all sub-services when implemented.
   */
  async generateBlueprint(): Promise<unknown> {
    throw new Error('PersonalizationService.generateBlueprint() not implemented — use saveBlueprint()');
  }

  /**
   * Analyze pain points for a prospect.
   * Placeholder — will use OpenAIService when implemented.
   */
  async analyzePainPoints(_prospectData: unknown): Promise<unknown> {
    throw new Error('PersonalizationService.analyzePainPoints() not implemented');
  }

  /**
   * Generate communication style recommendation.
   * Placeholder — will use OpenAIService + LinkedInService when implemented.
   */
  async generateCommunicationStyle(_prospectData: unknown): Promise<unknown> {
    throw new Error('PersonalizationService.generateCommunicationStyle() not implemented');
  }

  /**
   * Recommend value proposition for a prospect.
   * Placeholder — will use OpenAIService when implemented.
   */
  async recommendValueProposition(_prospectData: unknown): Promise<unknown> {
    throw new Error('PersonalizationService.recommendValueProposition() not implemented');
  }

  /**
   * Recommend services for a prospect.
   * Placeholder — will use OpenAIService when implemented.
   */
  async recommendServices(_prospectData: unknown): Promise<unknown> {
    throw new Error('PersonalizationService.recommendServices() not implemented');
  }

  /**
   * Recommend case studies for a prospect.
   * Placeholder — will use OpenAIService + CRMService when implemented.
   */
  async recommendCaseStudies(_prospectData: unknown): Promise<unknown> {
    throw new Error('PersonalizationService.recommendCaseStudies() not implemented');
  }

  /**
   * Generate opening hooks for a prospect.
   * Placeholder — will use OpenAIService + FirecrawlService + TavilyService when implemented.
   */
  async generateOpeningHooks(_prospectData: unknown): Promise<unknown> {
    throw new Error('PersonalizationService.generateOpeningHooks() not implemented');
  }

  /**
   * Generate CTA strategy for a prospect.
   * Placeholder — will use OpenAIService when implemented.
   */
  async generateCTA(_prospectData: unknown): Promise<unknown> {
    throw new Error('PersonalizationService.generateCTA() not implemented');
  }

  /**
   * Generate executive summary for a prospect.
   * Placeholder — will use OpenAIService when implemented.
   */
  async generateExecutiveSummary(_prospectData: unknown): Promise<unknown> {
    throw new Error('PersonalizationService.generateExecutiveSummary() not implemented');
  }

  /**
   * Calculate the overall personalization score.
   * Placeholder — will use OpenAIService when implemented.
   */
  async calculatePersonalizationScore(_prospectData: unknown): Promise<unknown> {
    throw new Error('PersonalizationService.calculatePersonalizationScore() not implemented');
  }

  /**
   * Save a complete personalization blueprint (with all child records) to the database.
   */
  async saveBlueprint(workspaceId: string, prospectIndex: number): Promise<string> {
    const mock = MOCK_PROSPECTS[prospectIndex] ?? MOCK_PROSPECTS[0];

    const { data: profileRow, error: profileError } = await supabase
      .from('personalization_profiles')
      .insert({
        workspace_id: workspaceId,
        personalization_score: mock.profile.personalization_score,
        communication_style: mock.profile.communication_style,
        tone: mock.profile.tone,
        value_proposition: mock.profile.value_proposition,
        cta_strategy: mock.profile.cta_strategy,
        status: 'completed',
      })
      .select('*')
      .single();

    if (profileError) throw new Error(profileError.message);
    const profileId = (profileRow as PersonalizationProfile).id;

    // Insert pain points
    if (mock.pain_points.length > 0) {
      const { error: ppError } = await supabase.from('pain_points').insert(
        mock.pain_points.map((p) => ({ ...p, profile_id: profileId })),
      );
      if (ppError) throw new Error(ppError.message);
    }

    // Insert opening hooks
    if (mock.opening_hooks.length > 0) {
      const { error: ohError } = await supabase.from('opening_hooks').insert(
        mock.opening_hooks.map((h) => ({ ...h, profile_id: profileId })),
      );
      if (ohError) throw new Error(ohError.message);
    }

    // Insert recommended assets
    if (mock.recommended_assets.length > 0) {
      const { error: raError } = await supabase.from('recommended_assets').insert(
        mock.recommended_assets.map((a) => ({ ...a, profile_id: profileId })),
      );
      if (raError) throw new Error(raError.message);
    }

    // Insert CTA recommendations
    if (mock.cta_recommendations.length > 0) {
      const { error: ctaError } = await supabase.from('cta_recommendations').insert(
        mock.cta_recommendations.map((c) => ({ ...c, profile_id: profileId })),
      );
      if (ctaError) throw new Error(ctaError.message);
    }

    return profileId;
  }

  /**
   * Refresh an existing personalization blueprint.
   */
  async refreshBlueprint(profileId: string): Promise<void> {
    const { error } = await supabase
      .from('personalization_profiles')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', profileId);

    if (error) throw new Error(error.message);
  }

  /**
   * Load a complete personalization blueprint from the database.
   */
  async loadBlueprint(profileId: string): Promise<FullPersonalizationProfile | null> {
    const { data: profile, error } = await supabase
      .from('personalization_profiles')
      .select('*')
      .eq('id', profileId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!profile) return null;

    const [ppRes, ohRes, raRes, ctaRes] = await Promise.all([
      supabase.from('pain_points').select('*').eq('profile_id', profileId),
      supabase.from('opening_hooks').select('*').eq('profile_id', profileId),
      supabase.from('recommended_assets').select('*').eq('profile_id', profileId),
      supabase.from('cta_recommendations').select('*').eq('profile_id', profileId),
    ]);

    return {
      ...(profile as PersonalizationProfile),
      pain_points: (ppRes.data as PainPoint[] | null) ?? [],
      opening_hooks: (ohRes.data as OpeningHook[] | null) ?? [],
      recommended_assets: (raRes.data as RecommendedAsset[] | null) ?? [],
      cta_recommendations: (ctaRes.data as CTARecommendation[] | null) ?? [],
    };
  }

  /**
   * Load the latest personalization blueprint for a workspace.
   */
  async loadLatestBlueprint(workspaceId: string): Promise<FullPersonalizationProfile | null> {
    const { data, error } = await supabase
      .from('personalization_profiles')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return this.loadBlueprint((data as PersonalizationProfile).id);
  }

  /**
   * Load all personalization blueprints for a workspace.
   */
  async loadAllBlueprints(workspaceId: string): Promise<FullPersonalizationProfile[]> {
    const { data: rows, error } = await supabase
      .from('personalization_profiles')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return [];

    const all = await Promise.all(
      (rows as PersonalizationProfile[]).map((r) => this.loadBlueprint(r.id)),
    );
    return all.filter((r): r is FullPersonalizationProfile => r !== null);
  }

  /**
   * Delete a personalization blueprint (cascades to all child tables).
   */
  async deleteBlueprint(profileId: string): Promise<void> {
    const { error } = await supabase.from('personalization_profiles').delete().eq('id', profileId);
    if (error) throw new Error(error.message);
  }

  /**
   * Get AI recommendations for a prospect by index.
   */
  getAIRecommendations(prospectIndex: number): PersonalizationAIRecommendations {
    return (MOCK_PROSPECTS[prospectIndex] ?? MOCK_PROSPECTS[0]).ai_recommendations;
  }

  /**
   * Export personalization blueprint data in various formats.
   */
  exportConfiguration(profile: FullPersonalizationProfile, format: ExportFormat): ExportConfig {
    const data = {
      personalization_score: profile.personalization_score,
      communication_style: profile.communication_style,
      tone: profile.tone,
      value_proposition: profile.value_proposition,
      cta_strategy: profile.cta_strategy,
      status: profile.status,
      pain_points: profile.pain_points,
      opening_hooks: profile.opening_hooks,
      recommended_assets: profile.recommended_assets,
      cta_recommendations: profile.cta_recommendations,
    };

    switch (format) {
      case 'json':
        return { format, data: JSON.stringify(data, null, 2), filename: `personalization-${profile.id.slice(0, 8)}.json` };
      case 'csv': {
        const rows: string[][] = [
          ['Field', 'Value'],
          ['Personalization Score', String(profile.personalization_score)],
          ['Communication Style', profile.communication_style ?? ''],
          ['Tone', profile.tone ?? ''],
          ['Value Proposition', profile.value_proposition ?? ''],
          ['CTA Strategy', profile.cta_strategy ?? ''],
          ['Status', profile.status],
          ['Pain Points', profile.pain_points.map((p) => `${p.category}: ${p.description}`).join('; ')],
          ['Opening Hooks', profile.opening_hooks.map((h) => `${h.hook_type}: ${h.hook_text}`).join('; ')],
          ['Recommended Assets', profile.recommended_assets.map((a) => `${a.asset_type}: ${a.title}`).join('; ')],
          ['CTA Recommendations', profile.cta_recommendations.map((c) => `${c.cta_type}: ${c.cta_text}`).join('; ')],
        ];
        const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
        return { format, data: csv, filename: `personalization-${profile.id.slice(0, 8)}.csv` };
      }
    }
  }

  /**
   * Generate timeline events for the personalization workflow.
   */
  getTimelineEvents(profile: PersonalizationProfile): PersonalizationTimelineEvent[] {
    const isCompleted = profile.status === 'completed';

    return [
      { id: 'loading_intelligence', label: 'Research Loaded', description: 'Loaded Buying Intent, Company Research, and Decision Maker data', timestamp: profile.created_at, completed: true },
      { id: 'analyzing_prospect', label: 'Signals Loaded', description: 'Analyzed prospect background and company context', timestamp: isCompleted ? profile.updated_at : null, completed: isCompleted },
      { id: 'generating_pain_points', label: 'Pain Points Generated', description: 'Identified challenges, frustrations, and business goals', timestamp: isCompleted ? profile.updated_at : null, completed: isCompleted },
      { id: 'selecting_value_proposition', label: 'Messaging Angle Created', description: 'Matched value proposition to prospect needs', timestamp: isCompleted ? profile.updated_at : null, completed: isCompleted },
      { id: 'creating_hooks', label: 'Communication Style Selected', description: 'Generated personalized opening hooks', timestamp: isCompleted ? profile.updated_at : null, completed: isCompleted },
      { id: 'generating_cta', label: 'Blueprint Generated', description: 'Created call-to-action strategy', timestamp: isCompleted ? profile.updated_at : null, completed: isCompleted },
      { id: 'building_blueprint', label: 'Ready For Outreach Strategy', description: 'Assembled complete personalization blueprint', timestamp: isCompleted ? profile.updated_at : null, completed: isCompleted },
      { id: 'saving_results', label: 'Saved', description: 'Blueprint saved and ready for outreach', timestamp: isCompleted ? profile.updated_at : null, completed: isCompleted },
    ];
  }

  /**
   * Get the current pipeline stage.
   */
  getCurrentStage(): PersonalizationStage {
    return 'loading_intelligence';
  }

  /**
   * Get mock prospect data by index.
   */
  getMockProspect(index: number): MockPersonalization {
    return MOCK_PROSPECTS[index] ?? MOCK_PROSPECTS[0];
  }
}

// Singleton instance
export const personalizationService = new PersonalizationService();
export { PERSONALIZATION_STAGES, MOCK_PROSPECTS, MOCK_AI_RECOMMENDATIONS };
