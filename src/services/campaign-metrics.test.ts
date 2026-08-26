import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCampaignMetrics } from './campaign-metrics.ts';

test('canonical campaign mappings count association-only prospects without changing outcomes', () => {
  const campaignId = 'f4ee741d-f3b8-47b8-ba67-770f44b58c00';
  const contactIds = ['eric', 'michael', 'vinny', 'tarun'];
  const metrics = buildCampaignMetrics({
    campaignIds: [campaignId],
    campaignContacts: contactIds.map((contactId) => ({ customer_campaign_id: campaignId, contact_id: contactId })),
    jobs: contactIds.slice(0, 3).map((contactId) => ({
      contact_id: contactId,
      action_type: 'connection_request',
      status: 'failed',
      action_payload: { source_campaign_id: campaignId },
    })),
    conversations: [],
    messages: [],
    confirmations: [],
  });

  assert.deepEqual(metrics[campaignId], {
    prospects: 4,
    connectionsSent: 0,
    connectionsAccepted: 0,
    messagesSent: 0,
    replies: 0,
    positiveReplies: 0,
    qualifiedLeads: 0,
    meetingsBooked: 0,
  });
});

test('campaign writes require positive verification and exclude controlled acceptance', () => {
  const campaignId = 'campaign';
  const metrics = buildCampaignMetrics({
    campaignIds: [campaignId],
    jobs: [
      { contact_id: 'verified', action_type: 'connection_request', status: 'completed', action_payload: { source_campaign_id: campaignId }, result_payload: { result_code: 'success', write_verified: true } },
      { contact_id: 'unverified', action_type: 'connection_request', status: 'completed', action_payload: { source_campaign_id: campaignId }, result_payload: {} },
      { contact_id: 'controlled', action_type: 'connection_request', status: 'completed', action_payload: { source_campaign_id: campaignId, acceptance_test_mode: true }, result_payload: { result_code: 'success', write_verified: true } },
    ],
  });
  assert.equal(metrics[campaignId].connectionsSent, 1);
});
