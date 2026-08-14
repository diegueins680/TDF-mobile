import type { Booking, ID } from '../types';

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
  serviceOfferingId: string;
  serviceOfferingCode: string;
  workflowId: string;
  workflowStateId: string;
  workflowStateCode: string;
  workflowStateNameEs: string;
  workflowStateNameEn: string;
  sortOrder?: number;
  notes?: string | null;
}

export interface PipelineCardUpdate {
  title?: string;
  artist?: string | null;
  workflowStateId?: string;
  sortOrder?: number;
  notes?: string | null;
}

export interface PipelineDefinitionDTO {
  workflowId: string;
  code: string;
  nameEs: string;
  nameEn: string;
  revision: number;
  serviceOfferings: Array<{ id: string; code: string; nameEs: string; nameEn: string }>;
  stages: Array<{ id: string; code: string; nameEs: string; nameEn: string; sortOrder: number; terminal: boolean }>;
}

export interface PipelineSnapshotDTO {
  revision: number;
  definitions: PipelineDefinitionDTO[];
  cards: PipelineCardDTO[];
}

export interface BookingDTO {
  bookingId: number;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
}

export function fromBookingDTO(dto: BookingDTO): Booking {
  return {
    id: dto.bookingId,
    title: dto.title,
    start: dto.startsAt,
    end: dto.endsAt,
    status: dto.status
  };
}
