import { QUICK_ACTIONS, TAB_MENU_ITEMS } from '../src/navigation/menu';

describe('mobile navigation menu access', () => {
  it('exposes every feature tab with an explicit menu item', () => {
    const tabNames = TAB_MENU_ITEMS.map((item) => item.name);

    expect(new Set(tabNames).size).toBe(tabNames.length);
    expect(tabNames).toEqual(
      expect.arrayContaining([
        'parties',
        'bookings',
        'create',
        'pipelines',
        'events',
        'inventory',
        'social',
        'vcard',
        'about',
      ]),
    );
  });

  it('keeps completed standalone feature screens reachable from quick actions', () => {
    const actionRoutes = QUICK_ACTIONS.map((action) => action.route);

    expect(actionRoutes).toEqual(
      expect.arrayContaining([
        '/createEvent',
        '/inventory',
        '/venueExplorer',
        '/userProfile',
      ]),
    );
  });
});
