import { http } from './client';
import type { PartyFollow, SuggestedFriend } from '../types';
import { SocialLegacyRetiredError, rememberSocialV2Activation, responseStatus } from './socialV2';

export interface VCardExchangePayload {
  vcerPartyId: number;
}

const normalizePositivePartyId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
};

const requirePositivePartyId = (value: unknown, action: string): number => {
  const normalized = normalizePositivePartyId(value);
  if (normalized === null) {
    throw new Error(`Party ID inválido para ${action}.`);
  }
  return normalized;
};

// Legacy relationship writes are permanently retired (410) once social v2 was
// activated on the server. Translate that into a typed error and remember the
// activation so screens switch to the v2 flow instead of showing a generic error.
async function legacyWrite<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (responseStatus(error) === 410) {
      await rememberSocialV2Activation();
      throw new SocialLegacyRetiredError();
    }
    throw error;
  }
}

/** Legacy contact exchange. Only used while social v2 is not active. */
export async function exchangeVCard(targetPartyId: number): Promise<void> {
  const normalizedPartyId = requirePositivePartyId(targetPartyId, 'intercambio de vCard');
  await legacyWrite(() => http.post('/social/vcard-exchange', { vcerPartyId: normalizedPartyId } satisfies VCardExchangePayload));
}

const normalizeTextField = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const parsePositivePartyId = (value: unknown): number | null => {
  return normalizePositivePartyId(value);
};

const normalizeTimestamp = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export function buildVCardSharePayload(input: {
  name?: string;
  email?: string;
  phone?: string;
  partyId?: number;
}): string {
  const name = normalizeTextField(input.name) ?? undefined;
  const email = normalizeTextField(input.email) ?? undefined;
  const phone = normalizeTextField(input.phone) ?? undefined;
  const payload = {
    kind: 'vcard-exchange',
    name,
    email,
    phone,
    partyId: parsePositivePartyId(input.partyId),
    ts: Date.now(),
  };
  return JSON.stringify(payload);
}

export interface ScannedVCard {
  kind: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  partyId?: number | null;
  ts?: number;
}

export function parseVCardPayload(raw: string): ScannedVCard | null {
  if (!raw || raw.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Record<string, unknown>;
    if (value['kind'] !== 'vcard-exchange') return null;

    return {
      kind: 'vcard-exchange',
      name: normalizeTextField(value['name']),
      email: normalizeTextField(value['email']),
      phone: normalizeTextField(value['phone']),
      partyId: parsePositivePartyId(value['partyId']),
      ts: normalizeTimestamp(value['ts']),
    };
  } catch (_err) {
    return null;
  }
}

export const Social = {
  listFollowers: async (): Promise<PartyFollow[]> => {
    const res = await http.get<PartyFollow[]>('/social/followers');
    return res.data;
  },
  listFollowing: async (): Promise<PartyFollow[]> => {
    const res = await http.get<PartyFollow[]>('/social/following');
    return res.data;
  },
  listFriends: async (): Promise<PartyFollow[]> => {
    const res = await http.get<PartyFollow[]>('/social/friends');
    return res.data;
  },
  listSuggestions: async (): Promise<SuggestedFriend[]> => {
    const res = await http.get<SuggestedFriend[]>('/social/suggestions');
    return res.data;
  },
  /** Legacy mutual friend edge. Only used while social v2 is not active. */
  addFriend: async (partyId: number): Promise<PartyFollow[]> => {
    const normalizedPartyId = requirePositivePartyId(partyId, 'agregar amistad');
    const res = await legacyWrite(() => http.post<PartyFollow[]>(`/social/friends/${normalizedPartyId}`, {}));
    return res.data;
  },
  /** Legacy friend edge removal. Only used while social v2 is not active. */
  removeFriend: async (partyId: number): Promise<void> => {
    const normalizedPartyId = requirePositivePartyId(partyId, 'eliminar amistad');
    await legacyWrite(() => http.delete(`/social/friends/${normalizedPartyId}`));
  }
};
