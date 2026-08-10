// ============================================================
// Enterprise Communication Provider Layer — Service Index
// ============================================================

export { communicationProviderManager } from './CommunicationProviderManager';
export { providerRegistry } from './ProviderRegistry';
export { providerFactory } from './ProviderFactory';
export { providerRouter } from './ProviderRouter';
export { providerHealthService } from './ProviderHealthService';
export { providerConnectionService } from './ProviderConnectionService';
export { providerCapabilityService } from './ProviderCapabilityService';
export { providerRetryService } from './ProviderRetryService';
export { providerWebhookService } from './ProviderWebhookService';
export { providerAnalyticsService } from './ProviderAnalyticsService';
export { gmailProvider, GMAIL_DEFINITION } from './GmailProvider';

// Register Gmail provider in the communication provider registry
import { providerRegistry } from './ProviderRegistry';
import { gmailProvider, GMAIL_DEFINITION } from './GmailProvider';
providerRegistry.register(gmailProvider, GMAIL_DEFINITION);

export type {
  ProviderKey, ProviderType, AuthType, ConnectionStatus, ConnectionHealth,
  EventType, EventStatus, OperationType, OperationStatus, Direction,
  CapabilityKey, WebhookStatus,
  CommunicationProviderRecord, ProviderConnectionRecord,
  ProviderCapabilityRecord, ProviderHealthRecord, ProviderEventRecord,
  ProviderLogRecord, ProviderRateLimitRecord, ProviderWebhookRecord,
  ProviderContext, ProviderDefinition,
  SendMessageRequest, SendMessageResult, ScheduleMessageRequest,
  SearchMessagesRequest, SearchMessagesResult, ProviderMessage,
  ProviderThread, ProviderFolder, SyncResult, HealthCheckResult,
  ConnectResult, RefreshResult, WebhookRegistration, WebhookProcessResult,
  ICommunicationProvider,
  ConnectRequest, DisconnectRequest, TestConnectionRequest, SyncRequest,
  ProviderHealthSummary, ProviderAnalytics, ProviderConnectionViewModel,
} from '@/types/communication-providers';
