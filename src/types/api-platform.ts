export type APIKey = {
  id: string; workspace_id: string; key_name: string; key_prefix: string;
  key_type: string; scopes: string[]; is_active: boolean; expires_at: string | null;
  last_used_at: string | null; created_by: string | null;
  created_at: string; updated_at: string;
};
export type OAuthClient = {
  id: string; workspace_id: string; client_id: string; client_name: string;
  redirect_uris: string[]; scopes: string[]; grant_types: string[];
  is_active: boolean; created_at: string; updated_at: string;
};
export type APILog = {
  id: string; workspace_id: string; api_key_id: string | null;
  endpoint: string; method: string; status_code: number;
  ip_address: string | null; user_agent: string | null;
  latency_ms: number | null; request_id: string | null;
  api_version: string; created_at: string;
};
export type APIUsage = {
  id: string; workspace_id: string; api_key_id: string | null;
  usage_date: string; request_count: number; total_tokens: number;
  total_cost: number; by_endpoint: Record<string, number>;
  by_method: Record<string, number>; by_status: Record<string, number>;
  created_at: string; updated_at: string;
};
export type APIRateLimit = {
  id: string; workspace_id: string; plan_tier: string;
  requests_per_minute: number; requests_per_hour: number;
  requests_per_day: number; burst_limit: number;
  is_active: boolean; created_at: string; updated_at: string;
};
export type APIVersion = {
  id: string; workspace_id: string; version_string: string;
  is_stable: boolean; is_deprecated: boolean;
  deprecation_date: string | null; sunset_date: string | null;
  release_notes: string | null; created_at: string; updated_at: string;
};
export type DeveloperApp = {
  id: string; workspace_id: string; developer_org_id: string | null;
  app_name: string; app_description: string | null; app_status: string;
  app_type: string; api_key_id: string | null; oauth_client_id: string | null;
  webhook_url: string | null; scopes: string[]; rate_limit_tier: string;
  is_active: boolean; created_at: string; updated_at: string;
};
export type DeveloperUser = {
  id: string; workspace_id: string; developer_org_id: string | null;
  user_id: string | null; email: string; display_name: string | null;
  role: string; permissions: string[]; is_active: boolean;
  last_login_at: string | null; created_at: string; updated_at: string;
};
export type DeveloperOrganization = {
  id: string; workspace_id: string; org_name: string; org_slug: string;
  org_description: string | null; org_status: string; plan_tier: string;
  billing_email: string | null; api_key_id: string | null;
  total_apps: number; total_requests: number;
  created_at: string; updated_at: string;
};
export type DeveloperAuditLog = {
  id: string; workspace_id: string; developer_user_id: string | null;
  developer_org_id: string | null; action: string; resource_type: string | null;
  resource_id: string | null; ip_address: string | null;
  user_agent: string | null; metadata: Record<string, unknown> | null;
  created_at: string;
};
export type APIDocumentation = {
  id: string; workspace_id: string; api_version_id: string | null;
  doc_version: string; openapi_spec: Record<string, unknown>;
  swagger_spec: Record<string, unknown> | null; generated_at: string | null;
  is_published: boolean; created_at: string; updated_at: string;
};
export type SDKVersion = {
  id: string; workspace_id: string; language: string; version: string;
  download_url: string | null; package_name: string | null;
  package_registry: string | null; is_stable: boolean;
  is_deprecated: boolean; release_notes: string | null;
  created_at: string; updated_at: string;
};
export type APIPlatformDashboard = {
  apiKeys: APIKey[]; oauthClients: OAuthClient[]; logs: APILog[];
  usage: APIUsage[]; rateLimits: APIRateLimit[]; versions: APIVersion[];
  developerApps: DeveloperApp[]; developerUsers: DeveloperUser[];
  developerOrgs: DeveloperOrganization[]; auditLogs: DeveloperAuditLog[];
  documentation: APIDocumentation[]; sdkVersions: SDKVersion[];
  totalRequests: number; totalErrors: number; totalTokens: number;
  totalCost: number; activeKeys: number; activeApps: number;
  activeOrgs: number; avgLatency: number; errorRate: number;
  requestsToday: number; requestsThisMonth: number;
};
