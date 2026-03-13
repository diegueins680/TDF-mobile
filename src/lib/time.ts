import Constants from 'expo-constants';

type TimeExtra = { defaultTimeZone?: string | null };

const expoExtra = Constants.expoConfig?.extra as TimeExtra | undefined;

export const DEFAULT_TZ =
  process.env.EXPO_PUBLIC_TZ?.trim() ||
  expoExtra?.defaultTimeZone?.trim() ||
  'America/Guayaquil';