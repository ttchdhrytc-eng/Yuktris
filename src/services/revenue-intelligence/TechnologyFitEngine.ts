// ============================================================
// TechnologyFitEngine — Scores technology stack fit
// ============================================================

import type { CompanyIntelligenceInput, ScoreResult, ScoreFactor, SignalType } from '@/types/revenue-intelligence';

class TechnologyFitEngine {
  // Technologies that indicate a good fit for B2B SaaS sales tools
  private positiveIndicators = [
    'Salesforce', 'HubSpot', 'Pipedrive', 'Zoho', 'Apollo', 'Outreach',
    'Salesloft', 'LinkedIn Sales Navigator', 'Zoom', 'Slack', 'Notion',
    'Jira', 'Asana', 'Monday.com', 'Intercom', 'Zendesk',
    'Google Analytics', 'Segment', 'Mixpanel', 'Amplitude',
    'AWS', 'Google Cloud', 'Cloudflare', 'Paddle',
  ];

  // Technologies that indicate potential incompatibility
  private negativeIndicators = [
    'WordPress', 'Wix', 'Squarespace',
  ];

  score(company: CompanyIntelligenceInput): ScoreResult {
    const factors: ScoreFactor[] = [];
    const techStack = company.technology_stack ?? [];

    // Stack size factor
    const stackSize = techStack.length;
    const sizeScore = Math.min(stackSize / 15, 1.0);
    factors.push({ name: 'stack_size', weight: 0.2, value: sizeScore, description: `${stackSize} technologies detected` });

    // Positive indicator match
    const positiveMatches = techStack.filter((t) =>
      this.positiveIndicators.some((pi) =>
        t.name.toLowerCase().includes(pi.toLowerCase()) || pi.toLowerCase().includes(t.name.toLowerCase())
      )
    );
    const positiveScore = Math.min(positiveMatches.length / 3, 1.0);
    factors.push({ name: 'positive_tech_match', weight: 0.35, value: positiveScore, description: `${positiveMatches.length} positive technology indicators` });

    // Negative indicator match
    const negativeMatches = techStack.filter((t) =>
      this.negativeIndicators.some((ni) =>
        t.name.toLowerCase().includes(ni.toLowerCase())
      )
    );
    const negativeScore = Math.max(1.0 - (negativeMatches.length * 0.3), 0.0);
    factors.push({ name: 'negative_tech_penalty', weight: 0.2, value: negativeScore, description: `${negativeMatches.length} negative indicators` });

    // Technology modernity (confidence in detection)
    const avgTechConfidence = techStack.length > 0
      ? techStack.reduce((sum, t) => sum + t.confidence, 0) / techStack.length
      : 0;
    factors.push({ name: 'detection_confidence', weight: 0.25, value: avgTechConfidence, description: `Average detection confidence: ${Math.round(avgTechConfidence * 100)}%` });

    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedScore = factors.reduce((sum, f) => sum + (f.value * f.weight), 0) / totalWeight;
    const confidence = techStack.length > 0 ? Math.min(0.5 + techStack.length * 0.05, 1.0) : 0.2;

    return { score: Math.round(weightedScore * 100) / 100, confidence, factors };
  }

  extractSignals(company: CompanyIntelligenceInput): { signal_type: SignalType; signal_strength: number; confidence_score: number; description: string; source: string }[] {
    const signals: { signal_type: SignalType; signal_strength: number; confidence_score: number; description: string; source: string }[] = [];
    const techStack = company.technology_stack ?? [];

    const positiveMatches = techStack.filter((t) =>
      this.positiveIndicators.some((pi) =>
        t.name.toLowerCase().includes(pi.toLowerCase()) || pi.toLowerCase().includes(t.name.toLowerCase())
      )
    );

    for (const match of positiveMatches) {
      signals.push({
        signal_type: 'technology_fit',
        signal_strength: match.confidence,
        confidence_score: match.confidence,
        description: `Uses ${match.name} — indicates compatibility with B2B sales tools`,
        source: 'research_intelligence',
      });
    }

    return signals;
  }
}

export const technologyFitEngine = new TechnologyFitEngine();
