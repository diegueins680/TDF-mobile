export interface FeedbackMetadataInput { version?: string | null; build?: string | null; os: string; osVersion: string | number; locale: string; route: string; environment?: string }
const safe = (value: string | number | null | undefined) => String(value ?? 'unknown').replace(/[^a-zA-Z0-9._/() -]/g, '').slice(0, 80);
export function feedbackMetadata(input: FeedbackMetadataInput) {
  return { app_version: safe(input.version), app_build: safe(input.build), platform: safe(input.os), os_version: safe(input.osVersion), locale: safe(input.locale), surface: safe(input.route), environment: safe(input.environment) };
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
