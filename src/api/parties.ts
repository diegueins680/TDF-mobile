import { get, post, put } from './client';
import type { PartyDTO, PartyCreate, PartyUpdate, RoleKey } from './types';
import { api } from '~/lib/api';
import type { Party } from '~/types';

export async function listParties(q?: string): Promise<Party[]> {
  const res = await api.get('/parties', { params: q ? { q } : undefined });
  return res.data;
}
export async function createParty(body: Partial<Party>): Promise<Party> {
  const res = await api.post('/parties', body);
  return res.data;
}
export async function updateParty(id: Party['id'], body: Partial<Party>): Promise<Party> {
  const res = await api.patch(`/parties/${id}`, body);
  return res.data;
}

export const Parties = {
  list: () => get<PartyDTO[]>('/parties'),
  create: (body: PartyCreate) => post<PartyDTO>('/parties', body),
  getOne: (id: number) => get<PartyDTO>(`/parties/${id}`),
  update: (id: number, body: PartyUpdate) => put<PartyDTO>(`/parties/${id}`, body),
  addRole: (id: number, role: RoleKey) => post<void>(`/parties/${id}/roles`, { roleKey: role }),
};
