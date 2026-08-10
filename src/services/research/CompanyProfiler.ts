// ============================================================
// CompanyProfiler — Extracts company profile from research data
// ============================================================

import type { CompanyIntelligenceRecord } from '@/types/research-intelligence';

export class CompanyProfiler {
  extractProfile(data: Record<string, unknown>): Partial<CompanyIntelligenceRecord> {
    return {
      company_name: (data.company_name as string) ?? null,
      website: (data.website as string) ?? null,
      industry: this.detectIndustry(data),
      sub_industry: this.detectSubIndustry(data),
      business_model: this.detectBusinessModel(data),
      company_size: this.detectCompanySize(data),
      locations: this.detectLocations(data),
      summary: (data.summary as string) ?? null,
      brand_positioning: (data.brand_positioning as string) ?? null,
      target_market: this.extractTargetMarket(data),
    };
  }

  private detectIndustry(data: Record<string, unknown>): string | null {
    if (data.industry) return data.industry as string;

    const text = this.combineText(data);
    const industries = [
      'SaaS', 'Fintech', 'Healthcare', 'E-commerce', 'Manufacturing',
      'Consulting', 'Marketing', 'Real Estate', 'Education', 'Logistics',
      'AI/ML', 'Cybersecurity', 'DevOps', 'Data Analytics', 'HR Tech',
    ];

    for (const industry of industries) {
      if (text.toLowerCase().includes(industry.toLowerCase())) return industry;
    }
    return null;
  }

  private detectSubIndustry(data: Record<string, unknown>): string | null {
    if (data.sub_industry) return data.sub_industry as string;
    return null;
  }

  private detectBusinessModel(data: Record<string, unknown>): string | null {
    if (data.business_model) return data.business_model as string;

    const text = this.combineText(data).toLowerCase();
    if (text.includes('subscription') || text.includes('saas') || text.includes('monthly')) return 'SaaS/Subscription';
    if (text.includes('marketplace') || text.includes('platform')) return 'Marketplace';
    if (text.includes('agency') || text.includes('consulting') || text.includes('services')) return 'Services';
    if (text.includes('enterprise') || text.includes('license')) return 'Enterprise License';
    if (text.includes('freemium') || text.includes('free tier')) return 'Freemium';
    if (text.includes('transaction') || text.includes('commission')) return 'Transaction-based';
    return null;
  }

  private detectCompanySize(data: Record<string, unknown>): string | null {
    if (data.company_size) return data.company_size as string;

    const text = this.combineText(data).toLowerCase();
    const employeeMatch = text.match(/(\d+)\+?\s*(?:employees|staff|people|team)/);
    if (employeeMatch) {
      const count = parseInt(employeeMatch[1], 10);
      if (count < 50) return '1-50';
      if (count < 200) return '51-200';
      if (count < 1000) return '201-1000';
      return '1000+';
    }
    return null;
  }

  private detectLocations(data: Record<string, unknown>): string[] {
    if (Array.isArray(data.locations)) return data.locations as string[];

    const text = this.combineText(data);
    const locations = new Set<string>();
    const cityPatterns = [
      /San Francisco/gi, /New York/gi, /London/gi, /Berlin/gi, /Tokyo/gi,
      /Singapore/gi, /Toronto/gi, /Sydney/gi, /Paris/gi, /Amsterdam/gi,
      /Austin/gi, /Seattle/gi, /Boston/gi, /Chicago/gi, /Denver/gi,
      /Remote/gi, /Distributed/gi,
    ];

    for (const pattern of cityPatterns) {
      const matches = text.match(pattern);
      if (matches) matches.forEach((m) => locations.add(m));
    }

    return Array.from(locations);
  }

  private extractTargetMarket(data: Record<string, unknown>): CompanyIntelligenceRecord['target_market'] {
    if (Array.isArray(data.target_market)) return data.target_market as CompanyIntelligenceRecord['target_market'];

    const text = this.combineText(data).toLowerCase();
    const segments: CompanyIntelligenceRecord['target_market'] = [];

    if (text.includes('enterprise')) segments.push({ segment: 'Enterprise', description: 'Large organizations' });
    if (text.includes('smb') || text.includes('small business')) segments.push({ segment: 'SMB', description: 'Small and medium businesses' });
    if (text.includes('startup')) segments.push({ segment: 'Startups', description: 'Early-stage companies' });
    if (text.includes('developer') || text.includes('engineering')) segments.push({ segment: 'Developers', description: 'Technical practitioners' });
    if (text.includes('b2b')) segments.push({ segment: 'B2B', description: 'Business-to-business' });
    if (text.includes('b2c')) segments.push({ segment: 'B2C', description: 'Business-to-consumer' });

    return segments;
  }

  private combineText(data: Record<string, unknown>): string {
    const parts: string[] = [];
    for (const value of Object.values(data)) {
      if (typeof value === 'string') parts.push(value);
      else if (Array.isArray(value)) parts.push(value.filter((v) => typeof v === 'string').join(' '));
    }
    return parts.join(' ');
  }
}

export const companyProfiler = new CompanyProfiler();
