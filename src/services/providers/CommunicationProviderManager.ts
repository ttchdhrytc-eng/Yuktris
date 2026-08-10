// ============================================================
// CommunicationProviderManager — Central facade for all provider ops
// ============================================================
//
// This is the single entry point for business engines. No engine
// should ever import a provider directly — they all go through the
// Manager. The Manager handles:
//   - Provider discovery and listing
//   - Connection lifecycle (connect, disconnect, refresh, validate)
//   - Message operations (send, schedule, cancel, search, get)
//   - Folder and sync operations
//   - Webhook registration and processing
//   - Health monitoring
//   - Rate limit checking
//   - Operation logging and analytics

import { supabase } from '@/lib/supabase';
import { providerRegistry } from './ProviderRegistry';
import { providerFactory } from './ProviderFactory';
import { providerRouter } from './ProviderRouter';
import { providerHealthService } from './ProviderHealthService';
import { providerConnectionService } from './ProviderConnectionService';
import { providerCapabilityService } from './ProviderCapabilityService';
import { providerRetryService } from './ProviderRetryService';
import { providerWebhookService } from './ProviderWebhookService';
import { providerAnalyticsService } from './ProviderAnalyticsService';
import type {
  ProviderKey,
  CommunicationProviderRecord,
  ProviderConnectionRecord,
  ProviderConnectionViewModel,
  HealthCheckResult,
  ConnectResult,
  RefreshResult,
  SyncResult,
  SendMessageRequest,
  SendMessageResult,
  ScheduleMessageRequest,
  SearchMessagesRequest,
  SearchMessagesResult,
  ProviderThread,
  ProviderMessage,
  ProviderFolder,
  ProviderContext,
  WebhookRegistration,
  WebhookProcessResult,
  ProviderAnalytics,
  ProviderHealthSummary,
  CapabilityKey,
  OperationType,
  Direction,
  OperationStatus,
} from '@/types/communication-providers';
import type {
  GmailConnectionState,
  GmailMessage,
  GmailThread,
  SendEmailParams,
  ReplyEmailParams,
  SearchParams,
  ConnectGmailResult,
  DisconnectGmailResult,
  ModifyMessageResult,
  GetAttachmentResult,
} from '@/types/gmail';
import type { GmailProvider } from './GmailProvider';

class CommunicationProviderManager {
  // ----------------------------------------------------------
  // Provider Discovery
  // ----------------------------------------------------------

  async listProviders(): Promise<CommunicationProviderRecord[]> {
    return providerConnectionService.listProviders();
  }

  async getProviderByKey(key: ProviderKey): Promise<CommunicationProviderRecord | null> {
    return providerConnectionService.getProviderByKey(key);
  }

  // ----------------------------------------------------------
  // Connection Lifecycle
  // ----------------------------------------------------------

  async listConnections(workspaceId: string): Promise<ProviderConnectionViewModel[]> {
    return providerConnectionService.listConnections(workspaceId);
  }

  async getConnection(connectionId: string): Promise<ProviderConnectionViewModel | null> {
    return providerConnectionService.getConnection(connectionId);
  }

  async connect(params: {
    workspaceId: string;
    providerKey: ProviderKey;
    redirectUri?: string;
    scopes?: string[];
  }): Promise<ConnectResult> {
    const provider = providerFactory.create(params.providerKey);
    const providerRecord = await providerConnectionService.getProviderByKey(params.providerKey);
    if (!providerRecord) throw new Error(`Provider not found: ${params.providerKey}`);

    let connection = await this.findOrCreateConnection(params.workspaceId, providerRecord);
    await providerCapabilityService.syncCapabilitiesFromDefinition(providerRecord.id, providerRecord.capabilities);

    const result = await provider.connect({
      workspaceId: params.workspaceId,
      connectionId: connection.id,
      redirectUri: params.redirectUri,
      scopes: params.scopes ?? providerRecord.default_scopes,
    });

    if (result.connected) {
      await providerConnectionService.updateStatus(connection.id, 'connected');
    }

    await this.logEvent(connection.id, providerRecord.id, params.workspaceId, 'connected', result.connected ? 'success' : 'failure', result.error ?? 'Connection attempt');

    return result;
  }

