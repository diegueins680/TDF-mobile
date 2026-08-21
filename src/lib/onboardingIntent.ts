import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Href } from 'expo-router';

import { MOBILE_LANDING_ROUTE } from '../navigation/mobileSurface';
import { resolveNewUserCohort } from './firstRunFlags';

export type OnboardingIntent =
  | 'events'
  | 'follow_artists'
  | 'artist_profile'
  | 'internships'
  | 'learning'
  | 'professional_tools';

export const DEFAULT_ONBOARDING_INTENT: OnboardingIntent = 'events';
export const PENDING_INTENT_KEY = 'tdf-onboarding-intent:pending';
export const PARTY_INTENT_PREFIX = 'tdf-onboarding-intent:party:';
export const FIRST_VALUE_PREFIX = 'tdf-first-value-completed:';

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
  { id: 'learning', labelEs: 'Aprender o enseñar', labelEn: 'Learn or teach' },
  { id: 'professional_tools', labelEs: 'Usar herramientas profesionales', labelEn: 'Use professional tools' },
] as const;

const partyIntentKey = (partyId: string) => `${PARTY_INTENT_PREFIX}${partyId}`;
const firstValueKey = (partyId: string) => `${FIRST_VALUE_PREFIX}${partyId}`;

export async function persistOnboardingIntent(intent: OnboardingIntent, partyId?: string | null) {
  try {
    await AsyncStorage.setItem(partyId ? partyIntentKey(partyId) : PENDING_INTENT_KEY, intent);
  } catch {
    // Intent improves routing but must never block account creation.
  }
}

export async function attachPendingIntentToParty(partyId: string, intent: OnboardingIntent) {
  if (!partyId) return;
  try {
    await AsyncStorage.multiSet([
      [partyIntentKey(partyId), intent],
      [PENDING_INTENT_KEY, intent],
    ]);
  } catch {
    // Best effort only.
  }
}

export async function markFirstValueCompleted(
  partyId: string | null | undefined,
  value: string,
): Promise<boolean> {
  if (!partyId) return false;
  try {
    if (!await resolveNewUserCohort(partyId)) return false;
    const key = firstValueKey(partyId);
    if (await AsyncStorage.getItem(key)) return false;
    await AsyncStorage.setItem(key, JSON.stringify({ value, completedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
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
