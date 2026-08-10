// ============================================================
// AgentRegistry — In-memory registry for all AI agents
// ============================================================
//
// Every AI agent must register itself here. The orchestrator uses
// this registry to discover, route to, and execute agents.
// Future agents become available by adding a registration call.

import { supabase } from '@/lib/supabase';
import type {
  AgentDefinition,
  IAgent,
  AgentRegistryRecord,
  AgentCategory,
  AgentStatus,
} from '@/types/agent-orchestrator';

class AgentRegistry {
  private agents = new Map<string, IAgent>();
  private definitions = new Map<string, AgentDefinition>();

  // Register an agent
  register(agent: IAgent): void {
    const name = agent.definition.agent_name;
    if (this.agents.has(name)) {
      console.warn(`[AgentRegistry] Agent already registered: ${name}`);
      return;
    }
    this.agents.set(name, agent);
    this.definitions.set(name, agent.definition);
  }

  // Get an agent by name
  get(agentName: string): IAgent | undefined {
    return this.agents.get(agentName);
  }

  // Get an agent definition by name
  getDefinition(agentName: string): AgentDefinition | undefined {
    return this.definitions.get(agentName);
  }

  // Get all registered agents
  getAll(): IAgent[] {
    return Array.from(this.agents.values());
  }

  // Get all agent definitions
  getAllDefinitions(): AgentDefinition[] {
    return Array.from(this.definitions.values());
  }

  // Check if an agent is registered
  has(agentName: string): boolean {
    return this.agents.has(agentName);
  }

  // Get all registered agent names
  getNames(): string[] {
    return Array.from(this.agents.keys());
  }

  // Get agents by category
  getByCategory(category: AgentCategory): IAgent[] {
    return this.getAll().filter((a) => a.definition.category === category);
  }

  // Get agents by status (from DB)
  async getByStatus(status: AgentStatus): Promise<AgentRegistryRecord[]> {
    const { data, error } = await supabase
      .from('agent_registry')
      .select('*')
      .eq('status', status)
      .order('agent_name', { ascending: true });
    if (error) throw new Error(`Failed to load agents: ${error.message}`);
    return (data ?? []) as AgentRegistryRecord[];
  }

  // Sync in-memory registry with database
  async syncFromDatabase(): Promise<void> {
    const { data, error } = await supabase
      .from('agent_registry')
      .select('*')
      .order('agent_name', { ascending: true });

    if (error) throw new Error(`Failed to sync agent registry: ${error.message}`);

    // Ensure all DB agents have corresponding in-memory registrations
    for (const record of (data ?? []) as AgentRegistryRecord[]) {
      if (!this.has(record.agent_name)) {
        console.warn(`[AgentRegistry] Agent "${record.agent_name}" exists in DB but not in memory.`);
      }
    }
  }

  // Get all agents from the database
  async getAllFromDatabase(): Promise<AgentRegistryRecord[]> {
    const { data, error } = await supabase
      .from('agent_registry')
      .select('*')
      .order('agent_name', { ascending: true });
    if (error) throw new Error(`Failed to load agents: ${error.message}`);
    return (data ?? []) as AgentRegistryRecord[];
  }

  // Get a single agent from the database
  async getFromDatabase(agentName: string): Promise<AgentRegistryRecord | null> {
    const { data, error } = await supabase
      .from('agent_registry')
      .select('*')
      .eq('agent_name', agentName)
      .maybeSingle();
    if (error) throw new Error(`Failed to load agent: ${error.message}`);
    return data as AgentRegistryRecord | null;
  }
}

export const agentRegistry = new AgentRegistry();