  async disconnect(connectionId: string): Promise<void> {
    const conn = await providerConnectionService.getConnection(connectionId);
    if (!conn) throw new Error(`Connection not found: ${connectionId}`);

    const provider = providerFactory.createOptional(conn.provider_key as ProviderKey);
    if (provider) {
      await provider.disconnect(connectionId);
    }

    await providerConnectionService.updateStatus(connectionId, 'disconnected');
    await this.logEvent(connectionId, conn.provider_id, conn.workspace_id, 'disconnected', 'success', 'Connection disconnected');
  }

  async refresh(connectionId: string): Promise<RefreshResult> {
    const conn = await providerConnectionService.getConnection(connectionId);
    if (!conn) throw new Error(`Connection not found: ${connectionId}`);

    const provider = providerFactory.createOptional(conn.provider_key as ProviderKey);
    if (!provider) throw new Error(`Provider not registered: ${conn.provider_key}`);

    const result = await providerRetryService.executeWithRetry(
      () => provider.refresh(connectionId),
      { connectionId, workspaceId: conn.workspace_id, operationType: 'refresh' }
    );

    await this.logEvent(connectionId, conn.provider_id, conn.workspace_id, 'token_refreshed', result.refreshed ? 'success' : 'failure', result.error ?? 'Token refresh');
    return result;
  }

  async validate(connectionId: string): Promise<boolean> {
    const conn = await providerConnectionService.getConnection(connectionId);
    if (!conn) return false;

    const provider = providerFactory.createOptional(conn.provider_key as ProviderKey);
    if (!provider) return false;

    return provider.validate(connectionId);
  }

  // ----------------------------------------------------------
  // Message Operations
  // ----------------------------------------------------------

  async sendMessage(params: {
    workspaceId: string;
    channel: string;
    message: SendMessageRequest;
    preferredProvider?: ProviderKey;
  }): Promise<SendMessageResult> {
    const route = await providerRouter.route({
      workspaceId: params.workspaceId,
      channel: params.channel,
      requiredCapability: 'send_message',
      preferredProvider: params.preferredProvider,
    });

    if (!route) throw new Error(`No available provider for channel: ${params.channel}`);

    const provider = providerFactory.create(route.providerKey);
    const ctx = await this.buildContext(route.connection);

    return this.executeWithLogging(
      () => providerRetryService.executeWithRetry(
        () => provider.sendMessage(ctx, params.message),
        { connectionId: route.connection.id, workspaceId: params.workspaceId, operationType: 'send_message' }
      ),
      {
        connectionId: route.connection.id,
        workspaceId: params.workspaceId,
        operation: 'send_message',
        direction: 'outbound',
      }
    );
  }

  async scheduleMessage(params: {
    workspaceId: string;
    channel: string;
    message: ScheduleMessageRequest;
    preferredProvider?: ProviderKey;
  }): Promise<SendMessageResult> {
    const route = await providerRouter.route({
      workspaceId: params.workspaceId,
      channel: params.channel,
      requiredCapability: 'schedule_message',
      preferredProvider: params.preferredProvider,
    });

    if (!route) throw new Error(`No available provider for scheduling on channel: ${params.channel}`);

    const provider = providerFactory.create(route.providerKey);
    const ctx = await this.buildContext(route.connection);

    return this.executeWithLogging(
      () => provider.scheduleMessage(ctx, params.message),
      {
        connectionId: route.connection.id,
        workspaceId: params.workspaceId,
        operation: 'schedule_message',
        direction: 'outbound',
      }
    );
  }

