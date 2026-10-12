export interface FeedbackMetadataInput { version?: string | null; build?: string | null; os: string; osVersion: string | number; locale: string; route: string; environment?: string; deviceClass?: DeviceClass }
const safe = (value: string | number | null | undefined) => String(value ?? 'unknown').replace(/[^a-zA-Z0-9._/() -]/g, '').slice(0, 80);
// A coarse form factor is enough to reproduce layout reports; the model name is never collected.
export type DeviceClass = 'phone' | 'tablet' | 'unknown';
export function deviceClass(input: { isPad?: boolean; width: number; height: number }): DeviceClass {
  if (input.isPad) return 'tablet';
  const shortest = Math.min(input.width, input.height);
  if (!Number.isFinite(shortest) || shortest <= 0) return 'unknown';
  return shortest >= 600 ? 'tablet' : 'phone';
}
export function feedbackMetadata(input: FeedbackMetadataInput) {
  return { app_version: safe(input.version), app_build: safe(input.build), platform: safe(input.os), os_version: safe(input.osVersion), device_class: safe(input.deviceClass), locale: safe(input.locale), surface: safe(input.route), environment: safe(input.environment) };
}
export interface Participation { sessions: number; lastSession: number; dismissedUntil: number; optedOut: boolean }
export function nextParticipation(raw: string | null, now: number): Participation {
  let previous: Partial<Participation> = {};
  try { previous = JSON.parse(raw ?? '{}') as Partial<Participation>; } catch { /* optional storage */ }
  const sessions = Number.isSafeInteger(previous?.sessions) && previous.sessions! >= 0 ? previous.sessions! : 0;
  const lastSession = typeof previous?.lastSession === 'number' && previous.lastSession <= now ? previous.lastSession : 0;
  return { sessions: sessions + (now - lastSession >= 30 * 60 * 1000 ? 1 : 0), lastSession: now - lastSession >= 30 * 60 * 1000 ? now : lastSession,
    dismissedUntil: typeof previous?.dismissedUntil === 'number' ? previous.dismissedUntil : 0, optedOut: previous?.optedOut === true };
}
export const PARTICIPATION_KEY = 'tdf:tester-participation:v1';
export const feedbackPromptDue = (state: Participation, now: number) => state.sessions >= 3 && !state.optedOut && state.dismissedUntil <= now;
