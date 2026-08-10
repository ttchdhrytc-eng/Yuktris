// ============================================================
// TechnologyAnalyzer — Detects and categorizes technology stack
// ============================================================

import type { CompanyIntelligenceRecord, TechnologyItem } from '@/types/research-intelligence';

class TechnologyAnalyzer {
  private knownTechnologies: Record<string, { category: string; patterns: string[] }> = {
    'React': { category: 'Frontend', patterns: ['react', 'reactjs', 'react.js'] },
    'Vue.js': { category: 'Frontend', patterns: ['vue', 'vuejs', 'vue.js'] },
    'Angular': { category: 'Frontend', patterns: ['angular'] },
    'Next.js': { category: 'Frontend', patterns: ['next.js', 'nextjs', '__next'] },
    'WordPress': { category: 'CMS', patterns: ['wordpress', 'wp-content', 'wp-includes'] },
    'Shopify': { category: 'E-commerce', patterns: ['shopify', 'cdn.shopify'] },
    'AWS': { category: 'Cloud', patterns: ['aws', 'amazonaws', 'cloudfront'] },
    'Google Cloud': { category: 'Cloud', patterns: ['google cloud', 'gcp', 'googleapis'] },
    'Cloudflare': { category: 'CDN', patterns: ['cloudflare', 'cdn-cgi'] },
    'HubSpot': { category: 'Marketing', patterns: ['hubspot', 'hs-scripts'] },
    'Paddle': { category: 'Payments', patterns: ['paddle', 'js.paddle'] },
    'Intercom': { category: 'Customer Support', patterns: ['intercom', 'widget.intercom'] },
    'Salesforce': { category: 'CRM', patterns: ['salesforce', 'force.com'] },
    'Marketo': { category: 'Marketing', patterns: ['marketo', 'mkto'] },
    'Google Analytics': { category: 'Analytics', patterns: ['google analytics', 'google-analytics', 'gtag', 'ga.js'] },
    'Segment': { category: 'Analytics', patterns: ['segment', 'analytics.js'] },
    'jQuery': { category: 'Frontend', patterns: ['jquery'] },
    'Tailwind CSS': { category: 'Frontend', patterns: ['tailwind', 'cdn.tailwindcss'] },
    'Node.js': { category: 'Backend', patterns: ['node', 'nodejs', 'express'] },
    'Python': { category: 'Backend', patterns: ['python', 'django', 'flask'] },
    'Ruby': { category: 'Backend', patterns: ['ruby', 'rails', 'ruby on rails'] },
    'PHP': { category: 'Backend', patterns: ['php'] },
    'Kubernetes': { category: 'DevOps', patterns: ['kubernetes', 'k8s'] },
    'Docker': { category: 'DevOps', patterns: ['docker'] },
  };

  analyze(content: string, metadata: Record<string, unknown> = {}): TechnologyItem[] {
    const detected = new Map<string, TechnologyItem>();
    const text = content.toLowerCase();
    const metaText = JSON.stringify(metadata).toLowerCase();

    for (const [name, info] of Object.entries(this.knownTechnologies)) {
      for (const pattern of info.patterns) {
        if (text.includes(pattern) || metaText.includes(pattern)) {
          if (!detected.has(name)) {
            detected.set(name, {
              name,
              category: info.category,
              confidence: this.calculateConfidence(pattern, text),
            });
          }
          break;
        }
      }
    }

    return Array.from(detected.values());
  }

  private calculateConfidence(pattern: string, text: string): number {
    const occurrences = (text.match(new RegExp(pattern, 'g')) ?? []).length;
    if (occurrences >= 5) return 0.95;
    if (occurrences >= 3) return 0.85;
    if (occurrences >= 1) return 0.75;
    return 0.5;
  }

  categorizeByStack(technologies: TechnologyItem[]): Record<string, TechnologyItem[]> {
    const categories: Record<string, TechnologyItem[]> = {};
    for (const tech of technologies) {
      if (!categories[tech.category]) categories[tech.category] = [];
      categories[tech.category].push(tech);
    }
    return categories;
  }

  detectFromHtml(html: string): TechnologyItem[] {
    return this.analyze(html);
  }

  detectFromScripts(scriptUrls: string[]): TechnologyItem[] {
    const text = scriptUrls.join(' ');
    return this.analyze(text);
  }
}

export const technologyAnalyzer = new TechnologyAnalyzer();
