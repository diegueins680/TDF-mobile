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
  status?: string | null;
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
  socialLinks?: ArtistSocialLinks;
};

export type ArtistProfileCreate = {
  partyId: ID;
  name: string;
  bio?: string;
  imageUrl?: string;
  genres?: string[];
  instagramHandle?: string;
  spotifyUrl?: string;
  socialLinks?: ArtistSocialLinks;
};

export type ArtistProfileUpdate = {
  partyId?: ID;
  name?: string;
  bio?: string | null;
  imageUrl?: string | null;
  genres?: string[];
  instagramHandle?: string | null;
  spotifyUrl?: string | null;
  socialLinks?: ArtistSocialLinks | null;
};

export type ArtistSocialLinks = {
  spotify?: string | null;
  instagram?: string | null;
  twitter?: string | null;
  youtube?: string | null;
  soundcloud?: string | null;
};

export type Venue = {
  id: ID;
  name: string;
  address: string;
  city: string;
  country?: string | null;
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
  country?: string;
  state?: string;
  zipCode?: string;
  latitude: number;
  longitude: number;
  capacity?: number;
  imageUrl?: string;
  phoneNumber?: string;
  website?: string;
};

export type VenueUpdate = {
  name?: string;
  address?: string;
  city?: string;
  country?: string | null;
  state?: string | null;
  zipCode?: string | null;
  latitude?: number;
  longitude?: number;
  capacity?: number | null;
  imageUrl?: string | null;
  phoneNumber?: string | null;
  website?: string | null;
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
  description?: string | null;
  startTime?: string;
  endTime?: string;
  venueId?: ID | null;
  artistIds?: ID[];
  ticketPrice?: number | null;
  ticketUrl?: string | null;
  imageUrl?: string | null;
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

export type EventInvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export type EventInvitation = {
  id: ID;
  eventId: ID;
  fromUserId?: ID | null;
  toUserId: ID;
  status: EventInvitationStatus;
  message?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

export type EventInvitationCreate = {
  eventId: ID;
  toUserId: ID;
  fromUserId?: ID | null;
  status?: EventInvitationStatus;
  message?: string | null;
};

export type EventMomentMediaKind = 'image' | 'video';
export type EventMomentReactionKind = 'fire' | 'love' | 'applause';

export type EventMomentMedia = {
  kind: EventMomentMediaKind;
  uri: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
};

export type EventMomentComment = {
  id: string;
  authorName: string;
  authorPartyId?: string | null;
  body: string;
  createdAt: string;
};

export type EventMoment = {
  id: string;
  eventId: string;
  authorName: string;
  authorPartyId?: string | null;
  caption?: string | null;
  media: EventMomentMedia;
  createdAt: string;
  reactions: Record<EventMomentReactionKind, string[]>;
  comments: EventMomentComment[];
};

export type EventMomentCreateInput = {
  eventId: ID;
  authorName: string;
  authorPartyId?: ID | null;
  caption?: string | null;
  media: EventMomentMedia;
};

export type EventMomentCommentInput = {
  eventId: ID;
  momentId: string;
  authorName: string;
  authorPartyId?: ID | null;
  body: string;
};

export type EventMomentActor = {
  actorKey: string;
  displayName: string;
  partyId?: string | null;
};

export type EventLiveBroadcastStatus = 'live' | 'ended';
export type EventLiveBroadcastQuality = 'auto' | '720p' | '480p';

export type EventLiveBroadcast = {
  id: string;
  eventId: string;
  artistId: string;
  artistName: string;
  broadcasterName: string;
  broadcasterPartyId?: string | null;
  title: string;
  description?: string | null;
  status: EventLiveBroadcastStatus;
  playbackUrl?: string | null;
  ingestUrl?: string | null;
  whipUrl?: string | null;
  streamKey?: string | null;
  viewerCount: number;
  startedAt: string;
  endedAt?: string | null;
  lastHeartbeatAt: string;
};

export type EventLiveBroadcastCreateInput = {
  eventId: ID;
  artistId: ID;
  artistName: string;
  broadcasterName: string;
  broadcasterPartyId?: ID | null;
  title?: string | null;
  description?: string | null;
  quality?: EventLiveBroadcastQuality;
  playbackUrl?: string | null;
  ingestUrl?: string | null;
  whipUrl?: string | null;
  streamKey?: string | null;
};

export type EventLiveBroadcastHeartbeatInput = {
  eventId: ID;
  broadcastId: string;
  viewerDelta?: number;
};

export type PartyFollow = {
  pfFollowerId: number;
  pfFollowingId: number;
  pfViaNfc: boolean;
  pfStartedAt: string; // ISO date
};

export type SuggestedFriend = {
  sfPartyId: number;
  sfMutualCount: number;
};
