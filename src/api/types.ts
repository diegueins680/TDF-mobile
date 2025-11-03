import type { Booking, PipelineCard, PipelineStage } from '../types';

export type BookingDTO = {
  id: number;
  cbTitle: string;
  cbStartsAt: string;
  cbEndsAt: string;
  cbStatus: string;
  cbNotes?: string | null;
  cbPartyId?: number | null;
  cbServiceType?: string | null;
  cbResourceIds?: string[] | null;
};

export type PartyDTO = {
  id: number;
  name: string;
  instagram?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
};

export type PartyCreate = Pick<PartyDTO, 'name'> & Partial<Omit<PartyDTO, 'id' | 'name'>>;
export type PartyUpdate = Partial<Omit<PartyDTO, 'id'>>;
export type RoleKey = string;

export type PipelineCardDTO = {
  id: PipelineCard['id'];
  title: string;
  artist?: string | null;
  stage: PipelineStage;
  kind: PipelineCard['kind'];
};

export function fromBookingDTO(dto: BookingDTO): Booking {
  return {
    id: dto.id,
    title: dto.cbTitle,
    start: dto.cbStartsAt,
    end: dto.cbEndsAt,
    room: undefined,
    teacherId: dto.cbResourceIds && dto.cbResourceIds.length > 0 ? dto.cbResourceIds[0] : undefined,
  };
}

export function fromPipelineCardDTO(dto: PipelineCardDTO): PipelineCard {
  return {
    id: dto.id,
    title: dto.title,
    artist: dto.artist ?? undefined,
    stage: dto.stage,
    kind: dto.kind,
  };
}
