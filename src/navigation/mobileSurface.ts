import { t } from '../i18n';

export const MOBILE_LANDING_ROUTE = '/(tabs)/events' as const;

export const NEW_USER_VISIBLE_TABS = [
  { name: 'events', title: t('tabs.events'), icon: 'calendar-star' },
  { name: 'social', title: t('tabs.social'), icon: 'account-heart' },
  { name: 'more', title: t('tabs.explore'), icon: 'compass-outline' },
  { name: 'create', title: t('tabs.create'), icon: 'plus-circle-outline' },
  { name: 'profile', title: t('tabs.profile'), icon: 'account-circle' },
];

export const HIDDEN_INTERNAL_TABS = [
  'parties',
  'bookings',
  'pipelines',
  'about',
  'inventory',
  'vcard',
] as const;

export const NEW_USER_ALLOWED_FEATURES = [
  'Eventos',
  'Compra de tickets',
  'vCards',
  'Perfil',
  'Seguir',
  'Video streaming',
  'Club de fans',
  'Explorar funciones autorizadas',
  'Creación rápida autorizada',
] as const;
