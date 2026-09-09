import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Href } from 'expo-router';

import {
  completeOnboardingProgress,
  type OnboardingCompletionResult,
  type OnboardingFirstValue,
  type OnboardingIntent,
} from '../api/onboarding';
import {
  assertAuthSession,
  authSessionRequestConfig,
  captureAuthSession,
} from '../api/client';
import { MOBILE_LANDING_ROUTE } from '../navigation/mobileSurface';

export type { OnboardingIntent } from '../api/onboarding';

export const DEFAULT_ONBOARDING_INTENT: OnboardingIntent = 'events';
export const PENDING_INTENT_KEY = 'tdf-onboarding-intent:pending';
export const PENDING_FIRST_VALUE_KEY_PREFIX = 'tdf-onboarding-first-value:pending:';

const FIRST_VALUES = new Set<OnboardingFirstValue>([
  'artist_followed',
  'access_requested',
  'event_saved',
  'moment_reaction',
]);

type PendingFirstValueRecord = {
  version: 1;
  value: OnboardingFirstValue;
};

export type PendingFirstValueCompletionResult = {
  value: OnboardingFirstValue;
  result: OnboardingCompletionResult;
};

const INTENTS = new Set<OnboardingIntent>([
  'events',
  'follow_artists',
  'artist_profile',
  'internships',
  'learning',
  'professional_tools',
]);

const LEGACY_INTENTS: Record<string, OnboardingIntent> = {
  fan: 'follow_artists',
  artist: 'artist_profile',
  artista: 'artist_profile',
  intern: 'internships',
  practicante: 'internships',
  pasante: 'internships',
  teacher: 'learning',
  profesor: 'learning',
  student: 'learning',
  estudiante: 'learning',
  dj: 'professional_tools',
  producer: 'professional_tools',
  productor: 'professional_tools',
  promoter: 'professional_tools',
  promotor: 'professional_tools',
  publicist: 'professional_tools',
  photographer: 'professional_tools',
};

const normalize = (value: string | null | undefined): string => value?.trim().toLowerCase() ?? '';

export function parseOnboardingIntent(value: string | null | undefined): OnboardingIntent | null {
  const normalized = normalize(value);
  if (INTENTS.has(normalized as OnboardingIntent)) return normalized as OnboardingIntent;
  return LEGACY_INTENTS[normalized] ?? null;
}

export const ONBOARDING_INTENT_OPTIONS: readonly {
  id: OnboardingIntent;
  labelEs: string;
  labelEn: string;
}[] = [
  { id: 'events', labelEs: 'Descubrir eventos', labelEn: 'Discover events' },
  { id: 'follow_artists', labelEs: 'Seguir artistas', labelEn: 'Follow artists' },
  { id: 'artist_profile', labelEs: 'Crear perfil de artista', labelEn: 'Create an artist profile' },
  { id: 'internships', labelEs: 'Buscar prácticas', labelEn: 'Find internships' },
  { id: 'learning', labelEs: 'Aprender o enseñar', labelEn: 'Learn or teach' },
  { id: 'professional_tools', labelEs: 'Usar herramientas profesionales', labelEn: 'Use professional tools' },
] as const;

export async function persistOnboardingIntent(intent: OnboardingIntent) {
  try {
    await AsyncStorage.setItem(PENDING_INTENT_KEY, intent);
  } catch {
    // Intent improves routing but must never block account creation.
  }
}

export async function readPendingOnboardingIntent(): Promise<OnboardingIntent | null> {
  try {
    const stored = await AsyncStorage.getItem(PENDING_INTENT_KEY);
    const intent = parseOnboardingIntent(stored);
    if (stored && !intent) {
      await AsyncStorage.removeItem(PENDING_INTENT_KEY);
    }
    return intent;
  } catch {
    return null;
  }
}

export async function clearPendingOnboardingIntent(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_INTENT_KEY);
  } catch {
    // Authentication must not fail because best-effort cleanup failed.
  }
}

const normalizePartyId = (partyId: string | null | undefined): string | null => {
  const normalized = partyId?.trim() ?? '';
  return /^[1-9]\d*$/.test(normalized) ? normalized : null;
};

const pendingFirstValueKey = (partyId: string): string =>
  `${PENDING_FIRST_VALUE_KEY_PREFIX}${partyId}`;

const parsePendingFirstValue = (raw: string | null): OnboardingFirstValue | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingFirstValueRecord> | null;
    if (
      !parsed
      || parsed.version !== 1
      || typeof parsed.value !== 'string'
      || !FIRST_VALUES.has(parsed.value as OnboardingFirstValue)
    ) return null;
    return parsed.value as OnboardingFirstValue;
  } catch {
    return null;
  }
};

async function readPendingFirstValue(partyId: string): Promise<OnboardingFirstValue | null> {
  const key = pendingFirstValueKey(partyId);
  const raw = await AsyncStorage.getItem(key);
  const value = parsePendingFirstValue(raw);
  if (raw && !value) await AsyncStorage.removeItem(key);
  return value;
}

