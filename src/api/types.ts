import type { ID } from '../types';

export type RoleKey = string;

export interface PartyDTO {
  partyId: number;
  displayName: string;
  legalName?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  instagram?: string | null;
  notes?: string | null;
}

export interface PartyCreate {
  cDisplayName: string;
  cIsOrg: boolean;
  cPrimaryEmail?: string | null;
  cPrimaryPhone?: string | null;
  cInstagram?: string | null;
}

export interface PartyUpdate {
  uDisplayName?: string;
  uPrimaryEmail?: string | null;
  uPrimaryPhone?: string | null;
  uInstagram?: string | null;
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
