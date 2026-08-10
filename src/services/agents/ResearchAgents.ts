// ============================================================
// Research Agents — Concrete implementations for the Research Workflow
// ============================================================
//
// Website Research Agent, Company Intelligence Agent,
// Technology Detection Agent, Executive Summary Agent.
//
// Each agent:
//   - Reads input from ExecutionContext
//   - Calls external providers (Firecrawl, Tavily) directly
//   - Uses the AI Gateway for structured synthesis
//   - Stores results into the Memory Engine
//   - Updates the Knowledge Graph when appropriate
//   - Returns structured JSON

import { BaseAgent } from './BaseAgent';
import { ExecutionContextBuilder } from './ExecutionContext';
import { aiGateway } from '@/services/ai/AIGateway';
import { knowledgeGraphService } from '@/services/knowledge-graph';
import { FirecrawlProvider } from '@/services/research/providers/FirecrawlProvider';
import { TavilyProvider } from '@/services/research/providers/TavilyProvider';
import type {
  AgentDefinition,
  ExecutionContext,
  AgentExecutionResult,
} from '@/types/agent-orchestrator';
import type { ResearchContext, ProviderResult } from '@/types/research-intelligence';


// ============================================================
// Shared helpers
// ============================================================

const firecrawl = new FirecrawlProvider();
const tavily = new TavilyProvider();

async function ensureProvidersInitialized(): Promise<void> {
  await Promise.all([firecrawl.initialize(), tavily.initialize()]);
}

function buildResearchContext(
  input: Record<string, unknown>,
  capabilities: string[],
): ResearchContext {
  const companyName = (input['company_name'] as string) ?? (input['companyName'] as string) ?? '';
  const website = (input['website'] as string) ?? (input['domain'] as string) ?? null;
  return {
    companyName,
    website,
    requestType: 'full_intelligence',
    capabilities: capabilities as ResearchContext['capabilities'],
  };
}

