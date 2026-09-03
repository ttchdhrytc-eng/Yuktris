import assert from 'node:assert/strict';
import test from 'node:test';
import { readCampaignUiState, writeCampaignUiState } from './campaign-ui-state.ts';

test('explicit new-campaign timezone survives a remount for the same workspace', () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
  writeCampaignUiState('workspace-a', { expandedCampaign: null, scheduleDraft: null, newCampaignTimezone: 'Asia/Kolkata' });
  assert.equal(readCampaignUiState('workspace-a').newCampaignTimezone, 'Asia/Kolkata');
  assert.equal(readCampaignUiState('workspace-b').newCampaignTimezone, null);
});
