// ============================================================
// ICPScoringService — Scores how well a company matches the ICP
// ============================================================

import type { CompanyIntelligenceInput, ICPDefinition, ScoreResult, ScoreFactor } from '@/types/revenue-intelligence';

class ICPScoringService {
  score(company: CompanyIntelligenceInput, icp: ICPDefinition | null): ScoreResult {
    if (!icp) {
      return { score: 0.5, confidence: 0.3, factors: [{ name: 'no_icp', weight: 1, value: 0.5, description: 'No ICP defined — using neutral score' }] };
    }

    const factors: ScoreFactor[] = [];

    // Industry match
    const industryScore = this.scoreIndustryMatch(company, icp);
    factors.push({ name: 'industry_match', weight: 0.25, value: industryScore.score, description: industryScore.reason });

    // Company size match
    const sizeScore = this.scoreCompanySize(company, icp);
    factors.push({ name: 'company_size_match', weight: 0.2, value: sizeScore.score, description: sizeScore.reason });

    // Business model match
    const modelScore = this.scoreBusinessModel(company, icp);
    factors.push({ name: 'business_model_match', weight: 0.15, value: modelScore.score, description: modelScore.reason });

    // Location match
    const locationScore = this.scoreLocationMatch(company, icp);
    factors.push({ name: 'location_match', weight: 0.15, value: locationScore.score, description: locationScore.reason });

    // Technology match
    const techScore = this.scoreTechnologyMatch(company, icp);
    factors.push({ name: 'technology_match', weight: 0.15, value: techScore.score, description: techScore.reason });

    // Exclusions
    const exclusionScore = this.scoreExclusions(company, icp);
    factors.push({ name: 'exclusion_check', weight: 0.1, value: exclusionScore.score, description: exclusionScore.reason });

    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedScore = factors.reduce((sum, f) => sum + (f.value * f.weight), 0) / totalWeight;
    const confidence = Math.min(factors.length / 6, 1.0);

    return { score: Math.round(weightedScore * 100) / 100, confidence, factors };
  }

  private scoreIndustryMatch(company: CompanyIntelligenceInput, icp: ICPDefinition): { score: number; reason: string } {
    if (!company.industry) return { score: 0.3, reason: 'No industry data available' };
    if (icp.target_industries.length === 0) return { score: 0.5, reason: 'No target industries defined' };

    const companyIndustry = company.industry.toLowerCase();
    const matched = icp.target_industries.some((ind) =>
      companyIndustry.includes(ind.toLowerCase()) || ind.toLowerCase().includes(companyIndustry)
    );

    if (matched) return { score: 1.0, reason: `Industry "${company.industry}" matches ICP target` };
    return { score: 0.2, reason: `Industry "${company.industry}" not in ICP targets` };
  }

  private scoreCompanySize(company: CompanyIntelligenceInput, icp: ICPDefinition): { score: number; reason: string } {
    if (!company.company_size) return { score: 0.4, reason: 'No company size data' };
    if (icp.target_company_sizes.length === 0) return { score: 0.5, reason: 'No target sizes defined' };

    const matched = icp.target_company_sizes.includes(company.company_size);
    if (matched) return { score: 1.0, reason: `Size "${company.company_size}" matches ICP` };
    return { score: 0.3, reason: `Size "${company.company_size}" not in ICP targets` };
  }

  private scoreBusinessModel(company: CompanyIntelligenceInput, icp: ICPDefinition): { score: number; reason: string } {
    if (!company.business_model) return { score: 0.4, reason: 'No business model data' };
    if (icp.target_business_models.length === 0) return { score: 0.5, reason: 'No target models defined' };

    const model = company.business_model.toLowerCase();
    const matched = icp.target_business_models.some((bm) => model.includes(bm.toLowerCase()));
    if (matched) return { score: 1.0, reason: `Business model "${company.business_model}" matches ICP` };
    return { score: 0.3, reason: `Business model "${company.business_model}" not in ICP targets` };
  }

  private scoreLocationMatch(company: CompanyIntelligenceInput, icp: ICPDefinition): { score: number; reason: string } {
    if (!company.locations || company.locations.length === 0) return { score: 0.4, reason: 'No location data' };
    if (icp.target_locations.length === 0) return { score: 0.5, reason: 'No target locations defined' };

    const companyLocations = company.locations.map((l) => l.toLowerCase());
    const matched = companyLocations.some((loc) =>
      icp.target_locations.some((tl) => loc.includes(tl.toLowerCase()) || tl.toLowerCase().includes(loc))
    );

    if (matched) return { score: 1.0, reason: 'Location matches ICP target' };
    return { score: 0.3, reason: 'Location not in ICP targets' };
  }

  private scoreTechnologyMatch(company: CompanyIntelligenceInput, icp: ICPDefinition): { score: number; reason: string } {
    if (!company.technology_stack || company.technology_stack.length === 0) return { score: 0.4, reason: 'No technology data' };
    if (icp.target_technologies.length === 0) return { score: 0.5, reason: 'No target technologies defined' };

    const companyTechs = company.technology_stack.map((t) => t.name.toLowerCase());
    const matchedCount = icp.target_technologies.filter((tt) =>
      companyTechs.some((ct) => ct.includes(tt.toLowerCase()) || tt.toLowerCase().includes(ct))
    ).length;

    const matchRatio = matchedCount / icp.target_technologies.length;
    if (matchRatio >= 0.5) return { score: 1.0, reason: `${matchedCount}/${icp.target_technologies.length} target technologies matched` };
    if (matchRatio > 0) return { score: 0.6, reason: `${matchedCount}/${icp.target_technologies.length} target technologies matched` };
    return { score: 0.2, reason: 'No target technologies matched' };
  }

  private scoreExclusions(company: CompanyIntelligenceInput, icp: ICPDefinition): { score: number; reason: string } {
    if (company.industry && icp.excluded_industries.length > 0) {
      const excluded = icp.excluded_industries.some((ei) =>
        company.industry!.toLowerCase().includes(ei.toLowerCase())
      );
      if (excluded) return { score: 0.0, reason: `Industry "${company.industry}" is excluded` };
    }

    if (company.company_size && icp.excluded_company_sizes.length > 0) {
      const excluded = icp.excluded_company_sizes.includes(company.company_size);
      if (excluded) return { score: 0.0, reason: `Size "${company.company_size}" is excluded` };
    }

    return { score: 1.0, reason: 'No exclusions triggered' };
  }
}

export const icpScoringService = new ICPScoringService();
