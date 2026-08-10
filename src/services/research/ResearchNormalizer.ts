// ============================================================
// ResearchNormalizer — Normalizes aggregated data into unified model
// ============================================================

import { providerRouter } from './ProviderRouter';
import { researchValidator } from './ResearchValidator';
import type {
  AggregatedResult,
  NormalizedIntelligence,
  CompanyIntelligenceRecord,
  ProviderResult,
  ResearchSourceRecord,
  ResearchProviderId,
} from '@/types/research-intelligence';

class ResearchNormalizer {
  normalize(aggregated: AggregatedResult): NormalizedIntelligence {
    const merged = aggregated.merged;
    const normalized: Partial<CompanyIntelligenceRecord> = {};

    normalized.company_name = (merged.company_name as string) ?? null;
    normalized.website = (merged.website as string) ?? null;
    normalized.industry = (merged.industry as string) ?? null;
    normalized.sub_industry = (merged.sub_industry as string) ?? null;
    normalized.business_model = (merged.business_model as string) ?? null;
    normalized.company_size = (merged.company_size as string) ?? null;
    normalized.locations = (merged.locations as string[]) ?? [];
    normalized.summary = this.sanitizeSummary(merged.summary as string);
    normalized.technology_stack = (merged.technology_stack as CompanyIntelligenceRecord['technology_stack']) ?? [];
    normalized.services = (merged.services as CompanyIntelligenceRecord['services']) ?? [];
    normalized.products = (merged.products as CompanyIntelligenceRecord['products']) ?? [];
    normalized.target_market = (merged.target_market as CompanyIntelligenceRecord['target_market']) ?? [];
    normalized.brand_positioning = (merged.brand_positioning as string) ?? null;
    normalized.seo_summary = (merged.seo_summary as CompanyIntelligenceRecord['seo_summary']) ?? {} as CompanyIntelligenceRecord['seo_summary'];
    normalized.social_profiles = (merged.social_profiles as CompanyIntelligenceRecord['social_profiles']) ?? [];
    normalized.contact_information = (merged.contact_information as CompanyIntelligenceRecord['contact_information']) ?? {} as CompanyIntelligenceRecord['contact_information'];
    normalized.buying_signals = (merged.buying_signals as CompanyIntelligenceRecord['buying_signals']) ?? [];
    normalized.growth_signals = (merged.growth_signals as CompanyIntelligenceRecord['growth_signals']) ?? [];
    normalized.decision_makers = (merged.decision_makers as CompanyIntelligenceRecord['decision_makers']) ?? [];
    normalized.competitive_positioning = (merged.competitive_positioning as CompanyIntelligenceRecord['competitive_positioning']) ?? {} as CompanyIntelligenceRecord['competitive_positioning'];

    for (const result of aggregated.results) {
      if (!result.success) continue;
      const provider = providerRouter.getProvider(result.provider as ResearchProviderId);
      if (!provider) continue;

      const providerNormalized = provider.normalize(result.data);
      for (const [key, value] of Object.entries(providerNormalized)) {
        if (value === null || value === undefined) continue;
        if (normalized[key as keyof CompanyIntelligenceRecord] === undefined ||
            normalized[key as keyof CompanyIntelligenceRecord] === null ||
            (Array.isArray(normalized[key as keyof CompanyIntelligenceRecord]) &&
             (normalized[key as keyof CompanyIntelligenceRecord] as unknown[]).length === 0)) {
          (normalized as Record<string, unknown>)[key] = value;
        }
      }
    }

    const sources = this.buildSources(aggregated.results);
    const confidenceScore = aggregated.totalConfidence;

    return {
      companyIntelligence: normalized,
      sources,
      confidenceScore,
    };
  }

  private sanitizeSummary(summary: string | null): string | null {
    if (!summary) return null;
    return researchValidator.sanitizeContent(summary);
  }

  private buildSources(results: ProviderResult[]): Omit<ResearchSourceRecord, 'id' | 'company_intelligence_id'>[] {
    return results
      .filter((r) => r.success)
      .map((r) => ({
        provider: r.provider as ResearchProviderId,
        source_url: r.source_url,
        confidence_score: r.confidence,
        retrieved_at: new Date().toISOString(),
      }));
  }
}

export const researchNormalizer = new ResearchNormalizer();
