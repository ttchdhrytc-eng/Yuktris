// ============================================================
// Agent Registration — All concrete agents
// ============================================================
//
// Registers every agent (concrete + placeholder fallback) with
// the AgentRegistry. Concrete implementations come from
// ResearchAgents, IntelligenceAgents, and GenerationAgents.

import { BaseAgent } from './BaseAgent';
import { agentRegistry } from './AgentRegistry';
import type { AgentDefinition } from '@/types/agent-orchestrator';
import {
  websiteResearchAgent,
  companyIntelligenceAgent,
  technologyDetectionAgent,
  executiveSummaryAgent,
} from './ResearchAgents';
import {
  seoAnalysisAgent,
  icpScoringAgent,
  buyingSignalAgent,
  linkedinIntelligenceAgent,
} from './IntelligenceAgents';
import { icpGenerationAgent } from './ICPGenerationAgent';
import {
  proposalGeneratorAgent,
  emailWriterAgent,
  followUpAgent,
  meetingPreparationAgent,
  crmUpdateAgent,
  workflowDecisionAgent,
} from './GenerationAgents';

// ============================================================
// Fallback for any agents not yet implemented
// ============================================================

class PlaceholderAgent extends BaseAgent {
  definition: AgentDefinition;

  constructor(definition: AgentDefinition) {
    super();
    this.definition = definition;
  }

  async execute(): Promise<never> {
    throw new Error(
      `Agent "${this.definition.agent_name}" is registered as a placeholder. Business logic not yet implemented.`,
    );
  }
}

// ============================================================
// Register All Agents
// ============================================================

agentRegistry.register(websiteResearchAgent);
agentRegistry.register(companyIntelligenceAgent);
agentRegistry.register(linkedinIntelligenceAgent);
agentRegistry.register(technologyDetectionAgent);
agentRegistry.register(seoAnalysisAgent);
agentRegistry.register(icpScoringAgent);
agentRegistry.register(icpGenerationAgent);
agentRegistry.register(buyingSignalAgent);
agentRegistry.register(proposalGeneratorAgent);
agentRegistry.register(emailWriterAgent);
agentRegistry.register(followUpAgent);
agentRegistry.register(meetingPreparationAgent);
agentRegistry.register(crmUpdateAgent);
agentRegistry.register(executiveSummaryAgent);
agentRegistry.register(workflowDecisionAgent);
