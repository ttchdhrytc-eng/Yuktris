import assert from 'node:assert/strict';
import test from 'node:test';
import { nextCampaignSendingWindow, normalizeIanaTimezone, parseCampaignDays, parseCampaignHours } from './campaign-schedule.ts';

test('hydrates the existing failed Testing 2 schedule without losing values', () => {
  assert.deepEqual(parseCampaignDays('Monday–Friday'), ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  assert.deepEqual(parseCampaignHours('09:00–17:00'), ['09:00', '17:00']);
  assert.equal(normalizeIanaTimezone('Asia/Calcutta'), 'Asia/Kolkata');
});

test('accepts compatibility separators and fails malformed hours to safe editable defaults', () => {
  assert.deepEqual(parseCampaignDays('monday,tuesday,saturday,sunday'), ['monday', 'tuesday', 'saturday', 'sunday']);
  assert.deepEqual(parseCampaignHours('09:00-17:00'), ['09:00', '17:00']);
  assert.deepEqual(parseCampaignHours('broken'), ['09:00', '17:00']);
});

test('calculates Testing 2 next Monday window in Asia/Kolkata', () => {
  const result = nextCampaignSendingWindow(parseCampaignDays('Monday–Friday'), ...parseCampaignHours('09:00–17:00'), 'Asia/Kolkata', new Date('2026-08-21T17:03:30Z'));
  assert.equal(result?.toISOString(), '2026-08-24T03:30:00.000Z');
});
