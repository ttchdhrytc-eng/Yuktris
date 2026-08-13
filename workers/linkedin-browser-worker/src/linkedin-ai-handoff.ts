export type ObjectionCategory =
  | 'pricing_question' | 'not_interested' | 'send_information' | 'timing_later'
  | 'current_vendor' | 'proof_case_study' | 'pay_per_lead'
  | 'decision_maker_redirect' | 'meeting_interest' | 'unknown';

export interface LinkedInDecision {
  action: 'SEND_REPLY' | 'FOLLOW_UP' | 'STOP' | 'REQUEST_MEETING' | 'HUMAN_REVIEW';
  category: ObjectionCategory;
  qualification_state: 'disqualified' | 'nurture' | 'engaged' | 'qualified' | 'unknown';
  response: string | null;
  requires_human_approval: boolean;
}

/** Deterministic fixture-safe handoff. The worker executes commands; it never invents or sends this response. */
export function decideLinkedInNextAction(message: string): LinkedInDecision {
  const text = message.toLowerCase().replace(/\s+/g, ' ').trim();
  const decision = (category: ObjectionCategory, action: LinkedInDecision['action'], qualification: LinkedInDecision['qualification_state'], response: string | null, approval = true): LinkedInDecision =>
    ({ action, category, qualification_state: qualification, response, requires_human_approval: approval });
  if (/\b(not interested|no thanks|stop messaging|do not contact)\b/.test(text)) return decision('not_interested', 'STOP', 'disqualified', null, false);
  if (/\b(book|schedule|meeting|calendar|available to talk|let's talk)\b/.test(text)) return decision('meeting_interest', 'REQUEST_MEETING', 'qualified', 'Offer a bounded meeting time and confirm attendees.');
  if (/\b(pay per lead|per qualified lead|cost per lead)\b/.test(text)) return decision('pay_per_lead', 'SEND_REPLY', 'engaged', 'Clarify the commercial model and qualification criteria.');
  if (/\b(price|pricing|cost|expensive|budget)\b/.test(text)) return decision('pricing_question', 'SEND_REPLY', 'engaged', 'Answer the pricing question using the approved offer and relevant ROI context.');
  if (/\b(case study|proof|evidence|results|references)\b/.test(text)) return decision('proof_case_study', 'SEND_REPLY', 'engaged', 'Share only an approved relevant case study or proof point.');
  if (/\b(already use|current vendor|using .+ already|competitor)\b/.test(text)) return decision('current_vendor', 'SEND_REPLY', 'engaged', 'Acknowledge the current vendor and explain approved differentiation without disparagement.');
  if (/\b(send (me )?(info|information|details)|more information|overview)\b/.test(text)) return decision('send_information', 'SEND_REPLY', 'engaged', 'Send the approved concise overview and one low-friction next step.');
  if (/\b(later|next quarter|not now|circle back|reconnect)\b/.test(text)) return decision('timing_later', 'FOLLOW_UP', 'nurture', 'Acknowledge the timing and schedule an approved follow-up.');
  if (/\b(speak to|contact|talk to|decision maker|not the right person|my (boss|manager))\b/.test(text)) return decision('decision_maker_redirect', 'SEND_REPLY', 'engaged', 'Thank them and request an introduction to the named decision maker.');
  return decision('unknown', 'HUMAN_REVIEW', 'unknown', null, true);
}