  async cancelMessage(params: {
    workspaceId: string;
    connectionId: string;
    messageId: string;
  }): Promise<boolean> {
    const conn = await providerConnectionService.getConnection(params.connectionId);
    if (!conn) throw new Error(`Connection not found: ${params.connectionId}`);

    const provider = providerFactory.createOptional(conn.provider_key as ProviderKey);
    if (!provider) throw new Error(`Provider not registered: ${conn.provider_key}`);

    const ctx = await this.buildContext(conn);
    return provider.cancelMessage(ctx, params.messageId);
  }

  async searchMessages(params: {
    workspaceId: string;
    connectionId: string;
    query: SearchMessagesRequest;
  }): Promise<SearchMessagesResult> {
    const conn = await providerConnectionService.getConnection(params.connectionId);
    if (!conn) throw new Error(`Connection not found: ${params.connectionId}`);

    const provider = providerFactory.createOptional(conn.provider_key as ProviderKey);
    if (!provider) throw new Error(`Provider not registered: ${conn.provider_key}`);

    const ctx = await this.buildContext(conn);
    return provider.searchMessages(ctx, params.query);
  }

  async getThread(params: {
    workspaceId: string;
    connectionId: string;
    threadId: string;
  }): Promise<ProviderThread> {
    const conn = await providerConnectionService.getConnection(params.connectionId);
    if (!conn) throw new Error(`Connection not found: ${params.connectionId}`);

    const provider = providerFactory.createOptional(conn.provider_key as ProviderKey);
    if (!provider) throw new Error(`Provider not registered: ${conn.provider_key}`);

    const ctx = await this.buildContext(conn);
    return provider.getThread(ctx, params.threadId);
  }

  async getMessage(params: {
    workspaceId: string;
    connectionId: string;
    messageId: string;
  }): Promise<ProviderMessage> {
    const conn = await providerConnectionService.getConnection(params.connectionId);
    if (!conn) throw new Error(`Connection not found: ${params.connectionId}`);

    const provider = providerFactory.createOptional(conn.provider_key as ProviderKey);
    if (!provider) throw new Error(`Provider not registered: ${conn.provider_key}`);

    const ctx = await this.buildContext(conn);
    return provider.getMessage(ctx, params.messageId);
  }

  async listFolders(workspaceId: string, connectionId: string): Promise<ProviderFolder[]> {
    const conn = await providerConnectionService.getConnection(connectionId);
    if (!conn) throw new Error(`Connection not found: ${connectionId}`);

    const provider = providerFactory.createOptional(conn.provider_key as ProviderKey);
    if (!provider) throw new Error(`Provider not registered: ${conn.provider_key}`);

    const ctx = await this.buildContext(conn);
    return provider.listFolders(ctx);
  }

  // ----------------------------------------------------------
  // Sync
  // ----------------------------------------------------------

  async sync(params: {
    workspaceId: string;
    connectionId: string;
    cursor?: string;
  }): Promise<SyncResult> {
    const conn = await providerConnectionService.getConnection(params.connectionId);
    if (!conn) throw new Error(`Connection not found: ${params.connectionId}`);

    const provider = providerFactory.createOptional(conn.provider_key as ProviderKey);
    if (!provider) throw new Error(`Provider not registered: ${conn.provider_key}`);

    const ctx = await this.buildContext(conn);

    await this.logEvent(params.connectionId, conn.provider_id, params.workspaceId, 'sync_started', 'info', 'Sync started');

    const result = await providerRetryService.executeWithRetry(
      () => provider.sync(ctx, params.cursor ?? conn.sync_cursor ?? undefined),
      { connectionId: params.connectionId, workspaceId: params.workspaceId, operationType: 'sync' }
    );

    if (result.synced) {
      await providerConnectionService.updateConnection(params.connectionId, {
        last_sync_at: result.last_sync,
        sync_cursor: result.sync_cursor,
      });
    }

    await this.logEvent(params.connectionId, conn.provider_id, params.workspaceId, 'sync_completed', result.synced ? 'success' : 'failure', result.error ?? 'Sync completed');

    return result;
  }

