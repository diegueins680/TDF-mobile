import {
  HIDDEN_INTERNAL_TABS,
  MOBILE_LANDING_ROUTE,
  NEW_USER_ALLOWED_FEATURES,
  NEW_USER_VISIBLE_TABS,
  getVisibleMobileTabs,
  mobileTabAccessibilityLabel,
} from '../src/navigation/mobileSurface';

describe('mobile new-user surface', () => {
  it('lands new users on the public music directory', () => {
    expect(MOBILE_LANDING_ROUTE).toBe('/(tabs)/directory');
  });

  it('keeps the directory as the first visible tab', () => {
    expect(NEW_USER_VISIBLE_TABS.map((tab) => tab.name)).toEqual([
      'directory',
      'events',
      'social',
      'more',
      'profile',
    ]);
    expect(NEW_USER_VISIBLE_TABS.map((tab) => tab.title)).toEqual([
      'Directorio',
      'Eventos',
      'Seguir',
      'Explorar',
      'Perfil',
    ]);
  });

  it('opens Crear from Explorar instead of the tab bar', () => {
    expect(NEW_USER_VISIBLE_TABS.some((tab) => tab.name === 'create')).toBe(false);
    expect(HIDDEN_INTERNAL_TABS).not.toContain('events');
  });

  it('keeps internal ops modules hidden from the mobile tab bar', () => {
    expect(HIDDEN_INTERNAL_TABS).toEqual(
      expect.arrayContaining(['create', 'parties', 'bookings', 'pipelines', 'inventory', 'vcard', 'about'])
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


describe('visible mobile tab label contracts', () => {
  for (const language of ['es', 'en'] as const) {
    for (const authenticated of [false, true]) {
      it(`uses only visible positions for ${language}, authenticated=${authenticated}`, () => {
        const tabs = getVisibleMobileTabs(language, authenticated);
        expect(tabs).toHaveLength(authenticated ? 5 : 1);
        tabs.forEach((tab, index) => {
          const label = mobileTabAccessibilityLabel(tab.title, index, tabs.length, language, 'ios');
          expect(label).toContain(language === 'es'
            ? `pestaña ${index + 1} de ${tabs.length}` : `tab ${index + 1} of ${tabs.length}`);
          expect(mobileTabAccessibilityLabel(tab.title, index, tabs.length, language, 'android')).toBe(tab.title);
        });
      });
    }
  }
});
