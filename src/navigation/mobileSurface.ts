export const MOBILE_LANDING_ROUTE = '/(tabs)/events' as const;

export const NEW_USER_VISIBLE_TABS = [
  { name: 'events', title: 'Eventos', icon: 'calendar-star' },
  { name: 'social', title: 'Seguir', icon: 'account-heart' },
  { name: 'vcard', title: 'vCard', icon: 'card-account-details' },
  { name: 'profile', title: 'Perfil', icon: 'account-circle' },
] as const;

export const HIDDEN_INTERNAL_TABS = [
  'parties',
  'bookings',
  'pipelines',
  'about',
  'create',
  'inventory',
] as const;

export const NEW_USER_ALLOWED_FEATURES = [
  'Eventos',
  'Compra de tickets',
  'vCards',
  'Perfil',
  'Seguir',
  'Video streaming',
  'Club de fans',
] as const;
