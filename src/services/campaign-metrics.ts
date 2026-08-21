export type CampaignMetricSet = {
  prospects?: number;
  connectionsSent?: number;
  connectionsAccepted?: number;
  messagesSent?: number;
  replies?: number;
  positiveReplies?: number;
  qualifiedLeads?: number;
  meetingsBooked?: number;
};

type Row = Record<string, unknown>;

export function isTestFixture(row: Row): boolean {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as Row : {};
  const payload = row.action_payload && typeof row.action_payload === 'object' ? row.action_payload as Row : {};
  const marker = metadata.fixture ?? metadata.is_fixture ?? metadata.test_fixture ?? payload.fixture ?? payload.is_fixture;
  const source = String(metadata.source ?? payload.source ?? '').toLowerCase();
  const name = String(row.prospect_name ?? row.name ?? '').trim().toLowerCase();
  return marker === true || ['fixture', 'test', 'regression_test', 'acceptance_test'].includes(source)
    || name === 'execution fixture';
}

function sourceId(row: Row): string | null {
  const payload = row.action_payload && typeof row.action_payload === 'object' ? row.action_payload as Row : {};
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as Row : {};
  const value = payload.source_campaign_id ?? metadata.source_campaign_id ?? metadata.customer_campaign_id;
  return typeof value === 'string' ? value : null;
}

export function buildCampaignMetrics(params: {
  campaignIds: string[];
  campaignContacts?: Row[];
  jobs?: Row[];
  conversations?: Row[];
  messages?: Row[];
  confirmations?: Row[];
}): Record<string, CampaignMetricSet> {
  const result = Object.fromEntries(params.campaignIds.map((id) => [id, {
    prospects: 0, connectionsSent: 0, connectionsAccepted: 0, messagesSent: 0,
    replies: 0, positiveReplies: 0, qualifiedLeads: 0, meetingsBooked: 0,
  } as CampaignMetricSet]));
  const contacts = new Map<string, Set<string>>();
  const profileCampaign = new Map<string, string>();
  for (const id of params.campaignIds) contacts.set(id, new Set());

  if (params.campaignContacts) {
    for (const mapping of params.campaignContacts) {
      const campaignId = typeof mapping.customer_campaign_id === 'string' ? mapping.customer_campaign_id : null;
      const contactId = typeof mapping.contact_id === 'string' ? mapping.contact_id : null;
      if (campaignId && contactId && result[campaignId]) contacts.get(campaignId)?.add(contactId);
    }
  }

  if (params.jobs) {
    for (const job of params.jobs) {
      if (isTestFixture(job)) continue;
      const id = sourceId(job); if (!id || !result[id]) continue;
      if (!params.campaignContacts && typeof job.contact_id === 'string') contacts.get(id)?.add(job.contact_id);
      const payload = job.action_payload && typeof job.action_payload === 'object' ? job.action_payload as Row : {};
      if (typeof payload.profile_url === 'string') profileCampaign.set(payload.profile_url.replace(/\/$/, '').toLowerCase(), id);
      if (job.action_type === 'connection_request' && job.status === 'completed') result[id].connectionsSent!++;
      if (job.action_type === 'check_connection_acceptance' && job.status === 'completed') result[id].connectionsAccepted!++;
    }
  }
  for (const id of params.campaignIds) result[id].prospects = contacts.get(id)?.size ?? 0;

  const conversationCampaign = new Map<string, string>();
  if (params.conversations) {
    for (const conversation of params.conversations) {
      if (isTestFixture(conversation)) continue;
      const profile = typeof conversation.prospect_profile_url === 'string' ? conversation.prospect_profile_url.replace(/\/$/, '').toLowerCase() : '';
      const id = sourceId(conversation) ?? profileCampaign.get(profile) ?? null; if (!id || !result[id]) continue;
      if (typeof conversation.id === 'string') conversationCampaign.set(conversation.id, id);
      if (conversation.stage === 'qualified') result[id].qualifiedLeads!++;
    }
  }
  if (params.messages) {
    for (const message of params.messages) {
      if (isTestFixture(message)) continue;
      const id = sourceId(message) ?? (typeof message.conversation_id === 'string' ? conversationCampaign.get(message.conversation_id) ?? null : null);
      if (!id || !result[id]) continue;
      if (message.direction === 'outbound') result[id].messagesSent!++;
      if (message.direction === 'inbound') {
        result[id].replies!++;
        if (['positive', 'meeting_interest'].includes(String(message.classification ?? ''))) result[id].positiveReplies!++;
      }
    }
  }
  if (params.confirmations) {
    for (const confirmation of params.confirmations) {
      if (isTestFixture(confirmation)) continue;
      const metadata = confirmation.metadata && typeof confirmation.metadata === 'object' ? confirmation.metadata as Row : {};
      const conversationId = typeof metadata.conversation_id === 'string' ? metadata.conversation_id : null;
      const id = sourceId(confirmation) ?? (conversationId ? conversationCampaign.get(conversationId) ?? null : null);
      if (id && result[id]) result[id].meetingsBooked!++;
    }
  }
  return result;
}

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  running: 'Active', ready: 'Ready', blocked_prerequisite: 'Action Required', paused: 'Paused',
  failed: 'Needs Attention', completed: 'Completed', initializing: 'Setting Up', action_required: 'Action Required', draft: 'Draft',
};
