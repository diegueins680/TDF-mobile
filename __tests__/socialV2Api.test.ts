jest.mock('../src/api/client', () => ({
  ...jest.requireActual('../src/api/client'),
  http: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'uuid-1') }));

import { setAuthToken } from '../src/api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SocialLegacyRetiredError,
  SocialV2,
  applySocialV2Intent,
  describeSocialV2Intent,
  hasSeenSocialV2Activation,
  resetSocialV2ActivationMemo,
  resolveSocialMode,
  socialV2ActionErrorMessage,
  socialV2ErrorMessage,
} from '../src/api/socialV2';
import { Social, exchangeVCard } from '../src/api/social';
import { connectWithParty } from '../src/api/socialConnect';

const { http } = jest.requireMock('../src/api/client') as {
  http: { get: jest.Mock; post: jest.Mock; put: jest.Mock; delete: jest.Mock };
};

const httpError = (status: number, data: unknown = '') =>
  Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status, data } });

const state = (overrides: Partial<Record<string, unknown>> = {}) => ({
  partyId: 9, revision: 3, following: false, requested: false, incoming: false,
  connected: false, blocked: false, muted: false, dismissed: false, ...overrides,
});
const meBody = {
  discoverable: false, personalized: true, revision: 0,
  relationships: [{ ...state(), displayName: 'Ana' }],
};

beforeEach(async () => {
  jest.clearAllMocks();
  setAuthToken('demo');
  resetSocialV2ActivationMemo();
  await AsyncStorage.clear();
});

describe('SocialV2 API helpers', () => {
  it('sends the strict v2 command body and validates the returned state', async () => {
    http.post.mockResolvedValueOnce({ data: state({ revision: 4, following: true }) });
    await expect(SocialV2.command(9, 'follow', 3, 'key-1')).resolves.toMatchObject({ following: true, revision: 4 });
    expect(http.post).toHaveBeenCalledWith('/social/v2/relationships/9', {
      operation: 'follow', expectedRevision: 3, requestKey: 'key-1',
    }, expect.objectContaining({ headers: { Authorization: 'Bearer demo' } }));
  });

  it('rejects invalid ids, revisions, request keys and operations before calling the API', async () => {
    await expect(SocialV2.command(0, 'follow', 0, 'k')).rejects.toThrow();
    await expect(SocialV2.command(9, 'follow', -1, 'k')).rejects.toThrow();
    await expect(SocialV2.command(9, 'follow', 0, '')).rejects.toThrow();
    await expect(SocialV2.command(9, 'befriend' as never, 0, 'k')).rejects.toThrow('Operación social inválida.');
    expect(http.post).not.toHaveBeenCalled();
  });

  it('updates preferences with the expected revision and pages the feed by cursor', async () => {
    http.put.mockResolvedValueOnce({ data: { discoverable: true, personalized: false, revision: 1 } });
    await SocialV2.preferences({ discoverable: true, personalized: false }, 0);
    expect(http.put).toHaveBeenCalledWith('/social/v2/preferences', { discoverable: true, personalized: false, expectedRevision: 0 });

    http.get.mockResolvedValueOnce({ data: { items: [], nextCursor: null } });
    await SocialV2.following('9007199254740993');
    expect(http.get).toHaveBeenCalledWith('/social/v2/following?limit=20&cursor=9007199254740993');

    http.get.mockResolvedValueOnce({ data: { personalized: true, items: [] } });
    await SocialV2.discover();
    expect(http.get).toHaveBeenLastCalledWith('/social/v2/discover?limit=20');
  });

  it('maps v2 statuses to Spanish guidance', () => {
    expect(socialV2ErrorMessage(httpError(409))).toContain('cambió');
    expect(socialV2ErrorMessage(httpError(429))).toContain('Espera un minuto');
    expect(socialV2ErrorMessage(httpError(404))).toContain('no está disponible');
    expect(socialV2ActionErrorMessage(new Error('Desbloquea primero'))).toBe('Desbloquea primero');
    expect(socialV2ActionErrorMessage(Object.assign(new Error('Network Error'), { isAxiosError: true })))
      .toContain('No se pudo actualizar');
  });
});

describe('runtime social mode', () => {
  it('uses v2 when GET /social/v2/me answers and remembers the activation', async () => {
    http.get.mockResolvedValueOnce({ data: meBody });
    await expect(resolveSocialMode()).resolves.toEqual({ mode: 'v2', me: meBody });
    expect(http.get).toHaveBeenCalledWith('/social/v2/me');
    resetSocialV2ActivationMemo();
    await expect(hasSeenSocialV2Activation()).resolves.toBe(true);
  });

  it.each([404, 500, 503])('falls back to legacy when v2 answers %i and was never active', async (status) => {
    http.get.mockRejectedValueOnce(httpError(status));
    await expect(resolveSocialMode()).resolves.toEqual({ mode: 'legacy' });
  });

  it('falls back to legacy on a network failure before activation', async () => {
    http.get.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { isAxiosError: true }));
    await expect(resolveSocialMode()).resolves.toEqual({ mode: 'legacy' });
  });

  it('never reopens legacy controls after activation: a later 404 is a pause', async () => {
    http.get.mockResolvedValueOnce({ data: meBody });
    await resolveSocialMode();
    http.get.mockRejectedValueOnce(httpError(404));
    await expect(resolveSocialMode()).resolves.toEqual({ mode: 'paused' });
  });

  it('propagates 401 and malformed v2 bodies instead of guessing', async () => {
    http.get.mockRejectedValueOnce(httpError(401));
    await expect(resolveSocialMode()).rejects.toMatchObject({ response: { status: 401 } });
    http.get.mockResolvedValueOnce({ data: { relationships: 'nope' } });
    await expect(resolveSocialMode()).rejects.toThrow();
  });
});

