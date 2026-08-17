// ============================================================
// Agent Orchestrator — Service Index
// ============================================================

import './PlaceholderAgents'; // Register all agents

export { agentOrchestrator } from './AgentOrchestrator';
export { agentRegistry } from './AgentRegistry';
export { agentPlanner } from './AgentPlanner';
export { agentExecutor } from './AgentExecutor';
export { agentHealthService } from './AgentHealthService';
export { agentLogger } from './AgentLogger';
export { sharedMemoryService } from './SharedMemoryService';
export { dependencyResolver } from './DependencyResolver';
export { ExecutionContextBuilder } from './ExecutionContext';
export { BaseAgent } from './BaseAgent';

// Concrete agent instances
export { websiteResearchAgent, companyIntelligenceAgent, technologyDetectionAgent, executiveSummaryAgent } from './ResearchAgents';
export { seoAnalysisAgent, icpScoringAgent, buyingSignalAgent, linkedinIntelligenceAgent } from './IntelligenceAgents';
export { icpGenerationAgent } from './ICPGenerationAgent';
export { proposalGeneratorAgent, emailWriterAgent, followUpAgent, meetingPreparationAgent, crmUpdateAgent, workflowDecisionAgent } from './GenerationAgents';
export type {
  AgentDefinition,
  AgentCategory,
  AgentStatus,
  AgentHealthStatus,
  ExecutionStatus,
  DependencyType,
  ExecutionMode,
  AgentRegistryRecord,
  AgentExecutionRecord,
  AgentDependencyRecord,
  IAgent,
  ExecutionContext,
  SharedContextData,
  AgentExecutionResult,
  ValidationResult,
  PlanRequest,
  ExecutionPlan,
  PlanStep,
  ExecutionEvent,
  EventHandler,
  AgentHealth,
  AgentMetrics,
  OrchestratorSummary,
} from '@/types/agent-orchestrator';
