import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Href } from 'expo-router';

import {
  completeOnboardingProgress,
  type OnboardingFirstValue,
  type OnboardingIntent,
} from '../api/onboarding';
import { MOBILE_LANDING_ROUTE } from '../navigation/mobileSurface';

export type { OnboardingIntent } from '../api/onboarding';

export const DEFAULT_ONBOARDING_INTENT: OnboardingIntent = 'events';
export const PENDING_INTENT_KEY = 'tdf-onboarding-intent:pending';

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

export async function markFirstValueCompleted(
  partyId: string | null | undefined,
  value: OnboardingFirstValue,
): Promise<boolean> {
  if (!partyId) return false;
  try {
    const result = await completeOnboardingProgress(value);
    return result.newlyCompleted === true;
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
