// ============================================================
// Personalization Agent — Barrel Export
// ============================================================

export { PersonalizationService, personalizationService, PERSONALIZATION_STAGES, MOCK_PROSPECTS, MOCK_AI_RECOMMENDATIONS } from './PersonalizationService';
export { PersonalizationOpenAIService, type IPersonalizationOpenAIService } from './OpenAIService';
export { PersonalizationFirecrawlService, type IPersonalizationFirecrawlService } from './FirecrawlService';
export { PersonalizationTavilyService, type IPersonalizationTavilyService } from './TavilyService';
export { PersonalizationLinkedInService, type IPersonalizationLinkedInService } from './LinkedInService';
export { PersonalizationCRMService, type IPersonalizationCRMService } from './CRMService';
export { type MockPersonalization } from './mockData';
