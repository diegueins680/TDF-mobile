import {
  HIDDEN_INTERNAL_TABS,
  MOBILE_LANDING_ROUTE,
  NEW_USER_ALLOWED_FEATURES,
  NEW_USER_VISIBLE_TABS,
} from '../src/navigation/mobileSurface';

describe('mobile new-user surface', () => {
  it('lands new users on the public music directory', () => {
    expect(MOBILE_LANDING_ROUTE).toBe('/(tabs)/directory');
  });

  it('keeps the directory as the first visible tab', () => {
    expect(NEW_USER_VISIBLE_TABS.map((tab) => tab.name)).toEqual([
      'directory',
      'social',
      'more',
      'create',
      'profile',
    ]);
    expect(NEW_USER_VISIBLE_TABS.map((tab) => tab.title)).toEqual([
      'Directorio',
      'Seguir',
      'Explorar',
      'Crear',
      'Perfil',
    ]);
  });

  it('keeps internal ops modules hidden from the mobile tab bar', () => {
    expect(HIDDEN_INTERNAL_TABS).toEqual(
      expect.arrayContaining(['events', 'parties', 'bookings', 'pipelines', 'inventory', 'vcard', 'about'])
    );
  });

  it('documents the new-user feature scope', () => {
    expect(NEW_USER_ALLOWED_FEATURES).toEqual([
      'Directorio y clasificados musicales',
      'Eventos y venues públicos',
      'Perfiles públicos',
      'Búsquedas guardadas y alertas',
      'Comunidad y conexiones',
      'Explorar funciones autorizadas',
      'Creación rápida autorizada',
    ]);
  });
});
