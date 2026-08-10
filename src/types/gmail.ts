// ============================================================
// Gmail Integration — Type Definitions
// ============================================================

export type GmailSyncStatus = 'idle' | 'syncing' | 'error';

export type GmailAccount = {
  id: string;
  workspace_id: string;
  google_account_id: string;
  email: string;
  history_id: string | null;
  sync_status: GmailSyncStatus;
  last_synced_at: string | null;
  next_page_token: string | null;
  full_sync_completed: boolean;
  last_history_id: string | null;
  sync_error: string | null;
  sync_retry_count: number;
  created_at: string;
  updated_at: string;
};

export type GmailAttachment = {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
};

export type GmailMessage = {
  id: string;
  gmail_account_id: string;
  google_message_id: string;
  thread_id: string | null;
  subject: string | null;
  from_email: string | null;
  to_email: string | null;
  snippet: string | null;
  label_ids: string[];
  received_at: string | null;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  message_id_header: string | null;
  in_reply_to: string | null;
  references_header: string | null;
  body_html: string | null;
  body_plain: string | null;
  has_attachments: boolean;
  attachments: GmailAttachment[];
  created_at: string;
};

export type GmailThread = {
  id: string;
  gmail_account_id: string;
  google_thread_id: string;
  subject: string | null;
  participants: string[];
  last_message_at: string | null;
  message_count: number;
  last_message_snippet: string | null;
  created_at: string;
};

export type GmailAttachmentMetadata = {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
};

export type SendEmailParams = {
  to: string;
  subject: string;
  body: string;
  html?: string;
  cc?: string;
  bcc?: string;
};

export type ReplyEmailParams = {
  threadId: string;
  to: string;
  subject: string;
  body: string;
  html?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
};

export type SearchParams = {
  query: string;
  label?: string;
  maxResults?: number;
};

export type SyncResult = {
  synced: number;
  errors: number;
  historyId: string | null;
  nextPageToken: string | null;
  hasMore: boolean;
};

export type ConnectGmailResult = {
  connected: boolean;
  gmailAccountId: string | null;
  error: string | null;
};

export type DisconnectGmailResult = {
  disconnected: boolean;
};

export type RefreshResult = {
  refreshed: boolean;
  unreadCount: number;
  error: string | null;
};

export type GmailConnectionState = {
  account: GmailAccount | null;
  isConnected: boolean;
  unreadCount: number;
  inboxCount: number;
  lastSync: string | null;
  syncStatus: GmailSyncStatus;
  needsReconnect: boolean;
  missingScopes: string[];
};

export type ModifyMessageResult = {
  success: boolean;
  error: string | null;
};

export type GetAttachmentResult = {
  data: string | null;
  size: number;
  mimeType: string;
  error: string | null;
};
