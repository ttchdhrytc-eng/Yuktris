import test from 'node:test';
import assert from 'node:assert/strict';
import { LINKEDIN_AGENT_COMMANDS, normalizeLinkedInAction, validateSalesNavigatorPayload } from './linkedin-agent-contract.js';

test('normalized cloud-agent command contract contains the V1 commands', () => {
  assert.deepEqual(LINKEDIN_AGENT_COMMANDS, [
    'CHECK_SESSION', 'OPEN_PROFILE', 'READ_PROFILE', 'SALES_NAV_SEARCH', 'SEND_CONNECTION_REQUEST',
    'SEND_MESSAGE', 'CHECK_MESSAGES', 'READ_THREAD', 'SEND_REPLY', 'FOLLOW_UP',
  ]);
});

test('normalized commands reuse existing queue actions', () => {
  assert.equal(normalizeLinkedInAction('CHECK_SESSION'), 'linkedin_test_connection');
  assert.equal(normalizeLinkedInAction('SEND_CONNECTION_REQUEST'), 'connection_request');
  assert.equal(normalizeLinkedInAction('SEND_REPLY'), 'send_message');
  assert.equal(normalizeLinkedInAction('read_replies'), 'read_replies');
});

test('Sales Navigator payload is structured, bounded, and rejects malformed filters', () => {
  assert.deepEqual(validateSalesNavigatorPayload({ geography: [' India '], title: ['Founder'], limit: 5 }), {
    geography: ['India'], title: ['Founder'], limit: 5,
  });
  assert.throws(() => validateSalesNavigatorPayload({ geography: 'India' }), /string array/);
  assert.throws(() => validateSalesNavigatorPayload({ limit: 100 }), /between 1 and 25/);
});
