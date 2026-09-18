// Push metadata selects a recipient-owned notification, never an arbitrary URL.
export function notificationResponseTarget(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const id = (data as Record<string, unknown>).notificationId;
  const valid = typeof id === 'number' ? Number.isSafeInteger(id) && id > 0
    : typeof id === 'string' && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id));
  return valid ? `/notifications?notificationId=${id}` : null;
}
