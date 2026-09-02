export function normalizeLinkedInDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

export type DisplayNameMatch =
  | { allowed: true; expected: string; actual: string }
  | { allowed: false; code: 'expected_name_missing' | 'displayed_name_missing' | 'displayed_name_mismatch'; expected: string | null; actual: string | null };

export function verifyLinkedInDisplayName(expectedValue: unknown, actualValue: unknown): DisplayNameMatch {
  const expected = normalizeLinkedInDisplayName(expectedValue);
  const actual = normalizeLinkedInDisplayName(actualValue);
  if (!expected) return { allowed: false, code: 'expected_name_missing', expected, actual };
  if (!actual) return { allowed: false, code: 'displayed_name_missing', expected, actual };
  if (actual !== expected) return { allowed: false, code: 'displayed_name_mismatch', expected, actual };
  return { allowed: true, expected, actual };
}

export type AcceptanceIdentityMatch = DisplayNameMatch | {
  allowed: false;
  code: 'canonical_target_mismatch';
  expected: string | null;
  actual: string | null;
};

export function verifyProductionAcceptanceIdentity(
  authorizedCanonicalTarget: string | null,
  presentedCanonicalTarget: string | null,
  expectedDisplayName: unknown,
  actualDisplayName: unknown,
): AcceptanceIdentityMatch {
  if (!authorizedCanonicalTarget || presentedCanonicalTarget !== authorizedCanonicalTarget) {
    return { allowed: false, code: 'canonical_target_mismatch', expected: authorizedCanonicalTarget, actual: presentedCanonicalTarget };
  }
  return verifyLinkedInDisplayName(expectedDisplayName, actualDisplayName);
}
