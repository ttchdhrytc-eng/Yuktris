// ============================================================
// LinkedInSafetyService — Safety rules and risk management
// ============================================================

import { supabase } from '@/lib/supabase';
import type { SafetyCheckResult, LinkedInAccount, LinkedInAccountHealth, HealthStatus } from '@/types/linkedin-operations';

class LinkedInSafetyService {
  // ----------------------------------------------------------
  // Check if an action is safe to execute
  // ----------------------------------------------------------

  async checkSafety(workspaceId: string, accountId: string, actionType: string): Promise<SafetyCheckResult> {
    const account = await this.loadAccount(accountId);
    if (!account) return { allowed: false, reason: 'Account not found', delayMs: 0, riskLevel: 'critical' };

    // Check connection status
    if (account.connection_status === 'restricted') {
      return { allowed: false, reason: 'Account is restricted by LinkedIn', delayMs: 0, riskLevel: 'critical' };
    }
    if (account.connection_status === 'cooldown') {
      return { allowed: false, reason: 'Account is in cooldown period', delayMs: 0, riskLevel: 'high' };
    }
    if (account.connection_status === 'disconnected') {
      return { allowed: false, reason: 'Account is disconnected', delayMs: 0, riskLevel: 'critical' };
    }

    // Check working hours
    const withinHours = this.isWithinWorkingHours(account);
    if (!withinHours.allowed) {
      return { allowed: false, reason: `Outside working hours (${account.working_hours_start}-${account.working_hours_end} ${account.timezone})`, delayMs: withinHours.delayMs, riskLevel: 'low' };
    }

    // Check daily limits
    const usage = await this.loadTodayUsage(workspaceId, accountId);
    if (usage) {
      const limitKey = actionType === 'connection_request' ? 'connections_sent' : 'messages_sent';
      const limit = actionType === 'connection_request' ? account.daily_connection_limit : account.daily_message_limit;
      const used = (usage as Record<string, number>)[limitKey] ?? 0;
      if (used >= limit) {
        return { allowed: false, reason: `Daily limit reached (${used}/${limit} ${actionType})`, delayMs: 0, riskLevel: 'medium' };
      }
    }

    // Check rate limits
    const rateLimit = await this.loadRateLimit(workspaceId, accountId, actionType);
    if (rateLimit) {
      if (rateLimit.daily_used >= rateLimit.daily_limit) {
        return { allowed: false, reason: `Rate limit reached for ${actionType}`, delayMs: 0, riskLevel: 'medium' };
      }
      if (rateLimit.cooldown_until && new Date(rateLimit.cooldown_until) > new Date()) {
        return { allowed: false, reason: `In cooldown until ${rateLimit.cooldown_until}`, delayMs: 0, riskLevel: 'high' };
      }
    }

    // Check risk score
    if (account.risk_score > 0.7) {
      return { allowed: false, reason: `Risk score too high (${Math.round(account.risk_score * 100)}%)`, delayMs: 0, riskLevel: 'high' };
    }

    // Check health
    const health = await this.loadHealth(workspaceId, accountId);
    if (health && health.health_status === 'critical') {
      return { allowed: false, reason: 'Account health is critical', delayMs: 0, riskLevel: 'critical' };
    }
    if (health && health.cooldown_until && new Date(health.cooldown_until) > new Date()) {
      return { allowed: false, reason: `Health cooldown active until ${health.cooldown_until}`, delayMs: 0, riskLevel: 'high' };
    }

    // Randomized delay for human-like behavior
    const delayMs = this.calculateRandomDelay(actionType);
    return { allowed: true, reason: 'Safe to proceed', delayMs, riskLevel: 'low' };
  }

  // ----------------------------------------------------------
  // Calculate risk score for an account
  // ----------------------------------------------------------

  async calculateRiskScore(workspaceId: string, accountId: string): Promise<number> {
    const [account, health, usage] = await Promise.all([
      this.loadAccount(accountId),
      this.loadHealth(workspaceId, accountId),
      this.loadTodayUsage(workspaceId, accountId),
    ]);

    if (!account) return 1;

    let risk = 0;

    // High daily usage increases risk
    if (usage) {
      const connUsageRate = account.daily_connection_limit > 0 ? usage.connections_sent / account.daily_connection_limit : 0;
      const msgUsageRate = account.daily_message_limit > 0 ? usage.messages_sent / account.daily_message_limit : 0;
      if (connUsageRate > 0.8) risk += 0.2;
      if (msgUsageRate > 0.8) risk += 0.2;
    }

    // Low acceptance rate increases risk
    if (health && health.invitation_acceptance_rate < 0.1 && health.connections_today > 10) {
      risk += 0.15;
    }

    // Low reply ratio increases risk
    if (health && health.reply_ratio < 0.05 && health.messages_today > 10) {
      risk += 0.1;
    }

    // Warmup accounts have higher base risk
    if (account.warmup_status === 'in_progress') {
      risk += 0.15;
    }

    // Already elevated risk
    risk += account.risk_score * 0.3;

    return Math.min(risk, 1);
  }

