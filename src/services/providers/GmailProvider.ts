// ============================================================
// GmailProvider — Communication Provider Layer implementation for Gmail
// ============================================================
//
// Implements the ICommunicationProvider interface so that Gmail
// operations flow through the Communication Provider Layer:
//   CommunicationProviderManager → ProviderRegistry → GmailProvider
//   → GmailService → Edge Functions → Gmail API
//
// This provider delegates to the existing GmailService for all
// operations. It does NOT duplicate any logic — it is a thin adapter
// that makes GmailService conform to the provider interface.

import { gmailService } from '@/services/gmail';
import { googleOAuthService } from '@/services/google-auth';
import { supabase } from '@/lib/supabase';
import type {
  ProviderKey,
  ProviderContext,
  ProviderConnectionRecord,
  ConnectResult,
  RefreshResult,
  HealthCheckResult,
  SendMessageRequest,
  SendMessageResult,
  ScheduleMessageRequest,
  SearchMessagesRequest,
  SearchMessagesResult,
  ProviderThread,
  ProviderMessage,
  ProviderFolder,
  SyncResult,
  WebhookRegistration,
  WebhookProcessResult,
  ICommunicationProvider,
  ProviderDefinition,
} from '@/types/communication-providers';
import type {
  GmailConnectionState,
  GmailMessage,
  GmailThread,
  SendEmailParams,
  ReplyEmailParams,
  SearchParams,
  ConnectGmailResult,
  DisconnectGmailResult,
  ModifyMessageResult,
  GetAttachmentResult,
} from '@/types/gmail';

const GMAIL_DEFINITION: ProviderDefinition = {
  key: 'gmail' as ProviderKey,
  name: 'Gmail',
  type: 'email',
  authType: 'oauth',
  description: 'Send, receive, search, and manage Gmail messages',
  icon: 'mail',
  color: '#EA4335',
  priority: 1,
  isBuiltIn: true,
  capabilities: [
    'send_message', 'search_messages', 'get_thread', 'get_message',
    'sync', 'connect', 'disconnect', 'refresh', 'health_check', 'validate',
  ],
  defaultScopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
  ],
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  docsUrl: 'https://developers.google.com/gmail/api',
};

class GmailProvider implements ICommunicationProvider {
  providerKey: ProviderKey = 'gmail';
  providerName: string = 'Gmail';

