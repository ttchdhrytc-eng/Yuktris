// ============================================================
// Google Workspace Integration — Type Definitions
// ============================================================

import type { GoogleAccount, OAuthToken } from './google-auth';

// ============================================================
// Workspace Services
// ============================================================

export type GoogleWorkspaceServiceId = 'gmail' | 'calendar' | 'meet' | 'contacts' | 'drive';

export const WORKSPACE_SERVICES: {
  id: GoogleWorkspaceServiceId;
  label: string;
  description: string;
  scopes: string[];
  icon: string;
}[] = [
  {
    id: 'gmail',
    label: 'Gmail',
    description: 'Read, send, search, and manage email messages',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
    ],
    icon: 'mail',
  },
  {
    id: 'calendar',
    label: 'Google Calendar',
    description: 'View and manage calendar events',
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    icon: 'calendar',
  },
  {
    id: 'meet',
    label: 'Google Meet',
    description: 'Create and join video conference meetings',
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    icon: 'video',
  },
  {
    id: 'contacts',
    label: 'Google Contacts',
    description: 'View and manage contact information',
    scopes: ['https://www.googleapis.com/auth/contacts.readonly'],
    icon: 'users',
  },
  {
    id: 'drive',
    label: 'Google Drive',
    description: 'View and manage files in Google Drive',
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    icon: 'folder',
  },
];

// ============================================================
// Connection Health
// ============================================================

export type ConnectionHealth = 'healthy' | 'degraded' | 'expired' | 'error' | 'unknown';

export type HealthCheckResult = {
  healthy: boolean;
  health: ConnectionHealth;
  services: Record<GoogleWorkspaceServiceId, boolean>;
  tokenExpired: boolean;
  tokenExpiresAt: string | null;
  lastCheckedAt: string;
  errors: string[];
};

// ============================================================
// Database Entities
// ============================================================

export type GoogleWorkspaceRecord = {
  id: string;
  workspace_id: string;
  google_account_id: string;
  gmail_enabled: boolean;
  calendar_enabled: boolean;
  meet_enabled: boolean;
  contacts_enabled: boolean;
  drive_enabled: boolean;
  connection_health: ConnectionHealth;
  last_health_check: string | null;
  created_at: string;
  updated_at: string;
};

export type GooglePermissionRecord = {
  id: string;
  google_workspace_id: string;
  scope: string;
  granted: boolean;
  last_checked: string | null;
};

// ============================================================
// Composite View Models
// ============================================================

export type GoogleWorkspaceState = {
  workspace: GoogleWorkspaceRecord | null;
  account: GoogleAccount | null;
  token: OAuthToken | null;
  permissions: GooglePermissionRecord[];
  services: Record<GoogleWorkspaceServiceId, boolean>;
  grantedScopes: string[];
  missingScopes: string[];
  isExpired: boolean;
  needsReconnect: boolean;
  health: ConnectionHealth;
  lastHealthCheck: string | null;
  tokenExpiresAt: string | null;
};

export type ScopeCheckResult = {
  serviceId: GoogleWorkspaceServiceId;
  granted: boolean;
  missingScopes: string[];
};

export type RequestScopesResult = {
  authUrl: string;
  state: string;
};

export type RefreshWorkspaceResult = {
  refreshed: boolean;
  expiresAt: string | null;
  error: string | null;
};
