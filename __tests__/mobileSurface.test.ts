import {
  HIDDEN_INTERNAL_TABS,
  MOBILE_LANDING_ROUTE,
  NEW_USER_ALLOWED_FEATURES,
  NEW_USER_VISIBLE_TABS,
} from '../src/navigation/mobileSurface';

describe('mobile new-user surface', () => {
  it('lands new users on events', () => {
    expect(MOBILE_LANDING_ROUTE).toBe('/(tabs)/events');
  });

  it('keeps the visible tab bar focused on community plus two-interaction discovery', () => {
    expect(NEW_USER_VISIBLE_TABS.map((tab) => tab.name)).toEqual([
      'events',
      'social',
      'more',
      'create',
      'profile',
    ]);
    expect(NEW_USER_VISIBLE_TABS.map((tab) => tab.title)).toEqual([
      'Eventos',
      'Seguir',
      'Explorar',
      'Crear',
      'Perfil',
    ]);
  });

  it('keeps internal ops modules hidden from the mobile tab bar', () => {
    expect(HIDDEN_INTERNAL_TABS).toEqual(
      expect.arrayContaining(['parties', 'bookings', 'pipelines', 'inventory', 'vcard', 'about'])
    );
  });

  it('documents the new-user feature scope', () => {
    expect(NEW_USER_ALLOWED_FEATURES).toEqual([
      'Eventos',
      'Compra de tickets',
      'vCards',
      'Perfil',
      'Seguir',
      'Video streaming',
      'Club de fans',
      'Explorar funciones autorizadas',
      'Creación rápida autorizada',
    ]);
  });
});
