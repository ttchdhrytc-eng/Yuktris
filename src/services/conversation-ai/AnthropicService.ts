// ============================================================
// AnthropicService — Conversation AI
// ============================================================
//
// Interface placeholder for future Anthropic integration.
// No implementation — architecture only.

import type { AnthropicReviewResult } from '@/types/conversation-ai';

export interface IAnthropicService {
  reviewConversation(messages: { sender: string; content: string }[]): Promise<AnthropicReviewResult>;
}

export class AnthropicService implements IAnthropicService {
  async reviewConversation(_messages: { sender: string; content: string }[]): Promise<AnthropicReviewResult> {
    throw new Error('AnthropicService.reviewConversation() not implemented');
  }
}
