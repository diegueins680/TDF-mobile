import { get, put } from './client';

export type LocalePreferences = {
  locale: string;
  currency: string;
  timezone: string;
  countryCode: string | null;
  supportedLocales: string[];
  supportedCurrencies: string[];
};

export type LocalePreferencesUpdate = Pick<LocalePreferences, 'locale' | 'currency' | 'timezone' | 'countryCode'>;

export const getLocalePreferences = () => get<LocalePreferences>('/session/preferences');
export const updateLocalePreferences = (input: LocalePreferencesUpdate) =>
  put<LocalePreferences>('/session/preferences', input);
