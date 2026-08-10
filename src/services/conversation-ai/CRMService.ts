// ============================================================
// CRMService — Conversation AI
// ============================================================
//
// Interface placeholder for future CRM integration.
// No implementation — architecture only.

import type { CRMConversationUpdate } from '@/types/conversation-ai';

export interface IConversationCRMService {
  updateConversation(params: { contactId: string; status: string; notes: string }): Promise<CRMConversationUpdate>;
}

export class ConversationCRMService implements IConversationCRMService {
  async updateConversation(_params: { contactId: string; status: string; notes: string }): Promise<CRMConversationUpdate> {
    throw new Error('ConversationCRMService.updateConversation() not implemented');
  }
}
