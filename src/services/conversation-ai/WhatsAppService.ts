// ============================================================
// WhatsAppService — Conversation AI
// ============================================================
//
// Interface placeholder for future WhatsApp integration.
// No implementation — architecture only.

import type { WhatsAppMessagesResult } from '@/types/conversation-ai';

export interface IWhatsAppService {
  loadMessages(conversationId: string): Promise<WhatsAppMessagesResult>;
}

export class WhatsAppService implements IWhatsAppService {
  async loadMessages(_conversationId: string): Promise<WhatsAppMessagesResult> {
    throw new Error('WhatsAppService.loadMessages() not implemented');
  }
}