  // ----------------------------------------------------------
  // Update health record
  // ----------------------------------------------------------

  async updateHealth(workspaceId: string, accountId: string, params: Partial<LinkedInAccountHealth>): Promise<void> {
    const { data: existing } = await supabase
      .from('linkedin_account_health')
      .select('id')
      .eq('linkedin_account_id', accountId)
      .maybeSingle();

    if (existing) {
      await supabase.from('linkedin_account_health').update({
        ...params,
        last_health_check: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await supabase.from('linkedin_account_health').insert({
        workspace_id: workspaceId,
        linkedin_account_id: accountId,
        health_status: params.health_status ?? 'healthy',
        ...params,
        last_health_check: new Date().toISOString(),
      });
    }
  }

  // ----------------------------------------------------------
  // Create notification
  // ----------------------------------------------------------

  async createNotification(workspaceId: string, accountId: string | null, type: string, title: string, message: string, severity: 'info' | 'warning' | 'error' | 'success' = 'info'): Promise<void> {
    await supabase.from('linkedin_notifications').insert({
      workspace_id: workspaceId,
      linkedin_account_id: accountId,
      notification_type: type,
      notification_title: title,
      notification_message: message,
      severity,
    });
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  private isWithinWorkingHours(account: LinkedInAccount): { allowed: boolean; delayMs: number } {
    const now = new Date();
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    if (!account.working_days.includes(dayName)) {
      const nextWorkDay = this.getNextWorkDay(account.working_days);
      const delayMs = nextWorkDay ? 24 * 60 * 60 * 1000 : 72 * 60 * 60 * 1000;
      return { allowed: false, delayMs };
    }

    const currentHour = now.getHours();
    const startHour = parseInt(account.working_hours_start.split(':')[0]);
    const endHour = parseInt(account.working_hours_end.split(':')[0]);

    if (currentHour < startHour) {
      return { allowed: false, delayMs: (startHour - currentHour) * 60 * 60 * 1000 };
    }
    if (currentHour >= endHour) {
      return { allowed: false, delayMs: 24 * 60 * 60 * 1000 };
    }

    return { allowed: true, delayMs: 0 };
  }

  private getNextWorkDay(workingDays: string[]): string | null {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const todayIdx = days.indexOf(today);
    for (let i = 1; i <= 7; i++) {
      const checkDay = days[(todayIdx + i) % 7];
      if (workingDays.includes(checkDay)) return checkDay;
    }
    return null;
  }

  private calculateRandomDelay(actionType: string): number {
    const baseDelays: Record<string, [number, number]> = {
      connection_request: [30000, 120000],
      first_message: [20000, 90000],
      follow_up_message: [30000, 120000],
      profile_visit: [10000, 45000],
      like_post: [8000, 30000],
      comment: [15000, 60000],
      endorse_skills: [12000, 45000],
      follow_company: [10000, 40000],
    };
    const [min, max] = baseDelays[actionType] ?? [20000, 90000];
    return Math.floor(Math.random() * (max - min) + min);
  }

  private async loadAccount(accountId: string): Promise<LinkedInAccount | null> {
    const { data } = await supabase.from('linkedin_accounts').select('*').eq('id', accountId).maybeSingle();
    return data as LinkedInAccount | null;
  }

  private async loadHealth(workspaceId: string, accountId: string): Promise<LinkedInAccountHealth | null> {
    const { data } = await supabase.from('linkedin_account_health').select('*').eq('linkedin_account_id', accountId).maybeSingle();
    return data as LinkedInAccountHealth | null;
  }

  private async loadTodayUsage(workspaceId: string, accountId: string): Promise<LinkedInDailyUsage | null> {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('linkedin_daily_usage').select('*').eq('linkedin_account_id', accountId).eq('usage_date', today).maybeSingle();
    return data as LinkedInDailyUsage | null;
  }

  private async loadRateLimit(workspaceId: string, accountId: string, actionType: string): Promise<LinkedInRateLimit | null> {
    const { data } = await supabase.from('linkedin_rate_limits').select('*').eq('linkedin_account_id', accountId).eq('action_type', actionType).maybeSingle();
    return data as LinkedInRateLimit | null;
  }
}

import type { LinkedInDailyUsage, LinkedInRateLimit } from '@/types/linkedin-operations';

export const linkedinSafetyService = new LinkedInSafetyService();
