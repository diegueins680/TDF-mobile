import { get, post } from './client';
import type { BookingDTO } from './types';
import { fromBookingDTO } from './types';
import type { Booking } from '../types';

export type CreateBookingReq = {
  cbTitle: string;
  cbStartsAt: string;
  cbEndsAt: string;
  cbStatus: string;
  cbNotes?: string | null;
  cbPartyId?: number | null;
  cbServiceType?: string | null;
  cbResourceIds?: string[];
};

export type CreateBookingInput = {
  title: string;
  start: string;
  end: string;
  status?: string;
  notes?: string | null;
  partyId?: number | null;
  serviceType?: string | null;
  resourceIds?: string[];
};

export const Bookings = {
  list: () => get<BookingDTO[]>('/bookings'),
  listByParty: async (partyId: number) => {
    const params = new URLSearchParams({ partyId: String(partyId) });
    try {
      return await get<BookingDTO[]>(`/bookings?${params.toString()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '');
      if (message.includes('404')) {
        return [];
      }
      throw error;
    }
  },
  create: (body: CreateBookingReq) => post<BookingDTO>('/bookings', body),
};

export async function listBookings(): Promise<Booking[]> {
  const data = await Bookings.list();
  return data.map(fromBookingDTO);
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const payload: CreateBookingReq = {
    cbTitle: input.title,
    cbStartsAt: input.start,
    cbEndsAt: input.end,
    cbStatus: input.status ?? 'scheduled',
    cbNotes: input.notes,
    cbPartyId: input.partyId ?? null,
    cbServiceType: input.serviceType ?? null,
    cbResourceIds: input.resourceIds,
  };
  const data = await Bookings.create(payload);
  return fromBookingDTO(data);
}
