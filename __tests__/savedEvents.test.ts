import AsyncStorage from '@react-native-async-storage/async-storage';

import { listSavedEventIds, saveEvent, toggleSavedEvent, unsaveEvent } from '../src/lib/savedEvents';

const LEGACY_STORAGE_KEY = 'tdf-saved-event-ids';
const storageKeyFor = (partyId: string) => `tdf-saved-event-ids:party:${partyId}`;

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('savedEvents storage', () => {
  const getItemMock = jest.mocked(AsyncStorage.getItem);
  const setItemMock = jest.mocked(AsyncStorage.setItem);
  const removeItemMock = jest.mocked(AsyncStorage.removeItem);

  let storage: Record<string, string>;

  beforeEach(() => {
    jest.clearAllMocks();
    storage = {};

    getItemMock.mockImplementation(async (key: string) => storage[key] ?? null);
    setItemMock.mockImplementation(async (key: string, value: string) => {
      storage[key] = value;
    });
    removeItemMock.mockImplementation(async (key: string) => {
      delete storage[key];
    });
  });

  it('propagates storage read failures instead of reporting an empty list', async () => {
    getItemMock.mockRejectedValueOnce(new Error('storage read failed'));

    await expect(listSavedEventIds('42')).rejects.toThrow('storage read failed');
  });

  it('sanitizes stored IDs, canonicalizes numeric strings, and rewrites cleaned data', async () => {
    const storageKey = storageKeyFor('42');
    storage[storageKey] = JSON.stringify(['0012', 12, 'abc', '', ' 0007 ', 'abc', -4]);

    await expect(listSavedEventIds('42')).resolves.toEqual(['12', 'abc', '7']);
    expect(setItemMock).toHaveBeenCalledWith(storageKey, JSON.stringify(['12', 'abc', '7']));
  });

  it('reports malformed account data without deleting or rewriting it', async () => {
    const storageKey = storageKeyFor('42');
    const malformedValue = '["9",';
    storage[storageKey] = malformedValue;

    await expect(listSavedEventIds('42')).rejects.toThrow('corrupted');

    expect(storage[storageKey]).toBe(malformedValue);
    expect(setItemMock).not.toHaveBeenCalled();
    expect(removeItemMock).not.toHaveBeenCalled();
  });

  it('treats equivalent numeric IDs as the same saved event', async () => {
    await expect(toggleSavedEvent('42', '0012')).resolves.toEqual({ saved: true, ids: ['12'] });
    await expect(toggleSavedEvent('42', 12)).resolves.toEqual({ saved: false, ids: [] });
    expect(storage[storageKeyFor('42')]).toBeUndefined();
  });

  it('isolates accounts and leaves legacy unscoped values quarantined', async () => {
    storage[LEGACY_STORAGE_KEY] = JSON.stringify(['99']);

    await expect(saveEvent('42', 9)).resolves.toEqual(['9']);
    await expect(listSavedEventIds('42')).resolves.toEqual(['9']);
    await expect(listSavedEventIds('77')).resolves.toEqual([]);

    expect(storage[LEGACY_STORAGE_KEY]).toBe(JSON.stringify(['99']));
    expect(getItemMock).not.toHaveBeenCalledWith(LEGACY_STORAGE_KEY);
    expect(storage[storageKeyFor('42')]).toBe(JSON.stringify(['9']));
  });

  it('propagates write and removal failures so callers cannot report success', async () => {
    setItemMock.mockRejectedValueOnce(new Error('write failed'));

    await expect(saveEvent('42', 9)).rejects.toThrow('write failed');

    storage[storageKeyFor('42')] = JSON.stringify(['9']);
    removeItemMock.mockRejectedValueOnce(new Error('remove failed'));

    await expect(unsaveEvent('42', 9)).rejects.toThrow('remove failed');
  });

  it('rejects missing or invalid account and event identities without touching storage', async () => {
    await expect(listSavedEventIds('')).rejects.toThrow('valid authenticated Party ID');
    await expect(listSavedEventIds('party-42')).rejects.toThrow('valid authenticated Party ID');
    await expect(saveEvent('42', '')).rejects.toThrow('valid event ID');

    expect(getItemMock).not.toHaveBeenCalled();
    expect(setItemMock).not.toHaveBeenCalled();
    expect(removeItemMock).not.toHaveBeenCalled();
  });
});
