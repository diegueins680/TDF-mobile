import type { Href } from 'expo-router';

export type MaterialCommunityIconName =
  keyof typeof import('@expo/vector-icons').MaterialCommunityIcons.glyphMap;

export type TabMenuItem = {
  name: string;
  title: string;
  icon: MaterialCommunityIconName;
};

export type QuickAction = {
  label: string;
  icon: MaterialCommunityIconName;
  route: Href;
};

export const TAB_MENU_ITEMS: readonly TabMenuItem[] = [
  { name: 'parties', title: 'Clientes', icon: 'account-multiple' },
  { name: 'bookings', title: 'Reservas', icon: 'calendar-check' },
  { name: 'create', title: 'Crear', icon: 'plus-circle' },
  { name: 'pipelines', title: 'Pipelines', icon: 'pipe' },
  { name: 'events', title: 'Eventos', icon: 'calendar-star' },
  { name: 'inventory', title: 'Inventario', icon: 'archive' },
  { name: 'social', title: 'Social', icon: 'account-heart' },
  { name: 'vcard', title: 'vCard', icon: 'card-account-details' },
  { name: 'about', title: 'Acerca de', icon: 'information' },
] as const;

export const QUICK_ACTIONS: readonly QuickAction[] = [
  { label: 'Nueva reserva', icon: 'calendar-plus', route: '/bookings' },
  { label: 'Nuevo evento', icon: 'calendar-star', route: '/createEvent' },
  { label: 'Nuevo contacto', icon: 'account-plus', route: '/parties' },
  { label: 'Inventario', icon: 'archive', route: '/inventory' },
  { label: 'Explorar lugares', icon: 'map-marker', route: '/venueExplorer' },
  { label: 'Mi perfil', icon: 'account-circle', route: '/userProfile' },
] as const;
