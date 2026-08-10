// ============================================================
// ExecutionEngine — Central facade for all execution operations
// ============================================================

import { workflowRunner } from './WorkflowRunner';
import { executionPlanner } from './ExecutionPlanner';
import { jobQueue } from './JobQueue';
import { workerPool } from './WorkerPool';
import { workerRegistry } from './WorkerRegistry';
import { workerDispatcher } from './WorkerDispatcher';
import { executionRuntime } from './ExecutionRuntime';
import { executionMonitor } from './ExecutionMonitor';
import { executionLogger } from './ExecutionLogger';
import { executionContext } from './ExecutionContext';
import { eventBus } from './EventBus';
import { stateMachine } from './StateMachine';
import { retryManager } from './RetryManager';
import { checkpointManager } from './CheckpointManager';
import { recoveryManager } from './RecoveryManager';
import { scheduler } from './Scheduler';
import type {
  WorkflowPlan,
  ExecutionMonitorSummary,
  QueueStatus,
  ExecutionEvent,
  EventHandler,
  IWorker,
} from '@/types/execution-engine';
import type { ExecutionPlan as AgentPlan } from '@/types/agent-orchestrator';

class ExecutionEngine {
  // ----------------------------------------------------------
  // Workflow Lifecycle
  // ----------------------------------------------------------

  async startWorkflow(params: {
    plan: WorkflowPlan;
    workspaceId?: string | null;
  }): Promise<string> {
    return workflowRunner.startWorkflow(params);
  }

  async startFromAgentPlan(params: {
    plan: AgentPlan;
    workflowName: string;
    workspaceId?: string | null;
    context?: Record<string, unknown>;
  }): Promise<string> {
    const workflowPlan = executionPlanner.fromAgentPlan({
      plan: params.plan,
      workflowName: params.workflowName,
      context: params.context,
    });
    return workflowRunner.startWorkflow({
      plan: workflowPlan,
      workspaceId: params.workspaceId,
    });
  }

  async pauseWorkflow(workflowId: string): Promise<void> {
    return workflowRunner.pauseWorkflow(workflowId);
  }

  async resumeWorkflow(workflowId: string): Promise<void> {
    return workflowRunner.resumeWorkflow(workflowId);
  }

  async cancelWorkflow(workflowId: string): Promise<void> {
    return workflowRunner.cancelWorkflow(workflowId);
  }

  async retryWorkflow(workflowId: string): Promise<void> {
    return workflowRunner.retryWorkflow(workflowId);
  }

  async checkCompletion(workflowId: string): Promise<boolean> {
    return workflowRunner.checkCompletion(workflowId);
  }

  // ----------------------------------------------------------
  // Runtime
  // ----------------------------------------------------------

  async startRuntime(): Promise<void> {
    return executionRuntime.start();
  }

  stopRuntime(): void {
    executionRuntime.stop();
  }

  isRuntimeRunning(): boolean {
    return executionRuntime.isRunning();
  }

  // ----------------------------------------------------------
  // Workers
  // ----------------------------------------------------------

  registerWorker(worker: IWorker): void {
    workerRegistry.register(worker);
  }

  getWorkers() {
    return workerRegistry.getAll();
  }

  async getWorkersFromDatabase() {
    return workerRegistry.getAllFromDatabase();
  }

  // ----------------------------------------------------------
  // Monitoring
  // ----------------------------------------------------------

  async getSummary(): Promise<ExecutionMonitorSummary> {
    return executionMonitor.getSummary();
  }

  async getQueueStatus(): Promise<QueueStatus> {
    return executionMonitor.getQueueStatus();
  }

  async getRecentWorkflows(limit?: number) {
    return executionMonitor.getRecentWorkflows(limit);
  }

  async getRecentJobs(limit?: number) {
    return executionMonitor.getRecentJobs(limit);
  }

  async getRecentEvents(limit?: number) {
    return executionMonitor.getRecentEvents(limit);
  }

  // ----------------------------------------------------------
  // Events
  // ----------------------------------------------------------

  on(eventType: ExecutionEvent['type'] | '*', handler: EventHandler): () => void {
    return eventBus.on(eventType, handler);
  }

  // ----------------------------------------------------------
  // Recovery
  // ----------------------------------------------------------

  async recoverWorkflow(workflowId: string): Promise<boolean> {
    return recoveryManager.recoverWorkflow(workflowId);
  }

  async recoverStaleJobs(): Promise<number> {
    return recoveryManager.recoverStaleJobs();
  }

  async cleanupOldWorkflows(daysOld?: number): Promise<number> {
    return recoveryManager.cleanupOldWorkflows(daysOld);
  }

  // ----------------------------------------------------------
  // Planning
  // ----------------------------------------------------------

  createPlan(params: {
    workflowName: string;
    steps: WorkflowPlan['steps'];
    context?: Record<string, unknown>;
  }): WorkflowPlan {
    return executionPlanner.createPlan(params);
  }

  async loadPlan(workflowId: string): Promise<WorkflowPlan | null> {
    return executionPlanner.loadPlan(workflowId);
  }
}

export const executionEngine = new ExecutionEngine();
