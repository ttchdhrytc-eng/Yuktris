// ============================================================
// ExecutionContext — Shared workflow context with versioning
// ============================================================

import { supabase } from '@/lib/supabase';
import type { WorkflowContext } from '@/types/execution-engine';

class ExecutionContextManager {
  private contexts = new Map<string, WorkflowContext>();

  create(workflowId: string, initialData?: Record<string, unknown>): WorkflowContext {
    const ctx: WorkflowContext = {
      workflowId,
      variables: initialData ?? {},
      metadata: {},
      sharedMemory: {},
      intermediateResults: {},
      agentOutputs: {},
      externalReferences: {},
      version: 1,
    };
    this.contexts.set(workflowId, ctx);
    return ctx;
  }

  get(workflowId: string): WorkflowContext | undefined {
    return this.contexts.get(workflowId);
  }

  update(workflowId: string, updates: Partial<WorkflowContext>): WorkflowContext | undefined {
    const ctx = this.contexts.get(workflowId);
    if (!ctx) return undefined;
    Object.assign(ctx, updates);
    ctx.version++;
    return ctx;
  }

  setVariable(workflowId: string, key: string, value: unknown): void {
    const ctx = this.contexts.get(workflowId);
    if (!ctx) return;
    ctx.variables[key] = value;
    ctx.version++;
  }

  getVariable(workflowId: string, key: string): unknown {
    return this.contexts.get(workflowId)?.variables[key];
  }

  setAgentOutput(workflowId: string, agentName: string, output: unknown): void {
    const ctx = this.contexts.get(workflowId);
    if (!ctx) return;
    ctx.agentOutputs[agentName] = output;
    ctx.version++;
  }

  getAgentOutput(workflowId: string, agentName: string): unknown {
    return this.contexts.get(workflowId)?.agentOutputs[agentName];
  }

  setIntermediateResult(workflowId: string, stepId: string, result: unknown): void {
    const ctx = this.contexts.get(workflowId);
    if (!ctx) return;
    ctx.intermediateResults[stepId] = result;
    ctx.version++;
  }

  getIntermediateResult(workflowId: string, stepId: string): unknown {
    return this.contexts.get(workflowId)?.intermediateResults[stepId];
  }

  validate(workflowId: string): { valid: boolean; errors: string[] } {
    const ctx = this.contexts.get(workflowId);
    if (!ctx) return { valid: false, errors: ['Context not found'] };
    const errors: string[] = [];
    if (!ctx.workflowId) errors.push('Missing workflow ID');
    if (ctx.version < 1) errors.push('Invalid version');
    return { valid: errors.length === 0, errors };
  }

  async persist(workflowId: string): Promise<void> {
    const ctx = this.contexts.get(workflowId);
    if (!ctx) return;
    const { error } = await supabase
      .from('execution_workflows')
      .update({ context: ctx as unknown as Record<string, unknown> })
      .eq('id', workflowId);
    if (error) console.error('[ExecutionContext] Failed to persist:', error.message);
  }

  clear(workflowId: string): void {
    this.contexts.delete(workflowId);
  }
}

export const executionContext = new ExecutionContextManager();
