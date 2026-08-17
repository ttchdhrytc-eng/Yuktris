// ============================================================
// ICP Generation Agent — generates Ideal Customer Profiles
// ============================================================
//
// Distinct from icp_scoring_agent (which scores a single prospect
// company against ICP criteria). This agent generates the ICP
// definitions themselves — industries, company size, geography,
// target roles, pain points, buying triggers, exclusions — from
// the workspace's persisted business/market research.
//
// Follows the same pattern as the other concrete agents:
//   - Reads persisted business/market research as primary context
//   - Uses the AI Gateway for structured synthesis (no separate AI stack)
//   - Never throws — degrades to a `failed` AgentExecutionResult

import { BaseAgent } from './BaseAgent';
import { ExecutionContextBuilder } from './ExecutionContext';
import { aiGateway } from '@/services/ai';
import type { AgentDefinition, ExecutionContext, AgentExecutionResult } from '@/types/agent-orchestrator';
import { validateGeneratedICPs } from '@/services/icp-intelligence/icpValidation';

function success(
  agentName: string,
  output: Record<string, unknown>,
  tokensUsed: number,
  estimatedCost: number,
  executionTimeMs: number,
): AgentExecutionResult {
  return { agentName, status: 'completed', output, tokensUsed, estimatedCost, executionTimeMs };
}

function failure(agentName: string, error: string, executionTimeMs: number): AgentExecutionResult {
  return { agentName, status: 'failed', output: {}, tokensUsed: 0, estimatedCost: 0, executionTimeMs, error };
}

const ICP_GENERATION_DEF: AgentDefinition = {
  agent_name: 'icp_generation_agent',
  description: 'Generates Ideal Customer Profile definitions (industries, company size, geography, target roles, pain points, buying triggers, exclusions) from a workspace\'s persisted business and market research.',
  version: '1.0.0',
  category: 'generation',
  capabilities: ['icp_generation', 'buyer_persona_generation', 'gtm_strategy'],
  inputSchema: {
    type: 'object',
    properties: { business_summary: { type: 'object' }, market_summary: { type: 'object' }, company_name: { type: 'string' } },
    required: ['business_summary'],
  },
  outputSchema: { type: 'object', properties: { icps: { type: 'array' } }, required: ['icps'] },
  defaultTimeoutMs: 60_000,
  maxRetries: 1,
};

const ICP_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    priority: { type: 'string', enum: ['primary', 'secondary', 'tertiary'] },
    confidence: { type: 'number' },
    opportunity_score: { type: 'number' },
    competition_score: { type: 'number' },
    revenue_score: { type: 'number' },
    conversion_rate: { type: 'number' },
    estimated_deal_size: { type: 'string' },
    reasoning: { type: 'string' },
    company_profile: {
      type: 'object',
      properties: {
        industry: { type: 'string' },
        sub_industry: { type: 'string' },
        company_size: { type: 'string' },
        revenue_range: { type: 'string' },
        employee_count: { type: 'string' },
        funding_stage: { type: 'string' },
        business_model: { type: 'string' },
        technology_stack: { type: 'array', items: { type: 'string' } },
        country: { type: 'string' },
        region: { type: 'string' },
        city: { type: 'string' },
      },
      required: ['industry', 'company_size', 'country'],
    },
    decision_makers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          department: { type: 'string' },
          job_title: { type: 'string' },
          seniority: { type: 'string' },
          responsibilities: { type: 'string' },
          authority_score: { type: 'number' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        },
        required: ['job_title'],
      },
    },
    pain_points: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pain_point: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          urgency: { type: 'string', enum: ['low', 'medium', 'high', 'immediate'] },
          business_impact: { type: 'string' },
          recommended_solution: { type: 'string' },
        },
        required: ['pain_point'],
      },
    },
    goals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          goal: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          category: { type: 'string', enum: ['business', 'revenue', 'marketing', 'operational', 'technology'] },
        },
        required: ['goal'],
      },
    },
    buying_triggers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          trigger: { type: 'string' },
          description: { type: 'string' },
          confidence: { type: 'number' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        },
        required: ['trigger'],
      },
    },
    negative_filters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          filter_type: { type: 'string', enum: ['industry', 'country', 'company_size', 'technology', 'revenue_range'] },
          value: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['filter_type', 'value'],
      },
    },
    sales_navigator_filters: {
      type: 'object',
      properties: {
        industry: { type: 'array', items: { type: 'string' } },
        company_size: { type: 'array', items: { type: 'string' } },
        location: { type: 'array', items: { type: 'string' } },
        keywords: { type: 'array', items: { type: 'string' } },
        titles: { type: 'array', items: { type: 'string' } },
        departments: { type: 'array', items: { type: 'string' } },
        technology: { type: 'array', items: { type: 'string' } },
        boolean_query: { type: 'string' },
      },
    },
  },
  required: ['name', 'description', 'priority', 'company_profile', 'decision_makers', 'pain_points', 'buying_triggers', 'negative_filters'],
};

export class ICPGenerationAgent extends BaseAgent {
  definition = ICP_GENERATION_DEF;

  async execute(context: ExecutionContext): Promise<AgentExecutionResult> {
    const start = Date.now();
    const input = context.input;
    const workspaceId = context.workspaceId;

    const businessSummary = input['business_summary'] as Record<string, unknown> | undefined;
    if (!businessSummary || Object.keys(businessSummary).length === 0) {
      return failure(this.definition.agent_name, 'Missing required field: business_summary (persisted business research)', Date.now() - start);
    }
    const marketSummary = (input['market_summary'] as Record<string, unknown>) ?? {};
    const companyName = (input['company_name'] as string) ?? '';

    const schema = {
      type: 'object',
      properties: { icps: { type: 'array', items: ICP_ITEM_SCHEMA, minItems: 1, maxItems: 3 } },
      required: ['icps'],
    };

    try {
      const response = await aiGateway.generateStructured({
        agentName: this.definition.agent_name,
        taskType: 'structured',
        systemPrompt:
          'You are a B2B go-to-market strategist. Using the company\'s own business research and market research as ' +
          'primary context, generate 1-3 distinct Ideal Customer Profiles (ICPs) this business should target. Each ICP ' +
          'must include: a company profile (industry, sub-industry, company size, revenue range, employee count, funding ' +
          'stage, business model, technology stack, country/region/city), decision makers (department, job title, ' +
          'seniority, responsibilities, authority score 0-100, priority), pain points (with severity, urgency, business ' +
          'impact, recommended solution), goals, buying triggers (with confidence 0-100), explicit exclusion/negative ' +
          'filters (industries, countries, company sizes, technologies, or revenue ranges this business should NOT ' +
          'target and why), and LinkedIn Sales Navigator search filters. Ground every field in the supplied research — ' +
          'do not invent unrelated industries. Return only valid JSON matching the schema.',
        userPrompt: `Company name: ${companyName || 'Unknown'}\n\nPersisted business research:\n${JSON.stringify(businessSummary).slice(0, 8000)}\n\nPersisted market research:\n${JSON.stringify(marketSummary).slice(0, 6000)}`,
        temperature: 0.4,
        maxTokens: 4000,
        schema,
        workspaceId: workspaceId ?? undefined,
      });

      const structured = (response.structuredData ?? {}) as Record<string, unknown>;
      const validation = validateGeneratedICPs(structured);
      if (!validation.valid) {
        return failure(
          this.definition.agent_name,
          `AI output failed validation: ${validation.errors.join('; ')}`,
          Date.now() - start,
        );
      }

      const output = { icps: validation.icps };

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

export const icpGenerationAgent = new ICPGenerationAgent();
