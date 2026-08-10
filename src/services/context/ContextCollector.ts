// ============================================================
// ContextCollector — Discovers and collects context from all sources
// ============================================================

import { supabase } from '@/lib/supabase';
import { knowledgeGraphService } from '@/services/knowledge-graph';
import { revenueIntelligenceEngine } from '@/services/revenue-intelligence';
import { researchEngine } from '@/services/research';
import { memoryEngine } from '@/services/memory';
import type {
  ContextFragment,
  ContextSourceId,
  ContextRequest,
  ContextPriority,
} from '@/types/context-engine';

class ContextCollector {
  private sourceLabels: Record<ContextSourceId, string> = {
    knowledge_graph: 'Knowledge Graph',
    revenue_intelligence: 'Revenue Intelligence',
    research_intelligence: 'Research Intelligence',
    google_workspace: 'Google Workspace',
    crm: 'CRM',
    linkedin: 'LinkedIn',
    firecrawl: 'Firecrawl',
    tavily: 'Tavily',
    documents: 'Documents',
    emails: 'Emails',
    calendar_events: 'Calendar Events',
    meetings: 'Meetings',
    tasks: 'Tasks',
    notes: 'Notes',
    company_profile: 'Company Profile',
    contacts: 'Contacts',
    past_ai_outputs: 'Past AI Outputs',
    user_preferences: 'User Preferences',
    conversation_history: 'Conversation History',
    memory_engine: 'Memory Engine',
  };

