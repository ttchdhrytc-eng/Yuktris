import type { SupabaseClient } from '@supabase/supabase-js';
import type { QueueItem } from './queue.js';

export const LINKEDIN_WRITE_ACTIONS = new Set([
  'connection_request', 'send_message', 'follow_up_message', 'like_post', 'follow_company',
]);

export type WriteSafetyCode =
  | 'allowed' | 'daily_limit_reached' | 'cooldown_active'
  | 'account_paused' | 'verification_required' | 'linkedin_restricted'
  | 'duplicate_action' | 'unsafe_target' | 'rate_limited' | 'invalid_request';

export interface WritePreflightResult {
  allowed: boolean;
  code: WriteSafetyCode;
  audit_id?: string;
  already_done?: boolean;
}

export function normalizeLinkedInTarget(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  try {
    const url = new URL(raw);
    if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
    url.protocol = 'https:';
    url.hostname = 'www.linkedin.com';
    url.search = '';
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString().replace(/\/$/, '');
  } catch {
    return raw.toLowerCase().replace(/\s+/g, ' ').slice(0, 300);
  }
}

export function targetForWrite(action: string, params: Record<string, unknown>): string | null {
  if (action === 'connection_request') return normalizeLinkedInTarget(params.profile_url);
  if (action === 'follow_company') return normalizeLinkedInTarget(params.company_url);
  if (action === 'like_post') return normalizeLinkedInTarget(params.post_url ?? params.target_identifier);
  return normalizeLinkedInTarget(params.thread_url ?? params.profile_url ?? params.target_identifier ?? params.prospect_name);
}

function projectRef(): string {
  try { return new URL(process.env.SUPABASE_URL ?? '').hostname.split('.')[0] ?? ''; }
  catch { return ''; }
}

export async function preflightLinkedInWrite(
  client: SupabaseClient,
  item: QueueItem,
): Promise<WritePreflightResult> {
  const target = targetForWrite(item.action_type, item.action_params ?? {});
  if (!item.account_id || !target || !item.idempotency_key) {
    return { allowed: false, code: 'invalid_request' };
  }
  const { data, error } = await client.rpc('preflight_linkedin_write', {
    p_task_id: item.id,
    p_attempt_id: item.attempt_id,
    p_workspace_id: item.workspace_id,
    p_account_id: item.account_id,
    p_action_type: item.action_type,
    p_target: target,
    p_idempotency_key: item.idempotency_key,
    p_project_ref: projectRef(),
    p_campaign_id: typeof item.action_params.campaign_id === 'string' ? item.action_params.campaign_id : null,
    p_contact_id: typeof item.action_params.contact_id === 'string' ? item.action_params.contact_id : null,
  });
  if (error) throw new Error(`LinkedIn write preflight failed: ${error.message}`);
  return data as WritePreflightResult;
}

export async function finalizeLinkedInWrite(
  client: SupabaseClient,
  auditId: string,
  success: boolean,
  classification: string,
): Promise<void> {
  const { error } = await client.rpc('finalize_linkedin_write', {
    p_audit_id: auditId,
    p_success: success,
    p_classification: classification,
  });
  if (error) throw new Error(`LinkedIn write finalization failed: ${error.message}`);
}
