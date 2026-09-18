import { t } from '../i18n';

export const MOBILE_LANDING_ROUTE = '/(tabs)/directory' as const;

export const NEW_USER_VISIBLE_TABS = [
  { name: 'directory', title: t('tabs.directory'), titleKey: 'tabs.directory', icon: 'magnify' },
  { name: 'social', title: t('tabs.social'), titleKey: 'tabs.social', icon: 'account-heart' },
  { name: 'more', title: t('tabs.explore'), titleKey: 'tabs.explore', icon: 'compass-outline' },
  { name: 'create', title: t('tabs.create'), titleKey: 'tabs.create', icon: 'plus-circle-outline' },
  { name: 'profile', title: t('tabs.profile'), titleKey: 'tabs.profile', icon: 'account-circle' },
];

export const HIDDEN_INTERNAL_TABS = [
  'events',
  'parties',
  'bookings',
  'pipelines',
  'about',
  'inventory',
  'vcard',
] as const;

export const NEW_USER_ALLOWED_FEATURES = [
  'Directorio y clasificados musicales',
  'Eventos y venues públicos',
  'Perfiles públicos',
  'Búsquedas guardadas y alertas',
  'Comunidad y conexiones',
  'Explorar funciones autorizadas',
  'Creación rápida autorizada',
] as const;

// Resolve labels from the current account/device locale at render time; module
// initialization must not freeze labels in the initial Spanish locale.
export function getVisibleMobileTabs(language: 'es' | 'en', authenticated: boolean) {
  return NEW_USER_VISIBLE_TABS
    .filter((tab) => authenticated || tab.name === 'directory')
    .map((tab) => ({ ...tab, title: t(tab.titleKey, undefined, language) }));
}

export function mobileTabAccessibilityLabel(
  title: string, index: number, count: number, language: 'es' | 'en', platform: string,
): string {
  // React Navigation's iOS default counts registered hidden routes. Android
  // supplies the native tab role separately, so preserve its name-only label.
  return platform === 'ios'
    ? t('tabs.accessibilityPosition', { title, position: index + 1, count }, language)
    : title;
}
