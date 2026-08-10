// ============================================================
// BaseAgent — Abstract base class for all AI agents
// ============================================================
//
// Every concrete agent extends this class and implements the
// execute() method. The base class provides shared input/output
// validation infrastructure.

import type {
  AgentDefinition,
  ExecutionContext,
  AgentExecutionResult,
  ValidationResult,
  IAgent,
} from '@/types/agent-orchestrator';

export abstract class BaseAgent implements IAgent {
  abstract definition: AgentDefinition;

  // Execute the agent — override in concrete agent
  async execute(_context: ExecutionContext): Promise<AgentExecutionResult> {
    throw new Error(`${this.definition.agent_name} execute() not implemented.`);
  }

  // Validate input against the agent's input schema
  validateInput(input: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const schema = this.definition.inputSchema;

    if (schema && schema.required) {
      const required = schema.required as string[];
      for (const field of required) {
        if (!(field in input) || input[field] === undefined || input[field] === null) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // Validate output against the agent's output schema
  validateOutput(output: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const schema = this.definition.outputSchema;

    if (schema && schema.required) {
      const required = schema.required as string[];
      for (const field of required) {
        if (!(field in output) || output[field] === undefined || output[field] === null) {
          errors.push(`Missing required output field: ${field}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  get name(): string {
    return this.definition.agent_name;
  }
}
