// ============================================================
// DecisionMakerResearchService — Architecture
// ============================================================
//
// Main orchestrator for the Decision Maker Research Agent.
// Runs after the Company Research Agent and Sales Navigator
// Intelligence Agent complete.
//
// Identifies, researches, enriches, scores, and maps every
// relevant stakeholder inside a target company.
//
// Not implemented — uses mock data to simulate the workflow.
// Data is persisted to Supabase tables:
//   - decision_maker_research
//   - contacts
//   - contact_profiles
//   - linkedin_activity
//   - buying_committee
//   - recommendations

import { supabase } from '@/lib/supabase';
import type {
  DecisionMakerResearch,
  Contact,
  ContactProfile,
  LinkedInActivity,
  BuyingCommittee,
  Recommendation,
  FullContact,
  FullDecisionMakerResearch,
  DMResearchStage,
  DMResearchTimelineEvent,
  DMRecommendations,
  ExportConfig,
  ExportFormat,
} from '@/types/decision-maker-research';
import { DM_STAGES, MOCK_DM_COMPANIES, type MockDMResearch } from './mockData';

// ============================================================
// Service Definition
// ============================================================

export class DecisionMakerResearchService {
  /**
   * Start the full decision maker research pipeline.
   * Placeholder — will orchestrate all sub-services when implemented.
   */
  async startResearch(): Promise<unknown> {
    throw new Error('DecisionMakerResearchService.startResearch() not implemented — use saveResearch()');
  }

  /**
   * Identify decision makers via LinkedIn and Sales Navigator.
   * Placeholder — will use LinkedInService.findDecisionMakers() when implemented.
   */
  async identifyDecisionMakers(_companyName: string): Promise<unknown> {
    throw new Error('DecisionMakerResearchService.identifyDecisionMakers() not implemented');
  }

  /**
   * Identify the buying committee structure.
   * Placeholder — will use OpenAIService.identifyBuyingCommittee() when implemented.
   */
  async identifyBuyingCommittee(_companyData: unknown): Promise<unknown> {
    throw new Error('DecisionMakerResearchService.identifyBuyingCommittee() not implemented');
  }

  /**
   * Research and enrich contact profiles.
   * Placeholder — will use ApolloService + ClearbitService when implemented.
   */
  async researchProfiles(_contacts: unknown[]): Promise<unknown> {
    throw new Error('DecisionMakerResearchService.researchProfiles() not implemented');
  }

  /**
   * Analyze professional background.
   * Placeholder — will use TavilyService.researchPerson() when implemented.
   */
  async analyzeProfessionalBackground(_contactId: string): Promise<unknown> {
    throw new Error('DecisionMakerResearchService.analyzeProfessionalBackground() not implemented');
  }

  /**
   * Analyze LinkedIn activity.
   * Placeholder — will use LinkedInService.fetchActivity() when implemented.
   */
  async analyzeLinkedInActivity(_profileUrl: string): Promise<unknown> {
    throw new Error('DecisionMakerResearchService.analyzeLinkedInActivity() not implemented');
  }

  /**
   * Analyze interests and expertise.
   * Placeholder — will use OpenAIService.analyzeProfiles() when implemented.
   */
  async analyzeInterests(_contactId: string): Promise<unknown> {
    throw new Error('DecisionMakerResearchService.analyzeInterests() not implemented');
  }

  /**
   * Calculate influence score.
   * Placeholder — will use OpenAIService.scoreContacts() when implemented.
   */
  async calculateInfluence(_contactId: string): Promise<unknown> {
    throw new Error('DecisionMakerResearchService.calculateInfluence() not implemented');
  }

  /**
   * Calculate relationship score.
   * Placeholder — will use OpenAIService when implemented.
   */
  async calculateRelationshipScore(_contactId: string): Promise<unknown> {
    throw new Error('DecisionMakerResearchService.calculateRelationshipScore() not implemented');
  }

  /**
   * Calculate outreach readiness.
   * Placeholder — will use OpenAIService.scoreContacts() when implemented.
   */
  async calculateOutreachReadiness(_contactId: string): Promise<unknown> {
    throw new Error('DecisionMakerResearchService.calculateOutreachReadiness() not implemented');
  }

  /**
   * Generate the buying committee mapping.
   * Placeholder — will use OpenAIService.identifyBuyingCommittee() when implemented.
   */
  async generateBuyingCommittee(_contacts: unknown[]): Promise<unknown> {
    throw new Error('DecisionMakerResearchService.generateBuyingCommittee() not implemented');
  }

