// ============================================================
// PromptContextBuilder — Generates AI-ready prompt context strings
// ============================================================

import { contextSummarizer } from './ContextSummarizer';
import type { AssembledContext, ContextFragment } from '@/types/context-engine';

class PromptContextBuilder {
  buildPromptContext(context: AssembledContext): string {
    const sections: string[] = [];

    // System context
    sections.push(this.formatSystemContext(context.system));

    // Business context
    if (context.business) {
      sections.push(this.formatBusinessContext(context.business));
    }

    // Company context
    if (context.company) {
      sections.push(this.formatCompanyContext(context.company));
    }

    // Research context
    if (context.research) {
      sections.push(this.formatResearchContext(context.research));
    }

    // Revenue context
    if (context.revenue) {
      sections.push(this.formatRevenueContext(context.revenue));
    }

    // Relationship context
    if (context.relationship) {
      sections.push(this.formatRelationshipContext(context.relationship));
    }

    // User context
    if (context.user) {
      sections.push(this.formatUserContext(context.user));
    }

    // Conversation context
    if (context.conversation) {
      sections.push(this.formatConversationContext(context.conversation));
    }

    // Execution context
    if (context.execution) {
      sections.push(this.formatExecutionContext(context.execution));
    }

    // Metadata footer
    sections.push(this.formatMetadata(context.metadata));

    return sections.join('\n\n---\n\n');
  }

  buildFromFragments(fragments: ContextFragment[]): string {
    return contextSummarizer.summarize(fragments);
  }

  buildSystemPrompt(context: AssembledContext): string {
    return this.formatSystemContext(context.system);
  }

  private formatSystemContext(system: AssembledContext['system']): string {
    const lines: string[] = [`# System Context`];
    lines.push(`Role: ${system.role}`);
    lines.push(`\nInstructions:\n${system.instructions}`);
    if (system.capabilities.length > 0) {
      lines.push(`\nCapabilities:\n${system.capabilities.map((c) => `- ${c}`).join('\n')}`);
    }
    if (system.limitations.length > 0) {
      lines.push(`\nLimitations:\n${system.limitations.map((l) => `- ${l}`).join('\n')}`);
    }
    return lines.join('\n');
  }

  private formatBusinessContext(business: NonNullable<AssembledContext['business']>): string {
    const lines: string[] = [`# Business Context`];
    lines.push(`Workspace: ${business.workspace_name}`);
    if (business.industry) lines.push(`Industry: ${business.industry}`);
    if (business.website) lines.push(`Website: ${business.website}`);
    if (business.description) lines.push(`Description: ${business.description}`);
    if (business.target_market.length > 0) lines.push(`Target Market: ${business.target_market.join(', ')}`);
    return lines.join('\n');
  }

  private formatCompanyContext(company: NonNullable<AssembledContext['company']>): string {
    const lines: string[] = [`# Company Context`];
    lines.push(`Company: ${company.company_name}`);
    if (company.website) lines.push(`Website: ${company.website}`);
    if (company.industry) lines.push(`Industry: ${company.industry}`);
    if (company.business_model) lines.push(`Business Model: ${company.business_model}`);
    if (company.company_size) lines.push(`Company Size: ${company.company_size}`);
    if (company.summary) lines.push(`\nSummary:\n${company.summary}`);
    if (company.technology_stack.length > 0) lines.push(`\nTechnology Stack: ${company.technology_stack.join(', ')}`);
    if (company.services.length > 0) lines.push(`Services: ${company.services.join(', ')}`);
    if (company.products.length > 0) lines.push(`Products: ${company.products.join(', ')}`);
    if (company.locations.length > 0) lines.push(`Locations: ${company.locations.join(', ')}`);
    if (company.confidence_score !== null) lines.push(`Data Confidence: ${Math.round(company.confidence_score * 100)}%`);
    return lines.join('\n');
  }

  private formatResearchContext(research: NonNullable<AssembledContext['research']>): string {
    const lines: string[] = [`# Research Context`];
    if (research.summary) lines.push(`Summary: ${research.summary.slice(0, 500)}`);
    if (research.buying_signals.length > 0) {
      lines.push(`\nBuying Signals:`);
      for (const s of research.buying_signals.slice(0, 5)) {
        lines.push(`- ${s.type}: ${s.description} (${Math.round(s.confidence * 100)}% confidence)`);
      }
    }
    if (research.growth_signals.length > 0) {
      lines.push(`\nGrowth Signals:`);
      for (const s of research.growth_signals.slice(0, 5)) {
        lines.push(`- ${s.type}: ${s.description} (${Math.round(s.confidence * 100)}% confidence)`);
      }
    }
    if (research.competitors.length > 0) lines.push(`\nCompetitors: ${research.competitors.join(', ')}`);
    if (research.confidence_score !== null) lines.push(`Research Confidence: ${Math.round(research.confidence_score * 100)}%`);
    return lines.join('\n');
  }

