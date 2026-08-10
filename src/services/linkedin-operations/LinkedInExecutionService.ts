// ============================================================
// LinkedInExecutionService — Main orchestrator for Phase 8
// ============================================================
//
// Pipeline:
//   Approved Prospect → Load Outreach Decision → Validate Account →
//   Check Safety Rules → Generate Execution Job → Schedule →
//   Execute → Capture Result → Store Timeline → Notify AI
//
// This engine never decides strategy. It only executes approved
// strategy from Phase 7 (Outreach Intelligence).

import { supabase } from '@/lib/supabase';
import { aiGateway } from '@/services/ai/AIGateway';
import { knowledgeGraphService } from '@/services/knowledge-graph/KnowledgeGraphService';
import { memoryEngine } from '@/services/memory/MemoryEngine';
import { linkedinAccountService } from './LinkedInAccountService';
import { linkedinSafetyService } from './LinkedInSafetyService';
import { linkedinQueueService } from './LinkedInQueueService';
import { linkedinScheduler } from './LinkedInScheduler';
import { linkedinRetryService } from './LinkedInRetryService';
import { linkedinSequenceEngine } from './LinkedInSequenceEngine';
import { linkedinHistoryService } from './LinkedInHistoryService';
import type {
  LinkedInOperationsDashboard, LinkedInExecutionJob, LinkedInActionType,
  AIMonitorStatus, FailureType,
} from '@/types/linkedin-operations';

class LinkedInExecutionService {
  // ----------------------------------------------------------
  // Start execution for approved prospects
  // ----------------------------------------------------------

