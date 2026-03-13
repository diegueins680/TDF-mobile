import { get, post } from './client';
import type { Booking } from '../types';

export type BookingDTO = {
  bookingId: number;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
};

export type CreateBookingReq = {
  title: string;
  start: string;
  end: string;
  status?: string;
  partyId?: number | null;
  serviceType?: string | null;
  resourceIds?: string[];
  notes?: string | null;
};

type CreateBookingPayload = {
  cbTitle: string;
  cbStartsAt: string;
  cbEndsAt: string;
  cbStatus: string;
  cbNotes?: string | null;
  cbPartyId?: number | null;
  cbServiceType?: string | null;
  cbResourceIds?: string[];
};

const toBooking = (dto: BookingDTO): Booking => ({
  id: dto.bookingId,
  title: dto.title,
  start: dto.startsAt,
  end: dto.endsAt,
  status: dto.status
});

const toCreatePayload = (body: CreateBookingReq): CreateBookingPayload => ({
  cbTitle: body.title,
  cbStartsAt: body.start,
  cbEndsAt: body.end,
  cbStatus: body.status ?? 'Confirmed',
  cbNotes: body.notes ?? null,
  cbPartyId: body.partyId ?? null,
  cbServiceType: body.serviceType ?? null,
  cbResourceIds: body.resourceIds
});

export const Bookings = {
  list: async (): Promise<Booking[]> => {
    const raw = await get<BookingDTO[]>('/bookings');
    return raw.map(toBooking);
  },
  listByParty: async (partyId: number): Promise<Booking[]> => {
    const params = new URLSearchParams({ partyId: String(partyId) });
    try {
      const raw = await get<BookingDTO[]>(`/bookings?${params.toString()}`);
      return raw.map(toBooking);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '');
      if (message.includes('404')) {
        return [];
      }
      throw error;
    }
  },
  create: async (body: CreateBookingReq): Promise<Booking> => {
    const res = await post<BookingDTO>('/bookings', toCreatePayload(body));
    return toBooking(res);
  }
};

export async function listBookings(): Promise<Booking[]> {
  return Bookings.list();
}

export async function createBooking(input: CreateBookingReq): Promise<Booking> {
  return Bookings.create(input);
}
