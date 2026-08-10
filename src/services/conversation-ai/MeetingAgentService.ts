// ============================================================
// MeetingAgentService — Conversation AI
// ============================================================
//
// Interface placeholder for future Meeting Agent integration.
// No implementation — architecture only.

import type { MeetingAgentHandoffResult } from '@/types/conversation-ai';

export interface IMeetingAgentService {
  handoffConversation(params: { conversationId: string; contactId: string; summary: string }): Promise<MeetingAgentHandoffResult>;
}

export class MeetingAgentService implements IMeetingAgentService {
  async handoffConversation(_params: { conversationId: string; contactId: string; summary: string }): Promise<MeetingAgentHandoffResult> {
    throw new Error('MeetingAgentService.handoffConversation() not implemented');
  }
}
