import { http } from './client';
import type { PartyFollow, SuggestedFriend } from '../types';

export interface VCardExchangePayload {
  vcerPartyId: number;
}

export async function exchangeVCard(targetPartyId: number, token?: string): Promise<void> {
  const headers = token?.trim()
    ? { Authorization: `Bearer ${token.trim()}` }
    : undefined;
  await http.post('/social/vcard-exchange', { vcerPartyId: targetPartyId } satisfies VCardExchangePayload, { headers });
}

export function buildVCardSharePayload(input: {
  name?: string;
  email?: string;
  phone?: string;
  partyId?: number;
}): string {
  const payload = {
    kind: 'vcard-exchange',
    name: input.name?.trim(),
    email: input.email?.trim(),
    phone: input.phone?.trim(),
    partyId: input.partyId ?? null,
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
}

export function parseVCardPayload(raw: string): ScannedVCard | null {
  try {
    const parsed = JSON.parse(raw) as ScannedVCard;
    if (!parsed || parsed.kind !== 'vcard-exchange') return null;
    return parsed;
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
