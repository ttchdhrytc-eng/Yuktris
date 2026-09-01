const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function productionAcceptanceAuthorizationId(value: string | undefined): string | null {
  const candidate = value?.trim() ?? '';
  return UUID_PATTERN.test(candidate) ? candidate.toLowerCase() : null;
}

