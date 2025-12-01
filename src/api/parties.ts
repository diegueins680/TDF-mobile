import { api } from '../lib/api';
import type { Party } from '../types';
import type { PartyDTO, PartyCreate, PartyUpdate, RoleKey } from './types';
import { get, post, put } from './client';

const toParty = (dto: PartyDTO): Party => ({
  id: dto.partyId,
  name: dto.displayName,
  instagram: dto.instagram ?? undefined,
  phone: dto.primaryPhone ?? undefined,
  email: dto.primaryEmail ?? undefined,
  notes: dto.notes ?? undefined,
});

export async function listParties(q?: string): Promise<Party[]> {
  const res = await api.get<PartyDTO[]>('/parties', { params: q ? { q } : undefined });
  return res.data.map(toParty);
}

export async function createParty(body: Partial<Party>): Promise<Party> {
  const payload: PartyCreate = {
    cDisplayName: body.name ?? 'Cliente TDF',
    cIsOrg: false,
    cPrimaryEmail: body.email ?? null,
    cPrimaryPhone: body.phone ?? null,
    cInstagram: body.instagram ?? null,
  };
  const res = await api.post<PartyDTO>('/parties', payload);
  return toParty(res.data);
}

export async function updateParty(id: Party['id'], body: Partial<Party>): Promise<Party> {
  const payload: PartyUpdate = {
    uDisplayName: body.name,
    uPrimaryEmail: body.email,
    uPrimaryPhone: body.phone,
    uInstagram: body.instagram,
    uNotes: body.notes,
  };
  const res = await api.put<PartyDTO>(`/parties/${id}`, payload);
  return toParty(res.data);
}

export const Parties = {
  list: () => get<PartyDTO[]>('/parties'),
  create: (body: PartyCreate) => post<PartyDTO>('/parties', body),
  getOne: (id: number) => get<PartyDTO>(`/parties/${id}`),
  update: (id: number, body: PartyUpdate) => put<PartyDTO>(`/parties/${id}`, body),
  addRole: (id: number, role: RoleKey) => post<void>(`/parties/${id}/roles`, { roleKey: role }),
};