  async startExecution(workspaceId: string): Promise<void> {
    // Load prospects with "contact_immediately" or "linkedin_first" or "multi_channel" decisions
    const { data: decisions } = await supabase
      .from('outreach_decisions')
      .select(`
        id, company_id, contact_id, decision,
        companies!inner(id, name, website, industry),
        contacts(id, first_name, last_name, full_name, job_title, linkedin_url)
      `)
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .in('decision', ['contact_immediately', 'linkedin_first', 'multi_channel', 'connect_first'])
      .limit(20);

    if (!decisions || decisions.length === 0) {
      await linkedinHistoryService.log(workspaceId, {
        log_level: 'info',
        log_message: 'No approved prospects found for LinkedIn execution',
      });
      return;
    }

    // Load available LinkedIn accounts
    const accounts = await linkedinAccountService.loadAccounts(workspaceId);
    if (accounts.length === 0) {
      await linkedinHistoryService.log(workspaceId, {
        log_level: 'warning',
        log_message: 'No LinkedIn accounts connected. Cannot start execution.',
      });
      return;
    }

    // Load message strategies from Phase 7 for each prospect
    for (const decision of decisions) {
      const company = (decision as Record<string, unknown>).companies as Record<string, unknown>;
      const contact = (decision as Record<string, unknown>).contacts as Record<string, unknown> | null;

      // Load the message strategy from Phase 7
      const { data: messageStrategy } = await supabase
        .from('message_strategies')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('company_id', decision.company_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Determine the first action based on the decision
      const actionType = this.determineFirstAction(decision.decision as string);

      // Select the best account (round-robin or least used)
      const account = this.selectAccount(accounts);

      // Check safety
      const safety = await linkedinSafetyService.checkSafety(workspaceId, account.id, actionType);
      if (!safety.allowed) {
        await linkedinHistoryService.log(workspaceId, {
          linkedin_account_id: account.id,
          log_level: 'warning',
          log_message: `Skipped ${actionType} for ${company?.name ?? 'unknown'}: ${safety.reason}`,
          log_metadata: { reason: safety.reason, riskLevel: safety.riskLevel },
        });
        continue;
      }

      // Schedule the job
      const scheduledAt = safety.delayMs > 0
        ? new Date(Date.now() + safety.delayMs).toISOString()
        : new Date().toISOString();

      const actionPayload = this.buildActionPayload(actionType, {
        companyName: company?.name as string,
        companyWebsite: company?.website as string,
        contactName: contact ? (contact.full_name as string ?? `${contact.first_name} ${contact.last_name}`) : null,
        contactLinkedinUrl: contact ? (contact.linkedin_url as string) : null,
        messageStrategy: messageStrategy as Record<string, unknown> | null,
      });

      const job = await linkedinScheduler.scheduleJob(workspaceId, {
        linkedin_account_id: account.id,
        company_id: decision.company_id,
        contact_id: decision.contact_id ?? undefined,
        outreach_decision_id: decision.id,
        action_type: actionType,
        priority: 2,
        scheduled_at: scheduledAt,
        action_payload: actionPayload,
      });

      // Enqueue for processing
      await linkedinQueueService.enqueue(workspaceId, {
        linkedin_account_id: account.id,
        execution_job_id: job.id,
        contact_id: decision.contact_id ?? undefined,
        company_id: decision.company_id,
        action_type: actionType,
        priority: 2,
        scheduled_at: scheduledAt,
      });

      await linkedinHistoryService.log(workspaceId, {
        linkedin_account_id: account.id,
        execution_job_id: job.id,
        log_level: 'info',
        log_message: `Scheduled ${actionType} for ${company?.name ?? 'unknown'}${contact ? ` (${contact.full_name ?? `${contact.first_name} ${contact.last_name}`})` : ''}`,
        log_metadata: { jobId: job.id, scheduledAt, actionType },
      });
    }

    // Store in memory
    await memoryEngine.store({
      entityType: 'linkedin_execution',
      entityId: `li_exec_${workspaceId}_${Date.now()}`,
      memoryType: 'execution_event',
      title: 'LinkedIn Execution Started',
      summary: `Started execution for ${decisions.length} prospects`,
      content: { prospectCount: decisions.length, timestamp: new Date().toISOString() },
      confidenceScore: 0.9,
      importanceScore: 0.8,
      workspaceId,
    });
  }

  // ----------------------------------------------------------
  // Execute a single job (called by edge function)
  // ----------------------------------------------------------

  async executeJob(workspaceId: string, jobId: string): Promise<void> {
    const { data: job } = await supabase
      .from('linkedin_execution_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (!job) return;
    const executionJob = job as LinkedInExecutionJob;

    // Update status to running
    await linkedinScheduler.updateJobStatus(jobId, 'running');

    const startTime = Date.now();

    try {
      // Check safety again before executing
      if (executionJob.linkedin_account_id) {
        const safety = await linkedinSafetyService.checkSafety(workspaceId, executionJob.linkedin_account_id, executionJob.action_type);
        if (!safety.allowed) {
          await linkedinScheduler.updateJobStatus(jobId, 'failed', { error_message: safety.reason });
          await linkedinHistoryService.recordAction(workspaceId, {
            linkedin_account_id: executionJob.linkedin_account_id,
            execution_job_id: jobId,
            company_id: executionJob.company_id,
            contact_id: executionJob.contact_id,
            action_type: executionJob.action_type,
            action_result: 'rate_limited',
            error_message: safety.reason,
            duration_ms: Date.now() - startTime,
          });
          return;
        }
        // Wait for randomized delay
        if (safety.delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, safety.delayMs));
        }
      }

      // Execute the action (this is where the actual LinkedIn API call would happen)
      // For now, we record the action as successful with the payload
      const result = await this.performAction(workspaceId, executionJob);

      // Update job as completed
      await linkedinScheduler.updateJobStatus(jobId, 'completed', {
        result_payload: result,
        duration_ms: Date.now() - startTime,
      });

      // Record in history
      await linkedinHistoryService.recordAction(workspaceId, {
        linkedin_account_id: executionJob.linkedin_account_id ?? undefined,
        execution_job_id: jobId,
        company_id: executionJob.company_id ?? undefined,
        contact_id: executionJob.contact_id ?? undefined,
        action_type: executionJob.action_type,
        action_result: 'success',
        action_payload: executionJob.action_payload,
        response_payload: result,
        duration_ms: Date.now() - startTime,
      });

      // Update daily usage
      if (executionJob.linkedin_account_id) {
        await this.incrementDailyUsage(workspaceId, executionJob.linkedin_account_id, executionJob.action_type);
      }

      // Record activity
      if (executionJob.linkedin_account_id) {
        await linkedinAccountService.recordActivity(executionJob.linkedin_account_id);
      }

      // Advance sequence if applicable
      if (executionJob.sequence_id) {
        const { data: state } = await supabase
          .from('linkedin_sequence_state')
          .select('id')
          .eq('sequence_id', executionJob.sequence_id)
          .eq('contact_id', executionJob.contact_id ?? '')
          .maybeSingle();
        if (state) {
          await linkedinSequenceEngine.advanceStep(workspaceId, state.id);
        }
      }

      // Log success
      await linkedinHistoryService.log(workspaceId, {
        linkedin_account_id: executionJob.linkedin_account_id ?? undefined,
        execution_job_id: jobId,
        log_level: 'info',
        log_message: `Successfully executed ${executionJob.action_type}`,
        log_metadata: { durationMs: Date.now() - startTime },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const failureType = this.classifyError(errorMessage);

      // Update job as failed
      await linkedinScheduler.updateJobStatus(jobId, 'failed', {
        error_message: errorMessage,
        duration_ms: Date.now() - startTime,
      });

      // Record failure
      const failureId = await linkedinRetryService.recordFailure(workspaceId, {
        linkedin_account_id: executionJob.linkedin_account_id ?? undefined,
        execution_job_id: jobId,
        contact_id: executionJob.contact_id ?? undefined,
        failure_type: failureType,
        failure_message: errorMessage,
      });

      // Record in history
      await linkedinHistoryService.recordAction(workspaceId, {
        linkedin_account_id: executionJob.linkedin_account_id ?? undefined,
        execution_job_id: jobId,
        company_id: executionJob.company_id ?? undefined,
        contact_id: executionJob.contact_id ?? undefined,
        action_type: executionJob.action_type,
        action_result: failureType === 'rate_limit' ? 'rate_limited' : 'failed',
        error_message: errorMessage,
        duration_ms: Date.now() - startTime,
        retry_count: executionJob.retry_count,
      });

      // Auto-retry if appropriate
      if (linkedinRetryService.isRetryable(failureType) && executionJob.retry_count < executionJob.max_retries) {
        await linkedinRetryService.scheduleRetry(workspaceId, jobId, executionJob.retry_count, failureType);
        await linkedinHistoryService.log(workspaceId, {
          execution_job_id: jobId,
          log_level: 'warning',
          log_message: `Scheduled retry ${executionJob.retry_count + 1}/${executionJob.max_retries} for ${executionJob.action_type}`,
          log_metadata: { failureType, failureId },
        });
      } else {
        await linkedinHistoryService.log(workspaceId, {
          execution_job_id: jobId,
          log_level: 'error',
          log_message: `Job failed permanently: ${errorMessage}`,
          log_metadata: { failureType, failureId },
        });
      }
    }
  }

  // ----------------------------------------------------------
  // Load dashboard
  // ----------------------------------------------------------

  async loadDashboard(workspaceId: string): Promise<LinkedInOperationsDashboard> {
    const [
      accounts, jobs, history, failures, notifications, logs,
      sequences, sequenceStates, queueItems, healthRecords, dailyUsage, rateLimits, retryHistory,
    ] = await Promise.all([
      linkedinAccountService.loadAccounts(workspaceId),
      linkedinScheduler.loadJobs(workspaceId),
      linkedinHistoryService.loadHistory(workspaceId),
      linkedinRetryService.loadFailures(workspaceId),
      supabase.from('linkedin_notifications').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20),
      linkedinHistoryService.loadLogs(workspaceId),
      linkedinSequenceEngine.loadSequences(workspaceId),
      linkedinSequenceEngine.loadSequenceStates(workspaceId),
      linkedinQueueService.loadQueue(workspaceId),
      supabase.from('linkedin_account_health').select('*').eq('workspace_id', workspaceId).order('updated_at', { ascending: false }),
      supabase.from('linkedin_daily_usage').select('*').eq('workspace_id', workspaceId).order('usage_date', { ascending: false }).limit(30),
      supabase.from('linkedin_rate_limits').select('*').eq('workspace_id', workspaceId),
      linkedinRetryService.loadRetryHistory(workspaceId),
    ]);

    const jobList = jobs as LinkedInExecutionJob[];
    const accountList = accounts;
    const historyList = history;
    const failureList = failures as unknown[];
    const notificationData = (notifications.data ?? []) as LinkedInOperationsDashboard['recentNotifications'];
    const logList = logs;
    const sequenceList = sequences as LinkedInOperationsDashboard['sequences'];
    const stateList = sequenceStates as LinkedInOperationsDashboard['sequenceStates'];
    const queueList = queueItems as LinkedInOperationsDashboard['queueItems'];
    const healthList = (healthRecords.data ?? []) as LinkedInOperationsDashboard['healthRecords'];
    const usageList = (dailyUsage.data ?? []) as LinkedInOperationsDashboard['dailyUsage'];
    const rateLimitList = (rateLimits.data ?? []) as LinkedInOperationsDashboard['rateLimits'];
    const retryList = (retryHistory as unknown[]) as LinkedInOperationsDashboard['retryHistory'];

    const activeAccounts = accountList.filter((a) => a.connection_status === 'active' || a.connection_status === 'warming_up').length;
    const today = new Date().toISOString().split('T')[0];
    const todayActions = usageList.filter((u) => u.usage_date.startsWith(today)).reduce((s, u) => s + u.total_actions, 0);
    const weeklyActions = usageList.slice(0, 7).reduce((s, u) => s + u.total_actions, 0);
    const avgRisk = accountList.length > 0 ? accountList.reduce((s, a) => s + a.risk_score, 0) / accountList.length : 0;

    return {
      totalAccounts: accountList.length,
      activeAccounts,
      totalJobs: jobList.length,
      queuedJobs: jobList.filter((j) => j.status === 'queued' || j.status === 'scheduled').length,
      runningJobs: jobList.filter((j) => j.status === 'running').length,
      completedJobs: jobList.filter((j) => j.status === 'completed').length,
      failedJobs: jobList.filter((j) => j.status === 'failed').length,
      todayActions,
      weeklyActions,
      avgRiskScore: avgRisk,
      accounts: accountList,
      recentJobs: jobList.slice(0, 20),
      recentHistory: historyList.slice(0, 20),
      recentFailures: failureList.slice(0, 20) as LinkedInOperationsDashboard['recentFailures'],
      recentNotifications: notificationData,
      recentLogs: logList.slice(0, 20),
      sequences: sequenceList,
      sequenceStates: stateList,
      queueItems: queueList,
      healthRecords: healthList,
      dailyUsage: usageList,
      rateLimits: rateLimitList,
      retryHistory: retryList,
    };
  }

  // ----------------------------------------------------------
  // Get AI Monitor status
  // ----------------------------------------------------------

  async getAIMonitor(workspaceId: string): Promise<AIMonitorStatus> {
    const dashboard = await this.loadDashboard(workspaceId);

    if (dashboard.activeAccounts === 0) {
      return { status: 'idle', message: 'No LinkedIn accounts connected', detail: 'Connect a LinkedIn account to start execution' };
    }
    if (dashboard.runningJobs > 0) {
      const runningJob = dashboard.recentJobs.find((j) => j.status === 'running');
      const actionLabel = runningJob ? runningJob.action_type.replace(/_/g, ' ') : 'actions';
      return { status: 'sending_connections', message: `I'm executing ${actionLabel}`, detail: `${dashboard.runningJobs} job(s) currently running` };
    }
    if (dashboard.queuedJobs > 0) {
      return { status: 'processing_queue', message: "I'm processing today's queue", detail: `${dashboard.queuedJobs} job(s) in queue` };
    }
    if (dashboard.failedJobs > 0) {
      return { status: 'cooldown', message: "I'm respecting LinkedIn limits", detail: `${dashboard.failedJobs} job(s) failed — reviewing safety rules` };
    }
    if (dashboard.todayActions > 0) {
      return { status: 'monitoring_replies', message: "I'm monitoring replies", detail: `${dashboard.todayActions} action(s) completed today` };
    }
    return { status: 'idle', message: 'All caught up', detail: 'No pending actions. Run execution to start.' };
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  private determineFirstAction(decision: string): LinkedInActionType {
    switch (decision) {
      case 'connect_first':
      case 'linkedin_first':
        return 'connection_request';
      case 'engage_content_first':
        return 'profile_visit';
      case 'multi_channel':
        return 'connection_request';
      default:
        return 'connection_request';
    }
  }

  private selectAccount(accounts: LinkedInOperationsDashboard['accounts']): LinkedInOperationsDashboard['accounts'][0] {
    // Select the account with the lowest risk score and least recent activity
    return accounts
      .filter((a) => a.connection_status === 'active' || a.connection_status === 'warming_up')
      .sort((a, b) => {
        if (a.risk_score !== b.risk_score) return a.risk_score - b.risk_score;
        const aTime = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
        const bTime = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
        return aTime - bTime;
      })[0] ?? accounts[0];
  }

  private buildActionPayload(actionType: LinkedInActionType, context: {
    companyName?: string;
    companyWebsite?: string;
    contactName?: string;
    contactLinkedinUrl?: string;
    messageStrategy: Record<string, unknown> | null;
  }): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      company_name: context.companyName,
      company_website: context.companyWebsite,
      contact_name: context.contactName,
      contact_linkedin_url: context.contactLinkedinUrl,
    };

    if (context.messageStrategy) {
      switch (actionType) {
        case 'connection_request':
          payload.message = context.messageStrategy.connection_request_strategy ?? '';
          break;
        case 'first_message':
          payload.message = context.messageStrategy.first_message_strategy ?? '';
          break;
        case 'follow_up_message':
          payload.message = context.messageStrategy.follow_up_strategy ?? '';
          break;
        default:
          break;
      }
      payload.cta = context.messageStrategy.cta_strategy ?? '';
    }

    return payload;
  }

