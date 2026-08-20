// ============================================================
// Google OAuth — Type Definitions
// ============================================================

// ============================================================
// OAuth Scopes
// ============================================================

export const GOOGLE_SCOPES = {
  OPENID: 'openid',
  EMAIL: 'https://www.googleapis.com/auth/userinfo.email',
  PROFILE: 'https://www.googleapis.com/auth/userinfo.profile',
  GMAIL_READONLY: 'https://www.googleapis.com/auth/gmail.readonly',
  GMAIL_SEND: 'https://www.googleapis.com/auth/gmail.send',
  CALENDAR: 'https://www.googleapis.com/auth/calendar',
  CALENDAR_EVENTS: 'https://www.googleapis.com/auth/calendar.events',
  DRIVE_READONLY: 'https://www.googleapis.com/auth/drive.readonly',
  CONTACTS_READONLY: 'https://www.googleapis.com/auth/contacts.readonly',
} as const;

export const DEFAULT_GOOGLE_SCOPES: string[] = [
  GOOGLE_SCOPES.OPENID,
  GOOGLE_SCOPES.EMAIL,
  GOOGLE_SCOPES.PROFILE,
  GOOGLE_SCOPES.GMAIL_READONLY,
  GOOGLE_SCOPES.GMAIL_SEND,
  GOOGLE_SCOPES.CALENDAR,
  GOOGLE_SCOPES.CALENDAR_EVENTS,
];

export const SCOPE_LABELS: Record<string, string> = {
  'openid': 'Sign-in',
  'https://www.googleapis.com/auth/userinfo.email': 'View email address',
  'https://www.googleapis.com/auth/userinfo.profile': 'View profile info',
  'https://www.googleapis.com/auth/gmail.readonly': 'Read Gmail messages',
  'https://www.googleapis.com/auth/gmail.send': 'Send Gmail messages',
  'https://www.googleapis.com/auth/calendar': 'Manage Google Calendar',
  'https://www.googleapis.com/auth/calendar.events': 'Manage calendar events',
  'https://www.googleapis.com/auth/drive.readonly': 'View Google Drive files',
  'https://www.googleapis.com/auth/contacts.readonly': 'View Google Contacts',
};

// ============================================================
// Account Status
// ============================================================

export type GoogleAccountStatus = 'connected' | 'disconnected' | 'expired' | 'error' | 'revoked';

// ============================================================
// Entity Types
// ============================================================

export type GoogleAccount = {
  id: string;
  workspace_id: string;
  user_id: string;
  google_user_id: string;
  email: string;
  display_name: string | null;
  avatar: string | null;
  is_primary: boolean;
  status: GoogleAccountStatus;
  connected_at: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OAuthToken = {
  id: string;
  google_account_id: string;
  provider: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
  token_type: string;
  created_at: string;
  updated_at: string;
};

export type IntegrationStatusRecord = {
  id: string;
  workspace_id: string;
  integration: string;
  status: 'connected' | 'disconnected' | 'expired' | 'error' | 'refreshing';
  last_check: string | null;
  last_error: string | null;
  connected_account: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================================
// Composite Types
// ============================================================

export type GoogleAccountWithToken = GoogleAccount & {
  token: OAuthToken | null;
};

export type GoogleConnectionState = {
  account: GoogleAccount | null;
  token: OAuthToken | null;
  isExpired: boolean;
  isRefreshing: boolean;
  hasError: boolean;
  needsReconnect: boolean;
};

// ============================================================
// Service Result Types
// ============================================================

export type ConnectGoogleResult = {
  authUrl: string;
  state: string;
};

export type CallbackResult = {
  success: boolean;
  accountId: string | null;
  error: string | null;
};

export type RefreshTokenResult = {
  refreshed: boolean;
  expires_at: string | null;
};

export type DisconnectResult = {
  disconnected: boolean;
};

export type SetPrimaryResult = {
  updated: boolean;
};

export type ValidateScopesResult = {
  valid: boolean;
  missing: string[];
  granted: string[];
};
