// ============================================================
// RevenueDNAService — Revenue DNA Profile Generation Engine
// ============================================================
//
// Uses the AI Gateway to generate a comprehensive Revenue DNA
// profile from business analysis data. Stores results in the
// revenue_dna_profiles, buyer_personas, competitor_intelligence,
// and value_propositions tables. Populates the Knowledge Graph
// and AI Memory Engine so future agents can query instead of
// re-researching.

import { supabase } from '@/lib/supabase';
import { aiGateway } from '@/services/ai/AIGateway';
import { knowledgeGraphService } from '@/services/knowledge-graph/KnowledgeGraphService';
import { memoryEngine } from '@/services/memory/MemoryEngine';
import type {
  RevenueDNAProfile,
  BuyerPersona,
  CompetitorIntelligence,
  ValueProposition,
  FullRevenueDNA,
  RevenueDNAInput,
  RevenueDNAGenerationResult,
} from '@/types/revenue-dna';

class RevenueDNAService {
  // ----------------------------------------------------------
  // Generate full Revenue DNA from business analysis
  // ----------------------------------------------------------

  async generateRevenueDNA(input: RevenueDNAInput): Promise<string> {
    const { workspaceId, website, companyName, businessAnalysisId, businessAnalysis } = input;

    // Create or get existing profile record
    const { data: existing } = await supabase
      .from('revenue_dna_profiles')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let profileId: string;

    if (existing) {
      // Update existing
      profileId = existing.id;
      await supabase
        .from('revenue_dna_profiles')
        .update({ status: 'processing', error_message: null })
        .eq('id', profileId);
    } else {
      const { data: newProfile, error } = await supabase
        .from('revenue_dna_profiles')
        .insert({
          workspace_id: workspaceId,
          business_analysis_id: businessAnalysisId ?? null,
          status: 'processing',
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      profileId = newProfile.id;
    }

    try {
      const generation = await this.callAIGeneration(website, companyName, businessAnalysis);
      await this.persistRevenueDNA(profileId, workspaceId, businessAnalysisId ?? null, generation);
      await this.populateKnowledgeGraph(workspaceId, companyName, generation);
      await this.storeInMemory(workspaceId, companyName, generation);

      return profileId;
    } catch (err) {
      await supabase
        .from('revenue_dna_profiles')
        .update({
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Generation failed',
        })
        .eq('id', profileId);
      throw err;
    }
  }

  // ----------------------------------------------------------
  // Call AI Gateway to generate the Revenue DNA
  // ----------------------------------------------------------

  private async callAIGeneration(
    website: string,
    companyName?: string,
    businessAnalysis?: RevenueDNAInput['businessAnalysis'],
  ): Promise<RevenueDNAGenerationResult> {
    const ba = businessAnalysis ?? {};
    const products = Array.isArray(ba.products) ? ba.products : ba.products ? [ba.products] : [];
    const services = Array.isArray(ba.services) ? ba.services : ba.services ? [ba.services] : [];
    const problems = Array.isArray(ba.customer_problems) ? ba.customer_problems : ba.customer_problems ? [ba.customer_problems] : [];
    const goals = Array.isArray(ba.business_goals) ? ba.business_goals : ba.business_goals ? [ba.business_goals] : [];

    const contextBlock = [
      `Website: ${website}`,
      companyName ? `Company Name: ${companyName}` : '',
      ba.industry ? `Industry: ${ba.industry}` : '',
      ba.description ? `Description: ${ba.description}` : '',
      ba.business_model ? `Business Model: ${ba.business_model}` : '',
      products.length ? `Products: ${products.join(', ')}` : '',
      services.length ? `Services: ${services.join(', ')}` : '',
      ba.pricing_model ? `Pricing Model: ${ba.pricing_model}` : '',
      ba.target_audience ? `Target Audience: ${ba.target_audience}` : '',
      ba.usp ? `USP: ${ba.usp}` : '',
      problems.length ? `Customer Problems: ${problems.join(', ')}` : '',
      goals.length ? `Business Goals: ${goals.join(', ')}` : '',
      ba.revenue_model ? `Revenue Model: ${ba.revenue_model}` : '',
      ba.competitive_position ? `Competitive Position: ${ba.competitive_position}` : '',
    ].filter(Boolean).join('\n');

    const systemPrompt = `You are an expert revenue intelligence analyst. You analyze companies and generate comprehensive Revenue DNA profiles that include business identity, market position, buyer personas, competitor intelligence, and value propositions. You always respond with valid JSON.`;

    const userPrompt = `Analyze the following company and generate a complete Revenue DNA profile.

COMPANY CONTEXT:
${contextBlock}

Generate a comprehensive Revenue DNA profile. Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:

{
  "profile": {
    "business_identity": {
      "name": "company name",
      "website": "${website}",
      "description": "2-3 sentence description",
      "industry": "primary industry",
      "business_model": "B2B/B2C/B2B2C/etc",
      "pricing_model": "subscription/one-time/freemium/etc",
      "value_proposition": "primary value prop",
      "target_customers": "who they sell to",
      "company_size": "estimated size range"
    },
    "core_services": ["service1", "service2", "service3"],
    "target_industries": ["industry1", "industry2", "industry3"],
    "ideal_customer_characteristics": ["characteristic1", "characteristic2"],
    "market_position": {
      "position": "leader/challenger/niche/emerging",
      "market_share": "estimated share",
      "maturity": "growing/mature/declining",
      "positioning_statement": "how they position themselves"
    },
    "differentiators": ["differentiator1", "differentiator2"],
    "business_strengths": ["strength1", "strength2"],
    "brand_positioning": "brand positioning statement",
    "pain_points_solved": ["pain point1", "pain point2"],
    "customer_outcomes": ["outcome1", "outcome2"],
    "buying_committee": [
      {"role": "VP Sales", "department": "Sales", "influence": "high", "involvement": "decider"},
      {"role": "CTO", "department": "Technology", "influence": "high", "involvement": "influencer"}
    ],
    "buying_signals": ["signal1", "signal2"],
    "disqualifiers": ["disqualifier1", "disqualifier2"],
    "sales_motion": "smb|mid_market|enterprise|mixed",
    "sales_motion_detail": "description of sales motion",
    "typical_objections": ["objection1", "objection2"],
    "offer_types": ["offer type1", "offer type2"],
    "geographies": ["region1", "region2"],
    "languages": ["English", "Spanish"],
    "technologies": ["tech1", "tech2"],
    "trust_signals": ["signal1", "signal2"],
    "content_assets": ["case studies", "whitepapers", "blog posts"],
    "keywords": ["keyword1", "keyword2"],
    "categories": ["category1", "category2"],
    "company_size": "estimated size",
    "geographic_markets": ["market1", "market2"],
    "market_maturity": "growing|mature|emerging",
    "confidence_score": 85,
    "completion_percentage": 100
  },
  "personas": [
    {
      "role": "VP of Sales",
      "responsibilities": ["responsibility1", "responsibility2"],
      "goals": ["goal1", "goal2"],
      "kpis": ["KPI1", "KPI2"],
      "daily_challenges": ["challenge1", "challenge2"],
      "common_objections": ["objection1", "objection2"],
      "buying_authority": "Has budget authority up to $50K",
      "preferred_communication_style": "Direct, data-driven",
      "linkedin_behavior": {"activity_level": "active", "content_preferences": ["industry news", "thought leadership"], "best_outreach_style": "comment on their posts first"},
      "email_behavior": {"response_patterns": "responds within 24 hours", "preferred_subject_style": "short and specific", "best_send_times": "Tuesday-Thursday 9-11am"},
      "typical_questions": ["question1", "question2"],
      "recommended_messaging_style": "Lead with ROI metrics",
      "confidence_score": 0.85
    }
  ],
  "competitors": [
    {
      "competitor_name": "Competitor Inc",
      "competitor_type": "direct",
      "key_differentiators": ["differentiator1"],
      "pricing_positioning": "premium",
      "messaging_differences": ["difference1"],
      "strengths": ["strength1"],
      "weaknesses": ["weakness1"],
      "competitive_opportunities": ["opportunity1"],
      "website": "https://competitor.com",
      "confidence_score": 0.8
    }
  ],
  "valuePropositions": [
    {
      "proposition_type": "primary",
      "target_industry": null,
      "target_persona": null,
      "content": "Primary value proposition statement",
      "email_hooks": ["hook1", "hook2"],
      "linkedin_hooks": ["hook1", "hook2"],
      "opening_messages": ["message1"],
      "conversation_starters": ["starter1"],
      "trust_builders": ["trust builder1"],
      "social_proof_suggestions": ["proof1"],
      "cta_suggestions": ["CTA1"],
      "confidence_score": 0.85
    },
    {
      "proposition_type": "industry_specific",
      "target_industry": "SaaS",
      "target_persona": null,
      "content": "Industry-specific value prop",
      "email_hooks": [],
      "linkedin_hooks": [],
      "opening_messages": [],
      "conversation_starters": [],
      "trust_builders": [],
      "social_proof_suggestions": [],
      "cta_suggestions": [],
      "confidence_score": 0.8
    }
  ]
}

Return ONLY the JSON object, no other text.`;

    const response = await aiGateway.generateStructured({
      systemPrompt,
      userPrompt,
      temperature: 0.4,
      maxTokens: 8000,
      workspaceId: input.workspaceId,
      agentName: 'revenue_dna_agent',
      schema: { type: 'object' },
    });

    const data = (response.structuredData ?? JSON.parse(response.content)) as RevenueDNAGenerationResult;
    return data;
  }

  // ----------------------------------------------------------
  // Persist Revenue DNA to database
  // ----------------------------------------------------------

  private async persistRevenueDNA(
    profileId: string,
    workspaceId: string,
    businessAnalysisId: string | null,
    generation: RevenueDNAGenerationResult,
  ): Promise<void> {
    // Update profile
    const { error: profileError } = await supabase
      .from('revenue_dna_profiles')
      .update({
        ...generation.profile,
        business_analysis_id: businessAnalysisId,
        status: 'completed',
        error_message: null,
      })
      .eq('id', profileId);
    if (profileError) throw new Error(profileError.message);

    // Delete existing child records
    await supabase.from('buyer_personas').delete().eq('revenue_dna_id', profileId);
    await supabase.from('competitor_intelligence').delete().eq('revenue_dna_id', profileId);
    await supabase.from('value_propositions').delete().eq('revenue_dna_id', profileId);

    // Insert personas
    if (generation.personas?.length) {
      const personaRows = generation.personas.map((p) => ({
        ...p,
        workspace_id: workspaceId,
        revenue_dna_id: profileId,
      }));
      await supabase.from('buyer_personas').insert(personaRows);
    }

    // Insert competitors
    if (generation.competitors?.length) {
      const competitorRows = generation.competitors.map((c) => ({
        ...c,
        workspace_id: workspaceId,
        revenue_dna_id: profileId,
      }));
      await supabase.from('competitor_intelligence').insert(competitorRows);
    }

    // Insert value propositions
    if (generation.valuePropositions?.length) {
      const vpRows = generation.valuePropositions.map((v) => ({
        ...v,
        workspace_id: workspaceId,
        revenue_dna_id: profileId,
      }));
      await supabase.from('value_propositions').insert(vpRows);
    }
  }

  // ----------------------------------------------------------
  // Populate Knowledge Graph
  // ----------------------------------------------------------

  private async populateKnowledgeGraph(
    workspaceId: string,
    companyName: string | undefined,
    generation: RevenueDNAGenerationResult,
  ): Promise<void> {
    try {
      const entities: Array<{ nodeType: string; externalId?: string; displayName: string; properties?: Record<string, unknown> }> = [];
      const relationships: Array<{ sourceExternalId: string; sourceNodeType: string; targetExternalId: string; targetNodeType: string; relationshipType: string }> = [];

      const companyExtId = companyName?.toLowerCase().replace(/\s+/g, '_') ?? `company_${workspaceId}`;

      // Company node
      entities.push({
        nodeType: 'company',
        externalId: companyExtId,
        displayName: companyName ?? 'Your Company',
        properties: generation.profile.business_identity,
      });

      // Industry nodes
      for (const industry of generation.profile.target_industries ?? []) {
        const indId = `industry_${industry.toLowerCase().replace(/\s+/g, '_')}`;
        entities.push({ nodeType: 'industry', externalId: indId, displayName: industry });
        relationships.push({ sourceExternalId: companyExtId, sourceNodeType: 'company', targetExternalId: indId, targetNodeType: 'industry', relationshipType: 'SERVES' });
      }

      // Pain point nodes
      for (const pain of generation.profile.pain_points_solved ?? []) {
        const painId = `pain_${pain.toLowerCase().replace(/\s+/g, '_').slice(0, 50)}`;
        entities.push({ nodeType: 'pain_point', externalId: painId, displayName: pain });
        relationships.push({ sourceExternalId: companyExtId, sourceNodeType: 'company', targetExternalId: painId, targetNodeType: 'pain_point', relationshipType: 'SOLVES' });
      }

      // Technology nodes
      for (const tech of generation.profile.technologies ?? []) {
        const techId = `tech_${tech.toLowerCase().replace(/\s+/g, '_')}`;
        entities.push({ nodeType: 'technology', externalId: techId, displayName: tech });
        relationships.push({ sourceExternalId: companyExtId, sourceNodeType: 'company', targetExternalId: techId, targetNodeType: 'technology', relationshipType: 'USES_TECHNOLOGY' });
      }

      // Competitor nodes
      for (const comp of generation.competitors ?? []) {
        const compId = `competitor_${comp.competitor_name.toLowerCase().replace(/\s+/g, '_')}`;
        entities.push({ nodeType: 'competitor', externalId: compId, displayName: comp.competitor_name, properties: { type: comp.competitor_type, strengths: comp.strengths, weaknesses: comp.weaknesses } });
        relationships.push({ sourceExternalId: companyExtId, sourceNodeType: 'company', targetExternalId: compId, targetNodeType: 'competitor', relationshipType: 'COMPETES_WITH' });
      }

      // Persona nodes
      for (const persona of generation.personas ?? []) {
        const personaId = `persona_${persona.role.toLowerCase().replace(/\s+/g, '_').slice(0, 50)}`;
        entities.push({ nodeType: 'buyer_persona', externalId: personaId, displayName: persona.role, properties: { goals: persona.goals, challenges: persona.daily_challenges, objections: persona.common_objections } });
        relationships.push({ sourceExternalId: companyExtId, sourceNodeType: 'company', targetExternalId: personaId, targetNodeType: 'buyer_persona', relationshipType: 'TARGETS' });
      }

      await knowledgeGraphService.ingestBatch({
        workspaceId,
        entities: entities.map((e) => ({
          nodeType: e.nodeType as any,
          externalId: e.externalId,
          displayName: e.displayName,
          properties: e.properties ?? {},
          confidenceScore: 0.85,
        })),
        relationships: relationships.map((r) => ({
          sourceExternalId: r.sourceExternalId,
          sourceNodeType: r.sourceNodeType as any,
          targetExternalId: r.targetExternalId,
          targetNodeType: r.targetNodeType as any,
          relationshipType: r.relationshipType as any,
          confidenceScore: 0.85,
        })),
      });
    } catch {
      // Knowledge graph population is best-effort, don't fail the whole generation
    }
  }

  // ----------------------------------------------------------
  // Store in AI Memory
  // ----------------------------------------------------------

  private async storeInMemory(
    workspaceId: string,
    companyName: string | undefined,
    generation: RevenueDNAGenerationResult,
  ): Promise<void> {
    try {
      const entityId = companyName?.toLowerCase().replace(/\s+/g, '_') ?? `company_${workspaceId}`;

      await memoryEngine.store({
        entityType: 'company',
        entityId,
        memoryType: 'revenue_dna',
        title: `Revenue DNA Profile — ${companyName ?? 'Your Company'}`,
        summary: generation.profile.business_identity?.description ?? '',
        content: {
          business_identity: generation.profile.business_identity,
          core_services: generation.profile.core_services,
          target_industries: generation.profile.target_industries,
          differentiators: generation.profile.differentiators,
          pain_points_solved: generation.profile.pain_points_solved,
          buying_signals: generation.profile.buying_signals,
          sales_motion: generation.profile.sales_motion,
          typical_objections: generation.profile.typical_objections,
          trust_signals: generation.profile.trust_signals,
          personas: generation.personas?.map((p) => ({ role: p.role, goals: p.goals, objections: p.common_objections })),
          competitors: generation.competitors?.map((c) => ({ name: c.competitor_name, type: c.competitor_type, weaknesses: c.weaknesses })),
          value_propositions: generation.valuePropositions?.map((v) => ({ type: v.proposition_type, content: v.content })),
        },
        confidenceScore: (generation.profile.confidence_score ?? 85) / 100,
        importanceScore: 0.95,
        workspaceId,
      });
    } catch {
      // Memory storage is best-effort
    }
  }

  // ----------------------------------------------------------
  // Load Revenue DNA
  // ----------------------------------------------------------

  async loadRevenueDNA(workspaceId: string): Promise<FullRevenueDNA | null> {
    const { data: profile } = await supabase
      .from('revenue_dna_profiles')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!profile) return null;

    const [personas, competitors, valueProps] = await Promise.all([
      supabase.from('buyer_personas').select('*').eq('revenue_dna_id', profile.id).order('created_at'),
      supabase.from('competitor_intelligence').select('*').eq('revenue_dna_id', profile.id).order('created_at'),
      supabase.from('value_propositions').select('*').eq('revenue_dna_id', profile.id).order('created_at'),
    ]);

    return {
      profile: profile as RevenueDNAProfile,
      personas: (personas.data ?? []) as BuyerPersona[],
      competitors: (competitors.data ?? []) as CompetitorIntelligence[],
      valuePropositions: (valueProps.data ?? []) as ValueProposition[],
    };
  }

  // ----------------------------------------------------------
  // Update profile fields (user edits)
  // ----------------------------------------------------------

  async updateProfile(profileId: string, updates: Partial<RevenueDNAProfile>): Promise<void> {
    const { error } = await supabase
      .from('revenue_dna_profiles')
      .update(updates)
      .eq('id', profileId);
    if (error) throw new Error(error.message);
  }

  async updatePersona(personaId: string, updates: Partial<BuyerPersona>): Promise<void> {
    const { error } = await supabase
      .from('buyer_personas')
      .update(updates)
      .eq('id', personaId);
    if (error) throw new Error(error.message);
  }

  async updateCompetitor(competitorId: string, updates: Partial<CompetitorIntelligence>): Promise<void> {
    const { error } = await supabase
      .from('competitor_intelligence')
      .update(updates)
      .eq('id', competitorId);
    if (error) throw new Error(error.message);
  }

  async updateValueProp(vpId: string, updates: Partial<ValueProposition>): Promise<void> {
    const { error } = await supabase
      .from('value_propositions')
      .update(updates)
      .eq('id', vpId);
    if (error) throw new Error(error.message);
  }
}

export const revenueDNAService = new RevenueDNAService();
