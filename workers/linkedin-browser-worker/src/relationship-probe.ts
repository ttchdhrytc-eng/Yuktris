export type RelationshipClassification =
  | 'eligible_for_connection_request'
  | 'already_connected'
  | 'invitation_pending'
  | 'probe_inconclusive';

export interface RelationshipProbeEvidence {
  degree: '1st' | '2nd' | '3rd' | null;
  primary: { message: boolean; connect: boolean; pending: boolean; follow: boolean; connected: boolean; more: boolean };
  moreMenu: { inspected: boolean; connect: boolean; pending: boolean; connected: boolean };
  hydrated: boolean;
}

export function classifyRelationshipProbe(evidence: RelationshipProbeEvidence): RelationshipClassification {
  if (evidence.primary.pending || evidence.moreMenu.pending) return 'invitation_pending';
  if (evidence.degree === '1st' || evidence.primary.connected || evidence.moreMenu.connected) return 'already_connected';
  if (evidence.primary.connect || evidence.moreMenu.connect) return 'eligible_for_connection_request';
  return 'probe_inconclusive';
}

export function classifyStabilizedRelationshipProbe(samples: RelationshipProbeEvidence[]): RelationshipClassification {
  const stable = samples.find(sample => sample.hydrated) ?? samples.at(-1);
  return stable ? classifyRelationshipProbe(stable) : 'probe_inconclusive';
}
