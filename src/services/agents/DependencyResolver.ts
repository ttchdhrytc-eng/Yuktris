// ============================================================
// DependencyResolver — Resolves agent execution order
// ============================================================
//
// Uses topological sort to determine the correct execution order
// for agents based on their declared dependencies.

import { supabase } from '@/lib/supabase';
import type { DependencyType } from '@/types/agent-orchestrator';

type DependencyEdge = {
  agent_id: string;
  depends_on_agent_id: string;
  dependency_type: DependencyType;
};

type AgentNameMap = Map<string, string>; // agent_id -> agent_name

class DependencyResolver {
  // Load all dependencies from the database
  async loadDependencies(): Promise<{ edges: DependencyEdge[]; nameMap: AgentNameMap }> {
    const [depsResult, agentsResult] = await Promise.all([
      supabase.from('agent_dependencies').select('agent_id, depends_on_agent_id, dependency_type'),
      supabase.from('agent_registry').select('id, agent_name'),
    ]);

    if (depsResult.error) throw new Error(`Failed to load dependencies: ${depsResult.error.message}`);
    if (agentsResult.error) throw new Error(`Failed to load agents: ${agentsResult.error.message}`);

    const nameMap: AgentNameMap = new Map();
    for (const agent of (agentsResult.data ?? []) as Array<{ id: string; agent_name: string }>) {
      nameMap.set(agent.id, agent.agent_name);
    }

    return {
      edges: (depsResult.data ?? []) as DependencyEdge[],
      nameMap,
    };
  }

  // Resolve execution order for a set of agents using topological sort
  async resolveOrder(agentNames: string[]): Promise<string[]> {
    const { edges, nameMap } = await this.loadDependencies();

    // Build name -> id map
    const idByName = new Map<string, string>();
    for (const [id, name] of nameMap) {
      idByName.set(name, id);
    }

    // Filter edges to only those involving our target agents
    const targetIds = new Set(agentNames.map((n) => idByName.get(n)).filter(Boolean) as string[]);
    const relevantEdges = edges.filter(
      (e) => targetIds.has(e.agent_id) && targetIds.has(e.depends_on_agent_id),
    );

    // Build adjacency list (agent -> dependencies)
    const adjacency = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();

    for (const id of targetIds) {
      adjacency.set(id, new Set());
      inDegree.set(id, 0);
    }

    for (const edge of relevantEdges) {
      if (edge.dependency_type === 'requires' || edge.dependency_type === 'enhances') {
        adjacency.get(edge.agent_id)?.add(edge.depends_on_agent_id);
        inDegree.set(edge.agent_id, (inDegree.get(edge.agent_id) ?? 0) + 1);
      }
    }

    // Kahn's algorithm for topological sort
    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);
      for (const [id, deps] of adjacency) {
        if (deps.has(current)) {
          deps.delete(current);
          const newDeg = (inDegree.get(id) ?? 0) - 1;
          inDegree.set(id, newDeg);
          if (newDeg === 0) queue.push(id);
        }
      }
    }

    // Convert back to names
    return sorted.map((id) => nameMap.get(id)).filter(Boolean) as string[];
  }

  // Get dependencies for a specific agent
  async getDependencies(agentName: string): Promise<{ dependsOn: string[]; type: DependencyType }[]> {
    const { data: agent } = await supabase
      .from('agent_registry')
      .select('id')
      .eq('agent_name', agentName)
      .maybeSingle();

    if (!agent) return [];

    const { data: deps, error } = await supabase
      .from('agent_dependencies')
      .select('depends_on_agent_id, dependency_type')
      .eq('agent_id', (agent as { id: string }).id);

    if (error || !deps) return [];

    const depIds = deps as Array<{ depends_on_agent_id: string; dependency_type: DependencyType }>;
    const depNames: { dependsOn: string[]; type: DependencyType }[] = [];

    for (const dep of depIds) {
      const { data: depAgent } = await supabase
        .from('agent_registry')
        .select('agent_name')
        .eq('id', dep.depends_on_agent_id)
        .maybeSingle();
      if (depAgent) {
        depNames.push({
          dependsOn: [(depAgent as { agent_name: string }).agent_name],
          type: dep.dependency_type,
        });
      }
    }

    return depNames;
  }

  // Check if all required dependencies have completed successfully
  checkDependenciesSatisfied(
    agentName: string,
    completedAgents: Map<string, { success: boolean }>,
  ): { satisfied: boolean; missing: string[] } {
    const missing: string[] = [];

    // This is a simplified check — the full dependency check
    // happens in the executor with the loaded dependency graph
    for (const [name, result] of completedAgents) {
      if (!result.success) {
        missing.push(name);
      }
    }

    return { satisfied: missing.length === 0, missing };
  }
}

export const dependencyResolver = new DependencyResolver();
