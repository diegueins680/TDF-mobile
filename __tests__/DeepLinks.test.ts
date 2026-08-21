import { directoryDeepLinkTarget } from '../src/navigation/deepLinks';

describe('directory deep links', () => {
  it('does not navigate again when the browser already opened the destination', () => {
    expect(directoryDeepLinkTarget('directory/manage', '/directory/manage')).toBeNull();
  });

  it('normalizes slashes and preserves navigation to a different directory destination', () => {
    expect(directoryDeepLinkTarget('/directory/profile/perfil-demo/', '/directory')).toBe(
      '/directory/profile/perfil-demo',
    );
  });
});
