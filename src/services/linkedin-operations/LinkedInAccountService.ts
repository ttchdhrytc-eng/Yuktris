// ============================================================
// LinkedInAccountService — Manage LinkedIn accounts
// ============================================================

import { supabase } from '@/lib/supabase';
import type { LinkedInAccount, ConnectionStatus } from '@/types/linkedin-operations';

class LinkedInAccountService {
  async loadAccounts(workspaceId: string): Promise<LinkedInAccount[]> {
    const { data } = await supabase
      .from('linkedin_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });
    return (data ?? []) as LinkedInAccount[];
  }

  async createAccount(workspaceId: string, params: {
    profile_url: string;
    display_name: string;
    headline?: string;
    session_token?: string;
    cookies?: Record<string, unknown>;
  }): Promise<LinkedInAccount> {
    const { data, error } = await supabase
      .from('linkedin_accounts')
      .insert({
        workspace_id: workspaceId,
        profile_url: params.profile_url,
        display_name: params.display_name,
        headline: params.headline ?? null,
        session_token: params.session_token ?? null,
        cookies: params.cookies ?? null,
        status: 'disconnected',
        connection_status: 'not_connected',
        warmup_status: 'not_started',
        warmup_day: 0,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as LinkedInAccount;
  }

  async markConnected(accountId: string): Promise<void> {
    await supabase
      .from('linkedin_accounts')
      .update({
        status: 'connected',
        connection_status: 'warming_up',
        warmup_status: 'in_progress',
        warmup_day: 1,
        connected_at: new Date().toISOString(),
      })
      .eq('id', accountId);
  }

  async updateAccount(accountId: string, updates: Partial<LinkedInAccount>): Promise<void> {
    await supabase.from('linkedin_accounts').update(updates).eq('id', accountId);
  }

  async updateConnectionStatus(accountId: string, status: ConnectionStatus): Promise<void> {
    await supabase.from('linkedin_accounts').update({ connection_status: status }).eq('id', accountId);
  }

  async updateRiskScore(accountId: string, riskScore: number): Promise<void> {
    await supabase.from('linkedin_accounts').update({ risk_score: riskScore }).eq('id', accountId);
  }

  async deleteAccount(accountId: string): Promise<void> {
    console.warn('[FORENSIC] DELETE linkedin_accounts PRE-EXECUTION', {
      file: 'src/services/linkedin-operations/LinkedInAccountService.ts',
      function: 'LinkedInAccountService.deleteAccount',
      accountId,
      timestamp: new Date().toISOString(),
      stack: new Error().stack,
    });
    await supabase.from('linkedin_accounts').delete().eq('id', accountId);
  }

  async updateLimits(accountId: string, limits: {
    daily_connection_limit?: number;
    daily_message_limit?: number;
    weekly_connection_limit?: number;
    weekly_message_limit?: number;
  }): Promise<void> {
    await supabase.from('linkedin_accounts').update(limits).eq('id', accountId);
  }

  async updateWorkingHours(accountId: string, params: {
    working_hours_start?: string;
    working_hours_end?: string;
    working_days?: string[];
    timezone?: string;
  }): Promise<void> {
    await supabase.from('linkedin_accounts').update(params).eq('id', accountId);
  }

  async recordActivity(accountId: string): Promise<void> {
    await supabase.from('linkedin_accounts').update({
      last_activity_at: new Date().toISOString(),
    }).eq('id', accountId);
  }
}

export const linkedinAccountService = new LinkedInAccountService();