  /**
   * Generate an executive summary.
   * Placeholder — will use OpenAIService.generateRecommendations() when implemented.
   */
  async generateExecutiveSummary(_researchData: unknown): Promise<unknown> {
    throw new Error('DecisionMakerResearchService.generateExecutiveSummary() not implemented');
  }

  /**
   * Generate AI-powered outreach recommendations.
   * Placeholder — will use OpenAIService.generateRecommendations() when implemented.
   */
  async generateRecommendations(_researchData: unknown): Promise<unknown> {
    throw new Error('DecisionMakerResearchService.generateRecommendations() not implemented');
  }

  /**
   * Save a complete research record (with all child records) to the database.
   */
  async saveResearch(workspaceId: string, companyIndex: number): Promise<string> {
    const mock = MOCK_DM_COMPANIES[companyIndex] ?? MOCK_DM_COMPANIES[0];

    const { data: researchRow, error: researchError } = await supabase
      .from('decision_maker_research')
      .insert({
        workspace_id: workspaceId,
        status: 'completed',
        research_score: mock.research.research_score,
        confidence_score: mock.research.confidence_score,
      })
      .select('*')
      .single();

    if (researchError) throw new Error(researchError.message);
    const researchId = (researchRow as DecisionMakerResearch).id;

    // Insert contacts + child records
    for (const c of mock.contacts) {
      const { data: contactRow, error: contactError } = await supabase
        .from('contacts')
        .insert({ ...c.contact, research_id: researchId })
        .select('*')
        .single();

      if (contactError) throw new Error(contactError.message);
      const contactId = (contactRow as Contact).id;

      // Insert contact profile
      const { error: profileError } = await supabase
        .from('contact_profiles')
        .insert({ ...c.profile, contact_id: contactId });
      if (profileError) throw new Error(profileError.message);

      // Insert LinkedIn activity
      const { error: activityError } = await supabase
        .from('linkedin_activity')
        .insert({ ...c.activity, contact_id: contactId });
      if (activityError) throw new Error(activityError.message);

      // Insert recommendation
      const { error: recError } = await supabase
        .from('recommendations')
        .insert({ ...c.recommendation, contact_id: contactId });
      if (recError) throw new Error(recError.message);
    }

    // Insert buying committee
    const { error: bcError } = await supabase
      .from('buying_committee')
      .insert({ ...mock.buying_committee, research_id: researchId });
    if (bcError) throw new Error(bcError.message);

    return researchId;
  }

  /**
   * Refresh an existing research record.
   */
  async refreshResearch(researchId: string): Promise<void> {
    const { error } = await supabase
      .from('decision_maker_research')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', researchId);

    if (error) throw new Error(error.message);
  }

  /**
   * Load a complete research record from the database.
   */
  async loadResearch(researchId: string): Promise<FullDecisionMakerResearch | null> {
    const { data: research, error } = await supabase
      .from('decision_maker_research')
      .select('*')
      .eq('id', researchId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!research) return null;

    const [contactsRes, bcRes] = await Promise.all([
      supabase.from('contacts').select('*').eq('research_id', researchId),
      supabase.from('buying_committee').select('*').eq('research_id', researchId).maybeSingle(),
    ]);

    const contacts = (contactsRes.data as Contact[] | null) ?? [];
    const buyingCommittee = (bcRes.data as BuyingCommittee | null) ?? null;

    // Load child records for each contact
    const fullContacts: FullContact[] = await Promise.all(
      contacts.map(async (c): Promise<FullContact> => {
        const [profileRes, activityRes, recRes] = await Promise.all([
          supabase.from('contact_profiles').select('*').eq('contact_id', c.id).maybeSingle(),
          supabase.from('linkedin_activity').select('*').eq('contact_id', c.id).maybeSingle(),
          supabase.from('recommendations').select('*').eq('contact_id', c.id).maybeSingle(),
        ]);

        return {
          ...c,
          profile: (profileRes.data as ContactProfile | null) ?? null,
          linkedin_activity: (activityRes.data as LinkedInActivity | null) ?? null,
          recommendation: (recRes.data as Recommendation | null) ?? null,
        };
      }),
    );

    return {
      ...(research as DecisionMakerResearch),
      contacts: fullContacts,
      buying_committee: buyingCommittee,
    };
  }

  /**
   * Load the latest research for a workspace.
   */
  async loadLatestResearch(workspaceId: string): Promise<FullDecisionMakerResearch | null> {
    const { data, error } = await supabase
      .from('decision_maker_research')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return this.loadResearch((data as DecisionMakerResearch).id);
  }

