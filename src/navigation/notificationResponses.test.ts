import { notificationResponseTarget } from './notificationResponses';
import { mobileDeepLinkTarget, currentRouteReturnTo } from './deepLinks';
import { notificationTargetPath } from './notificationTarget';
describe('notification entry point identities', () => {
  it('accepts only a positive recipient notification ID from push metadata', () => {
    expect(notificationResponseTarget({ notificationId: 17, url: 'https://evil.example' })).toBe('/notifications?notificationId=17');
    expect(notificationResponseTarget({ notificationId: '17' })).toBe('/notifications?notificationId=17');
    for (const notificationId of [0, -1, 1.2, NaN, '1/../../auth', 'https://evil.example', {}, Number.MAX_SAFE_INTEGER + 1]) {
      expect(notificationResponseTarget({ notificationId })).toBeNull();
    }
    expect(notificationResponseTarget({ url: 'https://evil.example' })).toBeNull();
  });
  it('preserves cold-start notification and request IDs through authentication', () => {
    const target = mobileDeepLinkTarget('tdf://notification/17', '/');
    expect(target).toBe('/notifications?notificationId=17');
    expect(currentRouteReturnTo('/notifications', target!)).toBe(target);
    expect(mobileDeepLinkTarget('tdf://access-requests/23', '/')).toBe('/access-requests?request=23');
    expect(mobileDeepLinkTarget('tdf://notification/17?returnTo=https://evil.example', '/')).toBe(target);
    expect(mobileDeepLinkTarget('https://evil.example/notification/17', '/')).toBeNull();
  });
  it('shares web target resolution and never treats the old artist recipient as the follower', () => {
    const row = { nId: 1, nType: 'artist_liked', nTitle: 'Galo', nBody: 'different text', nIsRead: false, nCreatedAt: '', nTargetId: 7 };
    expect(notificationTargetPath({ ...row, nTargetType: 'party_profile' })).toBe('/perfil/7');
    expect(notificationTargetPath({ ...row, nTargetType: 'artist' })).toBeNull();
  });
});
