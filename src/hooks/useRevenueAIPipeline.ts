import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { agentOrchestrator, sharedMemoryService } from '@/services/agents';
import { supabase } from '@/lib/supabase';
import type { AgentExecutionResult } from '@/types/agent-orchestrator';

export interface PipelineStageInfo {
  name: string;
  label: string;
  description: string;
  icon: string;
}

export interface PipelineStageStatus {
  agentName: string;
  label: string;
  description: string;
  icon: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  durationMs: number;
  tokensUsed: number;
  error: string | null;
  result: AgentExecutionResult | null;
}

export interface PipelineInput {
  company_name: string;
  website: string;
  workspace_id?: string | null;
  onProgress?: (stages: PipelineStageStatus[]) => void;
}

export interface PipelineResult {
  workflowId: string;
  stages: PipelineStageStatus[];
  results: Record<string, AgentExecutionResult>;
  summary: {
    agents_executed: number;
    agents_succeeded: number;
    agents_failed: number;
    total_tokens: number;
    total_cost: number;
    total_duration_ms: number;
    lead_value: string;
    lead_score: number;
    recommended_action: string;
    summary: string;
  };
}

export const PIPELINE_STAGES: PipelineStageInfo[] = [
  { name: 'website_research_agent', label: 'Website Research', description: 'Crawling and analyzing company website', icon: 'Globe' },
  { name: 'company_intelligence_agent', label: 'Company Intelligence', description: 'Building comprehensive company profile', icon: 'Building2' },
  { name: 'technology_detection_agent', label: 'Technology Detection', description: 'Detecting tech stack and infrastructure', icon: 'Cpu' },
  { name: 'executive_summary_agent', label: 'Executive Summary', description: 'Synthesizing research into key insights', icon: 'FileText' },
  { name: 'seo_analysis_agent', label: 'SEO Analysis', description: 'Auditing SEO metrics and opportunities', icon: 'Search' },
  { name: 'icp_scoring_agent', label: 'ICP Scoring', description: 'Scoring against ideal customer profile', icon: 'Users' },
  { name: 'buying_signal_agent', label: 'Buying Signals', description: 'Detecting buying intent and urgency', icon: 'Target' },
  { name: 'linkedin_intelligence_agent', label: 'Decision Makers', description: 'Finding key decision makers and contacts', icon: 'Linkedin' },
  { name: 'proposal_generator_agent', label: 'Proposal Generation', description: 'Creating customized proposal', icon: 'FileText' },
  { name: 'email_writer_agent', label: 'Email Generation', description: 'Writing personalized cold email', icon: 'Mail' },
  { name: 'follow_up_agent', label: 'Follow-up Sequence', description: 'Building follow-up sequence', icon: 'Send' },
  { name: 'meeting_preparation_agent', label: 'Meeting Brief', description: 'Preparing meeting brief and agenda', icon: 'CalendarCheck' },
  { name: 'crm_update_agent', label: 'CRM Update', description: 'Generating CRM update payload', icon: 'Database' },
  { name: 'workflow_decision_agent', label: 'Workflow Decision', description: 'Determining lead value and next action', icon: 'GitBranch' },
];

