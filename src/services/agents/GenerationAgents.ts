// ============================================================
// Generation Agents — Concrete implementations
// ============================================================
//
// Proposal Generator Agent, Email Writer Agent, Follow-up Agent,
// Meeting Preparation Agent, CRM Update Agent, Workflow Decision Agent.
//
// Each agent follows the same pattern as ResearchAgents:
//   - Reads input from ExecutionContext
//   - Reads previous agent outputs from shared memory
//   - Uses AI Gateway for structured synthesis
//   - Updates the Knowledge Graph when appropriate
//   - Never throws — degrades gracefully

import { BaseAgent } from './BaseAgent';
import { ExecutionContextBuilder } from './ExecutionContext';
import { aiGateway } from '@/services/ai';
import { knowledgeGraphService } from '@/services/knowledge-graph';
import type {
  AgentDefinition,
  ExecutionContext,
  AgentExecutionResult,
} from '@/types/agent-orchestrator';

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
  } catch { /* non-fatal */ }
}

const ALL_PRIOR_AGENTS = [
  'website_research_agent', 'company_intelligence_agent', 'technology_detection_agent',
  'executive_summary_agent', 'seo_analysis_agent', 'icp_scoring_agent',
  'buying_signal_agent', 'linkedin_intelligence_agent',
];

// ============================================================
// Proposal Generator Agent
// ============================================================

const PROPOSAL_GENERATOR_DEF: AgentDefinition = {
  agent_name: 'proposal_generator_agent',
  description: 'Generates customized proposals with executive summary, problems, solutions, timeline, pricing, deliverables, and next steps.',
  version: '2.0.0',
  category: 'generation',
  capabilities: ['proposal_generation', 'content_creation', 'personalization'],
  inputSchema: { type: 'object', properties: { prospect: { type: 'object' }, offering: { type: 'object' } } },
  outputSchema: { type: 'object', properties: { proposal: { type: 'string' }, sections: { type: 'array' } } },
  defaultTimeoutMs: 60_000,
  maxRetries: 2,
};

class ProposalGeneratorAgent extends BaseAgent {
  definition = PROPOSAL_GENERATOR_DEF;

