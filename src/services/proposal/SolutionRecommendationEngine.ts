// ============================================================
// SolutionRecommendationEngine — Recommends services/solutions
// ============================================================

import type { SolutionRecommendation, ProposalType, Priority } from '@/types/proposal';

type SolutionInput = {
  proposalType: ProposalType;
  painPoints: { pain_point: string; severity: string }[];
  technologyStack: { name: string; category: string }[];
  industry: string | null;
  growthScore: number;
  buyingIntentScore: number;
  competitors: string[];
};

class SolutionRecommendationEngine {
  recommend(input: SolutionInput): SolutionRecommendation[] {
    const solutions: SolutionRecommendation[] = [];

    const typeSolutions = this.getSolutionsByType(input.proposalType);

    for (const sol of typeSolutions) {
      const relevance = this.assessRelevance(sol, input);
      solutions.push({
        ...sol,
        priority: relevance >= 0.7 ? 'high' : relevance >= 0.4 ? 'medium' : 'low',
      });
    }

    // Add pain-point-specific solutions
    for (const pain of input.painPoints) {
      if (pain.severity === 'critical' || pain.severity === 'high') {
        const sol = this.solutionForPainPoint(pain.pain_point, input.proposalType);
        if (sol && !solutions.some((s) => s.service_name === sol.service_name)) {
          solutions.push(sol);
        }
      }
    }

    return solutions.sort((a, b) => {
      const priorityOrder: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private getSolutionsByType(type: ProposalType): Omit<SolutionRecommendation, 'priority'>[] {
    const solutions: Record<ProposalType, Omit<SolutionRecommendation, 'priority'>[]> = {
      executive: [
        {
          service_name: 'Strategic Business Consultation',
          description: 'Comprehensive business strategy assessment and roadmap development.',
          rationale: 'Executive proposals require a strategic foundation that aligns with long-term business objectives.',
          deliverables: ['Strategic assessment report', 'Executive roadmap', 'KPI framework', 'Quarterly review plan'],
          timeline_weeks: 16,
          dependencies: ['Access to key stakeholders', 'Historical business data'],
        },
        {
          service_name: 'Business Intelligence Dashboard',
          description: 'Custom BI dashboard for real-time business metrics and decision support.',
          rationale: 'Data-driven decision making is critical for executive-level strategic planning.',
          deliverables: ['Custom dashboard', 'Data pipeline setup', 'Training session', 'Documentation'],
          timeline_weeks: 8,
          dependencies: ['Data source access', 'API credentials'],
        },
      ],
      sales: [
        {
          service_name: 'Sales Process Optimization',
          description: 'End-to-end sales process audit and optimization program.',
          rationale: 'Streamlined sales processes increase conversion rates and reduce sales cycle time.',
          deliverables: ['Process audit', 'Optimized workflow', 'Sales playbook', 'Training materials'],
          timeline_weeks: 8,
          dependencies: ['CRM access', 'Sales team availability'],
        },
      ],
      seo: [
        {
          service_name: 'Technical SEO Audit & Implementation',
          description: 'Comprehensive technical SEO audit with implementation of fixes and optimizations.',
          rationale: 'Technical SEO is the foundation for organic search visibility and traffic growth.',
          deliverables: ['Technical audit report', 'Site speed optimization', 'Schema markup', 'XML sitemap optimization'],
          timeline_weeks: 8,
          dependencies: ['Website access', 'Analytics access'],
        },
        {
          service_name: 'Content Strategy & Creation',
          description: 'Data-driven content strategy with monthly content production.',
          rationale: 'Content authority is essential for sustained organic search growth.',
          deliverables: ['Content strategy document', 'Keyword research', 'Monthly content pieces', 'Content calendar'],
          timeline_weeks: 12,
          dependencies: ['Brand guidelines', 'Subject matter expert access'],
        },
        {
          service_name: 'Link Building Campaign',
          description: 'White-hat link building campaign to improve domain authority.',
          rationale: 'Backlinks remain a critical ranking factor for competitive keywords.',
          deliverables: ['Link building strategy', 'Outreach campaign', 'Monthly link reports', 'Authority building plan'],
          timeline_weeks: 12,
          dependencies: ['Content assets', 'Brand assets'],
        },
      ],
      google_ads: [
        {
          service_name: 'Google Ads Account Setup & Optimization',
          description: 'Full-funnel Google Ads campaign setup with ongoing optimization.',
          rationale: 'Structured campaigns with proper tracking are essential for ROAS-positive paid search.',
          deliverables: ['Account structure', 'Campaign setup', 'Conversion tracking', 'Monthly optimization'],
          timeline_weeks: 4,
          dependencies: ['Google Ads account', 'Conversion tracking setup'],
        },
        {
          service_name: 'Keyword Strategy & Bid Management',
          description: 'Data-driven keyword strategy with automated bid management.',
          rationale: 'Strategic keyword targeting and bid optimization maximize return on ad spend.',
          deliverables: ['Keyword strategy', 'Bid rules', 'Negative keyword list', 'Performance reports'],
          timeline_weeks: 4,
          dependencies: ['Historical search data', 'Budget allocation'],
        },
      ],
      meta_ads: [
        {
          service_name: 'Meta Ads Campaign Management',
          description: 'Full-funnel Meta Ads campaign with creative testing and audience optimization.',
          rationale: 'Creative-driven campaigns with proper audience segmentation drive conversion on Meta platforms.',
          deliverables: ['Campaign structure', 'Creative concepts', 'Audience strategy', 'Monthly optimization'],
          timeline_weeks: 4,
          dependencies: ['Meta Business Manager', 'Brand assets'],
        },
      ],
      linkedin_ads: [
        {
          service_name: 'LinkedIn Ads Account-Based Marketing',
          description: 'ABM-focused LinkedIn Ads targeting key decision-makers and accounts.',
          rationale: 'LinkedIn\'s professional targeting is ideal for B2B account-based marketing.',
          deliverables: ['ABM strategy', 'Target account list', 'Campaign setup', 'Lead gen forms'],
          timeline_weeks: 4,
          dependencies: ['LinkedIn Campaign Manager', 'ICP definition'],
        },
      ],
      digital_marketing: [
        {
          service_name: 'Integrated Digital Marketing Strategy',
          description: 'Comprehensive digital marketing program spanning SEO, paid media, and content.',
          rationale: 'Integrated channels create compounding growth effects and better attribution.',
          deliverables: ['Strategy document', 'Channel plan', 'Monthly reporting', 'Quarterly review'],
          timeline_weeks: 16,
          dependencies: ['Analytics access', 'Brand guidelines'],
        },
        {
          service_name: 'Conversion Rate Optimization',
          description: 'Ongoing CRO program with A/B testing and funnel optimization.',
          rationale: 'Improving conversion rates multiplies the value of all traffic sources.',
          deliverables: ['CRO audit', 'Test roadmap', 'A/B test execution', 'Results reporting'],
          timeline_weeks: 12,
          dependencies: ['Website access', 'Analytics setup'],
        },
      ],
      website: [
        {
          service_name: 'Custom Website Development',
          description: 'Conversion-optimized website with modern design and CMS integration.',
          rationale: 'A high-performing website is the foundation of digital presence and lead generation.',
          deliverables: ['Design mockups', 'Responsive development', 'CMS integration', 'Performance optimization'],
          timeline_weeks: 12,
          dependencies: ['Brand guidelines', 'Content assets'],
        },
      ],
      software: [
        {
          service_name: 'Custom Software Development',
          description: 'Agile software development with iterative delivery and scalable architecture.',
          rationale: 'Custom software addresses specific business needs that off-the-shelf solutions cannot.',
          deliverables: ['Architecture design', 'MVP development', 'Iterative releases', 'Documentation'],
          timeline_weeks: 20,
          dependencies: ['Requirements document', 'Stakeholder availability'],
        },
      ],
      ai_solution: [
        {
          service_name: 'AI Strategy & Assessment',
          description: 'Comprehensive AI readiness assessment and implementation roadmap.',
          rationale: 'A structured AI strategy ensures alignment with business objectives and realistic implementation.',
          deliverables: ['AI assessment report', 'Use case prioritization', 'Implementation roadmap', 'ROI model'],
          timeline_weeks: 8,
          dependencies: ['Data access', 'Technical infrastructure details'],
        },
        {
          service_name: 'AI Model Development & Deployment',
          description: 'Custom AI model development with training, validation, and production deployment.',
          rationale: 'Custom AI models provide competitive advantage through automation and intelligence.',
          deliverables: ['Model architecture', 'Training pipeline', 'Deployment setup', 'Monitoring dashboard'],
          timeline_weeks: 24,
          dependencies: ['Training data', 'Compute resources'],
        },
      ],
      custom: [
        {
          service_name: 'Custom Solution Design',
          description: 'Tailored solution designed to address specific business requirements.',
          rationale: 'Custom solutions address unique challenges that standard packages cannot solve.',
          deliverables: ['Requirements analysis', 'Solution design', 'Implementation plan', 'Success metrics'],
          timeline_weeks: 12,
          dependencies: ['Requirements document', 'Stakeholder availability'],
        },
      ],
    };

    return solutions[type] ?? solutions.custom;
  }

  private assessRelevance(solution: Omit<SolutionRecommendation, 'priority'>, input: SolutionInput): number {
    let score = 0.5;
    if (input.growthScore >= 0.6 && solution.service_name.includes('Scal')) score += 0.2;
    if (input.buyingIntentScore >= 0.7) score += 0.15;
    if (input.competitors.length > 5 && solution.service_name.includes('Differentiat')) score += 0.15;
    return Math.min(score, 1.0);
  }

  private solutionForPainPoint(painPoint: string, type: ProposalType): SolutionRecommendation | null {
    const lower = painPoint.toLowerCase();
    if (lower.includes('technology')) {
      return {
        service_name: 'Technology Stack Modernization',
        description: 'Comprehensive technology stack audit and modernization plan.',
        rationale: 'Modern technology stack improves operational efficiency and enables future growth.',
        deliverables: ['Stack audit', 'Modernization roadmap', 'Implementation plan'],
        timeline_weeks: 8,
        dependencies: ['Current system documentation'],
        priority: 'high',
      };
    }
    if (lower.includes('competitive')) {
      return {
        service_name: 'Competitive Differentiation Strategy',
        description: 'Market positioning and competitive differentiation program.',
        rationale: 'Clear differentiation is essential in competitive markets.',
        deliverables: ['Competitive analysis', 'Positioning strategy', 'Messaging framework'],
        timeline_weeks: 6,
        dependencies: ['Market research data'],
        priority: 'high',
      };
    }
    return null;
  }
}

export const solutionRecommendationEngine = new SolutionRecommendationEngine();
