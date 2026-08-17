// ============================================================
// Intelligence Agents — Concrete implementations
// ============================================================
//
// SEO Analysis Agent, ICP Scoring Agent, Buying Signal Agent,
// LinkedIn Intelligence Agent.
//
// Each agent follows the same pattern as ResearchAgents:
//   - Reads input from ExecutionContext
//   - Reads previous agent outputs from shared memory
//   - Uses AI Gateway for structured synthesis
//   - Updates the Knowledge Graph
//   - Never throws — degrades gracefully

import { BaseAgent } from './BaseAgent';
import { ExecutionContextBuilder } from './ExecutionContext';
import { aiGateway } from '@/services/ai';
import { knowledgeGraphService } from '@/services/knowledge-graph';
import { FirecrawlProvider } from '@/services/research/providers/FirecrawlProvider';
import { TavilyProvider } from '@/services/research/providers/TavilyProvider';
import type {
  AgentDefinition,
  ExecutionContext,
  AgentExecutionResult,
} from '@/types/agent-orchestrator';
import type { ResearchContext, ProviderResult } from '@/types/research-intelligence';

const firecrawl = new FirecrawlProvider();
const tavily = new TavilyProvider();

async function ensureProvidersInitialized(): Promise<void> {
  await Promise.all([firecrawl.initialize(), tavily.initialize()]);
}

function success(
  agentName: string,
  output: Record<string, unknown>,
  tokensUsed: number,
  estimatedCost: number,
  executionTimeMs: number,
): AgentExecutionResult {
  return { agentName, status: 'completed', output, tokensUsed, estimatedCost, executionTimeMs };
}

function failure(
  agentName: string,
  error: string,
  executionTimeMs: number,
): AgentExecutionResult {
  return { agentName, status: 'failed', output: {}, tokensUsed: 0, estimatedCost: 0, executionTimeMs, error };
}

function getPreviousOutputs(workflowId: string | undefined, agentNames: string[]): Record<string, unknown> {
  const outputs: Record<string, unknown> = {};
  if (!workflowId) return outputs;
  for (const name of agentNames) {
    const prev = ExecutionContextBuilder.getPreviousOutput(workflowId, name);
    if (prev?.output) outputs[name] = prev.output;
  }
  return outputs;
}

async function safeGraphUpdate(workspaceId: string | null, params: {
  companyName: string;
  website?: string | null;
  industry?: string | null;
  businessModel?: string | null;
  technologyStack?: string[];
}): Promise<void> {
  try {
    await knowledgeGraphService.ingestFromResearchIntelligence({
      companyName: params.companyName,
      website: params.website ?? null,
      industry: params.industry ?? null,
      businessModel: params.businessModel ?? null,
      technologyStack: params.technologyStack ?? [],
      workspaceId,
    });
  } catch {
    // non-fatal
  }
}

// ============================================================
// SEO Analysis Agent
// ============================================================

const SEO_ANALYSIS_DEF: AgentDefinition = {
  agent_name: 'seo_analysis_agent',
  description: 'Analyzes SEO metrics, keywords, search visibility, and backlink opportunities for a company domain.',
  version: '2.0.0',
  category: 'analysis',
  capabilities: ['seo_analysis', 'keyword_research', 'visibility_scoring', 'backlink_analysis'],
  inputSchema: { type: 'object', properties: { domain: { type: 'string' } }, required: ['domain'] },
  outputSchema: { type: 'object', properties: { technical_seo: { type: 'object' }, on_page_seo: { type: 'object' }, content_gaps: { type: 'array' }, keyword_opportunities: { type: 'array' }, backlink_opportunities: { type: 'array' }, local_seo: { type: 'object' }, priority_fixes: { type: 'array' } } },
  defaultTimeoutMs: 45_000,
  maxRetries: 2,
};

class SEOAnalysisAgent extends BaseAgent {
  definition = SEO_ANALYSIS_DEF;