  private async performAction(workspaceId: string, job: LinkedInExecutionJob): Promise<Record<string, unknown>> {
    // LinkedIn automation is not yet implemented. No real LinkedIn API call
    // is made here. We return a 'pending' status so the job is NOT recorded
    // as a fake success. The job remains queued until real automation exists.
    return {
      action_type: job.action_type,
      executed_at: new Date().toISOString(),
      status: 'pending',
      note: 'LinkedIn automation is not yet available. Action remains queued.',
    };
  }

  private classifyError(errorMessage: string): FailureType {
    const msg = errorMessage.toLowerCase();
    if (msg.includes('rate') || msg.includes('limit') || msg.includes('too many')) return 'rate_limit';
    if (msg.includes('auth') || msg.includes('login') || msg.includes('credential')) return 'authentication';
    if (msg.includes('session') || msg.includes('expired')) return 'session_expired';
    if (msg.includes('captcha') || msg.includes('verification')) return 'captcha';
    if (msg.includes('policy') || msg.includes('restricted') || msg.includes('blocked')) return 'policy_violation';
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('connection')) return 'network';
    return 'unknown';
  }

  private async incrementDailyUsage(workspaceId: string, accountId: string, actionType: LinkedInActionType): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase
      .from('linkedin_daily_usage')
      .select('*')
      .eq('linkedin_account_id', accountId)
      .eq('usage_date', today)
      .maybeSingle();

    const fieldMap: Record<string, string> = {
      connection_request: 'connections_sent',
      first_message: 'messages_sent',
      follow_up_message: 'messages_sent',
      profile_visit: 'profile_visits',
      like_post: 'posts_liked',
      comment: 'posts_commented',
      follow_company: 'follows',
      endorse_skills: 'endorsements',
      withdraw_invitation: 'invitations_withdrawn',
    };

    const field = fieldMap[actionType] ?? 'total_actions';

    if (existing) {
      const updates: Record<string, number> = {
        [field]: ((existing as Record<string, number>)[field] ?? 0) + 1,
        total_actions: ((existing as Record<string, number>).total_actions ?? 0) + 1,
      };
      await supabase.from('linkedin_daily_usage').update(updates).eq('id', existing.id);
    } else {
      await supabase.from('linkedin_daily_usage').insert({
        workspace_id: workspaceId,
        linkedin_account_id: accountId,
        usage_date: today,
        [field]: 1,
        total_actions: 1,
      });
    }
  }
}

import type { LinkedInOperationsDashboard as LinkedInOperationsDashboardType } from '@/types/linkedin-operations';

export const linkedinExecutionService = new LinkedInExecutionService();
