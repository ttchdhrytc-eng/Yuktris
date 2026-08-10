// ============================================================
// ProspectDiscoveryService — Main orchestrator for the full discovery pipeline
// ============================================================
//
// Pipeline:
//   Revenue Strategy → Target Account Lists → Provider Selection →
//   Company Discovery → Company Qualification → Decision Maker Discovery →
//   Contact Enrichment → Buying Signal Evaluation → Prospect Scoring →
//   Duplicate Detection → CRM Matching → Prospect Queue
//
// All discovery runs asynchronously through discovery_jobs.

import { supabase } from '@/lib/supabase';
import { aiGateway } from '@/services/ai/AIGateway';
import { knowledgeGraphService } from '@/services/knowledge-graph/KnowledgeGraphService';
import { memoryEngine } from '@/services/memory/MemoryEngine';
import { discoveryProviderManager } from './DiscoveryProviderManager';
import { duplicateDetectionService } from './DuplicateDetectionService';
import { prospectScoringService } from './ProspectScoringService';
import type {
  DiscoveryJob, CompanyWithDetails, ContactWithDetails,
  DiscoveryDashboard, ProspectList, SmartFilters,
  CompanySearchParams, CompanySearchResult, ContactSearchResult,
  SignalType, Company, Contact, CompanySignal, ProspectScore,
  ProspectRecommendation,
} from '@/types/prospect-discovery-engine';

class ProspectDiscoveryService {
  // ----------------------------------------------------------
  // Run full discovery pipeline
  // ----------------------------------------------------------