  async execute(context: ExecutionContext): Promise<AgentExecutionResult> {
    const start = Date.now();
    const input = context.input;
    const workspaceId = context.workspaceId;
    const domain = (input['domain'] as string) ?? (input['website'] as string);
    if (!domain) return failure(this.definition.agent_name, 'Missing required field: domain', Date.now() - start);

    try {
      await ensureProvidersInitialized();

      const researchContext: ResearchContext = {
        companyName: (input['company_name'] as string) ?? '',
        website: domain,
        requestType: 'seo_analysis',
        capabilities: ['seo_analysis', 'content_analysis'],
      };

      let crawlData: Record<string, unknown> = {};
      try {
        const crawlResult: ProviderResult = await firecrawl.research(researchContext);
        if (crawlResult.success) crawlData = crawlResult.data;
      } catch { /* non-fatal */ }

      let searchResults: Record<string, unknown>[] = [];
      try {
        const tavilyResult: ProviderResult = await tavily.research(researchContext);
        if (tavilyResult.success) searchResults = (tavilyResult.data['results'] as Record<string, unknown>[]) ?? [];
      } catch { /* non-fatal */ }

      const prev = getPreviousOutputs(context.workflowId, ['website_research_agent', 'company_intelligence_agent', 'technology_detection_agent']);

      const schema = {
        type: 'object',
        properties: {
          technical_seo: {
            type: 'object',
            properties: {
              page_speed_score: { type: 'number' },
              mobile_friendly: { type: 'boolean' },
              ssl_enabled: { type: 'boolean' },
              structured_data: { type: 'boolean' },
              issues: { type: 'array', items: { type: 'string' } },
            },
          },
          on_page_seo: {
            type: 'object',
            properties: {
              title_optimization: { type: 'string' },
              meta_descriptions: { type: 'string' },
              heading_structure: { type: 'string' },
              content_quality: { type: 'string' },
            },
          },
          content_gaps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                topic: { type: 'string' },
                opportunity: { type: 'string' },
                difficulty: { type: 'string' },
              },
            },
          },
          keyword_opportunities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                keyword: { type: 'string' },
                search_intent: { type: 'string' },
                estimated_volume: { type: 'string' },
                difficulty: { type: 'string' },
              },
            },
          },
          backlink_opportunities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                source: { type: 'string' },
                relevance: { type: 'string' },
                outreach_difficulty: { type: 'string' },
              },
            },
          },
          local_seo: {
            type: 'object',
            properties: {
              google_business_profile: { type: 'boolean' },
              local_keywords: { type: 'array', items: { type: 'string' } },
              local_competitors: { type: 'array', items: { type: 'string' } },
            },
          },
          priority_fixes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                issue: { type: 'string' },
                impact: { type: 'string' },
                effort: { type: 'string' },
                priority: { type: 'string' },
              },
            },
          },
        },
        required: ['technical_seo', 'on_page_seo', 'content_gaps', 'keyword_opportunities', 'priority_fixes'],
      };

      const response = await aiGateway.generateStructured({
        agentName: this.definition.agent_name,
        taskType: 'structured',
        systemPrompt: 'You are an expert SEO analyst. Analyze the website content and search results to produce a comprehensive SEO report. Include technical SEO, on-page SEO, content gaps, keyword opportunities, backlink opportunities, local SEO, and priority fixes. Return only valid JSON matching the schema.',
        userPrompt: `Domain: ${domain}\n\nCrawled content:\n${JSON.stringify(crawlData).slice(0, 8000)}\n\nSearch results:\n${searchResults.slice(0, 5).map(r => (r['content'] as string) ?? '').join('\n---\n').slice(0, 6000)}\n\nPrevious research:\n${JSON.stringify(prev).slice(0, 4000)}`,
        temperature: 0.3,
        maxTokens: 2500,
        schema,
        workspaceId: workspaceId ?? undefined,
      });

      const output = (response.structuredData ?? {}) as Record<string, unknown>;
      if (!output['technical_seo']) output['technical_seo'] = { issues: [] };
      if (!output['on_page_seo']) output['on_page_seo'] = {};
      if (!Array.isArray(output['content_gaps'])) output['content_gaps'] = [];
      if (!Array.isArray(output['keyword_opportunities'])) output['keyword_opportunities'] = [];
      if (!Array.isArray(output['backlink_opportunities'])) output['backlink_opportunities'] = [];
      if (!output['local_seo']) output['local_seo'] = {};
      if (!Array.isArray(output['priority_fixes'])) output['priority_fixes'] = [];
      output['domain'] = domain;

      if (context.workflowId) {
        ExecutionContextBuilder.storeResult(context.workflowId, this.definition.agent_name, {
          agentName: this.definition.agent_name, status: 'completed', output,
          tokensUsed: response.totalTokens, estimatedCost: response.estimatedCost, executionTimeMs: Date.now() - start,
        });
      }

      return success(this.definition.agent_name, output, response.totalTokens, response.estimatedCost, Date.now() - start);
    } catch (err) {
      return failure(this.definition.agent_name, err instanceof Error ? err.message : 'Unknown error', Date.now() - start);
    }
  }
}

