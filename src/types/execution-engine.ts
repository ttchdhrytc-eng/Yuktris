// ============================================================
// Enterprise Execution Engine — Type Definitions
// ============================================================

// ============================================================
// State Machine
// ============================================================

export type WorkflowState =
  | 'pending'
  | 'planning'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type JobState =
  | 'pending'
  | 'queued'
  | 'waiting'
  | 'running'
  | 'paused'
  | 'retrying'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'dead_letter';

export type WorkerState = 'idle' | 'busy' | 'paused' | 'offline' | 'error';

export type WorkerType =
  | 'ai'
  | 'research'
  | 'integration'
  | 'crm'
  | 'calendar'
  | 'email'
  | 'document'
  | 'notification'
  | 'file'
  | 'custom';

export type JobType =
  | 'immediate'
  | 'delayed'
  | 'scheduled'
  | 'recurring'
  | 'batch'
  | 'event_triggered'
  | 'long_running'
  | 'dependent'
  | 'manual';

export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

// ============================================================
// Database Records
// ============================================================

export type ExecutionWorkflowRecord = {
  id: string;
  workspace_id: string | null;
  workflow_name: string;
  workflow_version: string;
  status: WorkflowState;
  execution_plan: Record<string, unknown> | null;
  context: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type ExecutionJobRecord = {
  id: string;
  workflow_id: string;
  job_name: string;
  job_type: JobType;
  worker_type: WorkerType;
  priority: JobPriority;
  status: JobState;
  payload: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  error: string | null;
  attempts: number;
  max_attempts: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type ExecutionEventRecord = {
  id: string;
  workflow_id: string | null;
  job_id: string | null;
  event_type: string;
  event_data: Record<string, unknown> | null;
  created_at: string;
};

export type WorkerRegistryRecord = {
  id: string;
  worker_name: string;
  worker_type: WorkerType;
  status: WorkerState;
  current_job: string | null;
  last_heartbeat: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================================
// Execution Plan (from Agent Orchestrator)
// ============================================================

export type WorkflowStep = {
  stepId: string;
  jobName: string;
  jobType: JobType;
  workerType: WorkerType;
  priority?: JobPriority;
  payload: Record<string, unknown>;
  dependsOn: string[];
  mode: 'sequential' | 'parallel' | 'conditional';
  condition?: (context: WorkflowContext) => boolean;
  optional?: boolean;
  maxAttempts?: number;
};

export type WorkflowPlan = {
  workflowName: string;
  version: string;
  steps: WorkflowStep[];
  context: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

// ============================================================
// Execution Context
// ============================================================

export type WorkflowContext = {
  workflowId: string;
  variables: Record<string, unknown>;
  metadata: Record<string, unknown>;
  sharedMemory: Record<string, unknown>;
  intermediateResults: Record<string, unknown>;
  agentOutputs: Record<string, unknown>;
  externalReferences: Record<string, string>;
  version: number;
};

// ============================================================
// Events
// ============================================================

export type ExecutionEventType =
  | 'workflow_planned'
  | 'workflow_started'
  | 'workflow_paused'
  | 'workflow_resumed'
  | 'workflow_completed'
  | 'workflow_failed'
  | 'workflow_cancelled'
  | 'job_queued'
  | 'job_started'
  | 'job_completed'
  | 'job_failed'
  | 'job_retrying'
  | 'job_dead_letter'
  | 'worker_assigned'
  | 'worker_released'
  | 'checkpoint_saved'
  | 'retry_triggered'
  | 'execution_finished';

export type ExecutionEvent = {
  type: ExecutionEventType;
  workflowId?: string;
  jobId?: string;
  workerName?: string;
  data?: Record<string, unknown>;
  timestamp: string;
};

export type EventHandler = (event: ExecutionEvent) => void;

// ============================================================
// Worker Interface
// ============================================================

export type WorkerJob = {
  jobId: string;
  workflowId: string;
  jobName: string;
  jobType: JobType;
  workerType: WorkerType;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
};

export type WorkerResult = {
  jobId: string;
  status: 'completed' | 'failed' | 'retry';
  result?: Record<string, unknown>;
  error?: string;
  executionTimeMs: number;
};

export type IWorker = {
  workerName: string;
  workerType: WorkerType;
  initialize(): Promise<void>;
  execute(job: WorkerJob): Promise<WorkerResult>;
  healthCheck(): Promise<boolean>;
};

// ============================================================
// Monitoring
// ============================================================

export type ExecutionMonitorSummary = {
  total_workflows: number;
  running_workflows: number;
  pending_workflows: number;
  completed_workflows: number;
  failed_workflows: number;
  total_jobs: number;
  queued_jobs: number;
  running_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  dead_letter_jobs: number;
  total_workers: number;
  active_workers: number;
  busy_workers: number;
  queue_size: number;
  average_execution_time_ms: number;
  failure_rate: number;
  retry_count: number;
  throughput_per_minute: number;
};

export type QueueStatus = {
  pending: number;
  queued: number;
  running: number;
  retrying: number;
  dead_letter: number;
  total: number;
};
