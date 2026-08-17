// ============================================================
// ICP generation output validation
// ============================================================
//
// Validates AI-generated ICP structures before they are ever persisted
// or shown as real customer data. Deliberately strict: a malformed or
// incomplete AI response is treated as a generation failure, not
// silently patched with placeholder/mock values.

export type GeneratedICPCompanyProfile = {
  industry: string;
  sub_industry: string | null;
  company_size: string;
  revenue_range: string | null;
  employee_count: string | null;
  funding_stage: string | null;
  business_model: string | null;
  technology_stack: string[];
  country: string;
  region: string | null;
  city: string | null;
};

export type GeneratedICPDecisionMaker = {
  department: string | null;
  job_title: string;
  seniority: string | null;
  responsibilities: string | null;
  authority_score: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
};

export type GeneratedICPPainPoint = {
  pain_point: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  urgency: 'low' | 'medium' | 'high' | 'immediate';
  business_impact: string | null;
  recommended_solution: string | null;
};

export type GeneratedICPGoal = {
  goal: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'business' | 'revenue' | 'marketing' | 'operational' | 'technology';
};

export type GeneratedICPBuyingTrigger = {
  trigger: string;
  description: string | null;
  confidence: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
};

export type GeneratedICPNegativeFilter = {
  filter_type: 'industry' | 'country' | 'company_size' | 'technology' | 'revenue_range';
  value: string;
  reason: string | null;
};

export type GeneratedICPSalesNavigatorFilters = {
  industry: string[];
  company_size: string[];
  location: string[];
  keywords: string[];
  titles: string[];
  departments: string[];
  technology: string[];
  boolean_query: string | null;
};

export type GeneratedICP = {
  name: string;
  description: string;
  priority: 'primary' | 'secondary' | 'tertiary';
  confidence: number;
  opportunity_score: number;
  competition_score: number;
  revenue_score: number;
  conversion_rate: number;
  estimated_deal_size: string | null;
  reasoning: string | null;
  company_profile: GeneratedICPCompanyProfile;
  decision_makers: GeneratedICPDecisionMaker[];
  pain_points: GeneratedICPPainPoint[];
  goals: GeneratedICPGoal[];
  buying_triggers: GeneratedICPBuyingTrigger[];
  negative_filters: GeneratedICPNegativeFilter[];
  sales_navigator_filters: GeneratedICPSalesNavigatorFilters;
};

export type ICPValidationResult =
  | { valid: true; icps: GeneratedICP[]; errors: [] }
  | { valid: false; icps: []; errors: string[] };

const PRIORITY_VALUES = new Set(['low', 'medium', 'high', 'critical']);
const ICP_PRIORITY_VALUES = new Set(['primary', 'secondary', 'tertiary']);
const SEVERITY_VALUES = new Set(['low', 'medium', 'high', 'critical']);
const URGENCY_VALUES = new Set(['low', 'medium', 'high', 'immediate']);
const GOAL_CATEGORY_VALUES = new Set(['business', 'revenue', 'marketing', 'operational', 'technology']);
const NEGATIVE_FILTER_TYPES = new Set(['industry', 'country', 'company_size', 'technology', 'revenue_range']);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function clampScore(value: unknown, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(100, Math.max(0, n));
}

function clampConfidence01(value: unknown, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return n <= 1 ? Math.min(1, Math.max(0, n)) * 100 : Math.min(100, Math.max(0, n));
}

/**
 * Validates the raw structured AI output for icp_generation_agent.
 * Returns a strictly-typed, safe-to-persist ICP list, or a list of
 * validation errors if the output cannot be trusted.
 */
