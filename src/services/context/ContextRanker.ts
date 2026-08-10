// ============================================================
// ContextRanker — Ranks context fragments by priority and relevance
// ============================================================

import type { ContextFragment, ContextPriority, ContextRequest } from '@/types/context-engine';

class ContextRanker {
  rank(fragments: ContextFragment[], request: ContextRequest): ContextFragment[] {
    const scored = fragments.map((f) => ({
      fragment: f,
      score: this.calculateScore(f, request),
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.map((s) => s.fragment);
  }

  private calculateScore(fragment: ContextFragment, request: ContextRequest): number {
    let score = 0;

    // Priority weight (40%)
    const priorityWeight = this.priorityToWeight(fragment.priority);
    score += priorityWeight * 0.4;

    // Confidence weight (25%)
    score += fragment.confidence * 0.25;

    // Source relevance (20%)
    const sourceRelevance = this.getSourceRelevance(fragment.source, request.contextType);
    score += sourceRelevance * 0.2;

    // Token efficiency (15%) — prefer smaller fragments with high content value
    const tokenEfficiency = fragment.token_estimate > 0 ? Math.min(100 / fragment.token_estimate, 1) : 0;
    score += tokenEfficiency * 0.15;

    return score;
  }

  private priorityToWeight(priority: ContextPriority): number {
    switch (priority) {
      case 'critical': return 1.0;
      case 'high': return 0.8;
      case 'medium': return 0.6;
      case 'low': return 0.4;
      case 'minimal': return 0.2;
      default: return 0.5;
    }
  }

  private getSourceRelevance(source: string, contextType: string): number {
    const relevanceMap: Record<string, string[]> = {
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

    const relevantSources = relevanceMap[contextType] ?? [];
    if (relevantSources.length === 0) return 0.5;

    const index = relevantSources.indexOf(source);
    if (index === -1) return 0.3;
    return 1.0 - (index * 0.15);
  }

  allocateTokenBudget(fragments: ContextFragment[], maxTokens: number): {
    included: ContextFragment[];
    excluded: ContextFragment[];
    usedTokens: number;
  } {
    let usedTokens = 0;
    const included: ContextFragment[] = [];
    const excluded: ContextFragment[] = [];

    for (const fragment of fragments) {
      if (usedTokens + fragment.token_estimate <= maxTokens) {
        included.push(fragment);
        usedTokens += fragment.token_estimate;
      } else {
        excluded.push(fragment);
      }
    }

    return { included, excluded, usedTokens };
  }
}

export const contextRanker = new ContextRanker();
