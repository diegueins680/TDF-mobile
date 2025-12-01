
import { get, post } from './client';

export type BookingDTO = {
  bookingId: number;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
};

export type Booking = {
  id: number;
  title: string;
  start: string;
  end: string;
  status: string;
};

export type CreateBookingReq = {
  title: string;
  start: string;
  end: string;
  partyId?: number | null;
  serviceType?: string | null;
  resourceIds?: string[];
  notes?: string | null;
};

export const Bookings = {
  list: async (): Promise<Booking[]> => {
    const raw = await get<BookingDTO[]>('/bookings');
    return raw.map((b) => ({
      id: b.bookingId,
      title: b.title,
      start: b.startsAt,
      end: b.endsAt,
      status: b.status,
    }));
  },
  create: async (body: CreateBookingReq): Promise<Booking> => {
    const payload = {
      cbTitle: body.title,
      cbStartsAt: body.start,
      cbEndsAt: body.end,
      cbStatus: 'Confirmed',
      cbNotes: body.notes ?? null,
      cbPartyId: body.partyId ?? null,
      cbServiceType: body.serviceType ?? null,
      cbResourceIds: body.resourceIds,
    };
    const res = await post<BookingDTO>('/bookings', payload);
    return {
      id: res.bookingId,
      title: res.title,
      start: res.startsAt,
      end: res.endsAt,
      status: res.status,
    };
  },
};
