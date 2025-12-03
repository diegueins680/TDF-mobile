import { api } from '../lib/api';

export interface VCardExchangePayload {
  vcerPartyId: number;
}

export async function exchangeVCard(targetPartyId: number, token?: string): Promise<void> {
  const headers = token?.trim()
    ? { Authorization: `Bearer ${token.trim()}` }
    : undefined;
  await api.post('/social/vcard-exchange', { vcerPartyId: targetPartyId } satisfies VCardExchangePayload, { headers });
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
