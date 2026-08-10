// ============================================================
// Integration Hub — Type Definitions
// ============================================================

// ============================================================
// Provider Identity
// ============================================================

export type ProviderId =
  | 'google'
  | 'linkedin'
  | 'openai'
  | 'firecrawl'
  | 'tavily'
  | 'hubspot'
  | 'salesforce'
  | 'slack'
  | 'zoom'
  | 'pipedrive'
  | 'microsoft365'
  | 'outlook'
  | 'n8n'
  | 'paddle';

export type ProviderType = 'oauth' | 'api_key' | 'webhook' | 'service';

export type IntegrationStatus =
  | 'connected'
  | 'disconnected'
  | 'expired'
  | 'error'
  | 'pending';

export type ConnectionHealth =
  | 'healthy'
  | 'degraded'
  | 'expired'
  | 'error'
  | 'unknown';

export type LogEvent =
  | 'connect'
  | 'disconnect'
  | 'reconnect'
  | 'refresh'
  | 'sync'
  | 'health_check'
  | 'permission_change'
  | 'error'
  | 'retry'
  | 'rate_limit'
  | 'recovery';

export type LogStatus = 'success' | 'failure' | 'warning' | 'info';

// ============================================================
// Provider Metadata (static definition, not stored in DB)
// ============================================================

export type ProviderDefinition = {
  id: ProviderId;
  name: string;
  type: ProviderType;
  description: string;
  icon: string;
  color: string;
  authUrl?: string;
  tokenUrl?: string;
  scopes?: string[];
  docsUrl?: string;
  capabilities: ProviderCapability[];
};

export type ProviderCapability =
  | 'initialize'
  | 'connect'
  | 'disconnect'
  | 'reconnect'
  | 'refresh_tokens'
  | 'validate_connection'
  | 'health_check'
  | 'get_permissions'
  | 'request_permissions'
  | 'sync'
  | 'get_logs';

// ============================================================
// Database Records
// ============================================================

export type IntegrationRecord = {
  id: string;
  workspace_id: string;
  provider: ProviderId;
  provider_name: string;
  provider_type: ProviderType;
  status: IntegrationStatus;
  connection_health: ConnectionHealth;
  connected_account: string | null;
  last_sync: string | null;
  last_health_check: string | null;
  token_expires_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type IntegrationPermissionRecord = {
  id: string;
  integration_id: string;
  permission_name: string;
  granted: boolean;
  required: boolean;
  last_checked: string | null;
  created_at: string;
  updated_at: string;
};

export type IntegrationLogRecord = {
  id: string;
  integration_id: string;
  event: LogEvent;
  status: LogStatus;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

// ============================================================
// Composite View Models
// ============================================================

export type IntegrationViewModel = IntegrationRecord & {
  permissions: IntegrationPermissionRecord[];
  definition: ProviderDefinition;
  granted_permissions: string[];
  missing_permissions: string[];
  is_expired: boolean;
  needs_reconnect: boolean;
};

export type HealthCheckResult = {
  integration_id: string;
  provider: ProviderId;
  healthy: boolean;
  health: ConnectionHealth;
  status: IntegrationStatus;
  token_expired: boolean;
  token_expires_at: string | null;
  last_checked_at: string;
  errors: string[];
};

export type SyncResult = {
  integration_id: string;
  provider: ProviderId;
  synced: boolean;
  last_sync: string;
  error: string | null;
};

export type RefreshResult = {
  integration_id: string;
  provider: ProviderId;
  refreshed: boolean;
  expires_at: string | null;
  error: string | null;
};

export type ConnectParams = {
  provider: ProviderId;
  redirectUri?: string;
  scopes?: string[];
};

export type ConnectResult = {
  authUrl?: string;
  state?: string;
  connected: boolean;
  error: string | null;
};

// ============================================================
// Provider Interface
// ============================================================

export type ProviderContext = {
  integrationId: string;
  workspaceId: string;
  connectedAccount: string | null;
  metadata: Record<string, unknown> | null;
};

export type IIntegrationProvider = {
  definition: ProviderDefinition;

  initialize(workspaceId: string): Promise<IntegrationRecord>;
  connect(params: { workspaceId: string; redirectUri?: string; scopes?: string[] }): Promise<ConnectResult>;
  disconnect(integrationId: string): Promise<void>;
  reconnect(integrationId: string): Promise<ConnectResult>;
  refreshTokens(integrationId: string): Promise<RefreshResult>;
  validateConnection(integrationId: string): Promise<boolean>;
  healthCheck(integrationId: string): Promise<HealthCheckResult>;
  getPermissions(integrationId: string): Promise<IntegrationPermissionRecord[]>;
  requestPermissions(integrationId: string, permissions: string[]): Promise<ConnectResult>;
  sync(integrationId: string): Promise<SyncResult>;
};
