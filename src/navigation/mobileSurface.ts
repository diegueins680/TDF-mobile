export const MOBILE_LANDING_ROUTE = '/(tabs)/events' as const;

export const NEW_USER_VISIBLE_TABS = [
  { name: 'events', title: 'Eventos', icon: 'calendar-star' },
  { name: 'social', title: 'Seguir', icon: 'account-heart' },
  { name: 'more', title: 'Explorar', icon: 'compass-outline' },
  { name: 'create', title: 'Crear', icon: 'plus-circle-outline' },
  { name: 'profile', title: 'Perfil', icon: 'account-circle' },
] as const;

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
