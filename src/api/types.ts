import type { Booking, ID, PipelineCard, PipelineKind, PipelineStage } from '../types';

export type RoleKey = string;

export interface PartyDTO {
  partyId: number;
  displayName: string;
  legalName?: string | null;
  isOrg?: boolean;
  roles?: string[];
  taxId?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  emergencyContact?: string | null;
  notes?: string | null;
  hasUserAccount?: boolean;
}

export interface PartyCreate {
  cDisplayName: string;
  cIsOrg: boolean;
  cLegalName?: string | null;
  cPrimaryEmail?: string | null;
  cPrimaryPhone?: string | null;
  cWhatsapp?: string | null;
  cInstagram?: string | null;
  cTaxId?: string | null;
  cEmergencyContact?: string | null;
  cNotes?: string | null;
}

export interface PartyUpdate {
  uDisplayName?: string;
  uIsOrg?: boolean;
  uLegalName?: string | null;
  uPrimaryEmail?: string | null;
  uPrimaryPhone?: string | null;
  uWhatsapp?: string | null;
  uInstagram?: string | null;
  uTaxId?: string | null;
  uEmergencyContact?: string | null;
  uNotes?: string | null;
}

export interface PipelineCardDTO {
  id: ID;
  title: string;
  artist?: string | null;
  type: string;
  stage: string;
  sortOrder?: number;
  notes?: string | null;
}

export interface PipelineCardUpdate {
  title?: string;
  artist?: string | null;
  stage?: string;
  sortOrder?: number;
  notes?: string | null;
}

export interface BookingDTO {
  bookingId: number;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
}

const PIPELINE_STAGES: PipelineStage[] = [
  'Intake',
  'Editing',
  'Mixing',
  'Revisions',
  'Mastering',
  'Approved'
];

const STAGE_BY_LOWER = new Map<string, PipelineStage>(
  PIPELINE_STAGES.map((stage) => [stage.toLowerCase(), stage])
);

const normalizePipelineStage = (raw: unknown): PipelineStage | undefined => {
  if (typeof raw !== 'string') return undefined;
  return STAGE_BY_LOWER.get(raw.trim().toLowerCase());
};

const normalizePipelineKind = (raw: unknown): PipelineKind => {
  if (typeof raw !== 'string') return 'mixing';
  return raw.trim().toLowerCase() === 'mastering' ? 'mastering' : 'mixing';
};

export function fromBookingDTO(dto: BookingDTO): Booking {
  return {
    id: dto.bookingId,
    title: dto.title,
    start: dto.startsAt,
    end: dto.endsAt,
    status: dto.status
  };
}

export function fromPipelineCardDTO(dto: PipelineCardDTO): PipelineCard {
  return {
    id: dto.id,
    title: dto.title,
    artist: dto.artist ?? null,
    stage: normalizePipelineStage(dto.stage) ?? 'Intake',
    kind: normalizePipelineKind(dto.type)
  };
}
