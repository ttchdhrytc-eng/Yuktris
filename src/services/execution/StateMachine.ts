// ============================================================
// StateMachine — Workflow and job state transitions
// ============================================================

import type { WorkflowState, JobState } from '@/types/execution-engine';

const WORKFLOW_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  pending: ['planning', 'queued', 'cancelled'],
  planning: ['queued', 'failed', 'cancelled'],
  queued: ['running', 'cancelled', 'failed'],
  running: ['paused', 'completed', 'failed', 'cancelled'],
  paused: ['running', 'cancelled'],
  completed: [],
  cancelled: [],
  failed: ['queued'],
};

const JOB_TRANSITIONS: Record<JobState, JobState[]> = {
  pending: ['queued', 'cancelled'],
  queued: ['waiting', 'running', 'cancelled'],
  waiting: ['queued', 'running', 'cancelled'],
  running: ['paused', 'retrying', 'completed', 'failed', 'dead_letter', 'cancelled'],
  paused: ['running', 'cancelled'],
  retrying: ['queued', 'running', 'failed', 'dead_letter'],
  completed: [],
  cancelled: [],
  failed: ['retrying', 'dead_letter'],
  dead_letter: ['retrying'],
};

class StateMachine {
  canTransitionWorkflow(from: WorkflowState, to: WorkflowState): boolean {
    return WORKFLOW_TRANSITIONS[from]?.includes(to) ?? false;
  }

  canTransitionJob(from: JobState, to: JobState): boolean {
    return JOB_TRANSITIONS[from]?.includes(to) ?? false;
  }

  transitionWorkflow(from: WorkflowState, to: WorkflowState): WorkflowState {
    if (!this.canTransitionWorkflow(from, to)) {
      throw new Error(`Invalid workflow transition: ${from} -> ${to}`);
    }
    return to;
  }

  transitionJob(from: JobState, to: JobState): JobState {
    if (!this.canTransitionJob(from, to)) {
      throw new Error(`Invalid job transition: ${from} -> ${to}`);
    }
    return to;
  }

  isTerminalWorkflow(state: WorkflowState): boolean {
    return WORKFLOW_TRANSITIONS[state].length === 0;
  }

  isTerminalJob(state: JobState): boolean {
    return JOB_TRANSITIONS[state].length === 0;
  }

  getValidWorkflowTransitions(state: WorkflowState): WorkflowState[] {
    return WORKFLOW_TRANSITIONS[state] ?? [];
  }

  getValidJobTransitions(state: JobState): JobState[] {
    return JOB_TRANSITIONS[state] ?? [];
  }
}

export const stateMachine = new StateMachine();