describe('legacy writes after server activation', () => {
  it.each([
    ['addFriend', () => Social.addFriend(9), 'post'],
    ['removeFriend', () => Social.removeFriend(9), 'delete'],
    ['exchangeVCard', () => exchangeVCard(9), 'post'],
  ] as const)('%s turns a 410 into SocialLegacyRetiredError and latches v2', async (_name, call, method) => {
    http[method].mockRejectedValueOnce(httpError(410, 'Esta accion de amistad ya no esta disponible.'));
    await expect(call()).rejects.toBeInstanceOf(SocialLegacyRetiredError);
    await expect(hasSeenSocialV2Activation()).resolves.toBe(true);
    // From now on a v2 outage is a pause, not a reason to reopen legacy writes.
    http.get.mockRejectedValueOnce(httpError(404));
    await expect(resolveSocialMode()).resolves.toEqual({ mode: 'paused' });
  });

  it('keeps other legacy errors unchanged', async () => {
    const error = httpError(404, 'Party not found');
    http.post.mockRejectedValueOnce(error);
    await expect(Social.addFriend(9)).rejects.toBe(error);
    await expect(hasSeenSocialV2Activation()).resolves.toBe(false);
  });
});

describe('one-tap v2 intents', () => {
  it('reads the revision then sends a single request command', async () => {
    http.get.mockResolvedValueOnce({ data: state({ revision: 5 }) });
    http.post.mockResolvedValueOnce({ data: state({ revision: 6, requested: true }) });
    const result = await applySocialV2Intent(9, 'request', 'k-1');
    expect(http.get).toHaveBeenCalledWith('/social/v2/relationships/9', expect.any(Object));
    expect(http.post).toHaveBeenCalledWith('/social/v2/relationships/9', { operation: 'request', expectedRevision: 5, requestKey: 'k-1' }, expect.any(Object));
    expect(result.changed).toBe(true);
    expect(describeSocialV2Intent(result.state, 'request', true)).toContain('debe aceptarla');
  });

  it('stops the command if the account changes during the relationship read', async () => {
    http.get.mockImplementationOnce(async () => {
      setAuthToken('another-account');
      return { data: state() };
    });
    await expect(applySocialV2Intent(9, 'request')).rejects.toThrow('sesión cambió');
    expect(http.post).not.toHaveBeenCalled();
  });

  it('accepts an incoming request instead of sending a duplicate', async () => {
    http.get.mockResolvedValueOnce({ data: state({ incoming: true }) });
    http.post.mockResolvedValueOnce({ data: state({ revision: 4, incoming: true, requested: true, connected: true }) });
    const result = await applySocialV2Intent(9, 'request', 'k-2');
    expect(http.post.mock.calls[0][1]).toMatchObject({ operation: 'accept' });
    expect(describeSocialV2Intent(result.state, 'request', true)).toBe('Conexión aceptada.');
  });

  it('does nothing when the intent is already satisfied and refuses blocked pairs', async () => {
    http.get.mockResolvedValueOnce({ data: state({ following: true }) });
    await expect(applySocialV2Intent(9, 'follow')).resolves.toMatchObject({ changed: false });
    http.get.mockResolvedValueOnce({ data: state({ blocked: true }) });
    await expect(applySocialV2Intent(9, 'request')).rejects.toThrow('Desbloquea');
    expect(http.post).not.toHaveBeenCalled();
  });
});

describe('connectWithParty fallback', () => {
  it('uses only v2 when v2 is live', async () => {
    http.get.mockResolvedValueOnce({ data: state() });
    http.post.mockResolvedValueOnce({ data: state({ revision: 4, requested: true }) });
    await expect(connectWithParty(9, 'v2', { requestKey: 'k' })).resolves.toMatchObject({ via: 'v2' });
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(http.post.mock.calls[0][0]).toBe('/social/v2/relationships/9');
  });

  it('uses the legacy endpoint before activation', async () => {
    http.post.mockResolvedValueOnce({ data: [] });
    await expect(connectWithParty(9, 'legacy')).resolves.toMatchObject({ via: 'legacy', message: 'Agregaste este contacto a tu red.' });
    expect(http.post).toHaveBeenCalledWith('/social/friends/9', {});
  });

  it('switches to a v2 request when the legacy write returns 410', async () => {
    http.post.mockRejectedValueOnce(httpError(410));
    http.get.mockResolvedValueOnce({ data: state() });
    http.post.mockResolvedValueOnce({ data: state({ revision: 4, requested: true }) });
    const resolveMode = jest.fn(async () => ({ mode: 'v2' as const, me: meBody }));
    const result = await connectWithParty(9, 'legacy', { resolveMode, requestKey: 'k' });
    expect(result).toMatchObject({ via: 'v2', switchedToV2: true });
    expect(result.message).toContain('Actualizamos tu vista social.');
    expect(http.post.mock.calls[1]).toEqual(['/social/v2/relationships/9', { operation: 'request', expectedRevision: 3, requestKey: 'k' }, expect.objectContaining({ headers: { Authorization: 'Bearer demo' } })]);
  });

  it('shows the retirement message when v2 is not reachable after a 410', async () => {
    http.post.mockRejectedValueOnce(httpError(410));
    const resolveMode = jest.fn(async () => ({ mode: 'paused' as const }));
    await expect(connectWithParty(9, 'legacy', { resolveMode })).rejects.toBeInstanceOf(SocialLegacyRetiredError);
  });

  it('does not call any write while paused', async () => {
    await expect(connectWithParty(9, 'paused')).rejects.toThrow('actualizando la red social');
    expect(http.post).not.toHaveBeenCalled();
  });
});
