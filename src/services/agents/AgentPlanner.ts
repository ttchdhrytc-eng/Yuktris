// ============================================================
// AgentPlanner — Creates execution plans for multi-agent workflows
// ============================================================
//
// Given a task description and optional target agents, the planner
// determines which agents to invoke, in what order, and with what
// inputs. It uses the DependencyResolver to order agents correctly.

import { dependencyResolver } from './DependencyResolver';
import { agentRegistry } from './AgentRegistry';
import type {
  PlanRequest,
  ExecutionPlan,
  PlanStep,
  ExecutionMode,
  SharedContextData,
} from '@/types/agent-orchestrator';

class AgentPlanner {
  // Create an execution plan from a plan request
  async plan(request: PlanRequest): Promise<ExecutionPlan> {
    // Determine which agents to include
    let targetAgents = request.targetAgents ?? [];

    // If no specific agents requested, infer from task description
    if (targetAgents.length === 0) {
      targetAgents = this.inferAgents(request.taskDescription);
    }

    // Filter to only registered agents
    const availableAgents = targetAgents.filter((name) => agentRegistry.has(name));

    if (availableAgents.length === 0) {
      return {
        planId: crypto.randomUUID(),
        steps: [],
        mode: 'single',
        estimatedSteps: 0,
        estimatedTokens: 0,
        estimatedCost: 0,
      };
    }

    // Resolve execution order based on dependencies
    const orderedAgents = await dependencyResolver.resolveOrder(availableAgents);

    // Determine execution mode
    const mode = this.determineMode(orderedAgents, request.mode);

    // Build plan steps
    const steps: PlanStep[] = [];
    let stepIndex = 0;

    if (mode === 'parallel') {
      // All agents can run in parallel
      for (const agentName of orderedAgents) {
        steps.push({
          stepId: `step-${stepIndex++}`,
          agentName,
          dependsOn: [],
          mode: 'parallel',
          input: { ...request.input },
          optional: false,
        });
      }
    } else {
      // Sequential execution with dependencies
      const completedSteps: string[] = [];
      for (const agentName of orderedAgents) {
        const deps = await dependencyResolver.getDependencies(agentName);
        const requiredDeps = deps
          .filter((d) => d.type === 'requires')
          .flatMap((d) => d.dependsOn)
          .filter((name) => availableAgents.includes(name));

        steps.push({
          stepId: `step-${stepIndex++}`,
          agentName,
          dependsOn: requiredDeps.map((name) => {
            const depStep = steps.find((s) => s.agentName === name);
            return depStep?.stepId ?? '';
          }).filter(Boolean),
          mode: 'sequential',
          input: { ...request.input },
          optional: false,
        });
        completedSteps.push(agentName);
      }
    }

    // Estimate tokens and cost (rough estimates)
    const estimatedTokens = steps.length * 2000;
    const estimatedCost = steps.length * 0.03;

    return {
      planId: crypto.randomUUID(),
      steps,
      mode,
      estimatedSteps: steps.length,
      estimatedTokens,
      estimatedCost,
    };
  }

  // Infer which agents to use based on task description keywords
  private inferAgents(taskDescription: string): string[] {
    const desc = taskDescription.toLowerCase();
    const agents: string[] = [];

    if (desc.includes('website') || desc.includes('crawl') || desc.includes('scrape')) {
      agents.push('website_research_agent');
    }
    if (desc.includes('company') || desc.includes('intelligence')) {
      agents.push('company_intelligence_agent');
    }
    if (desc.includes('linkedin') || desc.includes('employee')) {
      agents.push('linkedin_intelligence_agent');
    }
    if (desc.includes('technology') || desc.includes('tech stack') || desc.includes('stack')) {
      agents.push('technology_detection_agent');
    }
    if (desc.includes('seo') || desc.includes('search')) {
      agents.push('seo_analysis_agent');
    }
    if (desc.includes('icp') || desc.includes('score') || desc.includes('fit')) {
      agents.push('icp_scoring_agent');
    }
    if (desc.includes('intent') || desc.includes('buying signal')) {
      agents.push('buying_signal_agent');
    }
    if (desc.includes('proposal') || desc.includes('pitch')) {
      agents.push('proposal_generator_agent');
    }
    if (desc.includes('email') || desc.includes('outreach')) {
      agents.push('email_writer_agent');
    }
    if (desc.includes('follow') || desc.includes('sequence')) {
      agents.push('follow_up_agent');
    }
    if (desc.includes('meeting') || desc.includes('brief')) {
      agents.push('meeting_preparation_agent');
    }
    if (desc.includes('crm') || desc.includes('update record')) {
      agents.push('crm_update_agent');
    }
    if (desc.includes('summary') || desc.includes('executive')) {
      agents.push('executive_summary_agent');
    }
    if (desc.includes('workflow') || desc.includes('route') || desc.includes('decision')) {
      agents.push('workflow_decision_agent');
    }

    // Default: if nothing matched, use company intelligence
    if (agents.length === 0) {
      agents.push('company_intelligence_agent');
    }

    return agents;
  }

  // Determine the execution mode
  private determineMode(orderedAgents: string[], requestedMode?: ExecutionMode): ExecutionMode {
    if (requestedMode) return requestedMode;
    if (orderedAgents.length <= 1) return 'single';
    // If agents have no dependencies between them, use parallel
    return 'sequential';
  }
}

export const agentPlanner = new AgentPlanner();
