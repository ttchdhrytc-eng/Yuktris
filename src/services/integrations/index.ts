// ============================================================
// Integration Hub — Service Index + Provider Registration
// ============================================================
//
// This module registers every provider with the ProviderRegistry.
// Future providers become available by adding a registration line
// here — no other code changes needed.

import { providerRegistry } from './ProviderRegistry';
import { GoogleProvider } from './providers/GoogleProvider';
import { LinkedInProvider } from './providers/LinkedInProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { FirecrawlProvider } from './providers/FirecrawlProvider';
import { TavilyProvider } from './providers/TavilyProvider';
import { HubSpotProvider } from './providers/HubSpotProvider';
import { SalesforceProvider } from './providers/SalesforceProvider';
import { SlackProvider } from './providers/SlackProvider';
import { ZoomProvider } from './providers/ZoomProvider';

// ----------------------------------------------------------
// Register all providers
// ----------------------------------------------------------

providerRegistry.register(new GoogleProvider());
providerRegistry.register(new LinkedInProvider());
providerRegistry.register(new OpenAIProvider());
providerRegistry.register(new FirecrawlProvider());
providerRegistry.register(new TavilyProvider());
providerRegistry.register(new HubSpotProvider());
providerRegistry.register(new SalesforceProvider());
providerRegistry.register(new SlackProvider());
providerRegistry.register(new ZoomProvider());

// ----------------------------------------------------------
// Re-exports
// ----------------------------------------------------------

export { integrationHubService } from './IntegrationHubService';
export { providerRegistry } from './ProviderRegistry';
export { integrationLogger } from './IntegrationLogger';
export { integrationHealthService } from './IntegrationHealthService';
export { BaseIntegrationProvider } from './BaseIntegrationProvider';
export type {
  ProviderId,
  ProviderDefinition,
  IntegrationRecord,
  IntegrationPermissionRecord,
  IntegrationLogRecord,
  IntegrationViewModel,
  HealthCheckResult,
  SyncResult,
  RefreshResult,
  ConnectResult,
  ConnectionHealth,
  IntegrationStatus,
  LogEvent,
  LogStatus,
} from '@/types/integrations';