// ============================================================
// ICP Scoring Agent
// ============================================================

const ICP_SCORING_DEF: AgentDefinition = {
  agent_name: 'icp_scoring_agent',
  description: 'Scores prospects against ICP criteria including digital maturity, marketing maturity, revenue band, and buyer personas.',
  version: '2.0.0',
  category: 'scoring',
  capabilities: ['icp_matching', 'prospect_scoring', 'fit_analysis', 'persona_identification'],
  inputSchema: { type: 'object', properties: { company: { type: 'object' }, icp_criteria: { type: 'object' } }, required: ['company'] },
  outputSchema: { type: 'object', properties: { icp_score: { type: 'number' }, digital_maturity: { type: 'number' }, marketing_maturity: { type: 'number' }, revenue_band: { type: 'string' }, buyer_personas: { type: 'array' }, qualification: { type: 'object' } } },
  defaultTimeoutMs: 30_000,
  maxRetries: 2,
};

class ICPScoringAgent extends BaseAgent {
  definition = ICP_SCORING_DEF;

  async execute(context: ExecutionContext): Promise<AgentExecutionResult> {
    const start = Date.now();
    const input = context.input;
    const workspaceId = context.workspaceId;

    try {
      const prev = getPreviousOutputs(context.workflowId, [
        'website_research_agent', 'company_intelligence_agent', 'technology_detection_agent',
        'executive_summary_agent', 'seo_analysis_agent',
      ]);

      const companyData = (input['company'] as Record<string, unknown>) ?? prev['company_intelligence_agent'] ?? {};
      const icpCriteria = (input['icp_criteria'] as Record<string, unknown>) ?? {};

      const schema = {
        type: 'object',
        properties: {
          icp_score: { type: 'number' },
          digital_maturity: { type: 'number' },
          marketing_maturity: { type: 'number' },
          revenue_band: { type: 'string' },
          buyer_personas: { type: 'array', items: { type: 'object', properties: { role: { type: 'string' }, seniority: { type: 'string' }, priorities: { type: 'array', items: { type: 'string' } } } } },
          qualification: { type: 'object', properties: { budget: { type: 'string' }, authority: { type: 'string' }, need: { type: 'string' }, timing: { type: 'string' } } },
        },
        required: ['icp_score', 'digital_maturity', 'marketing_maturity', 'revenue_band', 'buyer_personas', 'qualification'],
      };

      const response = await aiGateway.generateStructured({
        agentName: this.definition.agent_name,
        taskType: 'structured',
        systemPrompt: 'You are an ICP scoring analyst. Score the company against Ideal Customer Profile criteria. Assess digital maturity (0-100), marketing maturity (0-100), estimate revenue band, identify buyer personas, and qualify on BANT. Return only valid JSON matching the schema.',
        userPrompt: `Company data:\n${JSON.stringify(companyData).slice(0, 8000)}\n\nICP criteria:\n${JSON.stringify(icpCriteria).slice(0, 2000)}\n\nPrevious research:\n${JSON.stringify(prev).slice(0, 6000)}`,
        temperature: 0.3,
        maxTokens: 2000,
        schema,
        workspaceId: workspaceId ?? undefined,
      });

      const output = (response.structuredData ?? {}) as Record<string, unknown>;
      if (typeof output['icp_score'] !== 'number') output['icp_score'] = 50;
      if (typeof output['digital_maturity'] !== 'number') output['digital_maturity'] = 50;
      if (typeof output['marketing_maturity'] !== 'number') output['marketing_maturity'] = 50;
      if (!output['revenue_band']) output['revenue_band'] = 'Unknown';
      if (!Array.isArray(output['buyer_personas'])) output['buyer_personas'] = [];
      if (!output['qualification']) output['qualification'] = {};

      if (context.workflowId) {
        ExecutionContextBuilder.storeResult(context.workflowId, this.definition.agent_name, {
          agentName: this.definition.agent_name, status: 'completed', output,
          tokensUsed: response.totalTokens, estimatedCost: response.estimatedCost, executionTimeMs: Date.now() - start,
        });
      }

      return success(this.definition.agent_name, output, response.totalTokens, response.estimatedCost, Date.now() - start);
    } catch (err) {
      return failure(this.definition.agent_name, err instanceof Error ? err.message : 'Unknown error', Date.now() - start);
    }
  }
}

