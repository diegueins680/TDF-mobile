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

// Social Event Calendar Types
export type ArtistProfile = {
  id: ID;
  partyId: ID;
  name: string;
  bio?: string | null;
  imageUrl?: string | null;
  genres?: string[];
  instagramHandle?: string | null;
  spotifyUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ArtistProfileCreate = {
  partyId: ID;
  name: string;
  bio?: string;
  imageUrl?: string;
  genres?: string[];
  instagramHandle?: string;
  spotifyUrl?: string;
};

export type Venue = {
  id: ID;
  name: string;
  address: string;
  city: string;
  state?: string | null;
  zipCode?: string | null;
  latitude: number;
  longitude: number;
  capacity?: number | null;
  imageUrl?: string | null;
  phoneNumber?: string | null;
  website?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VenueCreate = {
  name: string;
  address: string;
  city: string;
  state?: string;
  zipCode?: string;
  latitude: number;
  longitude: number;
  capacity?: number;
  imageUrl?: string;
  phoneNumber?: string;
  website?: string;
};

export type SocialEvent = {
  id: ID;
  title: string;
  description?: string | null;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  venueId: ID;
  venue?: Venue;
  artistIds: ID[];
  artists?: ArtistProfile[];
  createdBy: ID;
  ticketPrice?: number | null;
  ticketUrl?: string | null;
  imageUrl?: string | null;
  isPublic: boolean;
  rsvpCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SocialEventCreate = {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  venueId: ID;
  artistIds: ID[];
  ticketPrice?: number;
  ticketUrl?: string;
  imageUrl?: string;
  isPublic?: boolean;
};

export type SocialEventUpdate = {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  venueId?: ID;
  artistIds?: ID[];
  ticketPrice?: number;
  ticketUrl?: string;
  imageUrl?: string;
  isPublic?: boolean;
};

export type RSVPStatus = 'GOING' | 'INTERESTED' | 'NOT_GOING' | 'NONE';

export type EventRSVP = {
  id: ID;
  eventId: ID;
  userId: ID;
  status: RSVPStatus;
  createdAt: string;
  updatedAt: string;
};

export type EventRSVPCreate = {
  eventId: ID;
  userId: ID;
  status: RSVPStatus;
};

export type EventInvitation = {
  id: ID;
  eventId: ID;
  fromUserId: ID;
  toUserId: ID;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: string;
  respondedAt?: string | null;
};

export type EventInvitationCreate = {
  eventId: ID;
  toUserId: ID;
};

