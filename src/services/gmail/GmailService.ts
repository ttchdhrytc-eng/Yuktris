// ============================================================
// Gmail Service — Gmail API Integration
// Routes through the Communication Provider Layer.
// Uses GoogleApiClient for all Google API calls.
// Reuses existing Google OAuth tokens and accounts.
// ============================================================

import { supabase } from '@/lib/supabase';
import { googleOAuthService } from '@/services/google-auth';
import { googleApiClient } from '@/services/google-auth';
import { GOOGLE_SCOPES } from '@/types/google-auth';
import type {
  GmailAccount,
  GmailMessage,
  GmailThread,
  GmailConnectionState,
  SendEmailParams,
  ReplyEmailParams,
  SearchParams,
  SyncResult,
  ConnectGmailResult,
  DisconnectGmailResult,
  RefreshResult,
  ModifyMessageResult,
  GetAttachmentResult,
} from '@/types/gmail';

const GMAIL_SCOPES = [
  GOOGLE_SCOPES.GMAIL_READONLY,
  GOOGLE_SCOPES.GMAIL_SEND,
];

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

function getFunctionUrl(slug: string): string {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${baseUrl}/functions/v1/${slug}`;
}

function getAuthHeaders(): Record<string, string> {
  const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

async function getAuthToken(workspaceId: string): Promise<{ accessToken: string; googleAccountId: string } | null> {
  // Query for connected OR expired accounts — expired accounts can still be refreshed
  const { data: connection } = await supabase
    .from('google_accounts')
    .select('id, status')
    .eq('workspace_id', workspaceId)
    .eq('is_primary', true)
    .in('status', ['connected', 'expired'])
    .maybeSingle();

  if (!connection) return null;

  const { data: token } = await supabase
    .from('oauth_tokens')
    .select('access_token, expires_at, refresh_token')
    .eq('google_account_id', connection.id)
    .maybeSingle();

  if (!token?.access_token && !token?.refresh_token) return null;

  const isExpired = token.expires_at ? new Date(token.expires_at) <= new Date() : false;

  if (isExpired && token.refresh_token) {
    // Attempt auto-recovery for expired accounts
    await googleOAuthService.refreshToken(connection.id);
    const { data: refreshed } = await supabase
      .from('oauth_tokens')
      .select('access_token')
      .eq('google_account_id', connection.id)
      .maybeSingle();
    if (refreshed?.access_token) {
      return { accessToken: refreshed.access_token, googleAccountId: connection.id };
    }
    return null;
  }

  if (!token.access_token) return null;

  return { accessToken: token.access_token, googleAccountId: connection.id };
}

class GmailService {
  // ============================================================
  // Connection Management
  // ============================================================

  async connect(workspaceId: string): Promise<ConnectGmailResult> {
    const auth = await getAuthToken(workspaceId);
    if (!auth) {
      return { connected: false, gmailAccountId: null, error: 'No connected Google account found. Connect Google first.' };
    }

    const { data: googleAccount } = await supabase
      .from('google_accounts')
      .select('email')
      .eq('id', auth.googleAccountId)
      .maybeSingle();

    if (!googleAccount?.email) {
      return { connected: false, gmailAccountId: null, error: 'Could not determine Google account email.' };
    }

    const { data: existing } = await supabase
      .from('gmail_accounts')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('google_account_id', auth.googleAccountId)
      .maybeSingle();

    if (existing) {
      return { connected: true, gmailAccountId: existing.id, error: null };
    }

    const { data, error } = await supabase
      .from('gmail_accounts')
      .insert({
        workspace_id: workspaceId,
        google_account_id: auth.googleAccountId,
        email: googleAccount.email,
        sync_status: 'idle',
      })
      .select('id')
      .single();

    if (error || !data) {
      return { connected: false, gmailAccountId: null, error: error?.message ?? 'Failed to create Gmail account record.' };
    }

    return { connected: true, gmailAccountId: data.id, error: null };
  }

  async disconnect(gmailAccountId: string): Promise<DisconnectGmailResult> {
    const { error } = await supabase
      .from('gmail_accounts')
      .delete()
      .eq('id', gmailAccountId);

    if (error) throw new Error(error.message);
    return { disconnected: true };
  }

  async getConnectionState(workspaceId: string): Promise<GmailConnectionState> {
    const { data: gmailAccount } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (!gmailAccount) {
      const { data: primaryAccount } = await supabase
        .from('google_accounts')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('is_primary', true)
        .maybeSingle();

      const { data: token } = await supabase
        .from('oauth_tokens')
        .select('scope')
        .eq('google_account_id', primaryAccount?.id ?? '')
        .maybeSingle();

      const grantedScopes = token?.scope?.split(' ') ?? [];
      const missingScopes = GMAIL_SCOPES.filter((s) => !grantedScopes.includes(s));

      return {
        account: null,
        isConnected: false,
        unreadCount: 0,
        inboxCount: 0,
        lastSync: null,
        syncStatus: 'idle',
        needsReconnect: false,
        missingScopes,
      };
    }

    const { count: inboxCount } = await supabase
      .from('gmail_messages')
      .select('id', { count: 'exact', head: true })
      .eq('gmail_account_id', gmailAccount.id);

    const { count: unreadCount } = await supabase
      .from('gmail_messages')
      .select('id', { count: 'exact', head: true })
      .eq('gmail_account_id', gmailAccount.id)
      .eq('is_read', false);

    const { data: token } = await supabase
      .from('oauth_tokens')
      .select('scope')
      .eq('google_account_id', gmailAccount.google_account_id)
      .maybeSingle();

    const grantedScopes = token?.scope?.split(' ') ?? [];
    const missingScopes = GMAIL_SCOPES.filter((s) => !grantedScopes.includes(s));

    return {
      account: gmailAccount as GmailAccount,
      isConnected: true,
      unreadCount: unreadCount ?? 0,
      inboxCount: inboxCount ?? 0,
      lastSync: gmailAccount.last_synced_at,
      syncStatus: gmailAccount.sync_status as GmailConnectionState['syncStatus'],
      needsReconnect: missingScopes.length > 0,
      missingScopes,
    };
  }

  // ============================================================
  // Sync Operations (via edge functions)
  // ============================================================

  async syncInbox(workspaceId: string, gmailAccountId: string, pageToken?: string): Promise<SyncResult> {
    const auth = await getAuthToken(workspaceId);
    if (!auth) throw new Error('No valid Google token. Please reconnect your Google account.');

    const response = await fetch(getFunctionUrl('gmail-sync'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        action: 'sync_inbox',
        accessToken: auth.accessToken,
        gmailAccountId,
        workspaceId,
        pageToken,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error ?? `Sync failed (${response.status})`);
    }

    const data = await response.json();
    return {
      synced: data.synced ?? 0,
      errors: data.errors ?? 0,
      historyId: data.historyId ?? null,
      nextPageToken: data.nextPageToken ?? null,
      hasMore: data.hasMore ?? false,
    };
  }

  async syncSent(workspaceId: string, gmailAccountId: string, pageToken?: string): Promise<SyncResult> {
    const auth = await getAuthToken(workspaceId);
    if (!auth) throw new Error('No valid Google token. Please reconnect your Google account.');

    const response = await fetch(getFunctionUrl('gmail-sync'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        action: 'sync_sent',
        accessToken: auth.accessToken,
        gmailAccountId,
        workspaceId,
        pageToken,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error ?? `Sync failed (${response.status})`);
    }

    const data = await response.json();
    return {
      synced: data.synced ?? 0,
      errors: data.errors ?? 0,
      historyId: data.historyId ?? null,
      nextPageToken: data.nextPageToken ?? null,
      hasMore: data.hasMore ?? false,
    };
  }

  async syncDrafts(workspaceId: string, gmailAccountId: string, pageToken?: string): Promise<SyncResult> {
    const auth = await getAuthToken(workspaceId);
    if (!auth) throw new Error('No valid Google token. Please reconnect your Google account.');

    const response = await fetch(getFunctionUrl('gmail-sync'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        action: 'sync_drafts',
        accessToken: auth.accessToken,
        gmailAccountId,
        workspaceId,
        pageToken,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error ?? `Sync failed (${response.status})`);
    }

    const data = await response.json();
    return {
      synced: data.synced ?? 0,
      errors: data.errors ?? 0,
      historyId: data.historyId ?? null,
      nextPageToken: data.nextPageToken ?? null,
      hasMore: data.hasMore ?? false,
    };
  }

  async incrementalSync(workspaceId: string, gmailAccountId: string): Promise<SyncResult> {
    const auth = await getAuthToken(workspaceId);
    if (!auth) throw new Error('No valid Google token. Please reconnect your Google account.');

    const response = await fetch(getFunctionUrl('gmail-sync'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        action: 'incremental',
        accessToken: auth.accessToken,
        gmailAccountId,
        workspaceId,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error ?? `Incremental sync failed (${response.status})`);
    }

    const data = await response.json();
    return {
      synced: data.synced ?? 0,
      errors: data.errors ?? 0,
      historyId: data.historyId ?? null,
      nextPageToken: data.nextPageToken ?? null,
      hasMore: data.hasMore ?? false,
    };
  }

  // ============================================================
  // Read Operations
  // ============================================================

  async getMessages(gmailAccountId: string, options?: {
    label?: string;
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    includeArchived?: boolean;
  }): Promise<GmailMessage[]> {
    let query = supabase
      .from('gmail_messages')
      .select('*')
      .eq('gmail_account_id', gmailAccountId)
      .order('received_at', { ascending: false })
      .limit(options?.limit ?? 50);

    if (options?.offset) query = query.range(options.offset, options.offset + (options?.limit ?? 50) - 1);
    if (options?.unreadOnly) query = query.eq('is_read', false);
    if (!options?.includeArchived) query = query.eq('is_archived', false);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as GmailMessage[];
  }

  async getThreads(gmailAccountId: string, limit?: number): Promise<GmailThread[]> {
    const { data, error } = await supabase
      .from('gmail_threads')
      .select('*')
      .eq('gmail_account_id', gmailAccountId)
      .order('last_message_at', { ascending: false })
      .limit(limit ?? 50);

    if (error) throw new Error(error.message);
    return (data ?? []) as GmailThread[];
  }

  async search(workspaceId: string, gmailAccountId: string, params: SearchParams): Promise<GmailMessage[]> {
    const auth = await getAuthToken(workspaceId);
    if (!auth) throw new Error('No valid Google token. Please reconnect your Google account.');

    const response = await fetch(getFunctionUrl('gmail-search'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        accessToken: auth.accessToken,
        query: params.query,
        label: params.label,
        maxResults: params.maxResults ?? 20,
        gmailAccountId,
        workspaceId,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error ?? `Search failed (${response.status})`);
    }

    const data = await response.json();
    return (data.messages ?? []) as GmailMessage[];
  }

  // ============================================================
  // Send / Reply (via edge function)
  // ============================================================

  async sendEmail(workspaceId: string, params: SendEmailParams): Promise<{ messageId: string | null; threadId: string | null }> {
    const auth = await getAuthToken(workspaceId);
    if (!auth) throw new Error('No valid Google token. Please reconnect your Google account.');

    const gmailConnection = await this.getConnectionState(workspaceId);
    const gmailAccountId = gmailConnection.account?.id;

    const response = await fetch(getFunctionUrl('gmail-send'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        action: 'send',
        accessToken: auth.accessToken,
        to: params.to,
        subject: params.subject,
        body: params.body,
        html: params.html,
        cc: params.cc,
        bcc: params.bcc,
        gmailAccountId,
        workspaceId,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error ?? `Send failed (${response.status})`);
    }

    const data = await response.json();
    return { messageId: data.messageId ?? null, threadId: data.threadId ?? null };
  }

  async replyEmail(workspaceId: string, params: ReplyEmailParams): Promise<{ messageId: string | null; threadId: string | null }> {
    const auth = await getAuthToken(workspaceId);
    if (!auth) throw new Error('No valid Google token. Please reconnect your Google account.');

    const gmailConnection = await this.getConnectionState(workspaceId);
    const gmailAccountId = gmailConnection.account?.id;

    // Fetch the original message's Message-ID header for proper threading
    let originalMessageId = params.messageId ?? params.inReplyTo ?? null;
    let inReplyTo = params.inReplyTo ?? null;
    let references = params.references ?? null;

    if (!inReplyTo && params.threadId) {
      // Look up the original message from the database to get its Message-ID header
      const { data: originalMsg } = await supabase
        .from('gmail_messages')
        .select('message_id_header, in_reply_to, references_header')
        .eq('thread_id', params.threadId)
        .order('received_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (originalMsg?.message_id_header) {
        inReplyTo = originalMsg.message_id_header;
        originalMessageId = originalMsg.message_id_header;
        references = originalMsg.references_header
          ? `${originalMsg.references_header} ${originalMsg.message_id_header}`
          : originalMsg.message_id_header;
      }
    }

    const response = await fetch(getFunctionUrl('gmail-send'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        action: 'reply',
        accessToken: auth.accessToken,
        threadId: params.threadId,
        to: params.to,
        subject: params.subject,
        body: params.body,
        html: params.html,
        messageId: originalMessageId,
        inReplyTo,
        references,
        gmailAccountId,
        workspaceId,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error ?? `Reply failed (${response.status})`);
    }

    const data = await response.json();
    return { messageId: data.messageId ?? null, threadId: data.threadId ?? null };
  }

  // ============================================================
  // Modify Operations — now sync to Gmail API AND Supabase
  // ============================================================

  private async modifyMessage(workspaceId: string, gmailAccountId: string, googleMessageId: string, addLabels: string[], removeLabels: string[]): Promise<ModifyMessageResult> {
    const auth = await getAuthToken(workspaceId);
    if (!auth) throw new Error('No valid Google token. Please reconnect your Google account.');

    const response = await fetch(getFunctionUrl('gmail-sync'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        action: 'modify_labels',
        accessToken: auth.accessToken,
        gmailAccountId,
        workspaceId,
        messageId: googleMessageId,
        addLabels,
        removeLabels,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { success: false, error: err.error ?? `Modify failed (${response.status})` };
    }

    const data = await response.json();
    return { success: data.success ?? false, error: null };
  }

  async markAsRead(workspaceId: string, gmailAccountId: string, googleMessageId: string): Promise<ModifyMessageResult> {
    const result = await this.modifyMessage(workspaceId, gmailAccountId, googleMessageId, [], ['UNREAD']);
    if (result.success) {
      await supabase
        .from('gmail_messages')
        .update({ is_read: true })
        .eq('google_message_id', googleMessageId)
        .eq('gmail_account_id', gmailAccountId);
    }
    return result;
  }

  async markAsUnread(workspaceId: string, gmailAccountId: string, googleMessageId: string): Promise<ModifyMessageResult> {
    const result = await this.modifyMessage(workspaceId, gmailAccountId, googleMessageId, ['UNREAD'], []);
    if (result.success) {
      await supabase
        .from('gmail_messages')
        .update({ is_read: false })
        .eq('google_message_id', googleMessageId)
        .eq('gmail_account_id', gmailAccountId);
    }
    return result;
  }

  async star(workspaceId: string, gmailAccountId: string, googleMessageId: string): Promise<ModifyMessageResult> {
    const result = await this.modifyMessage(workspaceId, gmailAccountId, googleMessageId, ['STARRED'], []);
    if (result.success) {
      await supabase
        .from('gmail_messages')
        .update({ is_starred: true })
        .eq('google_message_id', googleMessageId)
        .eq('gmail_account_id', gmailAccountId);
    }
    return result;
  }

  async unstar(workspaceId: string, gmailAccountId: string, googleMessageId: string): Promise<ModifyMessageResult> {
    const result = await this.modifyMessage(workspaceId, gmailAccountId, googleMessageId, [], ['STARRED']);
    if (result.success) {
      await supabase
        .from('gmail_messages')
        .update({ is_starred: false })
        .eq('google_message_id', googleMessageId)
        .eq('gmail_account_id', gmailAccountId);
    }
    return result;
  }

  async archive(workspaceId: string, gmailAccountId: string, googleMessageId: string): Promise<ModifyMessageResult> {
    // Remove INBOX label from Gmail — never delete the database row
    const result = await this.modifyMessage(workspaceId, gmailAccountId, googleMessageId, [], ['INBOX']);
    if (result.success) {
      await supabase
        .from('gmail_messages')
        .update({ is_archived: true })
        .eq('google_message_id', googleMessageId)
        .eq('gmail_account_id', gmailAccountId);
    }
    return result;
  }

  async unarchive(workspaceId: string, gmailAccountId: string, googleMessageId: string): Promise<ModifyMessageResult> {
    // Add INBOX label back
    const result = await this.modifyMessage(workspaceId, gmailAccountId, googleMessageId, ['INBOX'], []);
    if (result.success) {
      await supabase
        .from('gmail_messages')
        .update({ is_archived: false })
        .eq('google_message_id', googleMessageId)
        .eq('gmail_account_id', gmailAccountId);
    }
    return result;
  }

  // ============================================================
  // Attachments
  // ============================================================

  async getAttachment(workspaceId: string, googleMessageId: string, attachmentId: string): Promise<GetAttachmentResult> {
    const auth = await getAuthToken(workspaceId);
    if (!auth) throw new Error('No valid Google token. Please reconnect your Google account.');

    const url = `${GMAIL_API_BASE}/messages/${googleMessageId}/attachments/${attachmentId}`;
    const response = await googleApiClient.get<{ data?: string; size?: number; mimeType?: string }>(
      url,
      auth.accessToken,
      'gmail-attachment',
    );

    if (!response.ok || !response.data) {
      return { data: null, size: 0, mimeType: '', error: response.error?.message ?? 'Failed to fetch attachment' };
    }

    return {
      data: response.data.data ?? null,
      size: response.data.size ?? 0,
      mimeType: response.data.mimeType ?? 'application/octet-stream',
      error: null,
    };
  }

  // ============================================================
  // Refresh — incremental sync via edge function
  // ============================================================

  async refresh(workspaceId: string, gmailAccountId: string): Promise<RefreshResult> {
    const auth = await getAuthToken(workspaceId);
    if (!auth) throw new Error('No valid Google token. Please reconnect your Google account.');

    const response = await fetch(getFunctionUrl('gmail-refresh'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        accessToken: auth.accessToken,
        gmailAccountId,
        workspaceId,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error ?? `Refresh failed (${response.status})`);
    }

    const data = await response.json();
    return {
      refreshed: data.refreshed ?? false,
      unreadCount: data.unreadCount ?? 0,
      error: data.error ?? null,
    };
  }

  // ============================================================
  // Scope validation
  // ============================================================

  validateScopes(grantedScopes: string[]): { valid: boolean; missing: string[] } {
    const missing = GMAIL_SCOPES.filter((s) => !grantedScopes.includes(s));
    return { valid: missing.length === 0, missing };
  }

  getRequiredScopes(): string[] {
    return [...GMAIL_SCOPES];
  }
}

export const gmailService = new GmailService();
