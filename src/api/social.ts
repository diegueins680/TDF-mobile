import { http } from './client';
import type { PartyFollow, SuggestedFriend } from '../types';

export interface VCardExchangePayload {
  vcerPartyId: number;
}

export async function exchangeVCard(targetPartyId: number): Promise<void> {
  if (!Number.isInteger(targetPartyId) || targetPartyId <= 0) {
    throw new Error('Party ID inválido para intercambio de vCard.');
  }
  await http.post('/social/vcard-exchange', { vcerPartyId: targetPartyId } satisfies VCardExchangePayload);
}

const normalizeTextField = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const parsePositivePartyId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number.parseInt(value.trim(), 10);
    return parsed > 0 ? parsed : null;
  }
  return null;
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
  addFriend: async (partyId: number): Promise<PartyFollow[]> => {
    const res = await http.post<PartyFollow[]>(`/social/friends/${partyId}`, {});
    return res.data;
  },
  removeFriend: async (partyId: number): Promise<void> => {
    await http.delete(`/social/friends/${partyId}`);
  }
};