  async collect(request: ContextRequest): Promise<ContextFragment[]> {
    const fragments: ContextFragment[] = [];
    const allowedSources = request.sources ?? this.getAllSources();
    const excluded = request.excludeSources ?? [];

    const sources = allowedSources.filter((s) => !excluded.includes(s));

    const promises = sources.map((source) => this.collectFromSource(source, request));
    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        fragments.push(...result.value);
      }
    }

    return fragments;
  }

  private async collectFromSource(source: ContextSourceId, request: ContextRequest): Promise<ContextFragment[]> {
    try {
      switch (source) {
        case 'knowledge_graph':
          return await this.collectFromKnowledgeGraph(request);
        case 'revenue_intelligence':
          return await this.collectFromRevenueIntelligence(request);
        case 'research_intelligence':
          return await this.collectFromResearchIntelligence(request);
        case 'company_profile':
          return await this.collectCompanyProfile(request);
        case 'user_preferences':
          return await this.collectUserPreferences(request);
        case 'conversation_history':
          return await this.collectConversationHistory(request);
        case 'memory_engine':
          return await this.collectFromMemoryEngine(request);
        default:
          return [];
      }
    } catch {
      return [];
    }
  }

  private async collectFromKnowledgeGraph(request: ContextRequest): Promise<ContextFragment[]> {
    if (!request.entityId) return [];

    try {
      const { nodes, edges } = await knowledgeGraphService.getRelationships(request.entityId);

      if (nodes.length === 0) return [];

      return [{
        source: 'knowledge_graph',
        source_label: this.sourceLabels.knowledge_graph,
        priority: 'high',
        content: {
          connected_nodes: nodes.map((n) => ({ id: n.id, type: n.node_type, name: n.display_name, properties: n.properties })),
          relationships: edges.map((e) => ({ id: e.id, type: e.relationship_type, source: e.source_node_id, target: e.target_node_id, confidence: e.confidence_score })),
        },
        token_estimate: this.estimateTokens({ nodes: nodes.length, edges: edges.length }),
        confidence: 0.9,
        retrieved_at: new Date().toISOString(),
      }];
    } catch {
      return [];
    }
  }

  private async collectFromRevenueIntelligence(request: ContextRequest): Promise<ContextFragment[]> {
    if (!request.entityId) return [];

    try {
      const profile = await revenueIntelligenceEngine.getProfile(request.entityId);
      if (!profile) return [];

      const signals = await revenueIntelligenceEngine.getSignals(request.entityId);
      const recommendations = await revenueIntelligenceEngine.getRecommendations(request.entityId);

      return [{
        source: 'revenue_intelligence',
        source_label: this.sourceLabels.revenue_intelligence,
        priority: 'critical',
        content: {
          overall_score: profile.overall_score,
          icp_score: profile.icp_score,
          opportunity_score: profile.opportunity_score,
          buying_intent_score: profile.buying_intent_score,
          growth_score: profile.growth_score,
          risk_score: profile.risk_score,
          priority: profile.priority,
          recommended_action: profile.recommended_action,
          confidence_score: profile.confidence_score,
          signals: signals.map((s) => ({ type: s.signal_type, description: s.description, strength: s.signal_strength })),
          recommendations: recommendations.map((r) => ({ type: r.recommendation_type, title: r.title, description: r.description })),
        },
        token_estimate: this.estimateTokens({ profile, signals: signals.length, recommendations: recommendations.length }),
        confidence: 0.85,
        retrieved_at: new Date().toISOString(),
      }];
    } catch {
      return [];
    }
  }

  private async collectFromResearchIntelligence(request: ContextRequest): Promise<ContextFragment[]> {
    if (!request.entityId) return [];

    try {
      const { data, error } = await supabase
        .from('company_intelligence')
        .select('*')
        .eq('id', request.entityId)
        .maybeSingle();

      if (error || !data) return [];

      return [{
        source: 'research_intelligence',
        source_label: this.sourceLabels.research_intelligence,
        priority: 'high',
        content: {
          company_name: data.company_name,
          website: data.website,
          industry: data.industry,
          business_model: data.business_model,
          summary: data.summary,
          technology_stack: data.technology_stack,
          services: data.services,
          products: data.products,
          buying_signals: data.buying_signals,
          growth_signals: data.growth_signals,
          decision_makers: data.decision_makers,
          competitive_positioning: data.competitive_positioning,
          confidence_score: data.confidence_score,
        },
        token_estimate: this.estimateTokens(data),
        confidence: data.confidence_score ?? 0.7,
        retrieved_at: new Date().toISOString(),
      }];
    } catch {
      return [];
    }
  }

  private async collectCompanyProfile(request: ContextRequest): Promise<ContextFragment[]> {
    if (!request.workspaceId) return [];

    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('name, website, industry, country')
        .eq('id', request.workspaceId)
        .maybeSingle();

      if (error || !data) return [];

      return [{
        source: 'company_profile',
        source_label: this.sourceLabels.company_profile,
        priority: 'medium',
        content: {
          workspace_name: data.name,
          website: data.website,
          industry: data.industry,
          country: data.country,
        },
        token_estimate: 50,
        confidence: 1.0,
        retrieved_at: new Date().toISOString(),
      }];
    } catch {
      return [];
    }
  }

  private async collectUserPreferences(request: ContextRequest): Promise<ContextFragment[]> {
    if (!request.userId) return [];

    return [{
      source: 'user_preferences',
      source_label: this.sourceLabels.user_preferences,
      priority: 'low',
      content: {
        user_id: request.userId,
        preferences: {},
      },
      token_estimate: 20,
      confidence: 1.0,
      retrieved_at: new Date().toISOString(),
    }];
  }

  private async collectConversationHistory(request: ContextRequest): Promise<ContextFragment[]> {
    if (!request.conversationId) return [];

    return [{
      source: 'conversation_history',
      source_label: this.sourceLabels.conversation_history,
      priority: 'high',
      content: {
        conversation_id: request.conversationId,
        history: [],
      },
      token_estimate: 50,
      confidence: 1.0,
      retrieved_at: new Date().toISOString(),
    }];
  }

  private async collectFromMemoryEngine(request: ContextRequest): Promise<ContextFragment[]> {
    if (!request.entityId || !request.entityType) return [];

    try {
      const memories = await memoryEngine.getMemoriesByEntity(
        request.entityType,
        request.entityId,
        request.workspaceId,
      );

      if (memories.length === 0) return [];

      const relationships: Record<string, unknown>[] = [];
      for (const mem of memories.slice(0, 5)) {
        const rels = await memoryEngine.getRelationships(mem.id);
        relationships.push(...rels);
      }

      return [{
        source: 'memory_engine',
        source_label: this.sourceLabels.memory_engine,
        priority: 'high',
        content: {
          memories: memories.map((m) => ({
            id: m.id,
            type: m.memory_type,
            title: m.title,
            summary: m.summary,
            confidence: m.confidence_score,
            freshness: m.freshness_score,
            importance: m.importance_score,
            content: m.content,
          })),
          relationships: relationships.map((r) => ({
            source: r.source_memory_id,
            target: r.target_memory_id,
            type: r.relationship_type,
            strength: r.strength,
          })),
        },
        token_estimate: this.estimateTokens({ memories: memories.length, relationships: relationships.length }),
        confidence: memories.length > 0 ? Math.max(...memories.map((m) => m.confidence_score)) : 0.7,
        retrieved_at: new Date().toISOString(),
      }];
    } catch {
      return [];
    }
  }

  private estimateTokens(data: unknown): number {
    const json = JSON.stringify(data);
    return Math.ceil(json.length / 4);
  }

  private getAllSources(): ContextSourceId[] {
    return [
      'knowledge_graph', 'revenue_intelligence', 'research_intelligence',
      'company_profile', 'user_preferences', 'conversation_history',
      'memory_engine',
    ];
  }

  getSourceLabel(source: ContextSourceId): string {
    return this.sourceLabels[source] ?? source;
  }

  getAllSourceLabels(): { id: ContextSourceId; label: string }[] {
    return (Object.keys(this.sourceLabels) as ContextSourceId[]).map((id) => ({
      id,
      label: this.sourceLabels[id],
    }));
  }
}

export const contextCollector = new ContextCollector();