async function persistPendingFirstValue(
  partyId: string,
  value: OnboardingFirstValue,
): Promise<void> {
  const record: PendingFirstValueRecord = { version: 1, value };
  await AsyncStorage.setItem(pendingFirstValueKey(partyId), JSON.stringify(record));
}

export async function clearPendingFirstValueCompletion(
  partyId: string | null | undefined,
  authToken: string | null | undefined,
): Promise<void> {
  const normalizedPartyId = normalizePartyId(partyId);
  if (!normalizedPartyId || !authToken) return;
  let binding;
  try {
    binding = captureAuthSession(authToken);
    await AsyncStorage.removeItem(pendingFirstValueKey(normalizedPartyId));
    assertAuthSession(binding);
  } catch {
    // Keep a marker on storage failure. A later idempotent replay can clear it.
  }
}

async function requestPendingFirstValueCompletion(
  partyId: string,
  value: OnboardingFirstValue,
  authToken: string,
): Promise<OnboardingCompletionResult | null> {
  let binding;
  try {
    binding = captureAuthSession(authToken);
  } catch {
    return null;
  }

  try {
    const result = await completeOnboardingProgress(
      value,
      authSessionRequestConfig(binding),
    );
    assertAuthSession(binding);
    if (result.progress.completedAt) {
      try {
        await AsyncStorage.removeItem(pendingFirstValueKey(partyId));
      } catch {
        // Completion is authoritative even if best-effort marker cleanup fails.
      }
    }
    assertAuthSession(binding);
    return result;
  } catch {
    return null;
  }
}

export async function completeFirstValueWithRecovery(
  partyId: string | null | undefined,
  value: OnboardingFirstValue,
  authToken: string | null | undefined,
): Promise<OnboardingCompletionResult | null> {
  const normalizedPartyId = normalizePartyId(partyId);
  if (!normalizedPartyId || !authToken) return null;

  let binding;
  try {
    binding = captureAuthSession(authToken);
  } catch {
    return null;
  }

  try {
    await persistPendingFirstValue(normalizedPartyId, value);
  } catch {
    // Storage can be unavailable. Still attempt the authoritative handshake;
    // only relaunch recovery is degraded, not the already-completed action.
  }
  try {
    assertAuthSession(binding);
  } catch {
    return null;
  }

  return requestPendingFirstValueCompletion(normalizedPartyId, value, authToken);
}

export async function retryPendingFirstValueCompletion(
  partyId: string | null | undefined,
  authToken: string | null | undefined,
): Promise<PendingFirstValueCompletionResult | null> {
  const normalizedPartyId = normalizePartyId(partyId);
  if (!normalizedPartyId || !authToken) return null;

  let binding;
  try {
    binding = captureAuthSession(authToken);
    const value = await readPendingFirstValue(normalizedPartyId);
    assertAuthSession(binding);
    if (!value) return null;
    const result = await requestPendingFirstValueCompletion(
      normalizedPartyId,
      value,
      authToken,
    );
    return result ? { value, result } : null;
  } catch {
    return null;
  }
}

export async function markFirstValueCompleted(
  partyId: string | null | undefined,
  value: OnboardingFirstValue,
  authToken: string | null | undefined,
): Promise<OnboardingFirstValue | null> {
  const result = await completeFirstValueWithRecovery(partyId, value, authToken);
  const authoritativeValue = result?.progress.firstValue;
  return result?.newlyCompleted === true
    && authoritativeValue
    && FIRST_VALUES.has(authoritativeValue)
    ? authoritativeValue
    : null;
}

const hasAny = (values: readonly string[], candidates: readonly string[]) => {
  const normalized = new Set(values.map(normalize));
  return candidates.some((candidate) => normalized.has(candidate));
};

export function resolveMobileIntentDestination(
  intent: OnboardingIntent,
  roles: readonly string[] = [],
  modules: readonly string[] = [],
): Href {
  switch (intent) {
    case 'follow_artists':
      return '/(tabs)/social';
    case 'artist_profile':
      return hasAny(roles, ['artist', 'artista', 'admin'])
        ? '/createArtistProfile'
        : ({ pathname: '/access-requests/new', params: { feature: 'artist.onboarding', action: 'create' } } as unknown as Href);
    case 'internships':
      return hasAny(roles, ['intern', 'admin']) && hasAny(modules, ['internships', 'admin'])
        ? '/(tabs)/more' as unknown as Href
        : ({ pathname: '/access-requests/new', params: { feature: 'internships', action: 'view' } } as unknown as Href);
    case 'learning':
    case 'professional_tools':
      return '/(tabs)/more' as unknown as Href;
    case 'events':
    default:
      return MOBILE_LANDING_ROUTE;
  }
}