  async runDiscovery(workspaceId: string, revenueStrategyId?: string): Promise<string> {
    // Create a discovery job
    const { data: job, error } = await supabase
      .from('discovery_jobs')
      .insert({
        workspace_id: workspaceId,
        revenue_strategy_id: revenueStrategyId ?? null,
        job_type: 'full_pipeline',
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    try {
      // Step 1: Load Revenue Strategy for search criteria
      const strategy = await this.loadRevenueStrategy(workspaceId, revenueStrategyId);

      // Step 2: Company Discovery via providers
      const searchParams: CompanySearchParams = {
        industry: strategy.best_industry ?? undefined,
        companySize: strategy.best_company_size ?? undefined,
        geography: strategy.best_geography ?? undefined,
        limit: 25,
      };

      const { results: companyResults, providerUsed } = await discoveryProviderManager.searchCompanies(workspaceId, searchParams);
      await this.updateJob(job.id, { provider_used: providerUsed, companies_found: companyResults.length });

      // Step 3: Persist companies with duplicate detection
      const companyIds: string[] = [];
      let duplicatesMerged = 0;
      for (const result of companyResults) {
        const { company, created } = await duplicateDetectionService.findOrCreateCompany(workspaceId, {
          name: result.name,
          website: result.website ?? null,
          industry: result.industry ?? null,
          description: result.description ?? null,
          employee_count: result.employee_count ?? null,
          estimated_revenue: result.estimated_revenue ?? null,
          headquarters: result.headquarters ?? null,
          country: result.country ?? null,
          funding_stage: result.funding_stage ?? null,
          growth_stage: result.growth_stage ?? null,
          confidence_score: result.confidence,
        });
        companyIds.push(company.id);
        if (!created) duplicatesMerged++;

        // Store technologies
        if (result.technologies?.length) {
          await this.storeTechnologies(workspaceId, company.id, result.technologies);
        }
      }
      await this.updateJob(job.id, { duplicates_merged: duplicatesMerged });

      // Step 4: Buying Signal Evaluation
      for (const companyId of companyIds) {
        try {
          const company = await this.getCompany(companyId);
          if (!company) continue;
          const { signals } = await discoveryProviderManager.detectSignals(workspaceId, company.name, company.website ?? undefined);
          for (const signal of signals) {
            await this.storeSignal(workspaceId, companyId, signal.type, signal.data, signal.strength);
          }
        } catch { /* best-effort */ }
      }

      // Step 5: Decision Maker Discovery
      let totalContacts = 0;
      for (const companyId of companyIds) {
        try {
          const company = await this.getCompany(companyId);
          if (!company) continue;
          const roles = strategy.best_decision_makers ?? ['CEO', 'VP Sales', 'CTO'];
          const { results: contactResults } = await discoveryProviderManager.searchContacts(workspaceId, {
            company_name: company.name,
            roles,
            limit: 5,
          });
          for (const cResult of contactResults) {
            const { contact, created } = await duplicateDetectionService.findOrCreateContact(workspaceId, companyId, {
              first_name: cResult.first_name,
              last_name: cResult.last_name,
              full_name: cResult.full_name,
              job_title: cResult.job_title,
              department: cResult.department,
              seniority: cResult.seniority,
              linkedin_url: cResult.linkedin_url,
              public_email: cResult.public_email,
              confidence_score: cResult.confidence,
            });
            totalContacts++;
            if (created) {
              // Step 6: Contact Enrichment
              try {
                const { result: enrichment } = await discoveryProviderManager.enrichContact(workspaceId, contact.id);
                await this.storeContactProfile(workspaceId, contact.id, enrichment);
              } catch { /* best-effort */ }
            }
          }
        } catch { /* best-effort */ }
      }
      await this.updateJob(job.id, { contacts_found: totalContacts });

      // Step 7: Prospect Scoring + Recommendations
      for (const companyId of companyIds) {
        try {
          const company = await this.getCompany(companyId);
          if (!company) continue;
          const signals = await this.getCompanySignals(companyId);

          const scoringInput = {
            company: {
              name: company.name,
              industry: company.industry ?? undefined,
              size: company.size ?? company.employee_count ?? undefined,
              growth_score: company.growth_score,
              market_score: company.market_score,
            },
            signals: signals.map((s) => ({ type: s.signal_type, strength: s.signal_strength })),
            revenueStrategy: { best_icp: strategy.best_icp, confidence_score: strategy.confidence_score },
          };

          const score = await prospectScoringService.scoreProspect(workspaceId, scoringInput);
          await prospectScoringService.persistScore(workspaceId, companyId, null, score);

          // Generate recommendation
          const rec = await prospectScoringService.generateRecommendation(
            workspaceId,
            { name: company.name, industry: company.industry ?? undefined, size: company.size ?? undefined },
            null,
            signals.map((s) => ({ type: s.signal_type, strength: s.signal_strength })),
            { best_messaging_angle: strategy.best_messaging_angle ?? undefined, best_outreach_channel: strategy.best_outreach_channel ?? undefined },
          );
          await prospectScoringService.persistRecommendation(workspaceId, companyId, null, rec);
        } catch { /* best-effort */ }
      }

      // Step 8: Populate Knowledge Graph
      await this.populateKnowledgeGraph(workspaceId, companyIds);

      // Step 9: Store in Memory
      await this.storeInMemory(workspaceId, companyIds.length, totalContacts);

      // Complete the job
      await this.updateJob(job.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });

      return job.id;
    } catch (err) {
      await this.updateJob(job.id, {
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Discovery failed',
        completed_at: new Date().toISOString(),
      });
      throw err;
    }
  }

  // ----------------------------------------------------------
  // Load Revenue Strategy
  // ----------------------------------------------------------

  private async loadRevenueStrategy(workspaceId: string, strategyId?: string): Promise<{
    best_icp: Record<string, unknown>;
    best_industry: string | null;
    best_geography: string | null;
    best_company_size: string | null;
    best_decision_makers: string[];
    best_messaging_angle: string | null;
    best_outreach_channel: string | null;
    confidence_score: number;
  }> {
    let query = supabase.from('revenue_strategies').select('*').eq('workspace_id', workspaceId);
    if (strategyId) query = query.eq('id', strategyId);
    const { data } = await query.order('updated_at', { ascending: false }).limit(1).maybeSingle();

    if (data) {
      return {
        best_icp: data.best_icp ?? {},
        best_industry: data.best_industry,
        best_geography: data.best_geography,
        best_company_size: data.best_company_size,
        best_decision_makers: data.best_decision_makers ?? [],
        best_messaging_angle: data.best_messaging_angle,
        best_outreach_channel: data.best_outreach_channel,
        confidence_score: data.confidence_score ?? 0,
      };
    }

    // Fallback defaults
    return {
      best_icp: {},
      best_industry: null,
      best_geography: null,
      best_company_size: null,
      best_decision_makers: ['CEO', 'VP Sales', 'CTO'],
      best_messaging_angle: null,
      best_outreach_channel: null,
      confidence_score: 0,
    };
  }

  // ----------------------------------------------------------
  // Data access helpers
  // ----------------------------------------------------------

  private async getCompany(companyId: string): Promise<Company | null> {
    const { data } = await supabase.from('companies').select('*').eq('id', companyId).maybeSingle();
    return data as Company | null;
  }

  private async getCompanySignals(companyId: string): Promise<CompanySignal[]> {
    const { data } = await supabase.from('company_signals').select('*').eq('company_id', companyId);
    return (data ?? []) as CompanySignal[];
  }

  private async storeTechnologies(workspaceId: string, companyId: string, technologies: string[]): Promise<void> {
    const rows = technologies.map((tech) => ({
      workspace_id: workspaceId,
      company_id: companyId,
      technology_name: tech,
      confidence_score: 0.7,
    }));
    if (rows.length) await supabase.from('company_technologies').insert(rows);
  }

  private async storeSignal(
    workspaceId: string,
    companyId: string,
    type: SignalType,
    data: Record<string, unknown>,
    strength: number,
  ): Promise<void> {
    await supabase.from('company_signals').insert({
      workspace_id: workspaceId,
      company_id: companyId,
      signal_type: type,
      signal_data: data,
      signal_strength: strength,
      confidence_score: 0.7,
    });
  }

  private async storeContactProfile(workspaceId: string, contactId: string, enrichment: {
    personal_summary?: string;
    years_at_company?: string;
    previous_companies?: string[];
    education?: string[];
    skills?: string[];
    technologies?: string[];
    public_activity?: Record<string, unknown>;
    recent_posts?: unknown[];
    recent_news?: unknown[];
    website_signals?: unknown[];
    buying_signals?: unknown[];
    confidence: number;
  }): Promise<void> {
    const { data: existing } = await supabase
      .from('contact_profiles')
      .select('id')
      .eq('contact_id', contactId)
      .maybeSingle();

    if (existing) {
      await supabase.from('contact_profiles').update({
        personal_summary: enrichment.personal_summary,
        years_company: enrichment.years_at_company,
        previous_companies: enrichment.previous_companies ?? [],
        education: enrichment.education ?? [],
        skills: enrichment.skills ?? [],
        public_activity: enrichment.public_activity ?? {},
        recent_posts: enrichment.recent_posts ?? [],
        recent_news: enrichment.recent_news ?? [],
        website_signals: enrichment.website_signals ?? [],
        buying_signals: enrichment.buying_signals ?? [],
        confidence_score: enrichment.confidence,
      }).eq('id', existing.id);
    } else {
      await supabase.from('contact_profiles').insert({
        contact_id: contactId,
        workspace_id: workspaceId,
        personal_summary: enrichment.personal_summary,
        years_company: enrichment.years_at_company,
        previous_companies: enrichment.previous_companies ?? [],
        education: enrichment.education ?? [],
        skills: enrichment.skills ?? [],
        public_activity: enrichment.public_activity ?? {},
        recent_posts: enrichment.recent_posts ?? [],
        recent_news: enrichment.recent_news ?? [],
        website_signals: enrichment.website_signals ?? [],
        buying_signals: enrichment.buying_signals ?? [],
        confidence_score: enrichment.confidence,
      });
    }

    // Store skills
    if (enrichment.skills?.length) {
      await supabase.from('contact_skills').insert(
        enrichment.skills.map((skill) => ({
          workspace_id: workspaceId,
          contact_id: contactId,
          skill_name: skill,
          confidence_score: enrichment.confidence,
        })),
      );
    }
  }

  private async updateJob(jobId: string, updates: Record<string, unknown>): Promise<void> {
    await supabase.from('discovery_jobs').update(updates).eq('id', jobId);
  }

  // ----------------------------------------------------------
  // Knowledge Graph population
  // ----------------------------------------------------------

  private async populateKnowledgeGraph(workspaceId: string, companyIds: string[]): Promise<void> {
    try {
      const entities: Array<{ nodeType: string; externalId: string; displayName: string; properties: Record<string, unknown> }> = [];
      const relationships: Array<{ sourceExternalId: string; sourceNodeType: string; targetExternalId: string; targetNodeType: string; relationshipType: string }> = [];

      for (const companyId of companyIds) {
        const company = await this.getCompany(companyId);
        if (!company) continue;
        const extId = `company_${company.id}`;
        entities.push({
          nodeType: 'company',
          externalId: extId,
          displayName: company.name,
          properties: { industry: company.industry, website: company.website, size: company.employee_count },
        });
        relationships.push({
          sourceExternalId: `workspace_${workspaceId}`,
          sourceNodeType: 'workspace',
          targetExternalId: extId,
          targetNodeType: 'company',
          relationshipType: 'DISCOVERED_COMPANY',
        });
      }

      if (entities.length) {
        await knowledgeGraphService.ingestBatch({
          workspaceId,
          entities: entities.map((e) => ({
            nodeType: e.nodeType as any,
            externalId: e.externalId,
            displayName: e.displayName,
            properties: e.properties,
            confidenceScore: 0.8,
          })),
          relationships: relationships.map((r) => ({
            sourceExternalId: r.sourceExternalId,
            sourceNodeType: r.sourceNodeType as any,
            targetExternalId: r.targetExternalId,
            targetNodeType: r.targetNodeType as any,
            relationshipType: r.relationshipType as any,
            confidenceScore: 0.8,
          })),
        });
      }
    } catch { /* best-effort */ }
  }

  // ----------------------------------------------------------
  // Memory storage
  // ----------------------------------------------------------

  private async storeInMemory(workspaceId: string, companyCount: number, contactCount: number): Promise<void> {
    try {
      await memoryEngine.store({
        entityType: 'discovery_run',
        entityId: `discovery_${workspaceId}_${Date.now()}`,
        memoryType: 'prospect_discovery',
        title: 'Prospect Discovery Run',
        summary: `Discovered ${companyCount} companies and ${contactCount} contacts`,
        content: { companyCount, contactCount, timestamp: new Date().toISOString() },
        confidenceScore: 0.8,
        importanceScore: 0.85,
        workspaceId,
      });
    } catch { /* best-effort */ }
  }

  // ----------------------------------------------------------
  // Load dashboard data
  // ----------------------------------------------------------

  async loadDashboard(workspaceId: string): Promise<DiscoveryDashboard> {
    const [companies, contacts, jobs, scores] = await Promise.all([
      supabase.from('companies').select('id, opportunity_score, name, industry, website, size, country, growth_score, market_score, confidence_score, created_at, updated_at').eq('workspace_id', workspaceId).order('opportunity_score', { ascending: false }).limit(50),
      supabase.from('contacts').select('id, first_name, last_name, full_name, job_title, department, seniority, linkedin_url, company_id, confidence_score, created_at, updated_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(50),
      supabase.from('discovery_jobs').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(10),
      supabase.from('prospect_scores').select('overall_prospect_score').eq('workspace_id', workspaceId),
    ]);

    const companyList = (companies.data ?? []) as Company[];
    const contactList = (contacts.data ?? []) as Contact[];
    const jobList = (jobs.data ?? []) as DiscoveryJob[];
    const scoreList = (scores.data ?? []) as { overall_prospect_score: number }[];

    // Load top companies with details
    const topCompanyIds = companyList.slice(0, 5).map((c) => c.id);
    const topCompanies: CompanyWithDetails[] = [];
    for (const company of companyList.slice(0, 5)) {
      const [locations, technologies, signals, score, rec] = await Promise.all([
        supabase.from('company_locations').select('*').eq('company_id', company.id),
        supabase.from('company_technologies').select('*').eq('company_id', company.id),
        supabase.from('company_signals').select('*').eq('company_id', company.id),
        supabase.from('prospect_scores').select('*').eq('company_id', company.id).order('scored_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('prospect_recommendations').select('*').eq('company_id', company.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      topCompanies.push({
        ...company,
        locations: (locations.data ?? []) as CompanyWithDetails['locations'],
        technologies: (technologies.data ?? []) as CompanyWithDetails['technologies'],
        signals: (signals.data ?? []) as CompanySignal[],
        score: (score.data ?? null) as ProspectScore | null,
        recommendation: (rec.data ?? null) as ProspectRecommendation | null,
      });
    }

    // Load top contacts with details
    const topContacts: ContactWithDetails[] = [];
    for (const contact of contactList.slice(0, 5)) {
      const [profile, socialProfiles, skills, score, rec, companyData] = await Promise.all([
        supabase.from('contact_profiles').select('*').eq('contact_id', contact.id).maybeSingle(),
        supabase.from('contact_social_profiles').select('*').eq('contact_id', contact.id),
        supabase.from('contact_skills').select('*').eq('contact_id', contact.id),
        supabase.from('prospect_scores').select('*').eq('contact_id', contact.id).order('scored_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('prospect_recommendations').select('*').eq('contact_id', contact.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        contact.company_id ? supabase.from('companies').select('id, name, industry').eq('id', contact.company_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      topContacts.push({
        ...contact,
        profile: (profile.data ?? null) as ContactWithDetails['profile'],
        social_profiles: (socialProfiles.data ?? []) as ContactWithDetails['social_profiles'],
        skills: (skills.data ?? []) as ContactWithDetails['skills'],
        score: (score.data ?? null) as ProspectScore | null,
        recommendation: (rec.data ?? null) as ProspectRecommendation | null,
        company: (companyData.data ?? null) as ContactWithDetails['company'],
      });
    }

    const avgScore = scoreList.length > 0
      ? Math.round(scoreList.reduce((s, sc) => s + (sc.overall_prospect_score ?? 0), 0) / scoreList.length)
      : 0;

    const activeJobs = jobList.filter((j) => j.status === 'processing' || j.status === 'pending').length;

    return {
      totalCompanies: companyList.length,
      totalContacts: contactList.length,
      totalQualified: scoreList.filter((s) => s.overall_prospect_score >= 70).length,
      avgScore,
      activeJobs,
      providersActive: 0,
      recentJobs: jobList,
      topCompanies,
      topContacts,
    };
  }

  // ----------------------------------------------------------
  // Load companies with filters
  // ----------------------------------------------------------

  async loadCompanies(workspaceId: string, filters?: SmartFilters): Promise<CompanyWithDetails[]> {
    let query = supabase.from('companies').select('*').eq('workspace_id', workspaceId);

    if (filters?.industry) query = query.ilike('industry', `%${filters.industry}%`);
    if (filters?.companySize) query = query.ilike('size', `%${filters.companySize}%`);
    if (filters?.country) query = query.ilike('country', `%${filters.country}%`);
    if (filters?.minScore) query = query.gte('opportunity_score', filters.minScore);

    query = query.order('opportunity_score', { ascending: false }).limit(100);
    const { data: companies } = await query;

    const result: CompanyWithDetails[] = [];
    for (const company of (companies ?? []) as Company[]) {
      const [locations, technologies, signals, score, rec] = await Promise.all([
        supabase.from('company_locations').select('*').eq('company_id', company.id),
        supabase.from('company_technologies').select('*').eq('company_id', company.id),
        supabase.from('company_signals').select('*').eq('company_id', company.id),
        supabase.from('prospect_scores').select('*').eq('company_id', company.id).order('scored_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('prospect_recommendations').select('*').eq('company_id', company.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      result.push({
        ...company,
        locations: (locations.data ?? []) as CompanyWithDetails['locations'],
        technologies: (technologies.data ?? []) as CompanyWithDetails['technologies'],
        signals: (signals.data ?? []) as CompanySignal[],
        score: (score.data ?? null) as ProspectScore | null,
        recommendation: (rec.data ?? null) as ProspectRecommendation | null,
      });
    }
    return result;
  }

  // ----------------------------------------------------------
  // Load contacts with filters
  // ----------------------------------------------------------

  async loadContacts(workspaceId: string, filters?: SmartFilters): Promise<ContactWithDetails[]> {
    let query = supabase.from('contacts').select('*').eq('workspace_id', workspaceId);

    if (filters?.department) query = query.ilike('department', `%${filters.department}%`);
    if (filters?.persona) query = query.ilike('job_title', `%${filters.persona}%`);
    if (filters?.title) query = query.ilike('job_title', `%${filters.title}%`);

    query = query.order('created_at', { ascending: false }).limit(100);
    const { data: contacts } = await query;

    const result: ContactWithDetails[] = [];
    for (const contact of (contacts ?? []) as Contact[]) {
      const [profile, socialProfiles, skills, score, rec, companyData] = await Promise.all([
        supabase.from('contact_profiles').select('*').eq('contact_id', contact.id).maybeSingle(),
        supabase.from('contact_social_profiles').select('*').eq('contact_id', contact.id),
        supabase.from('contact_skills').select('*').eq('contact_id', contact.id),
        supabase.from('prospect_scores').select('*').eq('contact_id', contact.id).order('scored_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('prospect_recommendations').select('*').eq('contact_id', contact.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        contact.company_id ? supabase.from('companies').select('id, name, industry').eq('id', contact.company_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      result.push({
        ...contact,
        profile: (profile.data ?? null) as ContactWithDetails['profile'],
        social_profiles: (socialProfiles.data ?? []) as ContactWithDetails['social_profiles'],
        skills: (skills.data ?? []) as ContactWithDetails['skills'],
        score: (score.data ?? null) as ProspectScore | null,
        recommendation: (rec.data ?? null) as ProspectRecommendation | null,
        company: (companyData.data ?? null) as ContactWithDetails['company'],
      });
    }
    return result;
  }

  // ----------------------------------------------------------
  // Load discovery jobs
  // ----------------------------------------------------------

  async loadJobs(workspaceId: string): Promise<DiscoveryJob[]> {
    const { data } = await supabase
      .from('discovery_jobs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(20);
    return (data ?? []) as DiscoveryJob[];
  }

  // ----------------------------------------------------------
  // Load provider sources
  // ----------------------------------------------------------

  async loadProviders(workspaceId: string) {
    await discoveryProviderManager.ensureProviderSources(workspaceId);
    return discoveryProviderManager.getProviderSources(workspaceId);
  }

  // ----------------------------------------------------------
  // Load sync logs
  // ----------------------------------------------------------

  async loadSyncLogs(workspaceId: string) {
    const { data } = await supabase
      .from('provider_sync_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(30);
    return data ?? [];
  }

  // ----------------------------------------------------------
  // Prospect Lists
  // ----------------------------------------------------------

  async loadProspectLists(workspaceId: string): Promise<ProspectList[]> {
    const { data } = await supabase
      .from('prospect_lists')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    return (data ?? []) as ProspectList[];
  }

  async createProspectList(workspaceId: string, name: string, description?: string): Promise<ProspectList> {
    const { data, error } = await supabase
      .from('prospect_lists')
      .insert({ workspace_id: workspaceId, list_name: name, description: description ?? null })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as ProspectList;
  }

  async addToProspectList(workspaceId: string, listId: string, companyId?: string, contactId?: string): Promise<void> {
    await supabase.from('prospect_list_members').insert({
      prospect_list_id: listId,
      workspace_id: workspaceId,
      company_id: companyId ?? null,
      contact_id: contactId ?? null,
    });
    // Update count
    const { count } = await supabase.from('prospect_list_members').select('*', { count: 'exact', head: true }).eq('prospect_list_id', listId);
    await supabase.from('prospect_lists').update({ member_count: count ?? 0 }).eq('id', listId);
  }
}

export const prospectDiscoveryService = new ProspectDiscoveryService();
