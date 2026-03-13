export function normalizeRouteParam(value: string | string[] | null | undefined): string | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const normalizedEntry = normalizeRouteParam(entry);
      if (normalizedEntry) return normalizedEntry;
    }
    return null;
  }

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
