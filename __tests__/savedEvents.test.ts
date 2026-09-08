import AsyncStorage from '@react-native-async-storage/async-storage';

import { Directory } from '../src/api/directory';
import { AuthSessionChangedError, setAuthToken } from '../src/api/client';
import {
  SavedEventImportError,
  importPendingSavedEvents,
  loadSavedEventSnapshot,
  setSavedEventDesiredState,
} from '../src/lib/savedEvents';

const LEGACY_STORAGE_KEY = 'tdf-saved-event-ids';
const pendingKeyFor = (partyId: string) => `tdf-saved-event-ids:party:${partyId}`;
const cacheKeyFor = (partyId: string) => `tdf-saved-event-cache:v1:party:${partyId}`;
const AUTH_TOKEN = 'Bearer token-a';
const requestConfig = expect.objectContaining({
  headers: { Authorization: AUTH_TOKEN },
  signal: expect.anything(),
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../src/api/directory', () => ({
  Directory: {
    favorites: jest.fn(),
    addFavorite: jest.fn(),
    removeFavorite: jest.fn(),
  },
}));

describe('savedEvents server continuity', () => {
  const getItemMock = jest.mocked(AsyncStorage.getItem);
  const setItemMock = jest.mocked(AsyncStorage.setItem);
  const removeItemMock = jest.mocked(AsyncStorage.removeItem);
  const favoritesMock = jest.mocked(Directory.favorites);
  const addFavoriteMock = jest.mocked(Directory.addFavorite);
  const removeFavoriteMock = jest.mocked(Directory.removeFavorite);

  let storage: Record<string, string>;

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthToken(AUTH_TOKEN);
    storage = {};
    getItemMock.mockImplementation(async (key: string) => storage[key] ?? null);
    setItemMock.mockImplementation(async (key: string, value: string) => {
      storage[key] = value;
    });
    removeItemMock.mockImplementation(async (key: string) => {
      delete storage[key];
    });
  });

  function expectNoUnscopedRead() {
    expect(getItemMock).not.toHaveBeenCalledWith(LEGACY_STORAGE_KEY);
  }

  function mockFavorite(id: string) {
    return {
      targetKind: 'event' as const,
      targetId: id,
      createdAt: '2026-09-07T10:00:00Z',
      result: null,
    };
  }

  it('loads Party-scoped server favorites as authority and writes a separate confirmed cache', async () => {
    favoritesMock.mockResolvedValue([mockFavorite('0012'), mockFavorite('12'), mockFavorite('7')]);

    await expect(loadSavedEventSnapshot('42', AUTH_TOKEN)).resolves.toMatchObject({
      ids: ['12', '7'],
      pendingImportIds: [],
      pendingImportError: null,
      source: 'server',
      cachedAt: null,
    });

    expect(favoritesMock).toHaveBeenCalledWith('event', requestConfig);
    expect(JSON.parse(storage[cacheKeyFor('42')] ?? '{}')).toMatchObject({ ids: ['12', '7'] });
    expectNoUnscopedRead();
  });

  it('falls back to the last confirmed Party cache without treating pending imports as saved', async () => {
    storage[cacheKeyFor('42')] = JSON.stringify({
      ids: ['9'],
      cachedAt: '2026-09-07T09:00:00Z',
    });
    storage[pendingKeyFor('42')] = JSON.stringify(['11']);
    favoritesMock.mockRejectedValue({
      isAxiosError: true,
      code: 'ERR_NETWORK',
      response: undefined,
    });

    await expect(loadSavedEventSnapshot('42', AUTH_TOKEN)).resolves.toEqual({
      ids: ['9'],
      pendingImportIds: ['11'],
      pendingImportError: null,
      source: 'cache',
      cachedAt: '2026-09-07T09:00:00Z',
    });
  });

  it('rejects a failed server read when no confirmed cache exists', async () => {
    favoritesMock.mockRejectedValue(new Error('offline'));
    await expect(loadSavedEventSnapshot('42', AUTH_TOKEN)).rejects.toThrow('offline');
  });

  it('changes desired state only through acknowledged server operations', async () => {
    addFavoriteMock.mockResolvedValue(undefined);
    removeFavoriteMock.mockResolvedValue(undefined);

    await expect(setSavedEventDesiredState('42', '0012', true, AUTH_TOKEN)).resolves.toEqual({
      saved: true,
      cacheUpdated: true,
    });
    expect(addFavoriteMock).toHaveBeenCalledWith('event', '12', requestConfig);

    await expect(setSavedEventDesiredState('42', 12, false, AUTH_TOKEN)).resolves.toEqual({
      saved: false,
      cacheUpdated: true,
    });
    expect(removeFavoriteMock).toHaveBeenCalledWith('event', '12', requestConfig);
  });

  it('does not change the confirmed cache or claim success after a server failure', async () => {
    const cached = JSON.stringify({
      ids: ['9'],
      cachedAt: '2026-09-07T09:00:00Z',
    });
    storage[cacheKeyFor('42')] = cached;
    addFavoriteMock.mockRejectedValue(new Error('save failed'));

    await expect(setSavedEventDesiredState('42', '10', true, AUTH_TOKEN)).rejects.toThrow('save failed');
    expect(storage[cacheKeyFor('42')]).toBe(cached);
  });

  it('imports only the Party-scoped legacy list after every server write succeeds', async () => {
    storage[LEGACY_STORAGE_KEY] = JSON.stringify(['99']);
    storage[pendingKeyFor('42')] = JSON.stringify(['0012', 7, '12']);
    addFavoriteMock.mockResolvedValue(undefined);

    await expect(importPendingSavedEvents('42', AUTH_TOKEN)).resolves.toMatchObject({
      importedCount: 2,
      ids: ['12', '7'],
    });

    expect(addFavoriteMock).toHaveBeenNthCalledWith(1, 'event', '12', requestConfig);
    expect(addFavoriteMock).toHaveBeenNthCalledWith(2, 'event', '7', requestConfig);
    expect(storage[pendingKeyFor('42')]).toBeUndefined();
    expect(storage[LEGACY_STORAGE_KEY]).toBe(JSON.stringify(['99']));
    expectNoUnscopedRead();
  });

  it('retains the complete Party-scoped import source when any write is interrupted', async () => {
    const pending = JSON.stringify(['12', '7']);
    storage[pendingKeyFor('42')] = pending;
    addFavoriteMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('offline'));

    const importAttempt = importPendingSavedEvents('42', AUTH_TOKEN);
    await expect(importAttempt).rejects.toBeInstanceOf(SavedEventImportError);
    await expect(importAttempt).rejects.toMatchObject({
      importedCount: 1,
      totalCount: 2,
    });
    expect(storage[pendingKeyFor('42')]).toBe(pending);
    expect(removeItemMock).not.toHaveBeenCalled();
  });

  it('keeps caches isolated by Party and rejects invalid identities before I/O', async () => {
    favoritesMock.mockResolvedValue([mockFavorite('9')]);
    await loadSavedEventSnapshot('42', AUTH_TOKEN);
    setAuthToken('Bearer token-b');
    favoritesMock.mockResolvedValue([mockFavorite('11')]);
    await loadSavedEventSnapshot('77', 'Bearer token-b');

    expect(JSON.parse(storage[cacheKeyFor('42')] ?? '{}')).toMatchObject({ ids: ['9'] });
    expect(JSON.parse(storage[cacheKeyFor('77')] ?? '{}')).toMatchObject({ ids: ['11'] });

    jest.clearAllMocks();
    await expect(loadSavedEventSnapshot('party-42', 'Bearer token-b')).rejects.toThrow('valid authenticated Party ID');
    await expect(setSavedEventDesiredState('42', 'event-nine', true, 'Bearer token-b')).rejects.toThrow('numeric event ID');
    expect(favoritesMock).not.toHaveBeenCalled();
    expect(addFavoriteMock).not.toHaveBeenCalled();
  });

  it('does not hide authenticated or service failures behind a cached offline state', async () => {
    storage[cacheKeyFor('42')] = JSON.stringify({
      ids: ['9'],
      cachedAt: '2026-09-07T09:00:00Z',
    });
    favoritesMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: 'Unauthorized' },
    });

    await expect(loadSavedEventSnapshot('42', AUTH_TOKEN)).rejects.toMatchObject({
      response: { status: 401 },
    });
  });

  it('loads server truth even when the optional pending-import source is corrupt', async () => {
    storage[pendingKeyFor('42')] = '{';
    favoritesMock.mockResolvedValue([mockFavorite('9')]);

    await expect(loadSavedEventSnapshot('42', AUTH_TOKEN)).resolves.toMatchObject({
      ids: ['9'],
      pendingImportIds: [],
      pendingImportError: expect.stringMatching(/corrupted/i),
      source: 'server',
    });
    expect(storage[pendingKeyFor('42')]).toBe('{');
  });

  it('stops a pending import before any write when the authenticated session changes', async () => {
    let releasePendingRead: ((value: string | null) => void) | undefined;
    getItemMock.mockImplementation((key: string) => {
      if (key === pendingKeyFor('42')) {
        return new Promise((resolve) => {
          releasePendingRead = resolve;
        });
      }
      return Promise.resolve(storage[key] ?? null);
    });

    const importAttempt = importPendingSavedEvents('42', AUTH_TOKEN);
    await Promise.resolve();
    setAuthToken('Bearer token-b');
    releasePendingRead?.(JSON.stringify(['12']));

    await expect(importAttempt).rejects.toBeInstanceOf(AuthSessionChangedError);
    expect(addFavoriteMock).not.toHaveBeenCalled();
  });

  it('does not write an old Party cache when the session changes during a server read', async () => {
    let releaseServerRead: ((value: ReturnType<typeof mockFavorite>[]) => void) | undefined;
    favoritesMock.mockImplementation(() => new Promise((resolve) => {
      releaseServerRead = resolve;
    }));

    const loadAttempt = loadSavedEventSnapshot('42', AUTH_TOKEN);
    await Promise.resolve();
    await Promise.resolve();
    setAuthToken('Bearer token-b');
    releaseServerRead?.([mockFavorite('12')]);

    await expect(loadAttempt).rejects.toBeInstanceOf(AuthSessionChangedError);
    expect(storage[cacheKeyFor('42')]).toBeUndefined();
  });
});
