import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const STORAGE_PREFIX = 'tdf-ticket-checkout-key:';

const hashFingerprint = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const storageKey = (fingerprint: string): string =>
  `${STORAGE_PREFIX}${hashFingerprint(fingerprint)}`;

const createCheckoutKey = (): string =>
  `tdf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

const isStoredCheckoutKey = (value: string | null): value is string =>
  Boolean(value && /^tdf-[!-~]{8,124}$/.test(value));

export async function getOrCreateTicketCheckoutKey(fingerprint: string): Promise<string> {
  const key = storageKey(fingerprint);
  try {
    const stored = await AsyncStorage.getItem(key);
    if (isStoredCheckoutKey(stored)) return stored;
  } catch {
    // Continue with an in-memory-safe generated key when storage is unavailable.
  }

  const checkoutKey = createCheckoutKey();
  try {
    await AsyncStorage.setItem(key, checkoutKey);
  } catch {
    // A single mounted checkout still caches this key in memory.
  }
  return checkoutKey;
}

export async function rotateTicketCheckoutKey(fingerprint: string): Promise<string> {
  const checkoutKey = createCheckoutKey();
  try {
    await AsyncStorage.setItem(storageKey(fingerprint), checkoutKey);
  } catch {
    // A mounted checkout keeps the rotated key in memory when storage is unavailable.
  }
  return checkoutKey;
}

export async function clearTicketCheckoutKey(fingerprint: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(fingerprint));
  } catch {
    // Storage cleanup must never hide a successful or cancelled checkout.
  }
}

const CLOSED_CHECKOUT_MESSAGE = 'ticket checkout is already closed; start a new checkout';

export function isClosedTicketCheckoutConflict(error: unknown): boolean {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return false;

  const responseData = error.response.data;
  const serverMessage = typeof responseData === 'string'
    ? responseData
    : responseData && typeof responseData === 'object' && 'message' in responseData
      ? String(responseData.message ?? '')
      : '';

  return serverMessage.trim().toLowerCase() === CLOSED_CHECKOUT_MESSAGE;
}
