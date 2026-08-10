// ============================================================
// ContextSummarizer — Summarizes context for compact representation
// ============================================================

import type { ContextFragment, ContextSourceId } from '@/types/context-engine';

class ContextSummarizer {
  summarize(fragments: ContextFragment[]): string {
    const parts: string[] = [];

    for (const fragment of fragments) {
      const summary = this.summarizeFragment(fragment);
      if (summary) parts.push(summary);
    }

    return parts.join('\n\n');
  }

  summarizeFragment(fragment: ContextFragment): string {
    const content = fragment.content;

    switch (fragment.source) {
      case 'revenue_intelligence':
        return this.summarizeRevenue(content);
      case 'research_intelligence':
        return this.summarizeResearch(content);
      case 'knowledge_graph':
        return this.summarizeGraph(content);
      case 'company_profile':
        return this.summarizeCompany(content);
      default:
        return this.summarizeGeneric(content, fragment.source);
    }
  }

  private summarizeRevenue(content: Record<string, unknown>): string {
    const lines: string[] = ['## Revenue Intelligence'];
    if (content.overall_score !== undefined) lines.push(`- Overall Score: ${Math.round((content.overall_score as number) * 100)}%`);
    if (content.icp_score !== undefined) lines.push(`- ICP Match: ${Math.round((content.icp_score as number) * 100)}%`);
    if (content.buying_intent_score !== undefined) lines.push(`- Buying Intent: ${Math.round((content.buying_intent_score as number) * 100)}%`);
    if (content.recommended_action) lines.push(`- Recommended Action: ${content.recommended_action}`);
    if (content.priority) lines.push(`- Priority: ${content.priority}`);

    const signals = content.signals as { type: string; description: string }[] | undefined;
    if (signals && signals.length > 0) {
      lines.push('- Key Signals:');
      for (const s of signals.slice(0, 3)) {
        lines.push(`  - ${s.type}: ${s.description?.slice(0, 100) ?? ''}`);
      }
    }

    return lines.join('\n');
  }

  private summarizeResearch(content: Record<string, unknown>): string {
    const lines: string[] = ['## Research Intelligence'];
    if (content.company_name) lines.push(`- Company: ${content.company_name}`);
    if (content.industry) lines.push(`- Industry: ${content.industry}`);
    if (content.business_model) lines.push(`- Business Model: ${content.business_model}`);
    if (content.summary) lines.push(`- Summary: ${(content.summary as string).slice(0, 200)}`);

    const techStack = content.technology_stack as { name: string }[] | undefined;
    if (techStack && techStack.length > 0) {
      lines.push(`- Technologies: ${techStack.slice(0, 5).map((t) => t.name).join(', ')}`);
    }

    const buyingSignals = content.buying_signals as { signal_type: string; description: string }[] | undefined;
    if (buyingSignals && buyingSignals.length > 0) {
      lines.push(`- Buying Signals: ${buyingSignals.length} detected`);
    }

    return lines.join('\n');
  }

  private summarizeGraph(content: Record<string, unknown>): string {
    const lines: string[] = ['## Knowledge Graph Relationships'];
    const nodes = content.connected_nodes as { type: string; name: string }[] | undefined;
    const edges = content.relationships as { type: string }[] | undefined;

    if (nodes) lines.push(`- Connected Entities: ${nodes.length}`);
    if (edges) lines.push(`- Relationships: ${edges.length}`);

    if (nodes && nodes.length > 0) {
      lines.push('- Key Connections:');
      for (const n of nodes.slice(0, 5)) {
        lines.push(`  - ${n.type}: ${n.name}`);
      }
    }

    return lines.join('\n');
  }

  private summarizeCompany(content: Record<string, unknown>): string {
    const lines: string[] = ['## Company Profile'];
    if (content.workspace_name) lines.push(`- Workspace: ${content.workspace_name}`);
    if (content.website) lines.push(`- Website: ${content.website}`);
    if (content.industry) lines.push(`- Industry: ${content.industry}`);
    return lines.join('\n');
  }

  private summarizeGeneric(content: Record<string, unknown>, source: ContextSourceId): string {
    const keys = Object.keys(content);
    if (keys.length === 0) return '';
    return `## ${source.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}\n- ${keys.length} data points available`;
  }
}

export const contextSummarizer = new ContextSummarizer();
