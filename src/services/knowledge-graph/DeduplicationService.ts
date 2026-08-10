// ============================================================
// DeduplicationService — Detects duplicate nodes
// ============================================================

import { supabase } from '@/lib/supabase';
import { nodeService } from './NodeService';
import type { GraphNodeRecord, NodeType, MergeCandidate } from '@/types/knowledge-graph';

class DeduplicationService {
  async findDuplicates(params: {
    nodeType?: NodeType;
    workspaceId?: string | null;
    threshold?: number;
  }): Promise<MergeCandidate[]> {
    const threshold = params.threshold ?? 0.85;
    let query = supabase
      .from('graph_nodes')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });

    if (params.nodeType) query = query.eq('node_type', params.nodeType);
    if (params.workspaceId) query = query.eq('workspace_id', params.workspaceId);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load nodes: ${error.message}`);

    const nodes = (data ?? []) as GraphNodeRecord[];
    const candidates: MergeCandidate[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[i].node_type !== nodes[j].node_type) continue;

        const pairKey = `${nodes[i].id}:${nodes[j].id}`;
        if (seen.has(pairKey)) continue;

        const similarity = this.calculateSimilarity(nodes[i], nodes[j]);
        if (similarity.score >= threshold) {
          seen.add(pairKey);
          candidates.push({
            primaryNode: nodes[i].created_at <= nodes[j].created_at ? nodes[i] : nodes[j],
            duplicateNode: nodes[i].created_at <= nodes[j].created_at ? nodes[j] : nodes[i],
            similarityScore: similarity.score,
            matchReasons: similarity.reasons,
          });
        }
      }
    }

    return candidates;
  }

  private calculateSimilarity(a: GraphNodeRecord, b: GraphNodeRecord): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;
    let factors = 0;

    // Display name similarity (Jaccard on tokens)
    const nameSim = this.jaccardSimilarity(
      a.display_name.toLowerCase().split(/\s+/),
      b.display_name.toLowerCase().split(/\s+/)
    );
    score += nameSim * 0.4;
    factors++;
    if (nameSim > 0.8) reasons.push(`Similar name (${Math.round(nameSim * 100)}%)`);

    // External ID match
    if (a.external_id && b.external_id && a.external_id === b.external_id) {
      score += 0.3;
      factors++;
      reasons.push('Matching external_id');
    } else {
      score += 0;
      factors++;
    }

    // Properties overlap
    const propSim = this.propertySimilarity(a.properties, b.properties);
    score += propSim * 0.3;
    factors++;
    if (propSim > 0.7) reasons.push(`Similar properties (${Math.round(propSim * 100)}%)`);

    return { score: factors > 0 ? score / factors : 0, reasons };
  }

  private jaccardSimilarity(a: string[], b: string[]): number {
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  private propertySimilarity(a: Record<string, unknown>, b: Record<string, unknown>): number {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    const allKeys = new Set([...keysA, ...keysB]);
    if (allKeys.size === 0) return 0;

    let matches = 0;
    for (const key of allKeys) {
      if (key in a && key in b) {
        if (JSON.stringify(a[key]) === JSON.stringify(b[key])) {
          matches++;
        }
      }
    }

    return matches / allKeys.size;
  }

  async getDuplicateCount(workspaceId?: string | null): Promise<number> {
    const duplicates = await this.findDuplicates({ workspaceId, threshold: 0.85 });
    return duplicates.length;
  }
}

export const deduplicationService = new DeduplicationService();
