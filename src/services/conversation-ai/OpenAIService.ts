// ============================================================
// OpenAIService — Conversation AI
// ============================================================
//
// Interface placeholder for future OpenAI integration.
// No implementation — architecture only.

import type { OpenAIAnalysisResult } from '@/types/conversation-ai';

export interface IConversationOpenAIService {
  analyzeConversation(messages: { sender: string; content: string }[]): Promise<OpenAIAnalysisResult>;
  generateReply(context: { messages: { sender: string; content: string }[]; tone?: string }): Promise<{ reply: string; confidence: number }>;
  summarizeConversation(messages: { sender: string; content: string }[]): Promise<{ summary: string; key_points: string[] }>;
  qualifyLead(conversationData: unknown): Promise<{ budget: string; authority: string; need: string; timeline: string; score: number }>;
}

export class ConversationOpenAIService implements IConversationOpenAIService {
  async analyzeConversation(_messages: { sender: string; content: string }[]): Promise<OpenAIAnalysisResult> {
    throw new Error('ConversationOpenAIService.analyzeConversation() not implemented');
  }
  async generateReply(_context: { messages: { sender: string; content: string }[]; tone?: string }): Promise<{ reply: string; confidence: number }> {
    throw new Error('ConversationOpenAIService.generateReply() not implemented');
  }
  async summarizeConversation(_messages: { sender: string; content: string }[]): Promise<{ summary: string; key_points: string[] }> {
    throw new Error('ConversationOpenAIService.summarizeConversation() not implemented');
  }
  async qualifyLead(_conversationData: unknown): Promise<{ budget: string; authority: string; need: string; timeline: string; score: number }> {
    throw new Error('ConversationOpenAIService.qualifyLead() not implemented');
  }
}
