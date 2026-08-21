const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockPatch = jest.fn();

jest.mock('../src/api/client', () => ({
  get: (...args: unknown[]) => mockGet(...args),
  post: (...args: unknown[]) => mockPost(...args),
  put: (...args: unknown[]) => mockPut(...args),
  patch: (...args: unknown[]) => mockPatch(...args),
}));

import { Directory } from '../src/api/directory';

describe('mobile music directory canonical API', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses anonymous public routes and safely encodes search filters', async () => {
    mockGet.mockResolvedValue({});
    await Directory.search({ q: 'bajista & productor', entityType: 'profile', radiusKm: 25 });
    expect(mockGet).toHaveBeenCalledWith('/directory/search?q=bajista%20%26%20productor&entityType=profile&radiusKm=25');

    await Directory.profile('música/quito');
    expect(mockGet).toHaveBeenLastCalledWith('/directory/profiles/m%C3%BAsica%2Fquito');
  });

  it('sends a caller-provided idempotency key for an application retry', async () => {
    mockPost.mockResolvedValue({});
    await Directory.apply('11111111-1111-4111-8111-111111111111', {
      applicantProfileId: '22222222-2222-4222-8222-222222222222',
      message: 'Tengo disponibilidad y experiencia para esta oportunidad.',
      portfolio: [],
    }, 'mobile-application-retry-1');

    expect(mockPost).toHaveBeenCalledWith(
      '/directory/classifieds/11111111-1111-4111-8111-111111111111/applications',
      expect.objectContaining({ applicantProfileId: '22222222-2222-4222-8222-222222222222' }),
      { headers: { 'Idempotency-Key': 'mobile-application-retry-1' } },
    );
  });

  it('uses the same generated contract for profile, classified, and alert mutations', async () => {
    mockPut.mockResolvedValue({});
    mockPost.mockResolvedValue({});
    mockPatch.mockResolvedValue({});

    await Directory.setAgeAssurance({ adultAttestation: true });
    expect(mockPut).toHaveBeenCalledWith('/directory/age-assurance', { adultAttestation: true });

    await Directory.saveSearch({ name: 'Bajistas en Quito', canonicalQuery: { q: 'bajista' }, alertsEnabled: true, alertFrequency: 'instant' }, 'saved-search-key-1');
    expect(mockPost).toHaveBeenLastCalledWith(
      '/directory/saved-searches',
      expect.objectContaining({ alertsEnabled: true }),
      { headers: { 'Idempotency-Key': 'saved-search-key-1' } },
    );

    await Directory.transitionClassified('33333333-3333-4333-8333-333333333333', 'filled');
    expect(mockPatch).toHaveBeenCalledWith('/directory/classifieds/33333333-3333-4333-8333-333333333333/status', { status: 'filled' });
  });

  it('uses participant-scoped invitation endpoints with stable retry keys', async () => {
    mockPost.mockResolvedValue({});
    mockPatch.mockResolvedValue({});
    const invitation = {
      senderProfileId: '11111111-1111-4111-8111-111111111111',
      targetProfileId: '22222222-2222-4222-8222-222222222222',
      message: 'Te invito a colaborar en esta oportunidad musical.',
    };
    await Directory.invite(invitation, 'mobile-invitation-retry-1');
    expect(mockPost).toHaveBeenCalledWith('/directory/invitations', invitation, { headers: { 'Idempotency-Key': 'mobile-invitation-retry-1' } });

    await Directory.transitionInvitation('33333333-3333-4333-8333-333333333333', 'accepted');
    expect(mockPatch).toHaveBeenCalledWith('/directory/invitations/33333333-3333-4333-8333-333333333333/status', { status: 'accepted' });
  });

  it('reads public reviews and submits only an eligible interaction with a stable key', async () => {
    mockGet.mockResolvedValue({});
    mockPost.mockResolvedValue({});
    await Directory.profileReviews('perfil & quito', '11111111-1111-4111-8111-111111111111', 10);
    expect(mockGet).toHaveBeenCalledWith('/directory/profiles/perfil%20%26%20quito/reviews?cursor=11111111-1111-4111-8111-111111111111&limit=10');
    await Directory.reviewEligibility('22222222-2222-4222-8222-222222222222');
    expect(mockGet).toHaveBeenLastCalledWith('/directory/review-eligibility?authorProfileId=22222222-2222-4222-8222-222222222222');
    const request = {
      interactionId: '33333333-3333-4333-8333-333333333333',
      authorProfileId: '22222222-2222-4222-8222-222222222222',
      subjectProfileId: '44444444-4444-4444-8444-444444444444',
      rating: 5,
      body: 'Una colaboración profesional y verificable.',
    };
    await Directory.createReview(request, 'mobile-review-retry-1');
    expect(mockPost).toHaveBeenLastCalledWith('/directory/reviews', request, { headers: { 'Idempotency-Key': 'mobile-review-retry-1' } });
  });
});
