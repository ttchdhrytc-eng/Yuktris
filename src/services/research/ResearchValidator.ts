// ============================================================
// ResearchValidator — Input validation and domain sanitization
// ============================================================

import type { ResearchContext, ResearchRequestType } from '@/types/research-intelligence';

class ResearchValidator {
  private validRequestTypes: ResearchRequestType[] = [
    'company_profile', 'technology_stack', 'seo_analysis', 'business_model',
    'buying_signals', 'growth_signals', 'full_intelligence', 'refresh',
  ];

  private blockedDomains = [
    'localhost', '127.0.0.1', '0.0.0.0', 'example.com', 'example.org',
  ];

  validateCompanyName(name: string): { valid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Company name is required.' };
    }
    if (name.length > 200) {
      return { valid: false, error: 'Company name is too long (max 200 characters).' };
    }
    if (/[<>{}]/.test(name)) {
      return { valid: false, error: 'Company name contains invalid characters.' };
    }
    return { valid: true };
  }

  validateWebsite(website: string | null): { valid: boolean; sanitized: string | null; error?: string } {
    if (!website) return { valid: true, sanitized: null };

    let sanitized = website.trim();
    if (!sanitized.match(/^https?:\/\//)) {
      sanitized = `https://${sanitized}`;
    }

    try {
      const url = new URL(sanitized);
      const domain = url.hostname.toLowerCase();

      if (this.blockedDomains.includes(domain)) {
        return { valid: false, sanitized: null, error: 'Domain is blocked.' };
      }

      return { valid: true, sanitized };
    } catch {
      return { valid: false, sanitized: null, error: 'Invalid URL format.' };
    }
  }

  validateRequestType(type: string): { valid: boolean; error?: string } {
    if (!this.validRequestTypes.includes(type as ResearchRequestType)) {
      return { valid: false, error: `Invalid request type: ${type}` };
    }
    return { valid: true };
  }

  validateContext(context: ResearchContext): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const nameCheck = this.validateCompanyName(context.companyName);
    if (!nameCheck.valid) errors.push(nameCheck.error!);

    const websiteCheck = this.validateWebsite(context.website);
    if (!websiteCheck.valid && context.website) errors.push(websiteCheck.error!);

    const typeCheck = this.validateRequestType(context.requestType);
    if (!typeCheck.valid) errors.push(typeCheck.error!);

    return { valid: errors.length === 0, errors };
  }

  sanitizeContent(content: string): string {
    return content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  isDuplicateRequest(companyName: string, requestType: string, recentRequests: { company_name: string; request_type: string; created_at: string }[]): boolean {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return recentRequests.some(
      (r) =>
        r.company_name.toLowerCase() === companyName.toLowerCase() &&
        r.request_type === requestType &&
        new Date(r.created_at).getTime() > fiveMinutesAgo
    );
  }
}

export const researchValidator = new ResearchValidator();