  async execute(context: ExecutionContext): Promise<AgentExecutionResult> {
    const start = Date.now();
    const input = context.input;
    const workspaceId = context.workspaceId;

    try {
      const prev = getPreviousOutputs(context.workflowId, ALL_PRIOR_AGENTS);
      const companyName = (input['company_name'] as string) ?? (input['companyName'] as string) ?? '';

      const schema = {
        type: 'object',
        properties: {
          executive_summary: { type: 'string' },
          problems: { type: 'array', items: { type: 'object', properties: { problem: { type: 'string' }, impact: { type: 'string' }, evidence: { type: 'string' } } } },
          solutions: { type: 'array', items: { type: 'object', properties: { solution: { type: 'string' }, description: { type: 'string' }, addresses: { type: 'string' } } } },
          timeline: { type: 'array', items: { type: 'object', properties: { phase: { type: 'string' }, duration: { type: 'string' }, milestones: { type: 'array', items: { type: 'string' } } } } },
          pricing_placeholder: { type: 'object', properties: { model: { type: 'string' }, estimated_range: { type: 'string' }, notes: { type: 'string' } } },
          deliverables: { type: 'array', items: { type: 'object', properties: { deliverable: { type: 'string' }, description: { type: 'string' }, timeline: { type: 'string' } } } },
          next_steps: { type: 'array', items: { type: 'string' } },
        },
        required: ['executive_summary', 'problems', 'solutions', 'timeline', 'deliverables', 'next_steps'],
      };

      const response = await aiGateway.generateStructured({
        agentName: this.definition.agent_name,
        taskType: 'structured',
        systemPrompt: 'You are a senior proposal writer. Generate a comprehensive proposal based on all research and intelligence gathered. Include executive summary, problems, solutions, timeline, pricing placeholder, deliverables, and next steps. Return only valid JSON matching the schema.',
        userPrompt: `Company: ${companyName}\n\nAll previous agent outputs:\n${JSON.stringify(prev).slice(0, 16000)}`,
        temperature: 0.4,
        maxTokens: 3000,
        schema,
        workspaceId: workspaceId ?? undefined,
      });

      const output = (response.structuredData ?? {}) as Record<string, unknown>;
      if (!output['executive_summary']) output['executive_summary'] = '';
      if (!Array.isArray(output['problems'])) output['problems'] = [];
      if (!Array.isArray(output['solutions'])) output['solutions'] = [];
      if (!Array.isArray(output['timeline'])) output['timeline'] = [];
      if (!output['pricing_placeholder']) output['pricing_placeholder'] = {};
      if (!Array.isArray(output['deliverables'])) output['deliverables'] = [];
      if (!Array.isArray(output['next_steps'])) output['next_steps'] = [];

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
// Email Writer Agent
// ============================================================

const EMAIL_WRITER_DEF: AgentDefinition = {
  agent_name: 'email_writer_agent',
  description: 'Writes personalized cold outreach emails with subject lines, CTAs, and follow-up messaging.',
  version: '2.0.0',
  category: 'communication',
  capabilities: ['email_generation', 'personalization', 'copywriting'],
  inputSchema: { type: 'object', properties: { prospect: { type: 'object' }, tone: { type: 'string' } } },
  outputSchema: { type: 'object', properties: { subject: { type: 'string' }, body: { type: 'string' } } },
  defaultTimeoutMs: 30_000,
  maxRetries: 2,
};

class EmailWriterAgent extends BaseAgent {
  definition = EMAIL_WRITER_DEF;

  async execute(context: ExecutionContext): Promise<AgentExecutionResult> {
    const start = Date.now();
    const input = context.input;
    const workspaceId = context.workspaceId;

    try {
      const prev = getPreviousOutputs(context.workflowId, ALL_PRIOR_AGENTS);
      const tone = (input['tone'] as string) ?? 'professional';
      const companyName = (input['company_name'] as string) ?? '';

      const schema = {
        type: 'object',
        properties: {
          cold_email: { type: 'object', properties: { subject_line: { type: 'string' }, body: { type: 'string' }, cta: { type: 'string' } } },
          follow_up: { type: 'object', properties: { subject_line: { type: 'string' }, body: { type: 'string' }, cta: { type: 'string' } } },
          subject_lines: { type: 'array', items: { type: 'string' } },
          ctas: { type: 'array', items: { type: 'string' } },
          personalization: { type: 'object', properties: { icebreaker: { type: 'string' }, reference: { type: 'string' }, value_prop: { type: 'string' } } },
        },
        required: ['cold_email', 'follow_up', 'subject_lines', 'ctas'],
      };

      const response = await aiGateway.generateStructured({
        agentName: this.definition.agent_name,
        taskType: 'structured',
        systemPrompt: `You are an expert cold email copywriter. Write personalized outreach emails using a ${tone} tone. Include a cold email, a follow-up email, multiple subject line options, CTAs, and personalization elements. Return only valid JSON matching the schema.`,
        userPrompt: `Company: ${companyName}\n\nAll previous agent outputs:\n${JSON.stringify(prev).slice(0, 14000)}`,
        temperature: 0.5,
        maxTokens: 2000,
        schema,
        workspaceId: workspaceId ?? undefined,
      });

      const output = (response.structuredData ?? {}) as Record<string, unknown>;
      if (!output['cold_email']) output['cold_email'] = {};
      if (!output['follow_up']) output['follow_up'] = {};
      if (!Array.isArray(output['subject_lines'])) output['subject_lines'] = [];
      if (!Array.isArray(output['ctas'])) output['ctas'] = [];
      if (!output['personalization']) output['personalization'] = {};

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
// Follow-up Agent
// ============================================================

const FOLLOW_UP_DEF: AgentDefinition = {
  agent_name: 'follow_up_agent',
  description: 'Generates a 3-step follow-up sequence with timing, CTAs, and objection handling.',
  version: '2.0.0',
  category: 'communication',
  capabilities: ['follow_up_generation', 'sequence_management', 'response_analysis'],
  inputSchema: { type: 'object', properties: { previous_messages: { type: 'array' }, prospect: { type: 'object' } } },
  outputSchema: { type: 'object', properties: { message: { type: 'string' }, timing: { type: 'string' } } },
  defaultTimeoutMs: 30_000,
  maxRetries: 2,
};

class FollowUpAgent extends BaseAgent {
  definition = FOLLOW_UP_DEF;

  async execute(context: ExecutionContext): Promise<AgentExecutionResult> {
    const start = Date.now();
    const input = context.input;
    const workspaceId = context.workspaceId;

    try {
      const prev = getPreviousOutputs(context.workflowId, [...ALL_PRIOR_AGENTS, 'email_writer_agent']);

      const schema = {
        type: 'object',
        properties: {
          sequence: { type: 'array', items: { type: 'object', properties: { step: { type: 'number' }, subject: { type: 'string' }, body: { type: 'string' }, cta: { type: 'string' }, timing: { type: 'string' }, delay_days: { type: 'number' } } } },
          objection_follow_ups: { type: 'array', items: { type: 'object', properties: { objection: { type: 'string' }, response: { type: 'string' }, approach: { type: 'string' } } } },
          timing_strategy: { type: 'object', properties: { best_days: { type: 'array', items: { type: 'string' } }, best_times: { type: 'array', items: { type: 'string' } }, timezone: { type: 'string' } } },
        },
        required: ['sequence', 'objection_follow_ups'],
      };

      const response = await aiGateway.generateStructured({
        agentName: this.definition.agent_name,
        taskType: 'structured',
        systemPrompt: 'You are a follow-up sequence strategist. Generate a 3-step follow-up sequence with appropriate timing, CTAs, and objection handling responses. Return only valid JSON matching the schema.',
        userPrompt: `All previous agent outputs:\n${JSON.stringify(prev).slice(0, 14000)}`,
        temperature: 0.5,
        maxTokens: 2000,
        schema,
        workspaceId: workspaceId ?? undefined,
      });

      const output = (response.structuredData ?? {}) as Record<string, unknown>;
      if (!Array.isArray(output['sequence'])) output['sequence'] = [];
      if (!Array.isArray(output['objection_follow_ups'])) output['objection_follow_ups'] = [];
      if (!output['timing_strategy']) output['timing_strategy'] = {};

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
// Meeting Preparation Agent
// ============================================================

const MEETING_PREP_DEF: AgentDefinition = {
  agent_name: 'meeting_preparation_agent',
  description: 'Prepares meeting briefs with business summary, pain points, discovery questions, and recommended pitch.',
  version: '2.0.0',
  category: 'scheduling',
  capabilities: ['meeting_prep', 'brief_generation', 'agenda_creation'],
  inputSchema: { type: 'object', properties: { prospect: { type: 'object' }, meeting_type: { type: 'string' } } },
  outputSchema: { type: 'object', properties: { brief: { type: 'string' }, agenda: { type: 'array' } } },
  defaultTimeoutMs: 45_000,
  maxRetries: 2,
};

class MeetingPreparationAgent extends BaseAgent {
  definition = MEETING_PREP_DEF;

  async execute(context: ExecutionContext): Promise<AgentExecutionResult> {
    const start = Date.now();
    const input = context.input;
    const workspaceId = context.workspaceId;

    try {
      const prev = getPreviousOutputs(context.workflowId, [...ALL_PRIOR_AGENTS, 'email_writer_agent', 'follow_up_agent']);
      const meetingType = (input['meeting_type'] as string) ?? 'discovery';

      const schema = {
        type: 'object',
        properties: {
          meeting_brief: { type: 'string' },
          business_summary: { type: 'string' },
          pain_points: { type: 'array', items: { type: 'object', properties: { point: { type: 'string' }, severity: { type: 'string' }, impact: { type: 'string' } } } },
          discovery_questions: { type: 'array', items: { type: 'string' } },
          recommended_pitch: { type: 'string' },
          agenda: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, duration: { type: 'string' } } } },
        },
        required: ['meeting_brief', 'business_summary', 'pain_points', 'discovery_questions', 'recommended_pitch'],
      };

      const response = await aiGateway.generateStructured({
        agentName: this.definition.agent_name,
        taskType: 'structured',
        systemPrompt: `You are a meeting preparation specialist. Prepare a comprehensive ${meetingType} meeting brief using all research and intelligence. Include business summary, pain points, discovery questions, recommended pitch, and agenda. Return only valid JSON matching the schema.`,
        userPrompt: `All previous agent outputs:\n${JSON.stringify(prev).slice(0, 16000)}`,
        temperature: 0.4,
        maxTokens: 2500,
        schema,
        workspaceId: workspaceId ?? undefined,
      });

      const output = (response.structuredData ?? {}) as Record<string, unknown>;
      if (!output['meeting_brief']) output['meeting_brief'] = '';
      if (!output['business_summary']) output['business_summary'] = '';
      if (!Array.isArray(output['pain_points'])) output['pain_points'] = [];
      if (!Array.isArray(output['discovery_questions'])) output['discovery_questions'] = [];
      if (!output['recommended_pitch']) output['recommended_pitch'] = '';
      if (!Array.isArray(output['agenda'])) output['agenda'] = [];

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
// CRM Update Agent
// ============================================================

const CRM_UPDATE_DEF: AgentDefinition = {
  agent_name: 'crm_update_agent',
  description: 'Generates structured CRM update payloads from workflow outputs. Does not integrate external CRM.',
  version: '2.0.0',
  category: 'crm',
  capabilities: ['crm_sync', 'data_enrichment', 'record_updates'],
  inputSchema: { type: 'object', properties: { record_id: { type: 'string' }, updates: { type: 'object' } } },
  outputSchema: { type: 'object', properties: { updated: { type: 'boolean' }, fields: { type: 'array' } } },
  defaultTimeoutMs: 15_000,
  maxRetries: 3,
};

class CRMUpdateAgent extends BaseAgent {
  definition = CRM_UPDATE_DEF;

  async execute(context: ExecutionContext): Promise<AgentExecutionResult> {
    const start = Date.now();
    const input = context.input;
    const workspaceId = context.workspaceId;

    try {
      const prev = getPreviousOutputs(context.workflowId, [
        ...ALL_PRIOR_AGENTS, 'email_writer_agent', 'follow_up_agent',
        'meeting_preparation_agent', 'proposal_generator_agent',
      ]);

      const schema = {
        type: 'object',
        properties: {
          company_update: { type: 'object', properties: { name: { type: 'string' }, industry: { type: 'string' }, website: { type: 'string' }, description: { type: 'string' }, employee_count: { type: 'string' }, revenue_band: { type: 'string' } } },
          contact_updates: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, title: { type: 'string' }, email: { type: 'string' }, department: { type: 'string' } } } },
          opportunity: { type: 'object', properties: { stage: { type: 'string' }, priority: { type: 'string' }, estimated_value: { type: 'string' }, next_action: { type: 'string' }, close_date: { type: 'string' } } },
          activity_log: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, description: { type: 'string' }, timestamp: { type: 'string' } } } },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['company_update', 'contact_updates', 'opportunity', 'activity_log'],
      };

      const response = await aiGateway.generateStructured({
        agentName: this.definition.agent_name,
        taskType: 'structured',
        systemPrompt: 'You are a CRM data specialist. Generate structured CRM update payloads from all workflow outputs. Include company update, contact updates, opportunity details, activity log, and tags. Return only valid JSON matching the schema.',
        userPrompt: `All previous agent outputs:\n${JSON.stringify(prev).slice(0, 16000)}`,
        temperature: 0.2,
        maxTokens: 2000,
        schema,
        workspaceId: workspaceId ?? undefined,
      });

      const output = (response.structuredData ?? {}) as Record<string, unknown>;
      if (!output['company_update']) output['company_update'] = {};
      if (!Array.isArray(output['contact_updates'])) output['contact_updates'] = [];
      if (!output['opportunity']) output['opportunity'] = {};
      if (!Array.isArray(output['activity_log'])) output['activity_log'] = [];
      if (!Array.isArray(output['tags'])) output['tags'] = [];

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
// Workflow Decision Agent
// ============================================================

const WORKFLOW_DECISION_DEF: AgentDefinition = {
  agent_name: 'workflow_decision_agent',
  description: 'Determines lead value (high/medium/low) and recommended next action (proposal/email/meeting/follow-up/reject) based on all workflow outputs.',
  version: '2.0.0',
  category: 'workflow',
  capabilities: ['decision_routing', 'workflow_logic', 'conditional_execution'],
  inputSchema: { type: 'object', properties: { current_results: { type: 'object' }, rules: { type: 'object' } } },
  outputSchema: { type: 'object', properties: { next_step: { type: 'string' }, reason: { type: 'string' } } },
  defaultTimeoutMs: 15_000,
  maxRetries: 3,
};

class WorkflowDecisionAgent extends BaseAgent {
  definition = WORKFLOW_DECISION_DEF;

  async execute(context: ExecutionContext): Promise<AgentExecutionResult> {
    const start = Date.now();
    const input = context.input;
    const workspaceId = context.workspaceId;

    try {
      const prev = getPreviousOutputs(context.workflowId, [
        ...ALL_PRIOR_AGENTS, 'email_writer_agent', 'follow_up_agent',
        'meeting_preparation_agent', 'proposal_generator_agent', 'crm_update_agent',
      ]);

      const schema = {
        type: 'object',
        properties: {
          lead_value: { type: 'string', enum: ['high', 'medium', 'low'] },
          lead_score: { type: 'number' },
          recommended_action: { type: 'string', enum: ['proposal', 'email', 'meeting', 'follow_up', 'reject'] },
          action_reason: { type: 'string' },
          confidence: { type: 'number' },
          summary: { type: 'string' },
          key_factors: { type: 'array', items: { type: 'string' } },
        },
        required: ['lead_value', 'lead_score', 'recommended_action', 'action_reason', 'confidence', 'summary'],
      };

      const response = await aiGateway.generateStructured({
        agentName: this.definition.agent_name,
        taskType: 'structured',
        systemPrompt: 'You are a sales workflow decision engine. Based on all previous agent outputs, determine the lead value (high/medium/low), lead score (0-100), recommended next action (proposal/email/meeting/follow_up/reject), confidence level, and a summary. Return only valid JSON matching the schema.',
        userPrompt: `All previous agent outputs:\n${JSON.stringify(prev).slice(0, 16000)}`,
        temperature: 0.3,
        maxTokens: 1500,
        schema,
        workspaceId: workspaceId ?? undefined,
      });

      const output = (response.structuredData ?? {}) as Record<string, unknown>;
      if (!['high', 'medium', 'low'].includes(output['lead_value'] as string)) output['lead_value'] = 'medium';
      if (typeof output['lead_score'] !== 'number') output['lead_score'] = 50;
      if (!['proposal', 'email', 'meeting', 'follow_up', 'reject'].includes(output['recommended_action'] as string)) output['recommended_action'] = 'email';
      if (!output['action_reason']) output['action_reason'] = '';
      if (typeof output['confidence'] !== 'number') output['confidence'] = 0.7;
      if (!output['summary']) output['summary'] = '';
      if (!Array.isArray(output['key_factors'])) output['key_factors'] = [];

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

export const proposalGeneratorAgent = new ProposalGeneratorAgent();
export const emailWriterAgent = new EmailWriterAgent();
export const followUpAgent = new FollowUpAgent();
export const meetingPreparationAgent = new MeetingPreparationAgent();
export const crmUpdateAgent = new CRMUpdateAgent();
export const workflowDecisionAgent = new WorkflowDecisionAgent();
