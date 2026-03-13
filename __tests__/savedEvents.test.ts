import AsyncStorage from '@react-native-async-storage/async-storage';

import { listSavedEventIds, saveEvent, toggleSavedEvent, unsaveEvent } from '../src/lib/savedEvents';

const STORAGE_KEY = 'tdf-saved-event-ids';

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

  it('returns an empty list when storage read fails', async () => {
    getItemMock.mockRejectedValueOnce(new Error('storage read failed'));

    await expect(listSavedEventIds()).resolves.toEqual([]);
  });

  it('sanitizes stored IDs, canonicalizes numeric strings, and rewrites cleaned data', async () => {
    storage[STORAGE_KEY] = JSON.stringify(['0012', 12, 'abc', '', ' 0007 ', 'abc', -4]);

    await expect(listSavedEventIds()).resolves.toEqual(['12', 'abc', '7']);
    expect(setItemMock).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(['12', 'abc', '7']));
  });

  it('treats equivalent numeric IDs as the same saved event', async () => {
    await expect(toggleSavedEvent('0012')).resolves.toEqual({ saved: true, ids: ['12'] });
    await expect(toggleSavedEvent(12)).resolves.toEqual({ saved: false, ids: [] });
    expect(storage[STORAGE_KEY]).toBeUndefined();
  });

  it('does not throw when persisting updates fails', async () => {
    setItemMock.mockRejectedValueOnce(new Error('write failed'));

    await expect(saveEvent(9)).resolves.toEqual(['9']);

    storage[STORAGE_KEY] = JSON.stringify(['9']);
    removeItemMock.mockRejectedValueOnce(new Error('remove failed'));

    await expect(unsaveEvent(9)).resolves.toEqual([]);
  });
});
