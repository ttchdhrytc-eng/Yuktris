// ============================================================
// ReplyClassificationEngine — Classifies reply intent
// ============================================================

import type { ReplyAnalysis, ReplyClassification } from '@/types/outreach';

class ReplyClassificationEngine {
  classify(replyContent: string): ReplyAnalysis {
    const lower = replyContent.toLowerCase();

    if (lower.includes('out of office') || lower.includes('ooo') || lower.includes('on vacation') || lower.includes('returning on')) {
      return { classification: 'out_of_office', intent_score: 0.1, meeting_intent: false, opportunity_detected: false, suggested_action: 'Reschedule outreach for after the contact returns. Note the return date.' };
    }

    if (lower.includes('unsubscribe') || lower.includes('stop emailing') || lower.includes('remove me') || lower.includes('no longer interested')) {
      return { classification: 'unsubscribe', intent_score: 0, meeting_intent: false, opportunity_detected: false, suggested_action: 'Remove from active sequences and suppress future outreach.' };
    }

    if (lower.includes('schedule') || lower.includes('meeting') || lower.includes('call') || lower.includes('calendar') || lower.includes('available') || lower.includes('book')) {
      return { classification: 'meeting_request', intent_score: 0.85, meeting_intent: true, opportunity_detected: true, suggested_action: 'Send calendar invite or scheduling link immediately. This is a high-priority response.' };
    }

    if (lower.includes('yes') || lower.includes('interested') || lower.includes('sounds good') || lower.includes('tell me more') || lower.includes('sure') || lower.includes('great') || lower.includes('love to')) {
      return { classification: 'positive', intent_score: 0.8, meeting_intent: lower.includes('call') || lower.includes('meeting'), opportunity_detected: true, suggested_action: 'Respond promptly with next steps. Propose a discovery call if not already suggested.' };
    }

    if (lower.includes('no budget') || lower.includes('too expensive') || lower.includes('not now') || lower.includes('maybe later') || lower.includes('not the right time') || lower.includes('happy with')) {
      return { classification: 'objection', intent_score: 0.3, meeting_intent: false, opportunity_detected: false, suggested_action: 'Address the objection with ROI data or alternative options. Add to nurture sequence.' };
    }

    if (lower.includes('refer') || lower.includes('colleague') || lower.includes('someone else') || lower.includes('team') || lower.includes('forward')) {
      return { classification: 'referral', intent_score: 0.6, meeting_intent: false, opportunity_detected: true, suggested_action: 'Thank them and ask for an introduction to the referred person.' };
    }

    if (lower.includes('more information') || lower.includes('details') || lower.includes('pricing') || lower.includes('how much') || lower.includes('what does') || lower.includes('can you explain')) {
      return { classification: 'ask_for_info', intent_score: 0.65, meeting_intent: false, opportunity_detected: true, suggested_action: 'Provide the requested information and suggest a call to discuss further.' };
    }

    if (lower.includes('no') || lower.includes('not interested') || lower.includes('stop')) {
      return { classification: 'negative', intent_score: 0.1, meeting_intent: false, opportunity_detected: false, suggested_action: 'Acknowledge and add to long-term nurture. Do not push further.' };
    }

    return { classification: 'neutral', intent_score: 0.4, meeting_intent: false, opportunity_detected: false, suggested_action: 'Respond with value-add content. Keep the conversation going without being pushy.' };
  }
}

export const replyClassificationEngine = new ReplyClassificationEngine();
