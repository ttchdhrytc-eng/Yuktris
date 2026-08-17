// Behavioral tests for ICP generation output validation.
// Run with: deno test --allow-none src/services/icp-intelligence/icpValidation.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateGeneratedICPs } from "./icpValidation.ts";

function validIcp(overrides: Record<string, unknown> = {}) {
  return {
    name: "Mid-Market FinTech",
    description: "Financial services companies modernizing payments infrastructure.",
    priority: "primary",
    confidence: 82,
    opportunity_score: 78,
    competition_score: 55,
    revenue_score: 70,
    conversion_rate: 12,
    estimated_deal_size: "$25,000 ARR",
    reasoning: "Derived from persisted business research emphasizing fintech integrations.",
    company_profile: {
      industry: "Financial Services",
      sub_industry: "Payments",
      company_size: "100-500 employees",
      revenue_range: "$10M-$100M",
      employee_count: "100-500",
      funding_stage: "Series B",
      business_model: "B2B SaaS",
      technology_stack: ["Stripe", "Plaid"],
      country: "United States",
      region: "North America",
      city: "New York",
    },
    decision_makers: [
      { department: "Engineering", job_title: "VP Engineering", seniority: "VP", responsibilities: "Owns platform integrations", authority_score: 80, priority: "high" },
    ],
    pain_points: [
      { pain_point: "Manual reconciliation across payment providers", severity: "high", urgency: "high", business_impact: "Delays month-end close", recommended_solution: "Automated reconciliation" },
    ],
    goals: [{ goal: "Reduce reconciliation time by 50%", priority: "high", category: "operational" }],
    buying_triggers: [{ trigger: "New CFO hired", description: "New finance leadership evaluates tooling", confidence: 70, priority: "high" }],
    negative_filters: [{ filter_type: "industry", value: "Consumer Retail", reason: "Not a target vertical" }],
    sales_navigator_filters: {
      industry: ["Financial Services"], company_size: ["100-500"], location: ["United States"],
      keywords: ["payments"], titles: ["VP Engineering"], departments: ["Engineering"], technology: ["Stripe"],
      boolean_query: "(\"VP Engineering\") AND (\"payments\")",
    },
    ...overrides,
  };
}

Deno.test("validateGeneratedICPs: accepts a well-formed single ICP", () => {
  const result = validateGeneratedICPs({ icps: [validIcp()] });
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.icps.length, 1);
    assertEquals(result.icps[0].company_profile.industry, "Financial Services");
    assertEquals(result.icps[0].decision_makers[0].job_title, "VP Engineering");
  }
});

Deno.test("validateGeneratedICPs: rejects missing icps array", () => {
  const result = validateGeneratedICPs({});
  assertEquals(result.valid, false);
});

Deno.test("validateGeneratedICPs: rejects empty icps array", () => {
  const result = validateGeneratedICPs({ icps: [] });
  assertEquals(result.valid, false);
});

Deno.test("validateGeneratedICPs: rejects ICP missing company_profile", () => {
  const bad = validIcp();
  delete (bad as Record<string, unknown>).company_profile;
  const result = validateGeneratedICPs({ icps: [bad] });
  assertEquals(result.valid, false);
  if (!result.valid) {
    assertEquals(result.errors.some((e) => e.includes("company_profile")), true);
  }
});

Deno.test("validateGeneratedICPs: rejects ICP with no decision makers", () => {
  const bad = validIcp({ decision_makers: [] });
  const result = validateGeneratedICPs({ icps: [bad] });
  assertEquals(result.valid, false);
});

Deno.test("validateGeneratedICPs: rejects ICP with no pain points", () => {
  const bad = validIcp({ pain_points: [] });
  const result = validateGeneratedICPs({ icps: [bad] });
  assertEquals(result.valid, false);
});

Deno.test("validateGeneratedICPs: rejects ICP with no negative filters (exclusions required)", () => {
  const bad = validIcp({ negative_filters: [] });
  const result = validateGeneratedICPs({ icps: [bad] });
  assertEquals(result.valid, false);
});

Deno.test("validateGeneratedICPs: rejects ICP missing name/description", () => {
  const bad = validIcp({ name: "" });
  const result = validateGeneratedICPs({ icps: [bad] });
  assertEquals(result.valid, false);
});

Deno.test("validateGeneratedICPs: clamps out-of-range scores instead of failing", () => {
  const result = validateGeneratedICPs({ icps: [validIcp({ opportunity_score: 999, confidence: -50 })] });
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.icps[0].opportunity_score, 100);
    assertEquals(result.icps[0].confidence, 0);
  }
});

Deno.test("validateGeneratedICPs: defaults invalid enum values to a safe fallback instead of failing", () => {
  const result = validateGeneratedICPs({
    icps: [validIcp({ priority: "not-a-real-priority" })],
  });
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.icps[0].priority, "secondary");
  }
});

Deno.test("validateGeneratedICPs: accepts multiple ICPs and preserves order", () => {
  const result = validateGeneratedICPs({
    icps: [validIcp({ name: "ICP One" }), validIcp({ name: "ICP Two" })],
  });
  assertEquals(result.valid, true);
  if (result.valid) {
    assertEquals(result.icps.map((i) => i.name), ["ICP One", "ICP Two"]);
  }
});