async function updateGraph(
  input: Record<string, unknown>,
  workspaceId: string | null,
  params: {
    companyName: string;
    website?: string | null;
    industry?: string | null;
    businessModel?: string | null;
    technologyStack?: string[];
  },
): Promise<void> {
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

function success(
  agentName: string,
  output: Record<string, unknown>,
  tokensUsed: number,
  estimatedCost: number,
  executionTimeMs: number,
): AgentExecutionResult {
  return {
    agentName,
    status: 'completed',
    output,
    tokensUsed,
    estimatedCost,
    executionTimeMs,
  };
}

function failure(
  agentName: string,
  error: string,
  executionTimeMs: number,
): AgentExecutionResult {
  return {
    agentName,
    status: 'failed',
    output: {},
    tokensUsed: 0,
    estimatedCost: 0,
    executionTimeMs,
    error,
  };
}

// ============================================================
// Website Research Agent
// ============================================================

const WEBSITE_RESEARCH_DEF: AgentDefinition = {
  agent_name: 'website_research_agent',
  description:
    'Crawls and analyzes company websites to extract business information, products, services, and value propositions.',
  version: '2.0.0',
  category: 'research',
  capabilities: ['web_crawling', 'content_extraction', 'business_analysis'],
  inputSchema: {
    type: 'object',
    properties: { url: { type: 'string' }, depth: { type: 'integer' } },
    required: ['url'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      company_overview: { type: 'string' },
      products: { type: 'array' },
      services: { type: 'array' },
      about_us: { type: 'string' },
      contact: { type: 'object' },
      team: { type: 'array' },
      industries: { type: 'array' },
    },
  },
  defaultTimeoutMs: 60_000,
  maxRetries: 2,
};

class WebsiteResearchAgent extends BaseAgent {
  definition = WEBSITE_RESEARCH_DEF;

  async execute(context: ExecutionContext): Promise<AgentExecutionResult> {
    const start = Date.now();
    const input = context.input;
    const workspaceId = context.workspaceId;

    const url = (input['url'] as string) ?? (input['website'] as string);
    const companyName =
      (input['company_name'] as string) ?? (input['companyName'] as string) ?? '';

    if (!url) {
      return failure(this.definition.agent_name, 'Missing required field: url', Date.now() - start);
    }

    try {
      await ensureProvidersInitialized();

      // 1. Crawl the website with Firecrawl
      const researchContext: ResearchContext = {
        companyName,
        website: url,
        requestType: 'company_profile',
        capabilities: ['website_crawling', 'content_analysis', 'service_extraction'],
      };

      const crawlResult: ProviderResult = await firecrawl.research(researchContext);

      if (!crawlResult.success) {
        return failure(
          this.definition.agent_name,
          crawlResult.error ?? 'Firecrawl crawl failed',
          Date.now() - start,
        );
      }

      const markdown = (crawlResult.data['markdown'] as string) ?? '';
      const metadata = (crawlResult.data['metadata'] as Record<string, unknown>) ?? {};

      // 2. Use AI Gateway to synthesize structured output
      const schema = {
        type: 'object',
        properties: {
          company_overview: { type: 'string' },
          products: {
            type: 'array',
            items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
          },
          services: {
            type: 'array',
            items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
          },
          about_us: { type: 'string' },
          contact: {
            type: 'object',
            properties: {
              email: { type: 'array', items: { type: 'string' } },
              phone: { type: 'array', items: { type: 'string' } },
              address: { type: 'array', items: { type: 'string' } },
            },
          },
          team: {
            type: 'array',
            items: {
              type: 'object',
              properties: { name: { type: 'string' }, title: { type: 'string' } },
            },
          },
          industries: { type: 'array', items: { type: 'string' } },
        },
        required: ['company_overview', 'products', 'services', 'industries'],
      };

      const response = await aiGateway.generateStructured({
        agentName: this.definition.agent_name,
        taskType: 'structured',
        systemPrompt:
          'You are a business research analyst. Extract structured company information from the crawled website content. Return only valid JSON matching the schema.',
        userPrompt: `Website: ${url}\nTitle: ${metadata['title'] ?? ''}\nDescription: ${metadata['description'] ?? ''}\n\nCrawled content (markdown):\n${markdown.slice(0, 12000)}`,
        temperature: 0.3,
        maxTokens: 2000,
        schema,
        workspaceId: workspaceId ?? undefined,
      });

      const output = (response.structuredData ?? {}) as Record<string, unknown>;

      // Ensure required fields exist
      if (!output['company_overview']) output['company_overview'] = (metadata['description'] as string) ?? '';
      if (!Array.isArray(output['products'])) output['products'] = [];
      if (!Array.isArray(output['services'])) output['services'] = [];
      if (!Array.isArray(output['industries'])) output['industries'] = [];
      if (!output['about_us']) output['about_us'] = '';
      if (!output['contact']) output['contact'] = { email: [], phone: [], address: [] };
      if (!Array.isArray(output['team'])) output['team'] = [];

      output['source_url'] = url;
      output['crawl_confidence'] = crawlResult.confidence;

      // 3. Store in shared memory for downstream agents
      if (context.workflowId) {
        ExecutionContextBuilder.storeResult(context.workflowId, this.definition.agent_name, {
          agentName: this.definition.agent_name,
          status: 'completed',
          output,
          tokensUsed: response.totalTokens,
          estimatedCost: response.estimatedCost,
          executionTimeMs: Date.now() - start,
        });
      }

      // 4. Update Knowledge Graph
      await updateGraph(input, workspaceId, {
        companyName: companyName || (metadata['title'] as string) || url,
        website: url,
        industry: (output['industries'] as string[])?.[0] ?? null,
      });

      return success(
        this.definition.agent_name,
        output,
        response.totalTokens,
        response.estimatedCost,
        Date.now() - start,
      );
    } catch (err) {
      return failure(
        this.definition.agent_name,
        err instanceof Error ? err.message : 'Unknown error',
        Date.now() - start,
      );
    }
  }
}

// ============================================================
// Company Intelligence Agent
// ============================================================

const COMPANY_INTELLIGENCE_DEF: AgentDefinition = {
  agent_name: 'company_intelligence_agent',
  description:
    'Aggregates company data from website research and Tavily search to build a comprehensive company profile.',
  version: '2.0.0',
  category: 'intelligence',
  capabilities: ['data_aggregation', 'company_profiling', 'market_research'],
  inputSchema: {
    type: 'object',
    properties: { company_name: { type: 'string' }, domain: { type: 'string' } },
    required: ['company_name'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      description: { type: 'string' },
      headquarters: { type: 'string' },
      industry: { type: 'string' },
      employee_estimate: { type: 'string' },
      revenue_estimate: { type: 'string' },
      target_customers: { type: 'array' },
      competitors: { type: 'array' },
      recent_news: { type: 'array' },
    },
  },
  defaultTimeoutMs: 90_000,
  maxRetries: 2,
};

class CompanyIntelligenceAgent extends BaseAgent {
  definition = COMPANY_INTELLIGENCE_DEF;

  async execute(context: ExecutionContext): Promise<AgentExecutionResult> {
    const start = Date.now();
    const input = context.input;
    const workspaceId = context.workspaceId;

    const companyName =
      (input['company_name'] as string) ?? (input['companyName'] as string) ?? '';
    const domain = (input['domain'] as string) ?? (input['website'] as string) ?? null;

    if (!companyName) {
      return failure(
        this.definition.agent_name,
        'Missing required field: company_name',
        Date.now() - start,
      );
    }

    try {
      await ensureProvidersInitialized();

      // 1. Read Website Research output from shared memory if available
      let websiteOutput: Record<string, unknown> = {};
      if (context.workflowId) {
        const prev = ExecutionContextBuilder.getPreviousOutput(
          context.workflowId,
          'website_research_agent',
        );
        if (prev?.output) websiteOutput = prev.output;
      }

      // 2. Search Tavily for company intelligence
      const researchContext = buildResearchContext(input, [
        'company_research',
        'competitive_positioning',
        'industry_classification',
        'growth_signal_detection',
        'funding_detection',
      ]);

      const tavilyResult: ProviderResult = await tavily.research(researchContext);

      const tavilyData = tavilyResult.success
        ? (tavilyResult.data['results'] as Record<string, unknown>[]) ?? []
        : [];

      // 3. Use AI Gateway to synthesize structured company intelligence
      const schema = {
        type: 'object',
        properties: {
          description: { type: 'string' },
          headquarters: { type: 'string' },
          industry: { type: 'string' },
          employee_estimate: { type: 'string' },
          revenue_estimate: { type: 'string' },
          target_customers: { type: 'array', items: { type: 'string' } },
          competitors: { type: 'array', items: { type: 'string' } },
          recent_news: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                summary: { type: 'string' },
                date: { type: 'string' },
              },
            },
          },
        },
        required: ['description', 'industry', 'target_customers', 'competitors'],
      };

      const websiteContext = websiteOutput['company_overview']
        ? `Website research overview: ${JSON.stringify(websiteOutput).slice(0, 4000)}`
        : '';

      const tavilyContext = tavilyData
        .slice(0, 10)
        .map((r) => (r['content'] as string) ?? '')
        .join('\n---\n')
        .slice(0, 8000);

      const response = await aiGateway.generateStructured({
        agentName: this.definition.agent_name,
        taskType: 'structured',
        systemPrompt:
          'You are a company intelligence analyst. Synthesize the provided website research and web search results into a comprehensive company profile. Return only valid JSON matching the schema.',
        userPrompt: `Company: ${companyName}\nDomain: ${domain ?? 'unknown'}\n\n${websiteContext}\n\nWeb search results:\n${tavilyContext}`,
        temperature: 0.3,
        maxTokens: 2000,
        schema,
        workspaceId: workspaceId ?? undefined,
      });

      const output = (response.structuredData ?? {}) as Record<string, unknown>;

      if (!output['description']) output['description'] = '';
      if (!output['headquarters']) output['headquarters'] = '';
      if (!output['industry']) output['industry'] = '';
      if (!output['employee_estimate']) output['employee_estimate'] = '';
      if (!output['revenue_estimate']) output['revenue_estimate'] = '';
      if (!Array.isArray(output['target_customers'])) output['target_customers'] = [];
      if (!Array.isArray(output['competitors'])) output['competitors'] = [];
      if (!Array.isArray(output['recent_news'])) output['recent_news'] = [];

      output['company_name'] = companyName;
      output['domain'] = domain;
      output['data_sources'] = ['website_research', 'tavily'];
      output['tavily_confidence'] = tavilyResult.confidence;

      // Store in shared memory
      if (context.workflowId) {
        ExecutionContextBuilder.storeResult(context.workflowId, this.definition.agent_name, {
          agentName: this.definition.agent_name,
          status: 'completed',
          output,
          tokensUsed: response.totalTokens,
          estimatedCost: response.estimatedCost,
          executionTimeMs: Date.now() - start,
        });
      }

      // Update Knowledge Graph
      await updateGraph(input, workspaceId, {
        companyName,
        website: domain,
        industry: (output['industry'] as string) ?? null,
        businessModel: null,
      });

      return success(
        this.definition.agent_name,
        output,
        response.totalTokens,
        response.estimatedCost,
        Date.now() - start,
      );
    } catch (err) {
      return failure(
        this.definition.agent_name,
        err instanceof Error ? err.message : 'Unknown error',
        Date.now() - start,
      );
    }
  }
}

