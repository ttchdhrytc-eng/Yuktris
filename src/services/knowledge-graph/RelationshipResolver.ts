// ============================================================
// RelationshipResolver — Validates and resolves relationships
// ============================================================

import { nodeService } from './NodeService';
import { edgeService } from './EdgeService';
import type {
  RelationshipType,
  NodeType,
  GraphNodeRecord,
} from '@/types/knowledge-graph';

class RelationshipResolver {
  // Valid source -> target node type combinations per relationship
  private validCombinations: Record<RelationshipType, { source: NodeType[]; target: NodeType[] }> = {
    WORKS_FOR: { source: ['person', 'contact', 'user'], target: ['company', 'organization'] },
    OWNS: { source: ['company', 'organization', 'user'], target: ['product', 'service', 'domain', 'website'] },
    BELONGS_TO: { source: ['lead', 'contact', 'task', 'note', 'document'], target: ['company', 'account', 'organization'] },
    USES_TECHNOLOGY: { source: ['company', 'organization'], target: ['technology'] },
    COMPETES_WITH: { source: ['company', 'organization', 'product', 'competitor'], target: ['company', 'organization', 'product', 'competitor'] },
    SERVES: { source: ['company', 'organization', 'product', 'service'], target: ['industry', 'market'] },
    TARGETS: { source: ['company', 'organization', 'product', 'service'], target: ['industry', 'market', 'company'] },
    LOCATED_IN: { source: ['company', 'organization', 'person', 'contact'], target: ['location'] },
    PARTNER_OF: { source: ['company', 'organization'], target: ['company', 'organization'] },
    CUSTOMER_OF: { source: ['company', 'organization', 'contact'], target: ['company', 'organization'] },
    PROSPECT_OF: { source: ['company', 'lead', 'contact'], target: ['company', 'organization'] },
    ATTENDED: { source: ['person', 'contact', 'user'], target: ['meeting', 'calendar_event'] },
    SENT_EMAIL: { source: ['person', 'contact', 'user'], target: ['email'] },
    RECEIVED_EMAIL: { source: ['person', 'contact', 'email'], target: ['email'] },
    HAS_MEETING: { source: ['company', 'contact', 'person', 'lead'], target: ['meeting', 'calendar_event'] },
    RELATED_TO: { source: [], target: [] },
    GENERATED_BY: { source: ['research_report', 'ai_insight', 'document', 'proposal'], target: ['company', 'contact', 'person'] },
    MENTIONS: { source: ['document', 'note', 'research_report', 'ai_insight'], target: ['company', 'contact', 'person', 'product', 'technology'] },
    HAS_BUYING_SIGNAL: { source: ['company', 'organization', 'lead', 'account'], target: ['buying_signal'] },
    HAS_GROWTH_SIGNAL: { source: ['company', 'organization'], target: ['growth_signal'] },
    HAS_DOCUMENT: { source: ['company', 'contact', 'person', 'lead', 'account'], target: ['document'] },
    HAS_PROPOSAL: { source: ['company', 'contact', 'lead', 'account'], target: ['proposal'] },
    REFERENCES: { source: ['document', 'note', 'research_report', 'proposal'], target: ['company', 'contact', 'person', 'product'] },
    SIMILAR_TO: { source: ['company', 'product', 'service', 'technology'], target: ['company', 'product', 'service', 'technology'] },
    PARENT_OF: { source: ['company', 'organization'], target: ['company', 'organization'] },
    CHILD_OF: { source: ['company', 'organization'], target: ['company', 'organization'] },
  };

  validate(
    sourceNodeType: NodeType,
    targetNodeType: NodeType,
    relationshipType: RelationshipType
  ): { valid: boolean; error?: string } {
    const config = this.validCombinations[relationshipType];

    if (!config) {
      return { valid: false, error: `Unknown relationship type: ${relationshipType}` };
    }

    // RELATED_TO allows any combination
    if (relationshipType === 'RELATED_TO') {
      return { valid: true };
    }

    if (config.source.length > 0 && !config.source.includes(sourceNodeType)) {
      return {
        valid: false,
        error: `Relationship ${relationshipType} requires source type to be one of: ${config.source.join(', ')}. Got: ${sourceNodeType}`,
      };
    }

    if (config.target.length > 0 && !config.target.includes(targetNodeType)) {
      return {
        valid: false,
        error: `Relationship ${relationshipType} requires target type to be one of: ${config.target.join(', ')}. Got: ${targetNodeType}`,
      };
    }

    return { valid: true };
  }

  async resolveNodes(
    sourceExternalId: string,
    sourceNodeType: NodeType,
    targetExternalId: string,
    targetNodeType: NodeType,
    workspaceId?: string | null
  ): Promise<{ sourceNode: GraphNodeRecord | null; targetNode: GraphNodeRecord | null }> {
    const [sourceNode, targetNode] = await Promise.all([
      nodeService.getByExternalId(sourceExternalId, sourceNodeType, workspaceId),
      nodeService.getByExternalId(targetExternalId, targetNodeType, workspaceId),
    ]);

    return { sourceNode, targetNode };
  }

  async resolveAndCreate(
    sourceExternalId: string,
    sourceNodeType: NodeType,
    targetExternalId: string,
    targetNodeType: NodeType,
    relationshipType: RelationshipType,
    workspaceId?: string | null,
    properties?: Record<string, unknown>,
    confidenceScore?: number
  ): Promise<{ created: boolean; error?: string }> {
    const { sourceNode, targetNode } = await this.resolveNodes(
      sourceExternalId, sourceNodeType, targetExternalId, targetNodeType, workspaceId
    );

    if (!sourceNode || !targetNode) {
      return {
        created: false,
        error: `Could not resolve nodes: source=${!!sourceNode}, target=${!!targetNode}`,
      };
    }

    const validation = this.validate(sourceNode.node_type, targetNode.node_type, relationshipType);
    if (!validation.valid) {
      return { created: false, error: validation.error };
    }

    await edgeService.create({
      workspaceId,
      sourceNodeId: sourceNode.id,
      targetNodeId: targetNode.id,
      relationshipType,
      properties,
      confidenceScore,
    });

    return { created: true };
  }

  getValidRelationships(sourceNodeType: NodeType): RelationshipType[] {
    return (Object.keys(this.validCombinations) as RelationshipType[]).filter((relType) => {
      const config = this.validCombinations[relType];
      return config.source.length === 0 || config.source.includes(sourceNodeType);
    });
  }
}

export const relationshipResolver = new RelationshipResolver();
