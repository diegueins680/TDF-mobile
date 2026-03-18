export function normalizePartyId(value: string | number | null | undefined): string | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  }

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? String(parsed) : null;
}

export function resolvePartyId(
  ...values: Array<string | number | null | undefined>
): string | null {
  for (const value of values) {
    const normalized = normalizePartyId(value);
    if (normalized) return normalized;
  }

  return null;
}
