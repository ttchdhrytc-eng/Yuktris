// ============================================================
// ContextValidator — Validates context completeness and quality
// ============================================================

import type { ContextFragment, ContextRequest, AssembledContext } from '@/types/context-engine';

class ContextValidator {
  validateFragments(fragments: ContextFragment[], request: ContextRequest): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (fragments.length === 0) {
      errors.push('No context fragments collected from any source.');
      return { valid: false, errors, warnings };
    }

    // Check for critical sources
    const sources = new Set(fragments.map((f) => f.source));
    if (request.contextType === 'company' && !sources.has('research_intelligence')) {
      warnings.push('Research Intelligence not available — company context may be incomplete.');
    }
    if (request.contextType === 'prospect' && !sources.has('revenue_intelligence')) {
      warnings.push('Revenue Intelligence not available — prospect scoring may be unavailable.');
    }

    // Validate individual fragments
    for (const fragment of fragments) {
      if (!fragment.source || !fragment.content) {
        errors.push(`Invalid fragment: missing source or content.`);
      }
      if (fragment.token_estimate <= 0) {
        warnings.push(`Fragment from ${fragment.source} has zero token estimate.`);
      }
      if (fragment.confidence < 0 || fragment.confidence > 1) {
        warnings.push(`Fragment from ${fragment.source} has invalid confidence: ${fragment.confidence}.`);
      }
    }

    // Check for data leakage
    for (const fragment of fragments) {
      if (this.containsSensitiveData(fragment.content)) {
        warnings.push(`Fragment from ${fragment.source} may contain sensitive data — will be masked.`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  validateAssembled(context: AssembledContext): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!context.system) {
      errors.push('System context is missing.');
    }

    if (!context.system.role || !context.system.instructions) {
      errors.push('System context is incomplete — missing role or instructions.');
    }

    if (context.metadata.token_count <= 0) {
      errors.push('Token count is zero or negative.');
    }

    if (context.metadata.source_count === 0) {
      errors.push('No sources contributed to the context.');
    }

    return { valid: errors.length === 0, errors };
  }

  containsSensitiveData(content: Record<string, unknown>): boolean {
    const json = JSON.stringify(content).toLowerCase();
    const sensitivePatterns = ['password', 'secret', 'api_key', 'token', 'credential', 'private_key'];
    return sensitivePatterns.some((p) => json.includes(p));
  }

  maskSensitiveData(content: Record<string, unknown>): Record<string, unknown> {
    const masked = { ...content };
    const sensitiveKeys = ['password', 'secret', 'api_key', 'token', 'credential', 'private_key', 'ssn', 'credit_card'];

    for (const key of Object.keys(masked)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        masked[key] = '[REDACTED]';
      } else if (typeof masked[key] === 'object' && masked[key] !== null) {
        masked[key] = this.maskSensitiveData(masked[key] as Record<string, unknown>);
      }
    }

    return masked;
  }

  calculateQualityScore(fragments: ContextFragment[], context: AssembledContext): number {
    if (fragments.length === 0) return 0;

    // Average confidence of fragments
    const avgConfidence = fragments.reduce((sum, f) => sum + f.confidence, 0) / fragments.length;

    // Source diversity bonus
    const uniqueSources = new Set(fragments.map((f) => f.source)).size;
    const diversityBonus = Math.min(uniqueSources / 5, 1) * 0.2;

    // Completeness (how many context sections are populated)
    const sections = ['system', 'business', 'company', 'prospect', 'relationship', 'research', 'revenue', 'task', 'user', 'conversation', 'execution'];
    const populatedSections = sections.filter((s) => context[s as keyof AssembledContext] !== undefined).length;
    const completenessScore = populatedSections / sections.length;

    return Math.min((avgConfidence * 0.5) + (completenessScore * 0.3) + diversityBonus, 1.0);
  }
}

export const contextValidator = new ContextValidator();
