// ============================================================
// EmailService — Conversation AI
// ============================================================
//
// Interface placeholder for future Email integration.
// No implementation — architecture only.

import type { EmailThreadsResult } from '@/types/conversation-ai';

export interface IConversationEmailService {
  loadThreads(contactId: string): Promise<EmailThreadsResult>;
}

export class ConversationEmailService implements IConversationEmailService {
  async loadThreads(_contactId: string): Promise<EmailThreadsResult> {
    throw new Error('ConversationEmailService.loadThreads() not implemented');
  }
}