// ============================================================
// Buying Signal Agent
// ============================================================

const BUYING_SIGNAL_DEF: AgentDefinition = {
  agent_name: 'buying_signal_agent',
  description: 'Detects buying intent signals including hiring, funding, product launches, tech changes, and expansion. Calculates urgency score.',
  version: '2.0.0',
  category: 'scoring',
  capabilities: ['intent_detection', 'signal_analysis', 'urgency_scoring'],
  inputSchema: { type: 'object', properties: { company: { type: 'object' }, signals: { type: 'array' } } },
  outputSchema: { type: 'object', properties: { intent_score: { type: 'number' }, signals: { type: 'array' }, urgency_score: { type: 'number' } } },
  defaultTimeoutMs: 30_000,
  maxRetries: 2,
};

class BuyingSignalAgent extends BaseAgent {
  definition = BUYING_SIGNAL_DEF;

  async execute(context: ExecutionContext): Promise<AgentExecutionResult> {
    const start = Date.now();
    const input = context.input;
    const workspaceId = context.workspaceId;

    try {
      const prev = getPreviousOutputs(context.workflowId, [
        'website_research_agent', 'company_intelligence_agent', 'technology_detection_agent',
        'executive_summary_agent',
      ]);

      const companyData = (input['company'] as Record<string, unknown>) ?? prev['company_intelligence_agent'] ?? {};

      let searchResults: Record<string, unknown>[] = [];
      try {
        const companyName = (companyData['company_name'] as string) ?? (input['company_name'] as string) ?? '';
        if (companyName) {
          await ensureProvidersInitialized();
          const tavilyResult: ProviderResult = await tavily.research({
            companyName, website: (companyData['domain'] as string) ?? null,
            requestType: 'buying_signals', capabilities: ['buying_signal_detection', 'growth_signal_detection', 'funding_detection', 'hiring_signal_detection'],
          });
          if (tavilyResult.success) searchResults = (tavilyResult.data['results'] as Record<string, unknown>[]) ?? [];
        }
      } catch { /* non-fatal */ }

      const schema = {
        type: 'object',
        properties: {
          hiring_signals: { type: 'array', items: { type: 'object', properties: { signal: { type: 'string' }, description: { type: 'string' }, confidence: { type: 'number' } } } },
          funding: { type: 'array', items: { type: 'object', properties: { event: { type: 'string' }, amount: { type: 'string' }, date: { type: 'string' }, source: { type: 'string' } } } },
          product_launches: { type: 'array', items: { type: 'object', properties: { product: { type: 'string' }, description: { type: 'string' }, date: { type: 'string' } } } },
          technology_changes: { type: 'array', items: { type: 'object', properties: { change: { type: 'string' }, technology: { type: 'string' }, impact: { type: 'string' } } } },
          expansion: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, description: { type: 'string' }, market: { type: 'string' } } } },
          urgency_score: { type: 'number' },
        },
        required: ['hiring_signals', 'funding', 'product_launches', 'technology_changes', 'expansion', 'urgency_score'],
      };

      const response = await aiGateway.generateStructured({
        agentName: this.definition.agent_name,
        taskType: 'structured',
        systemPrompt: 'You are a buying signal analyst. Analyze the company data and web search results to detect buying intent signals: hiring signals, funding events, product launches, technology changes, and expansion indicators. Calculate an urgency score (0-100). Return only valid JSON matching the schema.',
        userPrompt: `Company data:\n${JSON.stringify(companyData).slice(0, 6000)}\n\nWeb search results:\n${searchResults.slice(0, 8).map(r => (r['content'] as string) ?? '').join('\n---\n').slice(0, 6000)}\n\nPrevious research:\n${JSON.stringify(prev).slice(0, 4000)}`,
        temperature: 0.3,
        maxTokens: 2000,
        schema,
        workspaceId: workspaceId ?? undefined,
      });

      const output = (response.structuredData ?? {}) as Record<string, unknown>;
      if (!Array.isArray(output['hiring_signals'])) output['hiring_signals'] = [];
      if (!Array.isArray(output['funding'])) output['funding'] = [];
      if (!Array.isArray(output['product_launches'])) output['product_launches'] = [];
      if (!Array.isArray(output['technology_changes'])) output['technology_changes'] = [];
      if (!Array.isArray(output['expansion'])) output['expansion'] = [];
      if (typeof output['urgency_score'] !== 'number') output['urgency_score'] = 50;

      if (context.workflowId) {
        ExecutionContextBuilder.storeResult(context.workflowId, this.definition.agent_name, {
          agentName: this.definition.agent_name, status: 'completed', output,
          tokensUsed: response.totalTokens, estimatedCost: response.estimatedCost, executionTimeMs: Date.now() - start,
        });
      }

      return success(this.definition.agent_name, output, response.totalTokens, response.estimatedCost, Date.now() - start);
    } catch (err) {
      return failure(this.definition.agent_name, err instanceof Error ? err.message : 'Unknown error', Date.now() - start);
    }
  }
}

