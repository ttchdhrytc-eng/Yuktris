export const LINKEDIN_AGENT_COMMANDS = [
  'CHECK_SESSION', 'OPEN_PROFILE', 'READ_PROFILE', 'SALES_NAV_SEARCH',
  'SEND_CONNECTION_REQUEST', 'SEND_MESSAGE', 'CHECK_MESSAGES', 'READ_THREAD',
  'SEND_REPLY', 'FOLLOW_UP',
] as const;

export type LinkedInAgentCommand = typeof LINKEDIN_AGENT_COMMANDS[number];

export type LinkedInAgentResultCode =
  | 'success' | 'already_done' | 'login_required' | 'verification_required'
  | 'restricted' | 'rate_limited' | 'not_available' | 'temporary_error'
  | 'provider_error' | 'identity_mismatch' | 'failed';

const commandAliases: Record<string, string> = {
  CHECK_SESSION: 'linkedin_test_connection',
  OPEN_PROFILE: 'profile_visit',
  READ_PROFILE: 'read_profile',
  SALES_NAV_SEARCH: 'sales_nav_search',
  SEND_CONNECTION_REQUEST: 'connection_request',
  SEND_MESSAGE: 'send_message',
  CHECK_MESSAGES: 'read_inbox',
  READ_THREAD: 'read_replies',
  SEND_REPLY: 'send_message',
  FOLLOW_UP: 'follow_up_message',
};

export function normalizeLinkedInAction(action: string): string {
  return commandAliases[action.trim().toUpperCase()] ?? action.trim().toLowerCase();
}

export interface SalesNavigatorSearchPayload {
  keywords?: string;
  geography?: string[];
  industry?: string[];
  company_size?: string[];
  seniority?: string[];
  function?: string[];
  title?: string[];
  relationship?: string[];
  company_attributes?: Record<string, string[]>;
  limit?: number;
}

export function validateSalesNavigatorPayload(value: unknown): SalesNavigatorSearchPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Sales Navigator filters are required');
  const payload = value as Record<string, unknown>;
  const result: SalesNavigatorSearchPayload = {};
  for (const key of ['geography', 'industry', 'company_size', 'seniority', 'function', 'title', 'relationship'] as const) {
    const field = payload[key];
    if (field !== undefined && (!Array.isArray(field) || field.some(v => typeof v !== 'string'))) {
      throw new Error(`Sales Navigator ${key} must be a string array`);
    }
    if (Array.isArray(field)) result[key] = field.map(v => v.trim()).filter(Boolean).slice(0, 25);
  }
  if (payload.keywords !== undefined && typeof payload.keywords !== 'string') throw new Error('Sales Navigator keywords must be text');
  if (typeof payload.keywords === 'string') result.keywords = payload.keywords.trim().slice(0, 200);
  if (payload.limit !== undefined && (!Number.isInteger(payload.limit) || Number(payload.limit) < 1 || Number(payload.limit) > 25)) {
    throw new Error('Sales Navigator limit must be between 1 and 25');
  }
  result.limit = payload.limit === undefined ? 10 : Number(payload.limit);
  if (payload.company_attributes !== undefined) {
    if (!payload.company_attributes || typeof payload.company_attributes !== 'object' || Array.isArray(payload.company_attributes)) {
      throw new Error('Sales Navigator company_attributes must be an object');
    }
    result.company_attributes = payload.company_attributes as Record<string, string[]>;
  }
  return result;
}
