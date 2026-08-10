// ============================================================
// Research Intelligence Engine — Service Index
// ============================================================

export { researchEngine } from './ResearchEngine';
export { providerRouter } from './ProviderRouter';
export { researchPlanner } from './ResearchPlanner';
export { researchAggregator } from './ResearchAggregator';
export { researchNormalizer } from './ResearchNormalizer';
export { researchCache } from './ResearchCache';
export { researchValidator } from './ResearchValidator';
export { companyProfiler } from './CompanyProfiler';
export { technologyAnalyzer } from './TechnologyAnalyzer';
export { seoAnalyzer } from './SEOAnalyzer';
export { businessModelDetector } from './BusinessModelDetector';
export { buyingSignalDetector } from './BuyingSignalDetector';
export { growthSignalDetector } from './GrowthSignalDetector';

export { FirecrawlProvider } from './providers/FirecrawlProvider';
export { TavilyProvider } from './providers/TavilyProvider';
export { GoogleProvider } from './providers/GoogleProvider';
export { LinkedInProvider } from './providers/LinkedInProvider';
export { SchemaProvider } from './providers/SchemaProvider';
export { TechnologyProvider } from './providers/TechnologyProvider';
export { WHOISProvider } from './providers/WHOISProvider';

export type {
  ResearchProviderId,
  ProviderStatus,
  ProviderHealth,
  ResearchCapability,
  ResearchRequestType,
  ResearchRequestStatus,
  ResearchRequestRecord,
  CompanyIntelligenceRecord,
  ResearchSourceRecord,
  ResearchPlan,
  ProviderResult,
  AggregatedResult,
  NormalizedIntelligence,
  ResearchContext,
  IResearchProvider,
  ResearchMonitorSummary,
  CacheEntry,
  CacheStats,
  ResearchEventType,
  ResearchEvent,
  ResearchEventHandler,
  TechnologyItem,
  ServiceItem,
  ProductItem,
  TargetMarketItem,
  SocialProfile,
  ContactInformation,
  BuyingSignal,
  GrowthSignal,
  DecisionMaker,
  CompetitivePosition,
  SEOSummary,
} from '@/types/research-intelligence';
