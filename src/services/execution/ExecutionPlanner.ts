// ============================================================
// ExecutionPlanner — Converts Agent Orchestrator plans to workflow plans
// ============================================================

import { supabase } from '@/lib/supabase';
import type {
  WorkflowPlan,
  WorkflowStep,
  JobType,
  WorkerType,
  JobPriority,
} from '@/types/execution-engine';
import type { ExecutionPlan as AgentPlan } from '@/types/agent-orchestrator';

class ExecutionPlanner {
  // Convert an Agent Orchestrator execution plan to a workflow plan
  fromAgentPlan(params: {
    plan: AgentPlan;
    workflowName: string;
    context?: Record<string, unknown>;
  }): WorkflowPlan {
    const steps: WorkflowStep[] = params.plan.steps.map((step) => ({
      stepId: step.stepId,
      jobName: step.agentName,
      jobType: this.inferJobType(step.mode),
      workerType: this.inferWorkerType(step.agentName),
      priority: 'normal' as JobPriority,
      payload: step.input,
      dependsOn: step.dependsOn,
      mode: step.mode,
      optional: step.optional,
      maxAttempts: 3,
    }));

    return {
      workflowName: params.workflowName,
      version: '1.0.0',
      steps,
      context: params.context ?? {},
      metadata: {
        sourcePlanId: params.plan.planId,
        estimatedSteps: params.plan.estimatedSteps,
        estimatedCost: params.plan.estimatedCost,
      },
    };
  }

  // Create a workflow plan from raw steps
  createPlan(params: {
    workflowName: string;
    steps: WorkflowStep[];
    context?: Record<string, unknown>;
  }): WorkflowPlan {
    return {
      workflowName: params.workflowName,
      version: '1.0.0',
      steps: params.steps,
      context: params.context ?? {},
    };
  }

  // Persist a workflow plan to the database
  async persistPlan(workflowId: string, plan: WorkflowPlan): Promise<void> {
    const { error } = await supabase
      .from('execution_workflows')
      .update({
        execution_plan: plan as unknown as Record<string, unknown>,
        context: plan.context,
      })
      .eq('id', workflowId);

    if (error) throw new Error(`Failed to persist plan: ${error.message}`);
  }

  // Load a workflow plan from the database
  async loadPlan(workflowId: string): Promise<WorkflowPlan | null> {
    const { data, error } = await supabase
      .from('execution_workflows')
      .select('execution_plan, context, workflow_name, workflow_version')
      .eq('id', workflowId)
      .maybeSingle();

    if (error || !data) return null;

    const record = data as {
      execution_plan: Record<string, unknown> | null;
      context: Record<string, unknown> | null;
      workflow_name: string;
      workflow_version: string;
    };

    if (!record.execution_plan) return null;

    return {
      workflowName: record.workflow_name,
      version: record.workflow_version,
      steps: (record.execution_plan.steps as WorkflowStep[]) ?? [],
      context: record.context ?? {},
    };
  }

  private inferJobType(mode: string): JobType {
    if (mode === 'parallel') return 'immediate';
    if (mode === 'sequential') return 'dependent';
    return 'immediate';
  }

  private inferWorkerType(agentName: string): WorkerType {
    if (agentName.includes('email') || agentName.includes('outreach')) return 'email';
    if (agentName.includes('crm')) return 'crm';
    if (agentName.includes('meeting') || agentName.includes('calendar')) return 'calendar';
    if (agentName.includes('linkedin') || agentName.includes('research')) return 'research';
    if (agentName.includes('integration')) return 'integration';
    if (agentName.includes('document') || agentName.includes('proposal')) return 'document';
    if (agentName.includes('notification')) return 'notification';
    return 'ai';
  }
}

export const executionPlanner = new ExecutionPlanner();
