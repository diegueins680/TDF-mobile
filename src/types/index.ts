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
export type PipelineCard = {
  id: ID;
  title: string;
  artist?: string | null;
  stage: PipelineStage;
  kind: 'mixing' | 'mastering';
};

export type Asset = {
  assetId: ID;
  name: string;
  category: string;
  status: string;
  condition?: string | null;
  brand?: string | null;
  model?: string | null;
  location?: string | null;
  qrToken?: string | null;
  photoUrl?: string | null;
};

export type AssetCreate = {
  cName: string;
  cCategory: string;
  cPhotoUrl?: string | null;
};

export type AssetUpdate = {
  uName?: string;
  uCategory?: string;
  uStatus?: string;
  uLocationId?: string | null;
  uNotes?: string | null;
  uPhotoUrl?: string | null;
};

export type AssetCheckout = {
  checkoutId: string;
  assetId: string;
  targetKind: string;
  targetSessionId?: string | null;
  targetPartyRef?: string | null;
  targetRoomId?: string | null;
  checkedOutBy: string;
  checkedOutAt: string;
  dueAt?: string | null;
  conditionOut?: string | null;
  conditionIn?: string | null;
  returnedAt?: string | null;
  notes?: string | null;
};

export type AssetCheckoutRequest = {
  coTargetKind?: 'party' | 'session' | 'room';
  coTargetSession?: string | null;
  coTargetParty?: string | null;
  coTargetRoom?: string | null;
  coDueAt?: string | null;
  coConditionOut?: string | null;
  coNotes?: string | null;
};

export type AssetCheckinRequest = {
  ciConditionIn?: string | null;
  ciNotes?: string | null;
};
