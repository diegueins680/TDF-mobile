import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Href } from 'expo-router';

import {
  completeOnboardingProgress,
  type OnboardingCompletionResult,
  type OnboardingFirstValue,
  type OnboardingIntent,
  updateOnboardingIntent,
} from '../api/onboarding';
import {
  evaluateFeatureAccess,
  getFeatureById,
  resolveMobileDestination,
} from '../features/featureRegistry';
import { MOBILE_LANDING_ROUTE } from '../navigation/mobileSurface';

export type { OnboardingIntent } from '../api/onboarding';

export const DEFAULT_ONBOARDING_INTENT: OnboardingIntent = 'events';
export const PENDING_INTENT_KEY = 'tdf-onboarding-intent:pending';
export const PENDING_PARTY_INTENT_PREFIX = 'tdf-onboarding-intent:party:';
export const PENDING_FIRST_VALUE_PREFIX = 'tdf-onboarding-first-value:party:';
export const PENDING_ONBOARDING_EXIT_PREFIX = 'tdf-onboarding-exit:party:';

const PENDING_ONBOARDING_EXIT_VALUE = 'pending';

const INTENTS = new Set<OnboardingIntent>([
  'events',
  'follow_artists',
  'artist_profile',
  'internships',
  'learning',
  'professional_tools',
]);