// ============================================================
// LinkedIn Intelligence Agent
// ============================================================

const LINKEDIN_INTELLIGENCE_DEF: AgentDefinition = {
  agent_name: 'linkedin_intelligence_agent',
  description: 'Gathers LinkedIn intelligence for companies including employee growth, hiring trends, decision makers, and suggested contacts. Uses Research Engine + Tavily when LinkedIn API is unavailable.',
  version: '2.0.0',
  category: 'intelligence',
  capabilities: ['linkedin_research', 'people_discovery', 'company_insights'],
  inputSchema: { type: 'object', properties: { company_name: { type: 'string' }, person_name: { type: 'string' } } },
  outputSchema: { type: 'object', properties: { employees: { type: 'array' }, key_personnel: { type: 'array' } } },
  defaultTimeoutMs: 45_000,
  maxRetries: 2,
};

class LinkedInIntelligenceAgent extends BaseAgent {
  definition = LINKEDIN_INTELLIGENCE_DEF;

  async execute(context: ExecutionContext): Promise<AgentExecutionResult> {
    const start = Date.now();
    const input = context.input;
    const workspaceId = context.workspaceId;
    const companyName = (input['company_name'] as string) ?? (input['companyName'] as string) ?? '';
    if (!companyName) return failure(this.definition.agent_name, 'Missing required field: company_name', Date.now() - start);

    try {
      const prev = getPreviousOutputs(context.workflowId, [
        'website_research_agent', 'company_intelligence_agent',
      ]);

      let searchResults: Record<string, unknown>[] = [];
      try {
        await ensureProvidersInitialized();
        const tavilyResult: ProviderResult = await tavily.research({
          companyName, website: null,
          requestType: 'company_profile', capabilities: ['decision_maker_discovery', 'company_research', 'social_presence_detection'],
        });
        if (tavilyResult.success) searchResults = (tavilyResult.data['results'] as Record<string, unknown>[]) ?? [];
      } catch { /* non-fatal */ }

      const schema = {
        type: 'object',
        properties: {
          company_linkedin_summary: { type: 'string' },
          employee_growth: { type: 'object', properties: { current_employees: { type: 'string' }, growth_trend: { type: 'string' }, growth_percentage: { type: 'string' } } },
          hiring_trends: { type: 'array', items: { type: 'object', properties: { role: { type: 'string' }, department: { type: 'string' }, trend: { type: 'string' } } } },
          decision_makers: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, title: { type: 'string' }, department: { type: 'string' }, linkedin_url: { type: 'string' }, confidence: { type: 'number' } } } },
          suggested_contacts: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, title: { type: 'string' }, reason: { type: 'string' }, priority: { type: 'string' } } } },
        },
        required: ['company_linkedin_summary', 'decision_makers', 'suggested_contacts'],
      };

      const response = await aiGateway.generateStructured({
        agentName: this.definition.agent_name,
        taskType: 'structured',
        systemPrompt: 'You are a LinkedIn intelligence analyst. Using web search results and previous research, produce a LinkedIn intelligence report for the company. Include company LinkedIn summary, employee growth, hiring trends, decision makers, and suggested contacts. Never fabricate data — only include what can be inferred from the search results. Return only valid JSON matching the schema.',
        userPrompt: `Company: ${companyName}\n\nWeb search results:\n${searchResults.slice(0, 8).map(r => (r['content'] as string) ?? '').join('\n---\n').slice(0, 8000)}\n\nPrevious research:\n${JSON.stringify(prev).slice(0, 4000)}`,
        temperature: 0.3,
        maxTokens: 2000,
        schema,
        workspaceId: workspaceId ?? undefined,
      });

      const output = (response.structuredData ?? {}) as Record<string, unknown>;
      if (!output['company_linkedin_summary']) output['company_linkedin_summary'] = '';
      if (!output['employee_growth']) output['employee_growth'] = {};
      if (!Array.isArray(output['hiring_trends'])) output['hiring_trends'] = [];
      if (!Array.isArray(output['decision_makers'])) output['decision_makers'] = [];
      if (!Array.isArray(output['suggested_contacts'])) output['suggested_contacts'] = [];
      output['company_name'] = companyName;
      output['data_source'] = 'tavily_web_search';

      if (context.workflowId) {
        ExecutionContextBuilder.storeResult(context.workflowId, this.definition.agent_name, {
          agentName: this.definition.agent_name, status: 'completed', output,
          tokensUsed: response.totalTokens, estimatedCost: response.estimatedCost, executionTimeMs: Date.now() - start,
        });
      }

      return success(this.definition.agent_name, output, response.totalTokens, response.estimatedCost, Date.now() - start);
    } catch (err) {
      return failure(this.definition.agent_name, err instanceof Error ? err.message : 'Unknown error', Date.now() - start);
    }
  }
}

// ============================================================
// Export instances
// ============================================================

export const seoAnalysisAgent = new SEOAnalysisAgent();
export const icpScoringAgent = new ICPScoringAgent();
export const buyingSignalAgent = new BuyingSignalAgent();
export const linkedinIntelligenceAgent = new LinkedInIntelligenceAgent();