export function validateGeneratedICPs(raw: Record<string, unknown>): ICPValidationResult {
  const errors: string[] = [];
  const rawIcps = raw?.['icps'];

  if (!Array.isArray(rawIcps) || rawIcps.length === 0) {
    return { valid: false, icps: [], errors: ['Response did not contain a non-empty "icps" array'] };
  }

  const icps: GeneratedICP[] = [];

  rawIcps.forEach((item, index) => {
    if (typeof item !== 'object' || item === null) {
      errors.push(`icps[${index}] is not an object`);
      return;
    }
    const icp = item as Record<string, unknown>;

    if (!isNonEmptyString(icp.name)) { errors.push(`icps[${index}].name is required`); return; }
    if (!isNonEmptyString(icp.description)) { errors.push(`icps[${index}].description is required`); return; }

    const profileRaw = icp.company_profile as Record<string, unknown> | undefined;
    if (!profileRaw || typeof profileRaw !== 'object') { errors.push(`icps[${index}].company_profile is required`); return; }
    if (!isNonEmptyString(profileRaw.industry)) { errors.push(`icps[${index}].company_profile.industry is required`); return; }
    if (!isNonEmptyString(profileRaw.company_size)) { errors.push(`icps[${index}].company_profile.company_size is required`); return; }
    if (!isNonEmptyString(profileRaw.country)) { errors.push(`icps[${index}].company_profile.country is required`); return; }

    const decisionMakersRaw = icp.decision_makers;
    if (!Array.isArray(decisionMakersRaw) || decisionMakersRaw.length === 0) {
      errors.push(`icps[${index}].decision_makers must be a non-empty array`); return;
    }
    const decisionMakers: GeneratedICPDecisionMaker[] = [];
    for (const dm of decisionMakersRaw as Record<string, unknown>[]) {
      if (!isNonEmptyString(dm?.job_title)) { errors.push(`icps[${index}].decision_makers[].job_title is required`); return; }
      decisionMakers.push({
        department: isNonEmptyString(dm.department) ? dm.department : null,
        job_title: dm.job_title as string,
        seniority: isNonEmptyString(dm.seniority) ? dm.seniority : null,
        responsibilities: isNonEmptyString(dm.responsibilities) ? dm.responsibilities : null,
        authority_score: clampScore(dm.authority_score, 50),
        priority: PRIORITY_VALUES.has(dm.priority as string) ? (dm.priority as GeneratedICPDecisionMaker['priority']) : 'medium',
      });
    }

    const painPointsRaw = icp.pain_points;
    if (!Array.isArray(painPointsRaw) || painPointsRaw.length === 0) {
      errors.push(`icps[${index}].pain_points must be a non-empty array`); return;
    }
    const painPoints: GeneratedICPPainPoint[] = [];
    for (const pp of painPointsRaw as Record<string, unknown>[]) {
      if (!isNonEmptyString(pp?.pain_point)) { errors.push(`icps[${index}].pain_points[].pain_point is required`); return; }
      painPoints.push({
        pain_point: pp.pain_point as string,
        severity: SEVERITY_VALUES.has(pp.severity as string) ? (pp.severity as GeneratedICPPainPoint['severity']) : 'medium',
        urgency: URGENCY_VALUES.has(pp.urgency as string) ? (pp.urgency as GeneratedICPPainPoint['urgency']) : 'medium',
        business_impact: isNonEmptyString(pp.business_impact) ? pp.business_impact : null,
        recommended_solution: isNonEmptyString(pp.recommended_solution) ? pp.recommended_solution : null,
      });
    }

    const goalsRaw = Array.isArray(icp.goals) ? (icp.goals as Record<string, unknown>[]) : [];
    const goals: GeneratedICPGoal[] = goalsRaw
      .filter((g) => isNonEmptyString(g?.goal))
      .map((g) => ({
        goal: g.goal as string,
        priority: PRIORITY_VALUES.has(g.priority as string) ? (g.priority as GeneratedICPGoal['priority']) : 'medium',
        category: GOAL_CATEGORY_VALUES.has(g.category as string) ? (g.category as GeneratedICPGoal['category']) : 'business',
      }));

    const triggersRaw = icp.buying_triggers;
    if (!Array.isArray(triggersRaw) || triggersRaw.length === 0) {
      errors.push(`icps[${index}].buying_triggers must be a non-empty array`); return;
    }
    const buyingTriggers: GeneratedICPBuyingTrigger[] = [];
    for (const t of triggersRaw as Record<string, unknown>[]) {
      if (!isNonEmptyString(t?.trigger)) { errors.push(`icps[${index}].buying_triggers[].trigger is required`); return; }
      buyingTriggers.push({
        trigger: t.trigger as string,
        description: isNonEmptyString(t.description) ? t.description : null,
        confidence: clampConfidence01(t.confidence, 50),
        priority: PRIORITY_VALUES.has(t.priority as string) ? (t.priority as GeneratedICPBuyingTrigger['priority']) : 'medium',
      });
    }

    const negativeFiltersRaw = icp.negative_filters;
    if (!Array.isArray(negativeFiltersRaw) || negativeFiltersRaw.length === 0) {
      errors.push(`icps[${index}].negative_filters must be a non-empty array (explicit exclusions are required)`); return;
    }
    const negativeFilters: GeneratedICPNegativeFilter[] = [];
    for (const nf of negativeFiltersRaw as Record<string, unknown>[]) {
      if (!NEGATIVE_FILTER_TYPES.has(nf?.filter_type as string) || !isNonEmptyString(nf?.value)) {
        errors.push(`icps[${index}].negative_filters[] requires a valid filter_type and value`); return;
      }
      negativeFilters.push({
        filter_type: nf.filter_type as GeneratedICPNegativeFilter['filter_type'],
        value: nf.value as string,
        reason: isNonEmptyString(nf.reason) ? nf.reason : null,
      });
    }

    const salesNavRaw = (icp.sales_navigator_filters as Record<string, unknown>) ?? {};
    const asStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

    icps.push({
      name: icp.name as string,
      description: icp.description as string,
      priority: ICP_PRIORITY_VALUES.has(icp.priority as string) ? (icp.priority as GeneratedICP['priority']) : 'secondary',
      confidence: clampConfidence01(icp.confidence, 60),
      opportunity_score: clampScore(icp.opportunity_score, 60),
      competition_score: clampScore(icp.competition_score, 50),
      revenue_score: clampScore(icp.revenue_score, 60),
      conversion_rate: typeof icp.conversion_rate === 'number' ? Math.min(100, Math.max(0, icp.conversion_rate)) : 10,
      estimated_deal_size: isNonEmptyString(icp.estimated_deal_size) ? icp.estimated_deal_size as string : null,
      reasoning: isNonEmptyString(icp.reasoning) ? icp.reasoning as string : null,
      company_profile: {
        industry: profileRaw.industry as string,
        sub_industry: isNonEmptyString(profileRaw.sub_industry) ? profileRaw.sub_industry as string : null,
        company_size: profileRaw.company_size as string,
        revenue_range: isNonEmptyString(profileRaw.revenue_range) ? profileRaw.revenue_range as string : null,
        employee_count: isNonEmptyString(profileRaw.employee_count) ? profileRaw.employee_count as string : null,
        funding_stage: isNonEmptyString(profileRaw.funding_stage) ? profileRaw.funding_stage as string : null,
        business_model: isNonEmptyString(profileRaw.business_model) ? profileRaw.business_model as string : null,
        technology_stack: asStringArray(profileRaw.technology_stack),
        country: profileRaw.country as string,
        region: isNonEmptyString(profileRaw.region) ? profileRaw.region as string : null,
        city: isNonEmptyString(profileRaw.city) ? profileRaw.city as string : null,
      },
      decision_makers: decisionMakers,
      pain_points: painPoints,
      goals,
      buying_triggers: buyingTriggers,
      negative_filters: negativeFilters,
      sales_navigator_filters: {
        industry: asStringArray(salesNavRaw.industry),
        company_size: asStringArray(salesNavRaw.company_size),
        location: asStringArray(salesNavRaw.location),
        keywords: asStringArray(salesNavRaw.keywords),
        titles: asStringArray(salesNavRaw.titles),
        departments: asStringArray(salesNavRaw.departments),
        technology: asStringArray(salesNavRaw.technology),
        boolean_query: isNonEmptyString(salesNavRaw.boolean_query) ? salesNavRaw.boolean_query as string : null,
      },
    });
  });

  if (errors.length > 0) return { valid: false, icps: [], errors };
  return { valid: true, icps, errors: [] };
}