  async initialize(workspaceId: string): Promise<ProviderConnectionRecord> {
    const { data: existing } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider_key', 'gmail')
      .maybeSingle();

    if (existing) return existing as ProviderConnectionRecord;

    const { data: provider } = await supabase
      .from('communication_providers')
      .select('id')
      .eq('provider_key', 'gmail')
      .maybeSingle();

    const { data: created, error } = await supabase
      .from('provider_connections')
      .insert({
        workspace_id: workspaceId,
        provider_id: provider?.id ?? '',
        provider_key: 'gmail',
        status: 'pending',
        connection_health: 'unknown',
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return created as ProviderConnectionRecord;
  }

  async connect(params: { workspaceId: string; connectionId: string; redirectUri?: string; scopes?: string[] }): Promise<ConnectResult> {
    const result = await gmailService.connect(params.workspaceId);

    if (result.connected) {
      await supabase
        .from('provider_connections')
        .update({ status: 'connected', connection_health: 'healthy' })
        .eq('id', params.connectionId);
    }

    return {
      connected: result.connected,
      connection_id: result.gmailAccountId ?? undefined,
      error: result.error,
    };
  }

  async disconnect(connectionId: string): Promise<void> {
    const { data: conn } = await supabase
      .from('provider_connections')
      .select('workspace_id')
      .eq('id', connectionId)
      .maybeSingle();

    if (conn) {
      const gmailState = await gmailService.getConnectionState(conn.workspace_id);
      if (gmailState.account) {
        await gmailService.disconnect(gmailState.account.id);
      }
    }
  }

  async refresh(connectionId: string): Promise<RefreshResult> {
    const { data: conn } = await supabase
      .from('provider_connections')
      .select('workspace_id')
      .eq('id', connectionId)
      .maybeSingle();

    if (!conn) {
      return { connection_id: connectionId, provider_key: 'gmail', refreshed: false, expires_at: null, error: 'Connection not found' };
    }

    const gmailState = await gmailService.getConnectionState(conn.workspace_id);
    if (!gmailState.account) {
      return { connection_id: connectionId, provider_key: 'gmail', refreshed: false, expires_at: null, error: 'Gmail not connected' };
    }

    const result = await gmailService.refresh(conn.workspace_id, gmailState.account.id);

    return {
      connection_id: connectionId,
      provider_key: 'gmail',
      refreshed: result.refreshed,
      expires_at: null,
      error: result.error,
    };
  }

  async healthCheck(connectionId: string): Promise<HealthCheckResult> {
    const { data: conn } = await supabase
      .from('provider_connections')
      .select('workspace_id')
      .eq('id', connectionId)
      .maybeSingle();

    if (!conn) {
      return {
        connection_id: connectionId,
        provider_key: 'gmail',
        healthy: false,
        health: 'error',
        latency_ms: null,
        status: 'disconnected',
        token_expired: false,
        token_expires_at: null,
        last_checked_at: new Date().toISOString(),
        errors: ['Connection not found.'],
      };
    }

    const gmailState = await gmailService.getConnectionState(conn.workspace_id);
    const healthy = gmailState.isConnected && !gmailState.needsReconnect;
    let health: 'healthy' | 'degraded' | 'expired' | 'error' | 'unknown' = 'healthy';
    if (!gmailState.isConnected) health = 'error';
    else if (gmailState.needsReconnect) health = 'degraded';

    return {
      connection_id: connectionId,
      provider_key: 'gmail',
      healthy,
      health,
      latency_ms: null,
      status: gmailState.isConnected ? 'connected' : 'disconnected',
      token_expired: false,
      token_expires_at: null,
      last_checked_at: new Date().toISOString(),
      errors: gmailState.needsReconnect ? ['Missing scopes'] : [],
    };
  }

  async validate(connectionId: string): Promise<boolean> {
    const { data: conn } = await supabase
      .from('provider_connections')
      .select('workspace_id')
      .eq('id', connectionId)
      .maybeSingle();

    if (!conn) return false;
    const state = await gmailService.getConnectionState(conn.workspace_id);
    return state.isConnected && !state.needsReconnect;
  }

  async sendMessage(ctx: ProviderContext, request: SendMessageRequest): Promise<SendMessageResult> {
    const result = await gmailService.sendEmail(ctx.workspaceId, {
      to: Array.isArray(request.to) ? request.to.join(', ') : request.to,
      subject: request.subject ?? '(no subject)',
      body: request.body,
      cc: Array.isArray(request.cc) ? request.cc.join(', ') : request.cc,
      bcc: Array.isArray(request.bcc) ? request.bcc.join(', ') : request.bcc,
    });

    return {
      message_id: result.messageId ?? '',
      thread_id: result.threadId ?? undefined,
      status: result.messageId ? 'success' : 'failure',
      provider_response: {},
    };
  }

  async scheduleMessage(_ctx: ProviderContext, _request: ScheduleMessageRequest): Promise<SendMessageResult> {
    throw new Error('Gmail does not support scheduled messages.');
  }

  async cancelMessage(_ctx: ProviderContext, _messageId: string): Promise<boolean> {
    throw new Error('Gmail does not support message cancellation.');
  }

  async searchMessages(ctx: ProviderContext, request: SearchMessagesRequest): Promise<SearchMessagesResult> {
    const gmailState = await gmailService.getConnectionState(ctx.workspaceId);
    if (!gmailState.account) {
      return { messages: [], next_cursor: null, total: 0 };
    }

    const messages = await gmailService.search(ctx.workspaceId, gmailState.account.id, {
      query: request.query ?? '',
      label: request.folder,
      maxResults: request.limit ?? 20,
    });

    const providerMessages: ProviderMessage[] = messages.map((m) => ({
      id: m.google_message_id,
      thread_id: m.thread_id,
      subject: m.subject,
      from: m.from_email ?? '',
      to: (m.to_email ?? '').split(', '),
      body: m.body_plain ?? m.snippet ?? '',
      snippet: m.snippet,
      received_at: m.received_at,
      sent_at: null,
      is_read: m.is_read,
      labels: m.label_ids,
    }));

    return {
      messages: providerMessages,
      next_cursor: null,
      total: providerMessages.length,
    };
  }

  async getThread(ctx: ProviderContext, threadId: string): Promise<ProviderThread> {
    const gmailState = await gmailService.getConnectionState(ctx.workspaceId);
    if (!gmailState.account) {
      throw new Error('Gmail not connected');
    }

    const { data: messages } = await supabase
      .from('gmail_messages')
      .select('*')
      .eq('gmail_account_id', gmailState.account.id)
      .eq('thread_id', threadId)
      .order('received_at', { ascending: true });

    const providerMessages: ProviderMessage[] = (messages ?? []).map((m: any) => ({
      id: m.google_message_id,
      thread_id: m.thread_id,
      subject: m.subject,
      from: m.from_email ?? '',
      to: (m.to_email ?? '').split(', '),
      body: m.body_plain ?? m.snippet ?? '',
      snippet: m.snippet,
      received_at: m.received_at,
      sent_at: null,
      is_read: m.is_read,
      labels: m.label_ids,
    }));

    return {
      id: threadId,
      subject: providerMessages[0]?.subject ?? null,
      messages: providerMessages,
      snippet: providerMessages[0]?.snippet ?? null,
      participant_count: new Set(providerMessages.flatMap((m) => [m.from, ...m.to])).size,
      last_message_at: providerMessages[providerMessages.length - 1]?.received_at ?? null,
    };
  }

  async getMessage(_ctx: ProviderContext, messageId: string): Promise<ProviderMessage> {
    const { data: msg } = await supabase
      .from('gmail_messages')
      .select('*')
      .eq('google_message_id', messageId)
      .maybeSingle();

    if (!msg) throw new Error('Message not found');

    return {
      id: msg.google_message_id,
      thread_id: msg.thread_id,
      subject: msg.subject,
      from: msg.from_email ?? '',
      to: (msg.to_email ?? '').split(', '),
      body: msg.body_plain ?? msg.snippet ?? '',
      snippet: msg.snippet,
      received_at: msg.received_at,
      sent_at: null,
      is_read: msg.is_read,
      labels: msg.label_ids,
    };
  }

  async listFolders(ctx: ProviderContext): Promise<ProviderFolder[]> {
    return [
      { id: 'INBOX', name: 'Inbox', type: 'inbox', unread_count: 0, total_count: 0 },
      { id: 'SENT', name: 'Sent', type: 'sent', unread_count: 0, total_count: 0 },
      { id: 'DRAFT', name: 'Drafts', type: 'drafts', unread_count: 0, total_count: 0 },
      { id: 'STARRED', name: 'Starred', type: 'starred', unread_count: 0, total_count: 0 },
    ];
  }

  async sync(ctx: ProviderContext, cursor?: string): Promise<SyncResult> {
    const gmailState = await gmailService.getConnectionState(ctx.workspaceId);
    if (!gmailState.account) {
      return {
        connection_id: ctx.connectionId,
        provider_key: 'gmail',
        synced: false,
        new_messages: 0,
        updated_messages: 0,
        sync_cursor: null,
        last_sync: new Date().toISOString(),
        error: 'Gmail not connected',
      };
    }

    const result = await gmailService.syncInbox(ctx.workspaceId, gmailState.account.id, cursor);

    return {
      connection_id: ctx.connectionId,
      provider_key: 'gmail',
      synced: result.synced > 0,
      new_messages: result.synced,
      updated_messages: 0,
      sync_cursor: result.nextPageToken,
      last_sync: new Date().toISOString(),
      error: result.errors > 0 ? 'Some errors during sync' : null,
    };
  }

  async registerWebhook(_ctx: ProviderContext, _events: string[]): Promise<WebhookRegistration> {
    // Gmail push notifications require Google Pub/Sub setup — not yet implemented
    throw new Error('Gmail webhook registration not yet supported.');
  }

  async processWebhook(_ctx: ProviderContext, _payload: Record<string, unknown>): Promise<WebhookProcessResult> {
    throw new Error('Gmail webhook processing not yet supported.');
  }

  // ----------------------------------------------------------
  // Gmail-Specific Operations
  // ----------------------------------------------------------

  async getConnectionState(workspaceId: string): Promise<GmailConnectionState> {
    return gmailService.getConnectionState(workspaceId);
  }

  async getMessages(gmailAccountId: string, options?: {
    label?: string;
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    includeArchived?: boolean;
  }): Promise<GmailMessage[]> {
    return gmailService.getMessages(gmailAccountId, options);
  }

  async getThreads(gmailAccountId: string, limit?: number): Promise<GmailThread[]> {
    return gmailService.getThreads(gmailAccountId, limit);
  }

  async connectGmail(workspaceId: string): Promise<ConnectGmailResult> {
    return gmailService.connect(workspaceId);
  }

  async disconnectGmail(gmailAccountId: string): Promise<DisconnectGmailResult> {
    return gmailService.disconnect(gmailAccountId);
  }

  async syncInbox(workspaceId: string, gmailAccountId: string, pageToken?: string): Promise<import('@/types/gmail').SyncResult> {
    return gmailService.syncInbox(workspaceId, gmailAccountId, pageToken);
  }

  async syncSent(workspaceId: string, gmailAccountId: string, pageToken?: string): Promise<import('@/types/gmail').SyncResult> {
    return gmailService.syncSent(workspaceId, gmailAccountId, pageToken);
  }

  async syncDrafts(workspaceId: string, gmailAccountId: string, pageToken?: string): Promise<import('@/types/gmail').SyncResult> {
    return gmailService.syncDrafts(workspaceId, gmailAccountId, pageToken);
  }

  async incrementalSync(workspaceId: string, gmailAccountId: string): Promise<import('@/types/gmail').SyncResult> {
    return gmailService.incrementalSync(workspaceId, gmailAccountId);
  }

  async searchGmail(workspaceId: string, gmailAccountId: string, params: SearchParams): Promise<GmailMessage[]> {
    return gmailService.search(workspaceId, gmailAccountId, params);
  }

  async sendEmail(workspaceId: string, params: SendEmailParams): Promise<{ messageId: string | null; threadId: string | null }> {
    return gmailService.sendEmail(workspaceId, params);
  }

  async replyEmail(workspaceId: string, params: ReplyEmailParams): Promise<{ messageId: string | null; threadId: string | null }> {
    return gmailService.replyEmail(workspaceId, params);
  }

  async markAsRead(workspaceId: string, gmailAccountId: string, googleMessageId: string): Promise<ModifyMessageResult> {
    return gmailService.markAsRead(workspaceId, gmailAccountId, googleMessageId);
  }

  async markAsUnread(workspaceId: string, gmailAccountId: string, googleMessageId: string): Promise<ModifyMessageResult> {
    return gmailService.markAsUnread(workspaceId, gmailAccountId, googleMessageId);
  }

  async star(workspaceId: string, gmailAccountId: string, googleMessageId: string): Promise<ModifyMessageResult> {
    return gmailService.star(workspaceId, gmailAccountId, googleMessageId);
  }

  async unstar(workspaceId: string, gmailAccountId: string, googleMessageId: string): Promise<ModifyMessageResult> {
    return gmailService.unstar(workspaceId, gmailAccountId, googleMessageId);
  }

  async archive(workspaceId: string, gmailAccountId: string, googleMessageId: string): Promise<ModifyMessageResult> {
    return gmailService.archive(workspaceId, gmailAccountId, googleMessageId);
  }

  async unarchive(workspaceId: string, gmailAccountId: string, googleMessageId: string): Promise<ModifyMessageResult> {
    return gmailService.unarchive(workspaceId, gmailAccountId, googleMessageId);
  }

  async getAttachment(workspaceId: string, googleMessageId: string, attachmentId: string): Promise<GetAttachmentResult> {
    return gmailService.getAttachment(workspaceId, googleMessageId, attachmentId);
  }

  async refreshGmail(workspaceId: string, gmailAccountId: string): Promise<import('@/types/gmail').RefreshResult> {
    return gmailService.refresh(workspaceId, gmailAccountId);
  }

  validateScopes(grantedScopes: string[]): { valid: boolean; missing: string[] } {
    return gmailService.validateScopes(grantedScopes);
  }

  getRequiredScopes(): string[] {
    return gmailService.getRequiredScopes();
  }
}

export const gmailProvider = new GmailProvider();
export { GMAIL_DEFINITION };
