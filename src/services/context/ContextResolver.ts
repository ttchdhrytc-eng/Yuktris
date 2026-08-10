// ============================================================
// ContextResolver — Resolves which sources to query for a request
// ============================================================

import type { ContextRequest, ContextSourceId, ContextType } from '@/types/context-engine';

class ContextResolver {
  private typeSourceMap: Record<ContextType, ContextSourceId[]> = {
    company: ['research_intelligence', 'revenue_intelligence', 'knowledge_graph', 'company_profile'],
    prospect: ['revenue_intelligence', 'research_intelligence', 'knowledge_graph', 'contacts'],
    contact: ['knowledge_graph', 'contacts', 'research_intelligence'],
    meeting: ['calendar_events', 'meetings', 'knowledge_graph', 'tasks'],
    task: ['tasks', 'notes', 'past_ai_outputs'],
    conversation: ['conversation_history', 'past_ai_outputs', 'user_preferences'],
    outreach: ['revenue_intelligence', 'research_intelligence', 'knowledge_graph', 'contacts'],
    proposal: ['revenue_intelligence', 'research_intelligence', 'documents', 'company_profile'],
    custom: [],
  };

  resolveSources(request: ContextRequest): ContextSourceId[] {
    if (request.sources && request.sources.length > 0) {
      return this.filterExcluded(request.sources, request.excludeSources ?? []);
    }

    const defaultSources = this.typeSourceMap[request.contextType] ?? [];
    return this.filterExcluded(defaultSources, request.excludeSources ?? []);
  }

  private filterExcluded(sources: ContextSourceId[], excluded: ContextSourceId[]): ContextSourceId[] {
    return sources.filter((s) => !excluded.includes(s));
  }

  resolveTokenBudget(request: ContextRequest): number {
    return request.tokenBudget ?? 8000;
  }

  shouldIncludeSystem(request: ContextRequest): boolean {
    return request.includeSystemContext ?? true;
  }

  shouldIncludeBusiness(request: ContextRequest): boolean {
    return request.includeBusinessContext ?? true;
  }

  resolveContextName(request: ContextRequest): string {
    const parts = [request.contextType];
    if (request.entityType) parts.push(request.entityType);
    if (request.entityId) parts.push(request.entityId.slice(0, 8));
    return parts.join(':');
  }
}

export const contextResolver = new ContextResolver();