// ============================================================
// Technology Detection Agent
// ============================================================

const TECHNOLOGY_DETECTION_DEF: AgentDefinition = {
  agent_name: 'technology_detection_agent',
  description:
    'Detects the technology stack used by a company including frameworks, CMS, analytics, and infrastructure from Firecrawl content.',
  version: '2.0.0',
  category: 'research',
  capabilities: ['tech_detection', 'stack_analysis', 'infrastructure_mapping'],
  inputSchema: {
    type: 'object',
    properties: { domain: { type: 'string' } },
    required: ['domain'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      technologies: { type: 'array' },
      categories: { type: 'object' },
    },
  },
  defaultTimeoutMs: 30_000,
  maxRetries: 2,
};

class TechnologyDetectionAgent extends BaseAgent {
  definition = TECHNOLOGY_DETECTION_DEF;

  async execute(context: ExecutionContext): Promise<AgentExecutionResult> {
    const start = Date.now();
    const input = context.input;
    const workspaceId = context.workspaceId;

    const domain = (input['domain'] as string) ?? (input['website'] as string);
    const companyName =
      (input['company_name'] as string) ?? (input['companyName'] as string) ?? '';

    if (!domain) {
      return failure(
        this.definition.agent_name,
        'Missing required field: domain',
        Date.now() - start,
      );
    }

    try {
      await ensureProvidersInitialized();

      // 1. Crawl website for HTML content (Firecrawl)
      const researchContext: ResearchContext = {
        companyName,
        website: domain,
        requestType: 'technology_stack',
        capabilities: ['technology_stack_detection', 'content_analysis'],
      };

      const crawlResult: ProviderResult = await firecrawl.research(researchContext);

      if (!crawlResult.success) {
        return failure(
          this.definition.agent_name,
          crawlResult.error ?? 'Firecrawl crawl failed for tech detection',
          Date.now() - start,
        );
      }

      const html = (crawlResult.data['html'] as string) ?? '';
      const markdown = (crawlResult.data['markdown'] as string) ?? '';
      const metadata = (crawlResult.data['metadata'] as Record<string, unknown>) ?? {};

      // 2. Use AI Gateway to detect technologies from content
      const schema = {
        type: 'object',
        properties: {
          cms: { type: 'array', items: { type: 'string' } },
          framework: { type: 'array', items: { type: 'string' } },
          analytics: { type: 'array', items: { type: 'string' } },
          crm: { type: 'array', items: { type: 'string' } },
          marketing_tools: { type: 'array', items: { type: 'string' } },
          chat_widgets: { type: 'array', items: { type: 'string' } },
          payment_gateways: { type: 'array', items: { type: 'string' } },
          cdn: { type: 'array', items: { type: 'string' } },
          hosting: { type: 'array', items: { type: 'string' } },
        },
        required: ['cms', 'framework', 'analytics'],
      };

      const response = await aiGateway.generateStructured({
        agentName: this.definition.agent_name,
        taskType: 'structured',
        systemPrompt:
          'You are a technology stack analyst. Analyze the HTML and content from a website to identify the technologies used. Look for script tags, meta tags, framework signatures, analytics codes, CDN headers, and other technology indicators. Return only valid JSON matching the schema.',
        userPrompt: `Domain: ${domain}\n\nHTML content (first 10000 chars):\n${html.slice(0, 10000)}\n\nMarkdown content:\n${markdown.slice(0, 5000)}\n\nMetadata: ${JSON.stringify(metadata)}`,
        temperature: 0.2,
        maxTokens: 1500,
        schema,
        workspaceId: workspaceId ?? undefined,
      });

      const structured = (response.structuredData ?? {}) as Record<string, unknown>;

      // Build categories map and technologies list
      const categories: Record<string, string[]> = {};
      const technologies: { name: string; category: string; confidence: number }[] = [];

      const categoryKeys = [
        'cms',
        'framework',
        'analytics',
        'crm',
        'marketing_tools',
        'chat_widgets',
        'payment_gateways',
        'cdn',
        'hosting',
      ];

      for (const key of categoryKeys) {
        const items = (structured[key] as string[]) ?? [];
        categories[key] = items;
        for (const name of items) {
          technologies.push({ name, category: key, confidence: 0.75 });
        }
      }

      const output: Record<string, unknown> = {
        domain,
        technologies,
        categories,
        cms: categories['cms'],
        framework: categories['framework'],
        analytics: categories['analytics'],
        crm: categories['crm'],
        marketing_tools: categories['marketing_tools'],
        chat_widgets: categories['chat_widgets'],
        payment_gateways: categories['payment_gateways'],
        cdn: categories['cdn'],
        hosting: categories['hosting'],
        detection_confidence: crawlResult.confidence,
      };

      // Store in shared memory
      if (context.workflowId) {
        ExecutionContextBuilder.storeResult(context.workflowId, this.definition.agent_name, {
          agentName: this.definition.agent_name,
          status: 'completed',
          output,
          tokensUsed: response.totalTokens,
          estimatedCost: response.estimatedCost,
          executionTimeMs: Date.now() - start,
        });
      }

      // Update Knowledge Graph with detected tech stack
      await updateGraph(input, workspaceId, {
        companyName: companyName || domain,
        website: domain,
        technologyStack: technologies.map((t) => t.name),
      });

      return success(
        this.definition.agent_name,
        output,
        response.totalTokens,
        response.estimatedCost,
        Date.now() - start,
      );
    } catch (err) {
      return failure(
        this.definition.agent_name,
        err instanceof Error ? err.message : 'Unknown error',
        Date.now() - start,
      );
    }
  }
}

