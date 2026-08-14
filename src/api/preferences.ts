import type { components } from './generated/types';
import { get, put } from './client';

export type LocalePreferences = components['schemas']['LocalePreferences'];
export type LocalePreferencesUpdate = components['schemas']['LocalePreferencesUpdate'];

export const getLocalePreferences = () => get<LocalePreferences>('/session/preferences');
export const updateLocalePreferences = (input: LocalePreferencesUpdate) =>
  put<LocalePreferences>('/session/preferences', input);
