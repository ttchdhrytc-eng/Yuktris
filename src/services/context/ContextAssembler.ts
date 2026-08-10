// ============================================================
// ContextAssembler — Assembles fragments into structured context
// ============================================================

import type {
  ContextFragment,
  AssembledContext,
  ContextMetadata,
  ContextSourceId,
  SourceContribution,
  ContextRequest,
} from '@/types/context-engine';

class ContextAssembler {
  assemble(params: {
    fragments: ContextFragment[];
    request: ContextRequest;
    tokenCount: number;
    compressionRatio: number;
    qualityScore: number;
    buildDurationMs: number;
  }): AssembledContext {
    const { fragments, request, tokenCount, compressionRatio, qualityScore, buildDurationMs } = params;

    const context: AssembledContext = {
      system: this.buildSystemContext(request),
      metadata: this.buildMetadata(fragments, tokenCount, compressionRatio, qualityScore, buildDurationMs),
    };

    // Business context
    if (request.includeBusinessContext) {
      const companyProfile = fragments.find((f) => f.source === 'company_profile');
      if (companyProfile) {
        context.business = this.extractBusinessContext(companyProfile.content);
      }
    }

    // Company context
    const research = fragments.find((f) => f.source === 'research_intelligence');
    if (research) {
      context.company = this.extractCompanyContext(research.content);
      context.research = this.extractResearchContext(research.content);
    }

    // Revenue context
    const revenue = fragments.find((f) => f.source === 'revenue_intelligence');
    if (revenue) {
      context.revenue = this.extractRevenueContext(revenue.content);
    }

    // Relationship context
    const graph = fragments.find((f) => f.source === 'knowledge_graph');
    if (graph) {
      context.relationship = this.extractRelationshipContext(graph.content);
    }

    // User context
    const userPrefs = fragments.find((f) => f.source === 'user_preferences');
    if (userPrefs) {
      context.user = this.extractUserContext(userPrefs.content, request.userId);
    }

    // Conversation context
    const conversation = fragments.find((f) => f.source === 'conversation_history');
    if (conversation) {
      context.conversation = this.extractConversationContext(conversation.content);
    }

    // Execution context
    if (request.conversationId) {
      context.execution = {
        execution_id: null,
        agent_id: null,
        agent_type: null,
        current_step: null,
        previous_outputs: [],
      };
    }

    return context;
  }

  private buildSystemContext(request: ContextRequest): { role: string; instructions: string; capabilities: string[]; limitations: string[] } {
    return {
      role: 'Yuktris Assistant',
      instructions: 'You are a Yuktris Assistant. Use the provided context to help with revenue-related tasks. Always base your responses on the context provided and never fabricate information.',
      capabilities: [
        'Analyze company intelligence',
        'Score opportunities',
        'Detect buying signals',
        'Recommend next best actions',
        'Generate outreach strategies',
        'Analyze relationships',
      ],
      limitations: [
        'Cannot access real-time data beyond the provided context',
        'Cannot send emails or make API calls',
        'Cannot modify any data — read-only analysis',
      ],
    };
  }

  private extractBusinessContext(content: Record<string, unknown>): AssembledContext extends { business: infer T } ? T : never {
    return {
      workspace_name: (content.workspace_name as string) ?? '',
      industry: (content.industry as string) ?? null,
      website: (content.website as string) ?? null,
      description: null,
      target_market: [],
    } as AssembledContext extends { business: infer T } ? T : never;
  }

  private extractCompanyContext(content: Record<string, unknown>): AssembledContext extends { company: infer T } ? T : never {
    return {
      company_id: (content.id as string) ?? '',
      company_name: (content.company_name as string) ?? '',
      website: (content.website as string) ?? null,
      industry: (content.industry as string) ?? null,
      business_model: (content.business_model as string) ?? null,
      company_size: (content.company_size as string) ?? null,
      summary: (content.summary as string) ?? null,
      technology_stack: ((content.technology_stack as { name: string }[]) ?? []).map((t) => t.name),
      services: ((content.services as { name: string }[]) ?? []).map((s) => s.name),
      products: ((content.products as { name: string }[]) ?? []).map((p) => p.name),
      locations: (content.locations as string[]) ?? [],
      social_profiles: (content.social_profiles as { platform: string; url: string }[]) ?? [],
      confidence_score: (content.confidence_score as number) ?? null,
    } as AssembledContext extends { company: infer T } ? T : never;
  }