// ============================================================
// Executive Summary Agent
// ============================================================

const EXECUTIVE_SUMMARY_DEF: AgentDefinition = {
  agent_name: 'executive_summary_agent',
  description:
    'Synthesizes all research outputs into an executive summary with pain points, opportunities, and sales angles.',
  version: '2.0.0',
  category: 'analysis',
  capabilities: ['summarization', 'synthesis', 'executive_reporting'],
  inputSchema: {
    type: 'object',
    properties: { research_data: { type: 'object' }, audience: { type: 'string' } },
  },
  outputSchema: {
    type: 'object',
    properties: {
      business_summary: { type: 'string' },
      pain_points: { type: 'array' },
      opportunities: { type: 'array' },
      sales_angle: { type: 'string' },
      recommended_services: { type: 'array' },
      confidence_score: { type: 'number' },
    },
  },
  defaultTimeoutMs: 45_000,
  maxRetries: 2,
};

class ExecutiveSummaryAgent extends BaseAgent {
  definition = EXECUTIVE_SUMMARY_DEF;

  async execute(context: ExecutionContext): Promise<AgentExecutionResult> {
    const start = Date.now();
    const input = context.input;
    const workspaceId = context.workspaceId;

    try {
      // 1. Gather all previous agent outputs from shared memory
      const previousOutputs: Record<string, unknown> = {};

      if (context.workflowId) {
        const agentNames = [
          'website_research_agent',
          'company_intelligence_agent',
          'technology_detection_agent',
        ];
        for (const name of agentNames) {
          const prev = ExecutionContextBuilder.getPreviousOutput(context.workflowId, name);
          if (prev?.output) {
            previousOutputs[name] = prev.output;
          }
        }
      }

      // Also accept direct input
      if (input['research_data']) {
        previousOutputs['direct_input'] = input['research_data'];
      }

      // 2. Use AI Gateway to synthesize executive summary
      const schema = {
        type: 'object',
        properties: {
          business_summary: { type: 'string' },
          pain_points: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                point: { type: 'string' },
                severity: { type: 'string' },
                evidence: { type: 'string' },
              },
            },
          },
          opportunities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                opportunity: { type: 'string' },
                potential_impact: { type: 'string' },
                time_to_value: { type: 'string' },
              },
            },
          },
          sales_angle: { type: 'string' },
          recommended_services: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                service: { type: 'string' },
                reason: { type: 'string' },
                priority: { type: 'string' },
              },
            },
          },
          confidence_score: { type: 'number' },
        },
        required: ['business_summary', 'pain_points', 'opportunities', 'sales_angle', 'confidence_score'],
      };

      const audience = (input['audience'] as string) ?? 'sales team';
      const researchJson = JSON.stringify(previousOutputs).slice(0, 16000);

      const response = await aiGateway.generateStructured({
        agentName: this.definition.agent_name,
        taskType: 'structured',
        systemPrompt: `You are a senior sales strategist and business analyst. Synthesize the research outputs into an executive summary tailored for the ${audience}. Identify pain points, opportunities, and a compelling sales angle. Return only valid JSON matching the schema.`,
        userPrompt: `Research data from previous agents:\n${researchJson}`,
        temperature: 0.4,
        maxTokens: 2500,
        schema,
        workspaceId: workspaceId ?? undefined,
      });

      const output = (response.structuredData ?? {}) as Record<string, unknown>;

      if (!output['business_summary']) output['business_summary'] = '';
      if (!Array.isArray(output['pain_points'])) output['pain_points'] = [];
      if (!Array.isArray(output['opportunities'])) output['opportunities'] = [];
      if (!output['sales_angle']) output['sales_angle'] = '';
      if (!Array.isArray(output['recommended_services'])) output['recommended_services'] = [];
      if (typeof output['confidence_score'] !== 'number') output['confidence_score'] = 0.7;

      output['synthesized_from'] = Object.keys(previousOutputs);
      output['audience'] = audience;

      // Store in shared memory
      if (context.workflowId) {
        ExecutionContextBuilder.storeResult(context.workflowId, this.definition.agent_name, {
          agentName: this.definition.agent_name,
          status: 'completed',
          output,
          tokensUsed: response.totalTokens,
          estimatedCost: response.estimatedCost,
          executionTimeMs: Date.now() - start,
        });
      }

      return success(
        this.definition.agent_name,
        output,
        response.totalTokens,
        response.estimatedCost,
        Date.now() - start,
      );
    } catch (err) {
      return failure(
        this.definition.agent_name,
        err instanceof Error ? err.message : 'Unknown error',
        Date.now() - start,
      );
    }
  }
}

// ============================================================
// Export instances
// ============================================================

export const websiteResearchAgent = new WebsiteResearchAgent();
export const companyIntelligenceAgent = new CompanyIntelligenceAgent();
export const technologyDetectionAgent = new TechnologyDetectionAgent();
export const executiveSummaryAgent = new ExecutiveSummaryAgent();