  private formatRevenueContext(revenue: NonNullable<AssembledContext['revenue']>): string {
    const lines: string[] = [`# Revenue Intelligence`];
    lines.push(`Overall Score: ${Math.round(revenue.overall_score * 100)}%`);
    lines.push(`ICP Match: ${Math.round(revenue.icp_score * 100)}%`);
    lines.push(`Opportunity Score: ${Math.round(revenue.opportunity_score * 100)}%`);
    lines.push(`Buying Intent: ${Math.round(revenue.buying_intent_score * 100)}%`);
    lines.push(`Growth Score: ${Math.round(revenue.growth_score * 100)}%`);
    lines.push(`Risk Score: ${Math.round(revenue.risk_score * 100)}%`);
    lines.push(`Priority: ${revenue.priority}`);
    if (revenue.recommended_action) lines.push(`\nRecommended Action: ${revenue.recommended_action}`);
    if (revenue.recommendations.length > 0) {
      lines.push(`\nRecommendations:`);
      for (const r of revenue.recommendations.slice(0, 5)) {
        lines.push(`- ${r.title}${r.description ? `: ${r.description}` : ''}`);
      }
    }
    if (revenue.signals.length > 0) {
      lines.push(`\nKey Signals:`);
      for (const s of revenue.signals.slice(0, 5)) {
        lines.push(`- ${s.type}: ${s.description} (${Math.round(s.strength * 100)}% strength)`);
      }
    }
    return lines.join('\n');
  }

  private formatRelationshipContext(rel: NonNullable<AssembledContext['relationship']>): string {
    const lines: string[] = [`# Relationship Context`];
    lines.push(`Relationship: ${rel.relationship_type} → ${rel.target_name} (${rel.target_type})`);
    lines.push(`Strength: ${Math.round(rel.strength * 100)}%`);
    return lines.join('\n');
  }

  private formatUserContext(user: NonNullable<AssembledContext['user']>): string {
    const lines: string[] = [`# User Context`];
    if (user.name) lines.push(`Name: ${user.name}`);
    if (user.role) lines.push(`Role: ${user.role}`);
    return lines.join('\n');
  }

  private formatConversationContext(conv: NonNullable<AssembledContext['conversation']>): string {
    const lines: string[] = [`# Conversation Context`];
    if (conv.summary) lines.push(`Summary: ${conv.summary}`);
    if (conv.history.length > 0) {
      lines.push(`\nHistory:`);
      for (const h of conv.history.slice(-5)) {
        lines.push(`- ${h.role}: ${h.content.slice(0, 200)}`);
      }
    }
    return lines.join('\n');
  }

  private formatExecutionContext(exec: NonNullable<AssembledContext['execution']>): string {
    const lines: string[] = [`# Execution Context`];
    if (exec.agent_type) lines.push(`Agent Type: ${exec.agent_type}`);
    if (exec.current_step) lines.push(`Current Step: ${exec.current_step}`);
    if (exec.previous_outputs.length > 0) {
      lines.push(`\nPrevious Outputs:`);
      for (const o of exec.previous_outputs.slice(-3)) {
        lines.push(`- ${o.agent}: ${o.output.slice(0, 200)}`);
      }
    }
    return lines.join('\n');
  }

  private formatMetadata(meta: AssembledContext['metadata']): string {
    const lines: string[] = [`# Context Metadata`];
    lines.push(`Version: ${meta.version}`);
    lines.push(`Token Count: ${meta.token_count}`);
    lines.push(`Sources Used: ${meta.source_count} (${meta.sources_used.join(', ')})`);
    lines.push(`Compression Ratio: ${meta.compression_ratio.toFixed(2)}`);
    lines.push(`Quality Score: ${Math.round(meta.quality_score * 100)}%`);
    lines.push(`Build Duration: ${meta.build_duration_ms}ms`);
    return lines.join('\n');
  }
}

export const promptContextBuilder = new PromptContextBuilder();