  /**
   * Delete a research record (cascades to all child tables).
   */
  async deleteResearch(researchId: string): Promise<void> {
    const { error } = await supabase.from('decision_maker_research').delete().eq('id', researchId);
    if (error) throw new Error(error.message);
  }

  /**
   * Generate AI-powered recommendations.
   * Placeholder — will use OpenAIService.generateRecommendations() when implemented.
   */
  async getRecommendations(companyIndex: number): Promise<DMRecommendations> {
    return (MOCK_DM_COMPANIES[companyIndex] ?? MOCK_DM_COMPANIES[0]).recommendations;
  }

  /**
   * Export research data in various formats.
   */
  exportConfiguration(research: FullDecisionMakerResearch, format: ExportFormat): ExportConfig {
    const data = {
      research_score: research.research_score,
      confidence_score: research.confidence_score,
      contacts: research.contacts.map((c) => ({
        name: `${c.first_name} ${c.last_name}`,
        title: c.job_title,
        department: c.department,
        seniority: c.seniority,
        buying_role: c.buying_role,
        decision_power: c.decision_power,
        influence_score: c.influence_score,
        outreach_readiness: c.outreach_readiness,
        email: c.email,
        linkedin_url: c.linkedin_url,
      })),
      buying_committee: research.buying_committee,
    };

    switch (format) {
      case 'json':
        return { format, data: JSON.stringify(data, null, 2), filename: `dm-research-${research.id.slice(0, 8)}.json` };
      case 'csv': {
        const rows: string[][] = [
          ['Name', 'Title', 'Department', 'Seniority', 'Buying Role', 'Decision Power', 'Influence', 'Outreach Readiness', 'Email', 'LinkedIn'],
          ...research.contacts.map((c) => [
            `${c.first_name} ${c.last_name}`,
            c.job_title ?? '',
            c.department ?? '',
            c.seniority ?? '',
            c.buying_role,
            String(c.decision_power),
            String(c.influence_score),
            String(c.outreach_readiness),
            c.email ?? '',
            c.linkedin_url ?? '',
          ]),
        ];
        const csv = rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
        return { format, data: csv, filename: `dm-research-${research.id.slice(0, 8)}.csv` };
      }
    }
  }

  /**
   * Generate timeline events for the research workflow.
   */
  getTimelineEvents(research: DecisionMakerResearch): DMResearchTimelineEvent[] {
    const isCompleted = research.status === 'completed';

    return [
      { id: 'company_loaded', label: 'Company Loaded', description: 'Company loaded from Company Research Agent', timestamp: research.created_at, completed: true },
      { id: 'committee_generated', label: 'Buying Committee Generated', description: 'Buying committee structure identified', timestamp: isCompleted ? research.updated_at : null, completed: isCompleted },
      { id: 'decision_makers_identified', label: 'Decision Makers Identified', description: 'Key stakeholders found via LinkedIn and Sales Navigator', timestamp: isCompleted ? research.updated_at : null, completed: isCompleted },
      { id: 'profiles_enriched', label: 'Profiles Enriched', description: 'Contact profiles enriched with Apollo and Clearbit', timestamp: isCompleted ? research.updated_at : null, completed: isCompleted },
      { id: 'activity_analyzed', label: 'Activity Analyzed', description: 'LinkedIn activity and professional background analyzed', timestamp: isCompleted ? research.updated_at : null, completed: isCompleted },
      { id: 'scores_calculated', label: 'Scores Calculated', description: 'Influence, relationship, and outreach readiness scores computed', timestamp: isCompleted ? research.updated_at : null, completed: isCompleted },
      { id: 'recommendations_generated', label: 'Recommendations Generated', description: 'AI-powered outreach recommendations created', timestamp: isCompleted ? research.updated_at : null, completed: isCompleted },
      { id: 'completed', label: 'Completed', description: 'Research completed — ready for Buying Intent Agent', timestamp: isCompleted ? research.updated_at : null, completed: isCompleted },
    ];
  }

  /**
   * Get the current pipeline stage.
   */
  getCurrentStage(): DMResearchStage {
    return 'loading_company';
  }

  /**
   * Get mock company data by index.
   */
  getMockCompany(index: number): MockDMResearch {
    return MOCK_DM_COMPANIES[index] ?? MOCK_DM_COMPANIES[0];
  }
}

// Singleton instance
export const dmResearchService = new DecisionMakerResearchService();
export { DM_STAGES };
