export type AgentProfile = {
  id: string; workspace_id: string; agent_type: string; agent_name: string;
  agent_description: string; avatar_emoji: string; is_active: boolean;
  auto_execute: boolean; confidence_threshold_auto: number;
  confidence_threshold_approval: number; max_concurrent_tasks: number;
  created_at: string;
};
export type AgentStatus = {
  id: string; workspace_id: string; agent_id: string; status: string;
  current_task_id: string | null; workload_percent: number;
  tasks_completed_today: number; created_at: string;
};
export type AgentHealth = {
  id: string; workspace_id: string; agent_id: string; health_score: number;
  health_status: string; created_at: string;
};
export type AgentObjective = {
  id: string; workspace_id: string; agent_id: string; objective_title: string;
  objective_description: string; status: string; created_at: string;
};
export type AgentTask = {
  id: string; workspace_id: string; agent_id: string | null;
  task_title: string; task_description: string; task_type: string;
  status: string; priority: string; confidence: number;
  approval_required: boolean; approval_level: string | null;
  approved_by: string | null; approved_at: string | null;
  ai_reasoning: string | null; requested_by: string | null;
  result_data: unknown; started_at: string | null; completed_at: string | null;
  created_at: string;
};
export type AgentTaskHistory = {
  id: string; workspace_id: string; task_id: string; agent_id: string;
  status: string; created_at: string;
};
export type AgentWorkflow = {
  id: string; workspace_id: string; workflow_name: string; workflow_type: string;
  is_active: boolean; execution_count: number; created_at: string;
};
export type AgentWorkflowStep = {
  id: string; workspace_id: string; workflow_id: string; step_number: number;
  step_name: string; created_at: string;
};
export type AgentApproval = {
  id: string; workspace_id: string; task_id: string; agent_id: string | null;
  approval_level: string; approval_status: string; approved_by: string | null;
  approved_at: string | null; rejection_reason: string | null;
  confidence_at_request: number; expires_at: string | null; created_at: string;
};
export type AgentCollaboration = {
  id: string; workspace_id: string; collaboration_type: string; created_at: string;
};
export type AgentHandoff = {
  id: string; workspace_id: string; task_id: string; from_agent_id: string;
  to_agent_id: string; created_at: string;
};
export type AgentLearning = {
  id: string; workspace_id: string; learning_title: string; learning_description: string;
  is_active: boolean; created_at: string;
};
export type AgentFeedback = {
  id: string; workspace_id: string; feedback_text: string; created_at: string;
};
export type AgentPerformance = {
  id: string; workspace_id: string; performance_date: string; tasks_completed: number;
  tasks_failed: number; success_rate: number; created_at: string;
};
export type AgentResult = {
  id: string; workspace_id: string; task_id: string; agent_id: string;
  result_type: string; result_summary: string; result_data: unknown;
  confidence: number; ai_reasoning: string | null; created_at: string;
};
export type AgentError = {
  id: string; workspace_id: string; task_id: string | null; agent_id: string | null;
  error_message: string; error_type: string; is_resolved: boolean; created_at: string;
};
export type AgentLog = {
  id: string; workspace_id: string; agent_id: string | null; log_message: string;
  log_level: string; created_at: string;
};
export type AgentSchedule = {
  id: string; workspace_id: string; schedule_name: string; schedule_type: string;
  is_active: boolean; created_at: string;
};
export type AgentDecision = {
  id: string; workspace_id: string; decision_title: string; decision_description: string;
  created_at: string;
};
export type AgentRecommendation = {
  id: string; workspace_id: string; recommendation_title: string; status: string;
  created_at: string;
};
export type AgentNotification = {
  id: string; workspace_id: string; notification_text: string; is_read: boolean;
  created_at: string;
};
export type AgentMetric = {
  id: string; workspace_id: string; metric_name: string; metric_category: string;
  measurement_date: string; created_at: string;
};
export type AgentMemory = {
  id: string; workspace_id: string; memory_title: string; memory_content: string;
  created_at: string;
};
export type AgentReasoning = {
  id: string; workspace_id: string; reasoning_title: string; reasoning_text: string;
  created_at: string;
};
export type WorkforceDashboard = {
  profiles: AgentProfile[]; skills: unknown[]; statuses: AgentStatus[];
  health: AgentHealth[]; objectives: AgentObjective[]; tasks: AgentTask[];
  taskHistory: AgentTaskHistory[]; workflows: AgentWorkflow[];
  workflowSteps: AgentWorkflowStep[]; approvals: AgentApproval[];
  collaborations: AgentCollaboration[]; handoffs: AgentHandoff[];
  learnings: AgentLearning[]; feedback: AgentFeedback[];
  performance: AgentPerformance[]; results: AgentResult[];
  errors: AgentError[]; logs: AgentLog[]; schedules: AgentSchedule[];
  decisions: AgentDecision[]; recommendations: AgentRecommendation[];
  notifications: AgentNotification[]; metrics: AgentMetric[];
  memories: AgentMemory[]; reasoning: AgentReasoning[];
  totalAgents: number; activeAgents: number; totalTasks: number;
  pendingTasks: number; runningTasks: number; completedTasks: number;
  failedTasks: number; pendingApprovals: number; avgConfidence: number;
  avgHealthScore: number; totalWorkload: number;
};
