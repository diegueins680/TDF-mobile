export type ID = string | number;

export type Party = {
  id: ID;
  name: string;
  instagram?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
};

export type Booking = {
  id: ID;
  title: string;
  start: string; // ISO
  end: string;   // ISO
  room?: string | null;
  teacherId?: ID | null;
};

export type PipelineStage = 'Intake' | 'Editing' | 'Mixing' | 'Revisions' | 'Mastering' | 'Approved';
export type PipelineKind = 'mixing' | 'mastering';
export type PipelineCard = {
  id: ID;
  title: string;
  artist?: string | null;
  stage: PipelineStage;
  kind: PipelineKind;
};