  // ----------------------------------------------------------
  // Webhooks
  // ----------------------------------------------------------

  async registerWebhook(params: {
    workspaceId: string;
    connectionId: string;
    events: string[];
    webhookUrl: string;
  }): Promise<WebhookRegistration> {
    const conn = await providerConnectionService.getConnection(params.connectionId);
    if (!conn) throw new Error(`Connection not found: ${params.connectionId}`);

    const provider = providerFactory.createOptional(conn.provider_key as ProviderKey);
    if (!provider) throw new Error(`Provider not registered: ${conn.provider_key}`);

    const ctx = await this.buildContext(conn);
    const registration = await provider.registerWebhook(ctx, params.events);

    await providerWebhookService.registerWebhook({
      connectionId: params.connectionId,
      providerId: conn.provider_id,
      workspaceId: params.workspaceId,
      webhookUrl: registration.webhook_url,
      webhookSecret: crypto.randomUUID(),
      subscribedEvents: registration.subscribed_events,
    });

    return registration;
  }

  async processWebhook(params: {
    workspaceId: string;
    connectionId: string;
    payload: Record<string, unknown>;
  }): Promise<WebhookProcessResult> {
    const conn = await providerConnectionService.getConnection(params.connectionId);
    if (!conn) throw new Error(`Connection not found: ${params.connectionId}`);

    const webhookRecord = await providerWebhookService.receiveWebhook({
      connectionId: params.connectionId,
      providerId: conn.provider_id,
      workspaceId: params.workspaceId,
      rawPayload: params.payload,
    });

    const provider = providerFactory.createOptional(conn.provider_key as ProviderKey);
    if (!provider) throw new Error(`Provider not registered: ${conn.provider_key}`);

    const ctx = await this.buildContext(conn);
    return providerWebhookService.processWebhook(ctx, webhookRecord.id, params.payload);
  }

  // ----------------------------------------------------------
  // Health
  // ----------------------------------------------------------

  async checkHealth(connectionId: string): Promise<HealthCheckResult> {
    return providerHealthService.checkConnection(connectionId);
  }

  async checkWorkspaceHealth(workspaceId: string): Promise<HealthCheckResult[]> {
    return providerHealthService.checkWorkspace(workspaceId);
  }

  async getHealthSummary(workspaceId: string): Promise<ProviderHealthSummary> {
    return providerHealthService.getHealthSummary(workspaceId);
  }

  // ----------------------------------------------------------
  // Analytics
  // ----------------------------------------------------------

  async getAnalytics(workspaceId: string): Promise<ProviderAnalytics> {
    return providerAnalyticsService.getAnalytics(workspaceId);
  }

  // ----------------------------------------------------------
  // Capabilities
  // ----------------------------------------------------------

  async getCapabilities(providerId: string) {
    return providerCapabilityService.getCapabilities(providerId);
  }

  async hasCapability(providerId: string, capability: CapabilityKey): Promise<boolean> {
    return providerCapabilityService.hasCapability(providerId, capability);
  }

  // ----------------------------------------------------------
  // Rate Limits
  // ----------------------------------------------------------

