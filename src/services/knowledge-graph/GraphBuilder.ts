// ============================================================
// GraphBuilder — Builds graph from external ingestion data
// ============================================================

import { nodeService } from './NodeService';
import { edgeService } from './EdgeService';
import { relationshipResolver } from './RelationshipResolver';
import { entityMerger } from './EntityMerger';
import type {
  IngestBatch,
  IngestEntity,
  IngestRelationship,
  GraphNodeRecord,
  NodeType,
  RelationshipType,
} from '@/types/knowledge-graph';

class GraphBuilder {
  async ingestBatch(batch: IngestBatch): Promise<{
    nodesCreated: number;
    nodesUpdated: number;
    edgesCreated: number;
    edgesFailed: number;
  }> {
    const workspaceId = batch.workspaceId ?? null;
    let nodesCreated = 0;
    let nodesUpdated = 0;
    let edgesCreated = 0;
    let edgesFailed = 0;

    // Ingest entities
    const nodeMap = new Map<string, GraphNodeRecord>();

    for (const entity of batch.entities) {
      const result = await this.ingestEntity(entity, workspaceId);
      if (result.created) nodesCreated++;
      else nodesUpdated++;

      if (result.node) {
        const key = this.buildEntityKey(entity);
        nodeMap.set(key, result.node);
      }
    }

    // Ingest relationships
    for (const rel of batch.relationships) {
      const sourceKey = this.buildRelKey(rel.sourceExternalId, rel.sourceNodeType);
      const targetKey = this.buildRelKey(rel.targetExternalId, rel.targetNodeType);

      const sourceNode = nodeMap.get(sourceKey) ?? await nodeService.getByExternalId(rel.sourceExternalId, rel.sourceNodeType, workspaceId);
      const targetNode = nodeMap.get(targetKey) ?? await nodeService.getByExternalId(rel.targetExternalId, rel.targetNodeType, workspaceId);

      if (!sourceNode || !targetNode) {
        edgesFailed++;
        continue;
      }

      const validation = relationshipResolver.validate(
        sourceNode.node_type as NodeType,
        targetNode.node_type as NodeType,
        rel.relationshipType
      );

      if (!validation.valid) {
        edgesFailed++;
        continue;
      }

      try {
        await edgeService.create({
          workspaceId,
          sourceNodeId: sourceNode.id,
          targetNodeId: targetNode.id,
          relationshipType: rel.relationshipType,
          properties: rel.properties ?? {},
          confidenceScore: rel.confidenceScore ?? 0.8,
        });
        edgesCreated++;
      } catch {
        edgesFailed++;
      }
    }

    return { nodesCreated, nodesUpdated, edgesCreated, edgesFailed };
  }

  private async ingestEntity(entity: IngestEntity, workspaceId: string | null): Promise<{ node: GraphNodeRecord | null; created: boolean }> {
    // Check for existing node by external_id
    if (entity.externalId) {
      const existing = await nodeService.getByExternalId(entity.externalId, entity.nodeType, workspaceId);
      if (existing) {
        // Update with new properties merged
        const mergedProperties = {
          ...existing.properties,
          ...entity.properties,
        };
        const updated = await nodeService.update(existing.id, {
          ...existing,
          properties: mergedProperties,
        });
        return { node: updated, created: false };
      }
    }

    // Create new node
    const node = await nodeService.create({
      workspaceId,
      nodeType: entity.nodeType,
      externalId: entity.externalId ?? null,
      displayName: entity.displayName,
      properties: entity.properties ?? {},
      confidenceScore: entity.confidenceScore ?? 0.8,
    });

    return { node, created: true };
  }

  private buildEntityKey(entity: IngestEntity): string {
    return `${entity.nodeType}:${entity.externalId ?? entity.displayName}`;
  }

  private buildRelKey(externalId: string, nodeType: NodeType): string {
    return `${nodeType}:${externalId}`;
  }

  async ingestFromResearchIntelligence(params: {
    companyName: string;
    website?: string | null;
    industry?: string | null;
    businessModel?: string | null;
    technologyStack?: string[];
    workspaceId?: string | null;
  }): Promise<{ nodesCreated: number; edgesCreated: number }> {
    const batch: IngestBatch = {
      workspaceId: params.workspaceId,
      entities: [],
      relationships: [],
    };

    // Company node
    const companyExternalId = `company:${params.companyName.toLowerCase()}`;
    batch.entities.push({
      nodeType: 'company',
      externalId: companyExternalId,
      displayName: params.companyName,
      properties: {
        website: params.website,
        industry: params.industry,
        business_model: params.businessModel,
      },
      source: 'research_intelligence',
    });

    // Industry node
    if (params.industry) {
      batch.entities.push({
        nodeType: 'industry',
        externalId: `industry:${params.industry.toLowerCase()}`,
        displayName: params.industry,
        properties: {},
        source: 'research_intelligence',
      });
      batch.relationships.push({
        sourceExternalId: companyExternalId,
        sourceNodeType: 'company',
        targetExternalId: `industry:${params.industry.toLowerCase()}`,
        targetNodeType: 'industry',
        relationshipType: 'SERVES',
        source: 'research_intelligence',
      });
    }

    // Technology nodes
    if (params.technologyStack) {
      for (const tech of params.technologyStack) {
        const techId = `tech:${tech.toLowerCase()}`;
        batch.entities.push({
          nodeType: 'technology',
          externalId: techId,
          displayName: tech,
          properties: {},
          source: 'research_intelligence',
        });
        batch.relationships.push({
          sourceExternalId: companyExternalId,
          sourceNodeType: 'company',
          targetExternalId: techId,
          targetNodeType: 'technology',
          relationshipType: 'USES_TECHNOLOGY',
          source: 'research_intelligence',
        });
      }
    }

    const result = await this.ingestBatch(batch);
    return { nodesCreated: result.nodesCreated, edgesCreated: result.edgesCreated };
  }
}

export const graphBuilder = new GraphBuilder();
