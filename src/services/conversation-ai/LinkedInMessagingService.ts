// ============================================================
// LinkedInMessagingService — Conversation AI
// ============================================================
//
// Interface placeholder for future LinkedIn messaging integration.
// No implementation — architecture only.

import type { LinkedInMessagesResult } from '@/types/conversation-ai';

export interface ILinkedInMessagingService {
  loadMessages(conversationId: string): Promise<LinkedInMessagesResult>;
}

export class LinkedInMessagingService implements ILinkedInMessagingService {
  async loadMessages(_conversationId: string): Promise<LinkedInMessagesResult> {
    throw new Error('LinkedInMessagingService.loadMessages() not implemented');
  }
}