  private extractResearchContext(content: Record<string, unknown>): AssembledContext extends { research: infer T } ? T : never {
    return {
      research_id: (content.id as string) ?? null,
      summary: (content.summary as string) ?? null,
      key_findings: [],
      buying_signals: ((content.buying_signals as { signal_type: string; description: string; confidence: number }[]) ?? []).map((s) => ({
        type: s.signal_type,
        description: s.description,
        confidence: s.confidence,
      })),
      growth_signals: ((content.growth_signals as { signal_type: string; description: string; confidence: number }[]) ?? []).map((s) => ({
        type: s.signal_type,
        description: s.description,
        confidence: s.confidence,
      })),
      technology_stack: ((content.technology_stack as { name: string; category: string }[]) ?? []).map((t) => ({
        name: t.name,
        category: t.category,
      })),
      competitors: ((content.competitive_positioning as { competitors?: string[] }) ?? {}).competitors ?? [],
      confidence_score: (content.confidence_score as number) ?? null,
    } as AssembledContext extends { research: infer T } ? T : never;
  }

  private extractRevenueContext(content: Record<string, unknown>): AssembledContext extends { revenue: infer T } ? T : never {
    return {
      profile_id: null,
      overall_score: (content.overall_score as number) ?? 0,
      icp_score: (content.icp_score as number) ?? 0,
      opportunity_score: (content.opportunity_score as number) ?? 0,
      buying_intent_score: (content.buying_intent_score as number) ?? 0,
      growth_score: (content.growth_score as number) ?? 0,
      risk_score: (content.risk_score as number) ?? 0,
      priority: (content.priority as string) ?? 'medium',
      recommended_action: (content.recommended_action as string) ?? null,
      recommendations: ((content.recommendations as { type: string; title: string; description: string | null }[]) ?? []).map((r) => ({
        type: r.type,
        title: r.title,
        description: r.description,
      })),
      signals: ((content.signals as { type: string; description: string; strength: number }[]) ?? []).map((s) => ({
        type: s.type,
        description: s.description,
        strength: s.strength,
      })),
    } as AssembledContext extends { revenue: infer T } ? T : never;
  }

  private extractRelationshipContext(content: Record<string, unknown>): AssembledContext extends { relationship: infer T } ? T : never {
    const nodes = (content.connected_nodes as { type: string; name: string }[]) ?? [];
    const edges = (content.relationships as { type: string; source: string; target: string; confidence: number }[]) ?? [];

    return {
      relationship_type: edges[0]?.type ?? 'RELATED_TO',
      target_name: nodes[0]?.name ?? '',
      target_type: nodes[0]?.type ?? '',
      strength: edges[0]?.confidence ?? 0.5,
      history: [],
    } as AssembledContext extends { relationship: infer T } ? T : never;
  }

  private extractUserContext(content: Record<string, unknown>, userId?: string | null): AssembledContext extends { user: infer T } ? T : never {
    return {
      user_id: userId ?? (content.user_id as string) ?? null,
      name: null,
      role: null,
      preferences: (content.preferences as Record<string, unknown>) ?? {},
    } as AssembledContext extends { user: infer T } ? T : never;
  }

  private extractConversationContext(content: Record<string, unknown>): AssembledContext extends { conversation: infer T } ? T : never {
    return {
      conversation_id: (content.conversation_id as string) ?? null,
      history: (content.history as { role: string; content: string; timestamp: string }[]) ?? [],
      summary: null,
    } as AssembledContext extends { conversation: infer T } ? T : never;
  }

  private buildMetadata(
    fragments: ContextFragment[],
    tokenCount: number,
    compressionRatio: number,
    qualityScore: number,
    buildDurationMs: number
  ): ContextMetadata {
    return {
      version: 1,
      token_count: tokenCount,
      source_count: fragments.length,
      sources_used: fragments.map((f) => f.source),
      compression_ratio: compressionRatio,
      quality_score: qualityScore,
      build_duration_ms: buildDurationMs,
      created_at: new Date().toISOString(),
    };
  }

  buildSourceContributions(fragments: ContextFragment[]): SourceContribution[] {
    const totalTokens = fragments.reduce((sum, f) => sum + f.token_estimate, 0);

    return fragments.map((f) => ({
      source: f.source,
      source_label: f.source_label,
      token_count: f.token_estimate,
      priority: f.priority,
      contribution_ratio: totalTokens > 0 ? f.token_estimate / totalTokens : 0,
    }));
  }
}

export const contextAssembler = new ContextAssembler();
