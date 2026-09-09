import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  deleteDirectoryEventFavorite,
  listDirectoryEventFavorites,
  saveDirectoryEventFavorite,
} from '../src/api/directoryFavorites';
import {
  getLegacySavedEventCandidate,
  importLegacySavedEvents,
  listSavedEventIds,
  saveEvent,
  toggleSavedEvent,
  unsaveEvent,
} from '../src/lib/savedEvents';
import { markFirstValueCompleted } from '../src/lib/onboardingIntent';

const LEGACY_STORAGE_KEY = 'tdf-saved-event-ids';
const storageKeyFor = (partyId: string) => `tdf-saved-event-ids:party:${partyId}`;
const outboxKeyFor = (partyId: string) => `tdf-saved-event-outbox:party:${partyId}`;

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../src/api/directoryFavorites', () => ({
  listDirectoryEventFavorites: jest.fn(),
  saveDirectoryEventFavorite: jest.fn(),
  deleteDirectoryEventFavorite: jest.fn(),
}));

jest.mock('../src/lib/onboardingIntent', () => ({
  markFirstValueCompleted: jest.fn(async () => false),
}));

describe('savedEvents account synchronization', () => {
  const getItemMock = jest.mocked(AsyncStorage.getItem);
  const setItemMock = jest.mocked(AsyncStorage.setItem);
  const removeItemMock = jest.mocked(AsyncStorage.removeItem);
  const listRemoteMock = jest.mocked(listDirectoryEventFavorites);
  const saveRemoteMock = jest.mocked(saveDirectoryEventFavorite);
  const deleteRemoteMock = jest.mocked(deleteDirectoryEventFavorite);
  const markFirstValueMock = jest.mocked(markFirstValueCompleted);

  let storage: Record<string, string>;
  let remoteIds: Set<string>;

  beforeEach(() => {
    jest.clearAllMocks();
    storage = {};
    remoteIds = new Set();
    getItemMock.mockImplementation(async (key: string) => storage[key] ?? null);
    setItemMock.mockImplementation(async (key: string, value: string) => {
      storage[key] = value;
    });
    removeItemMock.mockImplementation(async (key: string) => {
      delete storage[key];
    });
    listRemoteMock.mockImplementation(async () => [...remoteIds].map((targetId) => ({
      targetKind: 'event',
      targetId,
      createdAt: '2026-09-07T10:00:00Z',
    })));
    saveRemoteMock.mockImplementation(async (eventId) => {
      remoteIds.add(eventId);
    });
    deleteRemoteMock.mockImplementation(async (eventId) => {
      remoteIds.delete(eventId);
    });
  });

  it('uses the filtered server result as authoritative state and sanitizes IDs', async () => {
    storage[storageKeyFor('42')] = JSON.stringify(['3']);
    listRemoteMock.mockResolvedValue([
      { targetKind: 'event', targetId: '0012', createdAt: '2026-09-07T10:00:00Z' },
      { targetKind: 'profile', targetId: '90', createdAt: '2026-09-07T09:00:00Z' },
      { targetKind: 'event', targetId: 'invalid', createdAt: '2026-09-07T08:00:00Z' },
    ]);

    await expect(listSavedEventIds('42')).resolves.toEqual(['12']);
    expect(listRemoteMock).toHaveBeenCalledTimes(1);
    expect(storage[storageKeyFor('42')]).toBe(JSON.stringify(['12']));
  });

  it('acknowledges idempotent desired-state saves and removals on the server', async () => {
    await expect(saveEvent('42', '0012')).resolves.toEqual({
      saved: true,
      ids: ['12'],
      serverAcknowledged: true,
    });
    expect(saveRemoteMock).toHaveBeenCalledWith('12');

    await expect(unsaveEvent('42', 12)).resolves.toEqual({
      saved: false,
      ids: [],
      serverAcknowledged: true,
    });
    expect(deleteRemoteMock).toHaveBeenCalledWith('12');
    expect(storage[outboxKeyFor('42')]).toBeUndefined();
  });

  it('queues offline desired state and replays it during the next synchronization', async () => {
    saveRemoteMock.mockRejectedValueOnce(new Error('offline'));

    await expect(saveEvent('42', 9)).resolves.toEqual({
      saved: true,
      ids: ['9'],
      serverAcknowledged: false,
    });
    expect(storage[outboxKeyFor('42')]).toBe(JSON.stringify([{ eventId: '9', desiredSaved: true }]));

    listRemoteMock.mockResolvedValue([]);
    saveRemoteMock.mockResolvedValue(undefined);
    await expect(listSavedEventIds('42')).resolves.toEqual(['9']);
    expect(saveRemoteMock).toHaveBeenCalledTimes(2);
    expect(storage[outboxKeyFor('42')]).toBeUndefined();
    expect(markFirstValueMock).toHaveBeenCalledWith('42', 'event_saved', expect.any(Function));
  });

  it('falls back to Party-scoped cache during a retryable read failure', async () => {
    storage[storageKeyFor('42')] = JSON.stringify(['8']);
    listRemoteMock.mockRejectedValueOnce(new Error('offline'));

    await expect(listSavedEventIds('42')).resolves.toEqual(['8']);
    expect(storage[storageKeyFor('42')]).toBe(JSON.stringify(['8']));
  });

  it('converges another device cache to the latest server state', async () => {
    storage[storageKeyFor('42')] = JSON.stringify(['7']);
    listRemoteMock.mockResolvedValue([
      { targetKind: 'event', targetId: '11', createdAt: '2026-09-07T12:00:00Z' },
      { targetKind: 'event', targetId: '10', createdAt: '2026-09-07T11:00:00Z' },
    ]);

    await expect(listSavedEventIds('42')).resolves.toEqual(['11', '10']);
    expect(storage[storageKeyFor('42')]).toBe(JSON.stringify(['11', '10']));
  });

  it('serializes rapid toggles so the final desired state wins', async () => {
    const first = toggleSavedEvent('42', 12);
    const second = toggleSavedEvent('42', 12);

    await expect(first).resolves.toMatchObject({ saved: true, serverAcknowledged: true });
    await expect(second).resolves.toMatchObject({ saved: false, serverAcknowledged: true });
    expect(saveRemoteMock).toHaveBeenCalledWith('12');
    expect(deleteRemoteMock).toHaveBeenCalledWith('12');
    expect(storage[storageKeyFor('42')]).toBeUndefined();
  });

  it('isolates Party caches and never inspects legacy data during normal reads', async () => {
    storage[LEGACY_STORAGE_KEY] = JSON.stringify(['99']);
    storage[storageKeyFor('42')] = JSON.stringify(['9']);
    listRemoteMock.mockResolvedValueOnce([
      { targetKind: 'event', targetId: '9', createdAt: '2026-09-07T10:00:00Z' },
    ]).mockResolvedValueOnce([]);

    await expect(listSavedEventIds('42')).resolves.toEqual(['9']);
    await expect(listSavedEventIds('77')).resolves.toEqual([]);

    expect(storage[LEGACY_STORAGE_KEY]).toBe(JSON.stringify(['99']));
    expect(getItemMock).not.toHaveBeenCalledWith(LEGACY_STORAGE_KEY);
  });

  it('keeps queued work under its initiating Party when ownership changes before replay', async () => {
    storage[storageKeyFor('42')] = JSON.stringify(['9']);
    storage[outboxKeyFor('42')] = JSON.stringify([{ eventId: '9', desiredSaved: true }]);
    const stillOwnsParty = jest.fn(() => false);

    await expect(listSavedEventIds('42', stillOwnsParty)).resolves.toEqual(['9']);

    expect(listRemoteMock).not.toHaveBeenCalled();
    expect(saveRemoteMock).not.toHaveBeenCalled();
    expect(markFirstValueMock).not.toHaveBeenCalled();
    expect(storage[outboxKeyFor('42')]).toBe(JSON.stringify([{ eventId: '9', desiredSaved: true }]));
  });

  it('stops a multi-change replay when Party ownership changes between requests', async () => {
    storage[outboxKeyFor('42')] = JSON.stringify([
      { eventId: '9', desiredSaved: true },
      { eventId: '10', desiredSaved: true },
    ]);
    let ownsParty = true;
    saveRemoteMock.mockImplementation(async (eventId) => {
      remoteIds.add(eventId);
      ownsParty = false;
    });

    await expect(listSavedEventIds('42', () => ownsParty)).resolves.toEqual(['10', '9']);

    expect(saveRemoteMock).toHaveBeenCalledTimes(1);
    expect(saveRemoteMock).toHaveBeenCalledWith('9');
    expect(markFirstValueMock).not.toHaveBeenCalled();
    expect(storage[outboxKeyFor('42')]).toBe(JSON.stringify([{ eventId: '10', desiredSaved: true }]));
  });

  it('imports legacy values only after explicit account binding and preserves offline work', async () => {
    storage[LEGACY_STORAGE_KEY] = JSON.stringify(['0012', 12, '13']);
    saveRemoteMock.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('offline'));

    await expect(getLegacySavedEventCandidate()).resolves.toEqual({ count: 2 });
    await expect(importLegacySavedEvents('42')).resolves.toEqual({
      importedCount: 2,
      acknowledgedCount: 1,
      pendingCount: 1,
      ids: ['13', '12'],
    });

    expect(storage[LEGACY_STORAGE_KEY]).toBeUndefined();
    expect(storage[outboxKeyFor('42')]).toBe(JSON.stringify([{ eventId: '13', desiredSaved: true }]));
    expect(storage[storageKeyFor('42')]).toBe(JSON.stringify(['13', '12']));
  });

  it('reports malformed account data without deleting or rewriting it', async () => {
    const storageKey = storageKeyFor('42');
    const malformedValue = '["9",';
    storage[storageKey] = malformedValue;

    await expect(listSavedEventIds('42')).rejects.toThrow('corrupted');
    expect(storage[storageKey]).toBe(malformedValue);
    expect(listRemoteMock).not.toHaveBeenCalled();
  });

  it('propagates storage failures so callers cannot report a queued change', async () => {
    setItemMock.mockRejectedValueOnce(new Error('write failed'));
    await expect(saveEvent('42', 9)).rejects.toThrow('write failed');
    expect(saveRemoteMock).not.toHaveBeenCalled();
  });

  it('rejects missing or invalid identities before storage or network access', async () => {
    await expect(listSavedEventIds('')).rejects.toThrow('valid authenticated Party ID');
    await expect(listSavedEventIds('party-42')).rejects.toThrow('valid authenticated Party ID');
    await expect(saveEvent('42', 'event-9')).rejects.toThrow('valid event ID');

    expect(getItemMock).not.toHaveBeenCalled();
    expect(saveRemoteMock).not.toHaveBeenCalled();
  });
});
