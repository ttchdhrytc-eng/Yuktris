// ============================================================
// SharedMemoryService — Shared context across agents
// ============================================================
//
// Prevents duplicate data loading. Once an agent loads data (e.g.
// company research), it's stored in shared memory and available
// to all downstream agents in the same workflow.

import type { SharedContextData, AgentExecutionResult } from '@/types/agent-orchestrator';

class SharedMemoryService {
  private stores = new Map<string, SharedContextData>();

  // Initialize shared context for a workflow
  initialize(workflowId: string, initialData?: Partial<SharedContextData>): SharedContextData {
    const ctx: SharedContextData = {
      prospect: initialData?.prospect,
      company: initialData?.company,
      contacts: initialData?.contacts,
      researchResults: initialData?.researchResults,
      crmData: initialData?.crmData,
      calendarData: initialData?.calendarData,
      emailHistory: initialData?.emailHistory,
      documents: initialData?.documents,
      previousAgentOutputs: initialData?.previousAgentOutputs ?? {},
      workflowMetadata: initialData?.workflowMetadata,
    };
    this.stores.set(workflowId, ctx);
    return ctx;
  }

  // Get shared context for a workflow
  get(workflowId: string): SharedContextData | undefined {
    return this.stores.get(workflowId);
  }

  // Update a specific section of shared context
  update(workflowId: string, section: keyof SharedContextData, data: unknown): void {
    const ctx = this.stores.get(workflowId);
    if (!ctx) return;
    (ctx as Record<string, unknown>)[section] = data;
  }

  // Store an agent's output in shared context
  storeAgentOutput(workflowId: string, agentName: string, result: AgentExecutionResult): void {
    const ctx = this.stores.get(workflowId);
    if (!ctx) return;
    if (!ctx.previousAgentOutputs) ctx.previousAgentOutputs = {};
    ctx.previousAgentOutputs[agentName] = result;
  }

  // Get a previous agent's output from shared context
  getAgentOutput(workflowId: string, agentName: string): AgentExecutionResult | undefined {
    const ctx = this.stores.get(workflowId);
    return ctx?.previousAgentOutputs?.[agentName];
  }

  // Check if a previous agent's output exists
  hasAgentOutput(workflowId: string, agentName: string): boolean {
    const ctx = this.stores.get(workflowId);
    return !!ctx?.previousAgentOutputs?.[agentName];
  }

  // Merge new data into existing shared context
  merge(workflowId: string, data: Partial<SharedContextData>): void {
    const ctx = this.stores.get(workflowId);
    if (!ctx) {
      this.initialize(workflowId, data);
      return;
    }
    Object.assign(ctx, data);
  }

  // Clear shared context for a workflow
  clear(workflowId: string): void {
    this.stores.delete(workflowId);
  }
}

export const sharedMemoryService = new SharedMemoryService();
