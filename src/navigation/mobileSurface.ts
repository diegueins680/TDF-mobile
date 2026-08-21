import { t } from '../i18n';

export const MOBILE_LANDING_ROUTE = '/(tabs)/directory' as const;

export const NEW_USER_VISIBLE_TABS = [
  { name: 'directory', title: t('tabs.directory'), icon: 'magnify' },
  { name: 'social', title: t('tabs.social'), icon: 'account-heart' },
  { name: 'more', title: t('tabs.explore'), icon: 'compass-outline' },
  { name: 'create', title: t('tabs.create'), icon: 'plus-circle-outline' },
  { name: 'profile', title: t('tabs.profile'), icon: 'account-circle' },
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