  async checkRateLimit(connectionId: string): Promise<{ allowed: boolean; remaining: number; resetAt: string | null }> {
    const { data, error } = await supabase
      .from('provider_rate_limits')
      .select('*')
      .eq('connection_id', connectionId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return { allowed: true, remaining: Number.MAX_SAFE_INTEGER, resetAt: null };

    const limit = data as { current_count: number; max_requests: number; reset_at: string | null; remaining: number | null };
    const remaining = limit.remaining ?? (limit.max_requests - limit.current_count);
    const allowed = remaining > 0 && (!limit.reset_at || new Date(limit.reset_at) > new Date());
    return { allowed, remaining, resetAt: limit.reset_at };
  }

  // ----------------------------------------------------------
  // Private Helpers
  // ----------------------------------------------------------

  private async findOrCreateConnection(workspaceId: string, provider: CommunicationProviderRecord): Promise<ProviderConnectionRecord> {
    const { data: existing } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider_id', provider.id)
      .maybeSingle();

    if (existing) return existing as ProviderConnectionRecord;

    return providerConnectionService.createConnection({
      workspaceId,
      providerId: provider.id,
      providerKey: provider.provider_key as ProviderKey,
    });
  }

  private async buildContext(conn: ProviderConnectionRecord): Promise<ProviderContext> {
    return {
      connectionId: conn.id,
      workspaceId: conn.workspace_id,
      providerKey: conn.provider_key as ProviderKey,
      connectedAccount: conn.connected_account,
      credentials: conn.credentials,
      metadata: conn.metadata,
    };
  }

  private async executeWithLogging<T>(
    operation: () => Promise<T>,
    logParams: {
      connectionId: string;
      workspaceId: string;
      operation: OperationType;
      direction: Direction;
    }
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await operation();
      const latency = Date.now() - startTime;
      await this.logOperation({
        ...logParams,
        status: 'success',
        latencyMs: latency,
        responseData: { result },
      });
      return result;
    } catch (err) {
      const latency = Date.now() - startTime;
      await this.logOperation({
        ...logParams,
        status: 'failure',
        latencyMs: latency,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      });
      throw err;
    }
  }

  private async logOperation(params: {
    connectionId: string;
    workspaceId: string;
    operation: OperationType;
    direction: Direction;
    status: OperationStatus;
    latencyMs: number;
    responseData?: Record<string, unknown>;
    errorMessage?: string;
  }): Promise<void> {
    const { error } = await supabase.from('provider_logs').insert({
      connection_id: params.connectionId,
      workspace_id: params.workspaceId,
      operation: params.operation,
      direction: params.direction,
      status: params.status,
      latency_ms: params.latencyMs,
      response_data: params.responseData ?? {},
      error_message: params.errorMessage ?? null,
    });
    if (error) console.error('[CommunicationProviderManager] Failed to log operation:', error.message);
  }

  private async logEvent(
    connectionId: string,
    providerId: string,
    workspaceId: string,
    eventType: string,
    eventStatus: string,
    message: string
  ): Promise<void> {
    const { error } = await supabase.from('provider_events').insert({
      connection_id: connectionId,
      provider_id: providerId,
      workspace_id: workspaceId,
      event_type: eventType,
      event_status: eventStatus,
      message,
    });
    if (error) console.error('[CommunicationProviderManager] Failed to log event:', error.message);
  }

  // ----------------------------------------------------------
  // Gmail Facade — single execution path for all Gmail operations
  // ----------------------------------------------------------

  private getGmailProvider(): GmailProvider {
    const provider = providerRegistry.get('gmail');
    if (!provider) throw new Error('Gmail provider not registered.');
    return provider as unknown as GmailProvider;
  }

  async gmailGetConnectionState(workspaceId: string): Promise<GmailConnectionState> {
    return this.getGmailProvider().getConnectionState(workspaceId);
  }

  async gmailGetMessages(gmailAccountId: string, options?: {
    label?: string;
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    includeArchived?: boolean;
  }): Promise<GmailMessage[]> {
    return this.getGmailProvider().getMessages(gmailAccountId, options);
  }

  async gmailGetThreads(gmailAccountId: string, limit?: number): Promise<GmailThread[]> {
    return this.getGmailProvider().getThreads(gmailAccountId, limit);
  }

  async gmailConnect(workspaceId: string): Promise<ConnectGmailResult> {
    return this.getGmailProvider().connectGmail(workspaceId);
  }

  async gmailDisconnect(gmailAccountId: string): Promise<DisconnectGmailResult> {
    return this.getGmailProvider().disconnectGmail(gmailAccountId);
  }

