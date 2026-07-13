import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearTicketCheckoutKey,
  getOrCreateTicketCheckoutKey,
  isClosedTicketCheckoutConflict,
  rotateTicketCheckoutKey,
} from '../src/lib/ticketCheckoutIdempotency';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('ticket checkout idempotency storage', () => {
  const storage: Record<string, string> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(storage).forEach((key) => delete storage[key]);
    jest.mocked(AsyncStorage.getItem).mockImplementation(async (key) => storage[key] ?? null);
    jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage[key] = value;
    });
    jest.mocked(AsyncStorage.removeItem).mockImplementation(async (key) => {
      delete storage[key];
    });
  });

  it('reuses a key across calls and removes it after a terminal checkout', async () => {
    const fingerprint = '["42","3",1,"Ana","ana@example.com",""]';
    const first = await getOrCreateTicketCheckoutKey(fingerprint);
    const retry = await getOrCreateTicketCheckoutKey(fingerprint);

    expect(first).toMatch(/^tdf-/);
    expect(retry).toBe(first);

    await clearTicketCheckoutKey(fingerprint);
    const nextPurchase = await getOrCreateTicketCheckoutKey(fingerprint);
    expect(nextPurchase).not.toBe(first);
  });

  it('replaces a persisted key when the server confirms the checkout is closed', async () => {
    const fingerprint = '["42","3",1,"Ana","ana@example.com",""]';
    const first = await getOrCreateTicketCheckoutKey(fingerprint);
    const rotated = await rotateTicketCheckoutKey(fingerprint);

    expect(rotated).not.toBe(first);
    await expect(getOrCreateTicketCheckoutKey(fingerprint)).resolves.toBe(rotated);
  });

  it('recognizes only the exact closed-checkout 409 contract as rotatable', () => {
    expect(isClosedTicketCheckoutConflict({
      isAxiosError: true,
      response: { status: 409, data: 'Ticket checkout is already closed; start a new checkout' },
    })).toBe(true);
    expect(isClosedTicketCheckoutConflict({
      isAxiosError: true,
      response: { status: 409, data: 'ticketPurchaseIdempotencyKey was already used for different checkout details' },
    })).toBe(false);
    expect(isClosedTicketCheckoutConflict({
      isAxiosError: true,
      response: { status: 503, data: 'Ticket checkout is already closed; start a new checkout' },
    })).toBe(false);
  });

  it('does not store the buyer fingerprint or email in the storage key', async () => {
    await getOrCreateTicketCheckoutKey('["42","3",1,"Private","private@example.com",""]');
    const persistedStorageKey = jest.mocked(AsyncStorage.setItem).mock.calls[0]?.[0] ?? '';

    expect(persistedStorageKey).not.toContain('private@example.com');
    expect(persistedStorageKey).toMatch(/^tdf-ticket-checkout-key:/);
  });
});
