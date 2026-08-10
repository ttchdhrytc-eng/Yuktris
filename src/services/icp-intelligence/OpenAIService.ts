// ============================================================
// OpenAIService — ICP Intelligence Agent
// ============================================================
//
// Interface placeholder for future OpenAI integration.
// No implementation — architecture only.

import type {
  ICPScoringInput,
  ICPScoringResult,
  BuyerPersonaResult,
  PainPointResult,
  GoalResult,
  BuyingTriggerResult,
  SalesNavigatorResult,
  ICPRecommendations,
} from '@/types/icp-intelligence';

export interface IICPOpenAIService {
  generateICP(businessSummary: string, marketSummary: string): Promise<unknown>;
  generateBuyerPersona(icpName: string, industry: string): Promise<BuyerPersonaResult[]>;
  generatePainPoints(icpName: string, industry: string): Promise<PainPointResult[]>;
  generateGoals(icpName: string, industry: string): Promise<GoalResult[]>;
  generateTriggers(icpName: string, industry: string): Promise<BuyingTriggerResult[]>;
  generateRecommendations(icpNames: string[]): Promise<ICPRecommendations>;
  scoreICP(input: ICPScoringInput): Promise<ICPScoringResult>;
  generateSalesNavigatorFilters(icpName: string, industry: string): Promise<SalesNavigatorResult>;
}

export class ICPOpenAIService implements IICPOpenAIService {
  async generateICP(_businessSummary: string, _marketSummary: string): Promise<unknown> {
    throw new Error('ICPOpenAIService.generateICP() not implemented');
  }
  async generateBuyerPersona(_icpName: string, _industry: string): Promise<BuyerPersonaResult[]> {
    throw new Error('ICPOpenAIService.generateBuyerPersona() not implemented');
  }
  async generatePainPoints(_icpName: string, _industry: string): Promise<PainPointResult[]> {
    throw new Error('ICPOpenAIService.generatePainPoints() not implemented');
  }
  async generateGoals(_icpName: string, _industry: string): Promise<GoalResult[]> {
    throw new Error('ICPOpenAIService.generateGoals() not implemented');
  }
  async generateTriggers(_icpName: string, _industry: string): Promise<BuyingTriggerResult[]> {
    throw new Error('ICPOpenAIService.generateTriggers() not implemented');
  }
  async generateRecommendations(_icpNames: string[]): Promise<ICPRecommendations> {
    throw new Error('ICPOpenAIService.generateRecommendations() not implemented');
  }
  async scoreICP(_input: ICPScoringInput): Promise<ICPScoringResult> {
    throw new Error('ICPOpenAIService.scoreICP() not implemented');
  }
  async generateSalesNavigatorFilters(_icpName: string, _industry: string): Promise<SalesNavigatorResult> {
    throw new Error('ICPOpenAIService.generateSalesNavigatorFilters() not implemented');
  }
}