export function useRevenueAIPipeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PipelineInput): Promise<PipelineResult> => {
      const workflowId = `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      sharedMemoryService.initialize(workflowId, {
        company: { name: input.company_name, website: input.website },
        workflowMetadata: { createdAt: new Date().toISOString(), pipeline: 'revenue-ai' },
      });

      const stages: PipelineStageStatus[] = PIPELINE_STAGES.map((s) => ({
        agentName: s.name,
        label: s.label,
        description: s.description,
        icon: s.icon,
        status: 'pending',
        durationMs: 0,
        tokensUsed: 0,
        error: null,
        result: null,
      }));

      const emit = () => input.onProgress?.([...stages]);

      const results: Record<string, AgentExecutionResult> = {};
      let totalTokens = 0;
      let totalCost = 0;
      let totalDuration = 0;

      for (let i = 0; i < PIPELINE_STAGES.length; i++) {
        const stage = PIPELINE_STAGES[i];
        stages[i].status = 'running';
        emit();

        const agentInput: Record<string, unknown> = {
          company_name: input.company_name,
          companyName: input.company_name,
          website: input.website,
          domain: input.website,
          url: input.website,
          company: { name: input.company_name, website: input.website },
        };

        try {
          const result = await agentOrchestrator.executeAgent({
            agentName: stage.name,
            input: agentInput,
            workflowId,
            workspaceId: input.workspace_id ?? null,
            timeoutMs: 90_000,
          });

          results[stage.name] = result;
          stages[i].result = result;
          stages[i].durationMs = result.executionTimeMs;
          stages[i].tokensUsed = result.tokensUsed;

          if (result.status === 'completed') {
            stages[i].status = 'completed';
            totalTokens += result.tokensUsed;
            totalCost += result.estimatedCost;
            totalDuration += result.executionTimeMs;
          } else {
            stages[i].status = 'failed';
            stages[i].error = result.error ?? 'Agent returned failure status';
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          results[stage.name] = {
            agentName: stage.name,
            status: 'failed',
            output: {},
            tokensUsed: 0,
            estimatedCost: 0,
            executionTimeMs: 0,
            error: errMsg,
          };
          stages[i].status = 'failed';
          stages[i].error = errMsg;
        }
        emit();
      }

      const succeeded = stages.filter((s) => s.status === 'completed').length;
      const failed = stages.filter((s) => s.status === 'failed').length;

      const decisionResult = results['workflow_decision_agent'];
      const decision = decisionResult?.status === 'completed'
        ? (decisionResult.output as Record<string, unknown>)
        : {};

      const summary = {
        agents_executed: PIPELINE_STAGES.length,
        agents_succeeded: succeeded,
        agents_failed: failed,
        total_tokens: totalTokens,
        total_cost: totalCost,
        total_duration_ms: totalDuration,
        lead_value: (decision['lead_value'] as string) ?? 'medium',
        lead_score: (decision['lead_score'] as number) ?? 50,
        recommended_action: (decision['recommended_action'] as string) ?? 'email',
        summary: (decision['summary'] as string) ?? 'Pipeline completed.',
      };

      // Persist pipeline results to database
      if (input.workspace_id) {
        try {
          await persistPipelineResults(input.workspace_id, input.company_name, input.website, results, summary);
        } catch {
          // non-fatal — UI still shows results
        }
      }

      sharedMemoryService.clear(workflowId);

      return { workflowId, stages, results, summary };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['revenue-ai-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['research'] });
      queryClient.invalidateQueries({ queryKey: ['revenue'] });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast.success(
        `Analysis complete: ${data.summary.agents_succeeded}/${data.summary.agents_executed} stages succeeded. Lead: ${data.summary.lead_value} (${data.summary.lead_score}/100)`,
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Pipeline failed.');
    },
  });
}

async function persistPipelineResults(
  workspaceId: string,
  companyName: string,
  website: string,
  results: Record<string, AgentExecutionResult>,
  summary: PipelineResult['summary'],
) {
  // Find or create company record
  const { data: existing } = await supabase
    .from('companies')
    .select('id')
    .eq('workspace_id', workspaceId)
    .ilike('name', companyName)
    .maybeSingle();

  let companyId: string;

  if (existing) {
    companyId = existing.id;
    await supabase.from('companies').update({
      website,
      updated_at: new Date().toISOString(),
    }).eq('id', companyId);
  } else {
    const { data: created, error } = await supabase
      .from('companies')
      .insert({
        workspace_id: workspaceId,
        name: companyName,
        website,
        industry: 'Other',
      })
      .select('id')
      .single();

    if (error || !created) return;
    companyId = created.id;
  }

  // Store agent outputs as memory entities for retrieval
  const completedResults = Object.entries(results).filter(([, r]) => r.status === 'completed');

  for (const [agentName, result] of completedResults) {
    try {
      await supabase.from('memory_entities').insert({
        workspace_id: workspaceId,
        entity_type: 'company',
        entity_id: companyId,
        memory_type: `pipeline_${agentName}`,
        content: result.output as Record<string, unknown>,
        confidence_score: 0.8,
        importance_score: 0.7,
        freshness_score: 1.0,
        is_active: true,
        source: 'revenue_ai_pipeline',
      });
    } catch {
      // non-fatal
    }
  }

  // Store pipeline summary
  try {
    await supabase.from('memory_entities').insert({
      workspace_id: workspaceId,
      entity_type: 'company',
      entity_id: companyId,
      memory_type: 'pipeline_summary',
      content: {
        company_name: companyName,
        website,
        ...summary,
        completed_at: new Date().toISOString(),
      },
      confidence_score: 0.9,
      importance_score: 1.0,
      freshness_score: 1.0,
      is_active: true,
      source: 'revenue_ai_pipeline',
    });
  } catch {
    // non-fatal
  }
}
