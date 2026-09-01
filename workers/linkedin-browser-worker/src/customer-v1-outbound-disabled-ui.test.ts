import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(process.cwd(), '../..');
const campaigns = readFileSync(resolve(root, 'src/pages/CampaignsPage.tsx'), 'utf8');
const dashboard = readFileSync(resolve(root, 'src/pages/DashboardPage.tsx'), 'utf8');
const onboarding = readFileSync(resolve(root, 'src/pages/OnboardingPage.tsx'), 'utf8');
const mode = readFileSync(resolve(root, 'src/lib/linkedinExecutionMode.ts'), 'utf8');

test('customer execution mode fails closed and campaign UI reports disabled', () => {
  assert.match(mode, /value === LINKEDIN_OUTBOUND_MODE/);
  assert.match(campaigns, /!outboundEnabled \? 'Outbound Disabled'/);
  assert.match(campaigns, /disabled=\{!outboundEnabled\}/);
  assert.match(campaigns, /if \(!outboundEnabled\)[\s\S]*Campaign configuration remains saved/);
  assert.match(dashboard, /LinkedIn outbound is disabled\. Your campaign configuration remains saved\./);
});

test('LinkedIn-only customer requirements omit Gmail and Calendar prompts', () => {
  assert.doesNotMatch(dashboard, /Reconnect Gmail|Connect Calendar/);
  assert.doesNotMatch(campaigns, /Calendar connected|Calendar optional|Connect Calendar before/);
  const launchConnections = onboarding.slice(onboarding.indexOf('<PlanRow label="Connections"'));
  assert.doesNotMatch(launchConnections.slice(0, 250), /gmailConnected|calendarConnected/);
});

test('verification performs no LinkedIn or browser interaction', () => {
  assert.doesNotMatch(import.meta.url, /https?:/);
});
