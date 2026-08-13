import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decideLinkedInNextAction } from './linkedin-ai-handoff.js';
import { LINKEDIN_WRITE_ACTIONS, normalizeLinkedInTarget, targetForWrite } from './linkedin-execution-safety.js';

const worker = readFileSync(resolve(process.cwd(), 'src/worker.ts'), 'utf8');
const safety = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260814220000_linkedin_execution_write_safety.sql'), 'utf8');
const replies = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260811100000_linkedin_followup_reply_loop.sql'), 'utf8');
const meeting = readFileSync(resolve(process.cwd(), '../../supabase/migrations/20260814221000_linkedin_meeting_event_idempotency.sql'), 'utf8');

test('all current writes share one preflight before the switch', () => {
  for (const action of ['connection_request','send_message','follow_up_message','like_post','follow_company']) assert.ok(LINKEDIN_WRITE_ACTIONS.has(action));
  assert.ok(worker.indexOf('preflightLinkedInWrite(this.client, item)') < worker.indexOf('switch (item.action_type)'));
});
test('targets normalize and reject non-LinkedIn URL identities', () => {
  assert.equal(normalizeLinkedInTarget('https://linkedin.com/in/Test/?trk=x'), 'https://www.linkedin.com/in/Test');
  assert.equal(normalizeLinkedInTarget('https://evil.example/in/test'), null);
  assert.equal(targetForWrite('connection_request',{profile_url:'https://www.linkedin.com/in/test/'}),'https://www.linkedin.com/in/test');
});
test('safety classifications cover required denials', () => {
  for (const code of ['daily_limit_reached','cooldown_active','outside_working_hours','account_paused','verification_required','linkedin_restricted','duplicate_action','unsafe_target','rate_limited']) assert.match(safety,new RegExp(code));
});
test('denied preflight exits before a write control and successful finalization alone increments counters', () => {
  assert.match(worker,/if \(!preflight\.allowed\)[\s\S]*?return;/);
  assert.match(safety,/IF NOT p_success THEN[\s\S]*?RETURN;[\s\S]*?INSERT INTO public\.linkedin_daily_usage/);
});
test('queue ownership, semantic idempotency and sanitized audit are structural', () => {
  assert.match(safety,/q\.attempt_id=p_attempt_id AND q\.status='running'/);
  assert.match(safety,/semantic_key text NOT NULL UNIQUE/);
  assert.doesNotMatch(safety,/cookie|password|browserbase_url|cdp/i);
});
test('staging allowlist is project-bound and production requires campaign or contact authorization', () => {
  assert.match(safety,/p_project_ref='vdiqfiuqckaxdjkadinu'/);
  assert.match(safety,/public\.contacts[\s\S]*public\.campaigns/);
});
test('challenge finalization pauses before future writes', () => assert.match(safety,/status='paused',connection_state='requires_action'/));
test('profile extraction has bounded selector fallbacks', () => {
  assert.match(worker,/main h1[\s\S]*pv-text-details__left-panel h1[\s\S]*meta\[property="og:title"\]/);
});
test('Sales Navigator waits for results and normalizes positive candidate fields', () => {
  assert.match(worker,/data-x-search-result[\s\S]*timeout: 10000/);
  for (const field of ['sales_nav_lead_url','headline','company','location']) assert.match(worker,new RegExp(field));
});
test('reply ingestion maps context and suppresses duplicate external events', () => {
  assert.match(worker,/p_contact_id[\s\S]*p_campaign_id[\s\S]*p_classification/);
  assert.match(replies,/UNIQUE\s*\(linkedin_account_id,\s*external_reply_id\)/);
});

const fixtures: Array<[string,string,string]> = [
  ['What is the pricing?', 'pricing_question', 'SEND_REPLY'], ['Not interested, no thanks.', 'not_interested', 'STOP'],
  ['Please send me more information.', 'send_information', 'SEND_REPLY'], ['Circle back next quarter.', 'timing_later', 'FOLLOW_UP'],
  ['We already use a current vendor.', 'current_vendor', 'SEND_REPLY'], ['Do you have a case study or proof?', 'proof_case_study', 'SEND_REPLY'],
  ['Can you work pay per lead?', 'pay_per_lead', 'SEND_REPLY'], ['Speak to my manager instead.', 'decision_maker_redirect', 'SEND_REPLY'],
  ["Let's schedule a meeting.", 'meeting_interest', 'REQUEST_MEETING'],
];
for (const [body,category,action] of fixtures) test(`AI handoff classifies ${category}`, () => {
  const result=decideLinkedInNextAction(body); assert.equal(result.category,category); assert.equal(result.action,action);
});
test('unknown AI decisions require human review and fixture responses are never executed by worker', () => {
  assert.deepEqual(decideLinkedInNextAction('hello'),{action:'HUMAN_REVIEW',category:'unknown',qualification_state:'unknown',response:null,requires_human_approval:true});
  assert.doesNotMatch(worker,/decideLinkedInNextAction/);
});
test('meeting event is workspace authorized, idempotent, persistent and notification-consumable', () => {
  assert.match(meeting,/is_workspace_member/); assert.match(meeting,/uq_linkedin_meeting_event_idempotency/);
  assert.match(meeting,/notification_type='meeting_booked'/); assert.match(meeting,/'fixture',true/);
});