  async gmailSyncInbox(workspaceId: string, gmailAccountId: string, pageToken?: string): Promise<import('@/types/gmail').SyncResult> {
    return this.getGmailProvider().syncInbox(workspaceId, gmailAccountId, pageToken);
  }

  async gmailSyncSent(workspaceId: string, gmailAccountId: string, pageToken?: string): Promise<import('@/types/gmail').SyncResult> {
    return this.getGmailProvider().syncSent(workspaceId, gmailAccountId, pageToken);
  }

  async gmailSyncDrafts(workspaceId: string, gmailAccountId: string, pageToken?: string): Promise<import('@/types/gmail').SyncResult> {
    return this.getGmailProvider().syncDrafts(workspaceId, gmailAccountId, pageToken);
  }

  async gmailIncrementalSync(workspaceId: string, gmailAccountId: string): Promise<import('@/types/gmail').SyncResult> {
    return this.getGmailProvider().incrementalSync(workspaceId, gmailAccountId);
  }

  async gmailSearch(workspaceId: string, gmailAccountId: string, params: SearchParams): Promise<GmailMessage[]> {
    return this.getGmailProvider().searchGmail(workspaceId, gmailAccountId, params);
  }

  async gmailSendEmail(workspaceId: string, params: SendEmailParams): Promise<{ messageId: string | null; threadId: string | null }> {
    return this.getGmailProvider().sendEmail(workspaceId, params);
  }

  async gmailReplyEmail(workspaceId: string, params: ReplyEmailParams): Promise<{ messageId: string | null; threadId: string | null }> {
    return this.getGmailProvider().replyEmail(workspaceId, params);
  }

  async gmailMarkAsRead(workspaceId: string, gmailAccountId: string, googleMessageId: string): Promise<ModifyMessageResult> {
    return this.getGmailProvider().markAsRead(workspaceId, gmailAccountId, googleMessageId);
  }

  async gmailMarkAsUnread(workspaceId: string, gmailAccountId: string, googleMessageId: string): Promise<ModifyMessageResult> {
    return this.getGmailProvider().markAsUnread(workspaceId, gmailAccountId, googleMessageId);
  }

  async gmailStar(workspaceId: string, gmailAccountId: string, googleMessageId: string): Promise<ModifyMessageResult> {
    return this.getGmailProvider().star(workspaceId, gmailAccountId, googleMessageId);
  }

  async gmailUnstar(workspaceId: string, gmailAccountId: string, googleMessageId: string): Promise<ModifyMessageResult> {
    return this.getGmailProvider().unstar(workspaceId, gmailAccountId, googleMessageId);
  }

  async gmailArchive(workspaceId: string, gmailAccountId: string, googleMessageId: string): Promise<ModifyMessageResult> {
    return this.getGmailProvider().archive(workspaceId, gmailAccountId, googleMessageId);
  }

  async gmailUnarchive(workspaceId: string, gmailAccountId: string, googleMessageId: string): Promise<ModifyMessageResult> {
    return this.getGmailProvider().unarchive(workspaceId, gmailAccountId, googleMessageId);
  }

  async gmailGetAttachment(workspaceId: string, googleMessageId: string, attachmentId: string): Promise<GetAttachmentResult> {
    return this.getGmailProvider().getAttachment(workspaceId, googleMessageId, attachmentId);
  }

  async gmailRefresh(workspaceId: string, gmailAccountId: string): Promise<import('@/types/gmail').RefreshResult> {
    return this.getGmailProvider().refreshGmail(workspaceId, gmailAccountId);
  }

  gmailValidateScopes(grantedScopes: string[]): { valid: boolean; missing: string[] } {
    return this.getGmailProvider().validateScopes(grantedScopes);
  }

  gmailGetRequiredScopes(): string[] {
    return this.getGmailProvider().getRequiredScopes();
  }
}

export const communicationProviderManager = new CommunicationProviderManager();
