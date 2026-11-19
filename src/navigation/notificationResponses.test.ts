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

it('routes a chat notice to the exact web conversation without trusting arbitrary URLs', () => {
  const row = { nId: 1, nType: 'chat.message', nTitle: 'Nuevo mensaje', nBody: '', nIsRead: false, nCreatedAt: '', nTargetType: 'chat_thread', nTargetKey: '42' };
  expect(notificationTargetPath(row)).toBe('/chat?threadId=42');
  for (const nTargetKey of ['0', '-1', '1.2', '9007199254740992', 'https://evil.example', '42?partyId=5']) {
    expect(notificationTargetPath({ ...row, nTargetKey })).toBeNull();
  }
});

describe('event agreement notification destinations', () => {
  const row = { nId: 3, nType: 'event.agreement.updated', nTitle: 'Synthetic agreement', nBody: 'https://untrusted.invalid', nIsRead: false, nCreatedAt: '', nTargetType: 'event_agreement', nTargetId: 17 };
  const agreement = '123e4567-e89b-12d3-a456-426614174000';

  it('retains the typed event and exact agreement identity on the canonical web path', () => {
    expect(notificationTargetPath({ ...row, nTargetKey: agreement })).toBe(`/social/eventos/17/acuerdos?agreement=${agreement}`);
    expect(notificationTargetPath(row)).toBe('/social/eventos/17/acuerdos');
  });

  it('never forms a destination from an unsafe event identity', () => {
    for (const nTargetId of [0, -1, 1.2, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, null]) {
      expect(notificationTargetPath({ ...row, nTargetId, nTargetKey: agreement })).toBeNull();
    }
  });

  it('falls back to the event overview without reflecting malformed agreement keys or text', () => {
    for (const nTargetKey of ['', 'https://untrusted.invalid', `${agreement}?partyId=9`, '../other', '17']) {
      expect(notificationTargetPath({ ...row, nTargetKey })).toBe('/social/eventos/17/acuerdos');
    }
  });
});
