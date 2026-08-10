// ============================================================
// ExecutionContext — Shared context passed to every agent
// ============================================================

import type { ExecutionContext as IExecutionContext, SharedContextData, AgentExecutionResult } from '@/types/agent-orchestrator';
import { sharedMemoryService } from './SharedMemoryService';

export class ExecutionContextBuilder {
  static create(params: {
    executionId: string;
    workflowId: string | null;
    workspaceId: string | null;
    agentName: string;
    input: Record<string, unknown>;
    initialContext?: Partial<SharedContextData>;
    abortSignal?: AbortSignal;
  }): IExecutionContext {
    let sharedContext: SharedContextData;

    if (params.workflowId && sharedMemoryService.get(params.workflowId)) {
      sharedContext = sharedMemoryService.get(params.workflowId)!;
    } else if (params.workflowId) {
      sharedContext = sharedMemoryService.initialize(params.workflowId, params.initialContext);
    } else {
      sharedContext = sharedMemoryService.initialize(params.executionId, params.initialContext);
    }

    return {
      executionId: params.executionId,
      workflowId: params.workflowId,
      workspaceId: params.workspaceId,
      agentName: params.agentName,
      input: params.input,
      sharedContext,
      abortSignal: params.abortSignal,
    };
  }

  static storeResult(workflowId: string, agentName: string, result: AgentExecutionResult): void {
    const wid = workflowId || agentName;
    sharedMemoryService.storeAgentOutput(wid, agentName, result);
  }

  static getPreviousOutput(workflowId: string, agentName: string): AgentExecutionResult | undefined {
    return sharedMemoryService.getAgentOutput(workflowId, agentName);
  }
}