const FIRST_VALUES = new Set<OnboardingFirstValue>([
  'artist_followed',
  'access_requested',
  'event_saved',
  'moment_reaction',
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

export async function clearPendingOnboardingIntentIfCurrent(
  intent: OnboardingIntent,
  stillOwnsParty: () => boolean = () => true,
): Promise<void> {
  try {
    if (
      stillOwnsParty()
      && await AsyncStorage.getItem(PENDING_INTENT_KEY) === intent
      && stillOwnsParty()
    ) {
      await AsyncStorage.removeItem(PENDING_INTENT_KEY);
    }
  } catch {
    // A retained intent is safe to retry; never clear a newer auth attempt.
  }
}

const partyIntentKey = (partyId: string): string =>
  `${PENDING_PARTY_INTENT_PREFIX}${encodeURIComponent(partyId)}`;

async function readPendingPartyIntent(partyId: string): Promise<OnboardingIntent | null> {
  try {
    const key = partyIntentKey(partyId);
    const stored = await AsyncStorage.getItem(key);
    const intent = parseOnboardingIntent(stored);
    if (stored && !intent) {
      await AsyncStorage.removeItem(key);
    }
    return intent;
  } catch {
    return null;
  }
}

async function storePendingPartyIntent(
  partyId: string,
  intent: OnboardingIntent,
): Promise<boolean> {
  try {
    await AsyncStorage.setItem(partyIntentKey(partyId), intent);
    return true;
  } catch {
    return false;
  }
}

async function clearPendingPartyIntentIfCurrent(
  partyId: string,
  intent: OnboardingIntent,
  stillOwnsParty: () => boolean,
): Promise<void> {
  try {
    const key = partyIntentKey(partyId);
    if (
      stillOwnsParty()
      && await AsyncStorage.getItem(key) === intent
      && stillOwnsParty()
    ) {
      await AsyncStorage.removeItem(key);
    }
  } catch {
    // A later retry is safe because the server upserts intent for the authenticated Party.
  }
}

export async function persistOnboardingIntentForPartyWithRetry(
  rawPartyId: string | number | null | undefined,
  intent: OnboardingIntent,
  stillOwnsParty: () => boolean = () => true,
): Promise<boolean> {
  const partyId = String(rawPartyId ?? '').trim();
  if (!partyId || !stillOwnsParty()) return false;
  const storedForParty = await storePendingPartyIntent(partyId, intent);
  if (!stillOwnsParty()) return false;
  if (storedForParty) {
    await clearPendingOnboardingIntentIfCurrent(intent, stillOwnsParty);
    if (!stillOwnsParty()) return false;
  }
  try {
    await updateOnboardingIntent(intent);
  } catch {
    return false;
  }
  if (!stillOwnsParty()) return false;
  await clearPendingPartyIntentIfCurrent(partyId, intent, stillOwnsParty);
  if (!stillOwnsParty()) return false;
  await clearPendingOnboardingIntentIfCurrent(intent, stillOwnsParty);
  return true;
}

export async function retryPendingOnboardingIntent(
  rawPartyId: string | null | undefined,
  stillOwnsParty: () => boolean = () => true,
): Promise<boolean> {
  const partyId = rawPartyId?.trim();
  if (!partyId || !stillOwnsParty()) return false;
  const intent = await readPendingPartyIntent(partyId)
    ?? await readPendingOnboardingIntent();
  if (!intent || !stillOwnsParty()) return false;
  return persistOnboardingIntentForPartyWithRetry(partyId, intent, stillOwnsParty);
}

export async function markFirstValueCompleted(
  partyId: string | null | undefined,
  value: OnboardingFirstValue,
  stillOwnsParty: () => boolean = () => true,
): Promise<boolean> {
  const result = await completeFirstValueWithRetry(partyId, value, stillOwnsParty);
  return result?.newlyCompleted === true;
}

const firstValueKey = (partyId: string): string =>
  `${PENDING_FIRST_VALUE_PREFIX}${encodeURIComponent(partyId)}`;

async function clearPendingFirstValueIfCurrent(
  partyId: string,
  value: OnboardingFirstValue,
): Promise<void> {
  try {
    const key = firstValueKey(partyId);
    if (await AsyncStorage.getItem(key) === value) {
      await AsyncStorage.removeItem(key);
    }
  } catch {
    // A later retry is harmless because the completion endpoint is idempotent.
  }
}

export async function completeFirstValueWithRetry(
  rawPartyId: string | null | undefined,
  value: OnboardingFirstValue,
  stillOwnsParty: () => boolean = () => true,
): Promise<OnboardingCompletionResult | null> {
  const partyId = rawPartyId?.trim();
  if (!partyId || !stillOwnsParty()) return null;
  try {
    await AsyncStorage.setItem(firstValueKey(partyId), value);
  } catch {
    // Still attempt the authoritative handshake when local persistence is unavailable.
  }
  if (!stillOwnsParty()) return null;
  try {
    const result = await completeOnboardingProgress(value);
    if (!stillOwnsParty()) return null;
    await clearPendingFirstValueIfCurrent(partyId, value);
    return result;
  } catch {
    return null;
  }
}

export type RetriedFirstValueCompletion = {
  value: OnboardingFirstValue;
  result: OnboardingCompletionResult;
};

export async function retryPendingFirstValueCompletion(
  rawPartyId: string | null | undefined,
  stillOwnsParty: () => boolean = () => true,
): Promise<RetriedFirstValueCompletion | null> {
  const partyId = rawPartyId?.trim();
  if (!partyId || !stillOwnsParty()) return null;
  const key = firstValueKey(partyId);
  let stored: string | null;
  try {
    stored = await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
  if (!stored) return null;
  if (!FIRST_VALUES.has(stored as OnboardingFirstValue)) {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Best-effort cleanup of invalid local state.
    }
    return null;
  }
  const value = stored as OnboardingFirstValue;
  if (!stillOwnsParty()) return null;
  try {
    const result = await completeOnboardingProgress(value);
    if (!stillOwnsParty()) return null;
    await clearPendingFirstValueIfCurrent(partyId, value);
    return { value, result };
  } catch {
    return null;
  }
}

const onboardingExitKey = (partyId: string): string =>
  `${PENDING_ONBOARDING_EXIT_PREFIX}${encodeURIComponent(partyId)}`;

async function clearPendingOnboardingExit(
  partyId: string,
  stillOwnsParty: () => boolean,
): Promise<void> {
  try {
    const key = onboardingExitKey(partyId);
    if (
      stillOwnsParty()
      && await AsyncStorage.getItem(key) === PENDING_ONBOARDING_EXIT_VALUE
      && stillOwnsParty()
    ) {
      await AsyncStorage.removeItem(key);
    }
  } catch {
    // A later retry is harmless because the completion endpoint is idempotent.
  }
}

export async function completeOnboardingExitWithRetry(
  rawPartyId: string | null | undefined,
  stillOwnsParty: () => boolean = () => true,
): Promise<OnboardingCompletionResult | null> {
  const partyId = rawPartyId?.trim();
  if (!partyId || !stillOwnsParty()) return null;
  try {
    await AsyncStorage.setItem(
      onboardingExitKey(partyId),
      PENDING_ONBOARDING_EXIT_VALUE,
    );
  } catch {
    // Still attempt the authoritative handshake when local persistence is unavailable.
  }
  if (!stillOwnsParty()) return null;
  try {
    const result = await completeOnboardingProgress();
    if (!stillOwnsParty()) return null;
    await clearPendingOnboardingExit(partyId, stillOwnsParty);
    return result;
  } catch {
    return null;
  }
}

export type RetriedOnboardingExit = {
  result: OnboardingCompletionResult | null;
};

export async function retryPendingOnboardingExit(
  rawPartyId: string | null | undefined,
  stillOwnsParty: () => boolean = () => true,
): Promise<RetriedOnboardingExit | null> {
  const partyId = rawPartyId?.trim();
  if (!partyId || !stillOwnsParty()) return null;
  const key = onboardingExitKey(partyId);
  let stored: string | null;
  try {
    stored = await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
  if (!stored || !stillOwnsParty()) return null;
  if (stored !== PENDING_ONBOARDING_EXIT_VALUE) {
    try {
      if (stillOwnsParty()) await AsyncStorage.removeItem(key);
    } catch {
      // Best-effort cleanup of invalid local state.
    }
    return null;
  }
  return {
    result: await completeOnboardingExitWithRetry(partyId, stillOwnsParty),
  };
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
    case 'events':
    case 'learning':
    case 'professional_tools':
    default:
      return MOBILE_LANDING_ROUTE;
  }
}

export type MobileIntentNavigation =
  | { kind: 'native'; value: Href }
  | { kind: 'web'; value: string };

const resolvePublicWebFeature = (
  featureId: string,
  roles: readonly string[],
  modules: readonly string[],
): MobileIntentNavigation | null => {
  const feature = getFeatureById(featureId);
  if (!feature) return null;
  if (evaluateFeatureAccess(
    feature,
    { authenticated: true, roles, modules },
    'view',
  ).state !== 'allowed') return null;
  const destination = resolveMobileDestination(feature);
  return destination?.kind === 'web' ? destination : null;
};

export function resolveMobileIntentNavigation(
  intent: OnboardingIntent,
  roles: readonly string[] = [],
  modules: readonly string[] = [],
): MobileIntentNavigation {
  const publicFirstAction = intent === 'learning'
    ? resolvePublicWebFeature('public.trials', roles, modules)
    : intent === 'professional_tools'
      ? resolvePublicWebFeature('tools.music-maker', roles, modules)
      : null;
  return publicFirstAction ?? {
    kind: 'native',
    value: resolveMobileIntentDestination(intent, roles, modules),
  };
}
