import { del, get, post, put } from './client';
import type {
  ID,
  SocialEvent,
  SocialEventCreate,
  SocialEventUpdate,
  EventRSVP,
  EventRSVPCreate,
  EventRSVPSummary,
  EventRSVPFeedPage,
  EventInvitation,
  EventInvitationCreate,
  EventMoment,
  EventMomentComment,
  EventMomentCommentInput,
  EventMomentCreateInput,
  EventMomentReactionOption,
  RSVPStatus,
  EventInvitationStatus,
  ArtistSocialLinks,
  EventTicket,
  EventTicketOrder,
  EventTicketPaymentIntent,
  EventTicketPaymentSheetParams,
  EventTicketPurchaseInput,
  EventTicketTier,
  EventCity,
  EventCityInput,
  EventSource
} from '../types';
import { assertNever } from '../lib/assertNever';
import { normalizePartyId as normalizeIdentityPartyId } from '../lib/identity';
import { normalizeOptionalTimestamp } from '../lib/isoDate';
import { normalizeRsvpStatus } from '../lib/rsvp';
import { PUBLIC_EVENT_ORIGIN } from '../lib/eventSharing';
import { mapBackendArtistToFrontend } from './artists';
import { Venues } from './venues';

type BackendArtistDTO = {
  artistId?: ID;
  id?: ID;
  artistName?: string;
  artistGenres?: string[];
  artistBio?: string | null;
  artistAvatarUrl?: string | null;
  artistSocialLinks?: ArtistSocialLinks;
};

type BackendEventDTO = {
  eventId: ID;
  eventTypeId: string;
  eventOrganizerPartyId?: ID | null;
  eventTitle: string;
  eventDescription?: string | null;
  eventStart: string;
  eventEnd?: string | null;
  eventVenueId?: string | null;
  eventPriceCents?: number | null;
  eventCurrency?: string | null;
  eventCapacity?: number | null;
  eventTicketUrl?: string | null;
  eventImageUrl?: string | null;
  eventIsPublic?: boolean | null;
  eventWorkflowStateId?: string | null;
  eventWorkflowStateCode?: string | null;
  eventWorkflowStateNameEs?: string | null;
  eventWorkflowStateNameEn?: string | null;
  eventPublicListable?: boolean | null;
  eventRsvpEligible?: boolean | null;
  eventTicketPurchaseEnabled?: boolean | null;
  eventCreatedAt?: string | null;
  eventUpdatedAt?: string | null;
  eventArtists?: BackendArtistDTO[];
  eventRsvps?: BackendRsvpDTO[];
  eventSources?: BackendEventSourceDTO[] | null;
};

type BackendPublicEventDTO = {
  id: ID;
  title: string;
  description?: string | null;
  startTime: string;
  endTime?: string | null;
  timezone?: string | null;
  priceCents?: number | null;
  capacity?: number | null;
  imageUrl?: string | null;
  isPublic?: boolean;
  workflowStateCode?: string;
  rsvpEligible?: boolean;
  publicShareEligible?: boolean;
  venue?: { id?: ID; name?: string | null } | null;
  location?: { city?: string | null; countryCode?: string | null; latitude?: number | null; longitude?: number | null } | null;
  rsvpSummary?: { acceptedCount?: number; maybeCount?: number } | null;
};

type BackendEventSourceDTO = {
  eventSourceProvider: string;
  eventSourceLabel: string;
  eventSourceUrl?: string | null;
  eventSourcePriceCents?: number | null;
  eventSourceCurrency?: string | null;
  eventSourceStatus: string;
};

type BackendEventCityDTO = {
  eventCityId: string;
  eventCityName: string;
  eventCityCountryCode: string;
  eventCityTimeZone?: string | null;
  eventCitySubscribed: boolean;
};

type BackendRsvpDTO = {
  rsvpEventId?: ID;
  rsvpStatus?: string;
  rsvpShowOnProfile?: boolean;
  rsvpCreatedAt?: string;
  rsvpUpdatedAt?: string;
};

type BackendRsvpSummaryDTO = {
  rsvpAcceptedCount?: number;
  rsvpMaybeCount?: number;
};

type BackendRsvpFeedPageDTO = {
  feedItems?: Array<{
    feedItemType?: string;
    feedEventId?: ID;
    feedStatus?: string;
    feedEventTitle?: string;
    feedEventStart?: string;
    feedEventTimezone?: string | null;
    feedEventImageUrl?: string | null;
    feedVenueName?: string | null;
    feedCity?: string | null;
    feedWorkflowStateCode?: string;
    feedActionAt?: string;
    feedCanonicalUrl?: string;
    feedCanEdit?: boolean;
    feedCanShare?: boolean;
  }>;
  feedNextCursor?: string | null;
};

type BackendInvitationDTO = {
  invitationId?: ID;
  invitationEventId?: ID;
  invitationFromPartyId?: ID | null;
  invitationToPartyId: ID;
  invitationStatus?: string | null;
  invitationMessage?: string | null;
  invitationCreatedAt?: string;
  invitationUpdatedAt?: string;
};

type BackendMomentReactionDTO = {
  emrReactionTypeId?: string | null;
  emrReactionCode?: string | null;
  emrReactionNameEs?: string | null;
  emrReactionNameEn?: string | null;
  emrReactionEmoji?: string | null;
  emrPartyId?: ID | null;
  emrCreatedAt?: string | null;
};

type BackendMomentCommentDTO = {
  emcId?: ID | null;
  emcMomentId?: ID | null;
  emcAuthorPartyId?: ID | null;
  emcAuthorName?: string | null;
  emcBody?: string | null;
  emcCreatedAt?: string | null;
  emcUpdatedAt?: string | null;
};

type BackendMomentDTO = {
  emId?: ID | null;
  emEventId?: ID | null;
  emAuthorPartyId?: ID | null;
  emAuthorName?: string | null;
  emCaption?: string | null;
  emMediaUrl?: string | null;
  emMediaType?: string | null;
  emMediaWidth?: number | null;
  emMediaHeight?: number | null;
  emMediaDurationMs?: number | null;
  emCreatedAt?: string | null;
  emUpdatedAt?: string | null;
  emReactions?: BackendMomentReactionDTO[];
  emComments?: BackendMomentCommentDTO[];
};

type BackendTicketTierDTO = {
  ticketTierId?: ID | null;
  ticketTierEventId?: ID | null;
  ticketTierCode?: string | null;
  ticketTierName?: string | null;
  ticketTierDescription?: string | null;
  ticketTierPriceCents?: number | null;
  ticketTierCurrency?: string | null;
  ticketTierQuantityTotal?: number | null;
  ticketTierQuantitySold?: number | null;
  ticketTierSalesStart?: string | null;
  ticketTierSalesEnd?: string | null;
  ticketTierActive?: boolean | null;
  ticketTierPosition?: number | null;
};

type BackendTicketDTO = {
  ticketId?: ID | null;
  ticketEventId?: ID | null;
  ticketTierId?: ID | null;
  ticketOrderId?: ID | null;
  ticketCode?: string | null;
  ticketStatus?: string | null;
  ticketHolderName?: string | null;
  ticketHolderEmail?: string | null;
  ticketCheckedInAt?: string | null;
  ticketCreatedAt?: string | null;
  ticketUpdatedAt?: string | null;
};

type BackendTicketOrderDTO = {
  ticketOrderId?: ID | null;
  ticketOrderEventId?: ID | null;
  ticketOrderTierId?: ID | null;
  ticketOrderBuyerPartyId?: ID | null;
  ticketOrderBuyerName?: string | null;
  ticketOrderBuyerEmail?: string | null;
  ticketOrderQuantity?: number | null;
  ticketOrderAmountCents?: number | null;
  ticketOrderCurrency?: string | null;
  ticketOrderStatusValue?: string | null;
  ticketOrderPurchasedAt?: string | null;
  ticketOrderCreatedAt?: string | null;
  ticketOrderUpdatedAt?: string | null;
  ticketOrderTickets?: BackendTicketDTO[] | null;
};

type BackendPaymentSheetParamsDTO = {
  psCustomerId?: string | null;
  psEphemeralKeySecret?: string | null;
  psPaymentIntentClientSecret?: string | null;
  psPublishableKey?: string | null;
};

type BackendStripePaymentIntentDTO = {
  spiClientSecret?: string | null;
  spiOrderId?: ID | null;
  spiAmountCents?: number | null;
  spiCurrency?: string | null;
  spiPaymentSheet?: BackendPaymentSheetParamsDTO | null;
};

type SocialEventWrite = Omit<SocialEventCreate, 'description' | 'venueId' | 'ticketPrice' | 'ticketUrl' | 'imageUrl'> & {
  description?: string | null;
  venueId: ID | null;
  ticketPrice?: number | null;
  ticketUrl?: string | null;
  imageUrl?: string | null;
};

const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const parseSafeInteger = (value: string): number | null => {
  if (!/^-?\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const normalizeComparableId = (value: ID): string | null => {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) return null;
    return String(value);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseSafeInteger(trimmed);
  if (parsed !== null) return parsed > 0 ? String(parsed) : null;
  return trimmed;
};

const normalizeVenueId = (value?: string | null): ID => {
  const trimmed = value?.trim();
  if (!trimmed) return 0;
  const parsed = parseSafeInteger(trimmed);
  if (parsed !== null) return parsed > 0 ? parsed : 0;
  return trimmed;
};

const normalizePartyId = (value?: ID | null): ID => {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) return 0;
    return value;
  }
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return 0;
  const parsed = parseSafeInteger(trimmed);
  if (parsed !== null) return parsed > 0 ? parsed : 0;
  return trimmed;
};

const normalizeVenueLookupId = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const parsed = parseSafeInteger(trimmed);
  if (parsed !== null) return parsed > 0 ? String(parsed) : null;
  return trimmed;
};

const normalizeOptionalIdParam = (value: ID | null | undefined): string | null => {
  if (value == null) return null;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) return null;
    return String(value);
  }
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = parseSafeInteger(trimmed);
  if (parsed !== null) return parsed >= 0 ? String(parsed) : null;
  return trimmed;
};

const normalizeOptionalPositiveIdParam = (value: ID | null | undefined): string | null => {
  if (value == null) return null;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) return null;
    return String(value);
  }
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = parseSafeInteger(trimmed);
  if (parsed !== null) return parsed > 0 ? String(parsed) : null;
  return trimmed;
};

const normalizePositiveIntegerIdParam = (value: ID | null | undefined): string | null => {
  if (value == null) return null;
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  }
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed) || !/[1-9]/.test(trimmed)) return null;
  return trimmed.replace(/^0+(?=\d)/, '');
};

const normalizeOptionalText = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizeSafeFeedImage = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed, PUBLIC_EVENT_ORIGIN);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
};

const CATALOG_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeCatalogUuid = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed && CATALOG_UUID_PATTERN.test(trimmed) ? trimmed.toLowerCase() : null;
};

const requireCatalogUuid = (value: string | null | undefined, fieldName: string): string => {
  const normalized = normalizeCatalogUuid(value);
  if (!normalized) throw new Error(`${fieldName} must be a canonical catalog UUID.`);
  return normalized;
};

const requireNonBlankText = (value: string | null | undefined, fieldName: string): string => {
  const normalized = normalizeOptionalText(value);
  if (!normalized) throw new Error(`${fieldName} must be a non-blank persisted value.`);
  return normalized;
};

const normalizeMomentMediaKind = (value: string | null | undefined): 'image' | 'video' => {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'video' ? 'video' : 'image';
};

const normalizeBackendVenueId = (value: ID | null | undefined): string | null => {
  if (value == null) return null;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) return null;
    return String(value);
  }
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = parseSafeInteger(trimmed);
  if (parsed !== null) return parsed > 0 ? String(parsed) : null;
  return trimmed;
};

async function loadVenueMapByIds(rawVenueIds: Array<string | null | undefined>) {
  const uniqueVenueIds = [...new Set(rawVenueIds.map((value) => normalizeVenueLookupId(value)).filter((value): value is string => Boolean(value)))];
  if (uniqueVenueIds.length === 0) return new Map<string, Awaited<ReturnType<typeof Venues.getById>>>();

  const settled = await Promise.allSettled(uniqueVenueIds.map((venueId) => Venues.getById(venueId)));
  const map = new Map<string, Awaited<ReturnType<typeof Venues.getById>>>();
  settled.forEach((result, index) => {
    const requestedId = uniqueVenueIds[index];
    if (result.status === 'fulfilled') {
      if (requestedId) {
        // Keep lookup stable when backend canonicalizes venue IDs.
        map.set(String(requestedId), result.value);
      }
      map.set(String(result.value.id), result.value);
    }
    if (result.status === 'rejected') {
      if (requestedId) {
        map.delete(String(requestedId));
      }
    }
  });
  return map;
}

/**
 * Social Events API - Wired to backend endpoints
 * Maps backend EventDTO to frontend SocialEvent types
 */
export const Events = {
  // Event CRUD
  list: async (filters?: {
    city?: string;
    startAfter?: string;
    upcomingOnly?: boolean;
    limit?: number;
    offset?: number;
    artistId?: ID;
    venueId?: ID;
    eventTypeId?: string;
    scope?: 'subscribed' | 'all';
  }): Promise<SocialEvent[]> => {
    const query = new URLSearchParams();
    const city = filters?.city?.trim();
    const startAfter = filters?.startAfter?.trim();
    if (city) query.append('city', city);
    if (filters?.scope) query.append('scope', filters.scope);
    if (startAfter) query.append('start_after', startAfter);
    if (filters?.upcomingOnly && !startAfter) {
      query.append('start_after', new Date().toISOString());
    }
    if (typeof filters?.limit === 'number' && Number.isFinite(filters.limit)) {
      const normalizedLimit = Math.trunc(filters.limit);
      if (normalizedLimit > 0) {
        query.append('limit', String(normalizedLimit));
      }
    }
    if (typeof filters?.offset === 'number' && Number.isFinite(filters.offset)) {
      const normalizedOffset = Math.trunc(filters.offset);
      if (normalizedOffset >= 0) {
        query.append('offset', String(normalizedOffset));
      }
    }
    const artistId = normalizeOptionalPositiveIdParam(filters?.artistId);
    const venueId = normalizeOptionalPositiveIdParam(filters?.venueId);
    const eventTypeId = normalizeCatalogUuid(filters?.eventTypeId);
    if (artistId) query.append('artistId', artistId);
    if (venueId) query.append('venueId', venueId);
    if (eventTypeId) query.append('event_type_id', eventTypeId);

    const url = `/social-events/events${query.toString() ? `?${query.toString()}` : ''}`;
    const events = await get<BackendEventDTO[]>(url);
    const venueMap = await loadVenueMapByIds(events.map((event) => event.eventVenueId));
    const mapped = events.map((event) =>
      mapBackendEventToFrontend(event, venueMap.get(String(normalizeVenueId(event.eventVenueId))))
    );
    return filters?.upcomingOnly
      ? mapped.sort((left, right) => Date.parse(left.startTime) - Date.parse(right.startTime))
      : mapped;
  },

  getById: async (eventId: ID): Promise<SocialEvent> => {
    const normalizedEventId = normalizePositiveIntegerIdParam(eventId);
    if (!normalizedEventId) throw new Error('Invalid event identifier.');
    const event = await get<BackendEventDTO>(`/social-events/events/${normalizedEventId}`);
    const venueMap = await loadVenueMapByIds([event.eventVenueId]);
    return mapBackendEventToFrontend(event, venueMap.get(String(normalizeVenueId(event.eventVenueId))));
  },

  getPublicById: async (eventId: ID): Promise<SocialEvent> => {
    const normalizedEventId = normalizePositiveIntegerIdParam(eventId);
    if (!normalizedEventId) throw new Error('Invalid public event identifier.');
    const event = await get<BackendPublicEventDTO>(`/directory/events/${normalizedEventId}`);
    const nowIso = new Date().toISOString();
    const venue = event.venue?.id && event.venue.name ? {
      id: event.venue.id,
      name: event.venue.name,
      address: '',
      city: event.location?.city ?? '',
      country: event.location?.countryCode ?? null,
      latitude: event.location?.latitude ?? 0,
      longitude: event.location?.longitude ?? 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    } : undefined;
    return {
      id: event.id,
      eventTypeId: '',
      title: event.title,
      description: event.description ?? null,
      startTime: event.startTime,
      endTime: event.endTime ?? null,
      venueId: event.venue?.id ?? 0,
      venue,
      artistIds: [],
      artists: [],
      createdBy: 0,
      ticketPrice: typeof event.priceCents === 'number' ? event.priceCents / 100 : null,
      imageUrl: event.imageUrl ?? null,
      isPublic: event.isPublic === true,
      workflowStateId: '',
      workflowStateCode: event.workflowStateCode ?? '',
      workflowStateNameEs: event.workflowStateCode === 'cancelled' ? 'Cancelado' : 'Publicado',
      workflowStateNameEn: event.workflowStateCode === 'cancelled' ? 'Cancelled' : 'Published',
      publicListable: event.publicShareEligible === true,
      rsvpEligible: event.rsvpEligible === true,
      ticketPurchaseEnabled: false,
      rsvpCount: Math.max(0, event.rsvpSummary?.acceptedCount ?? 0),
      rsvpInterestedCount: Math.max(0, event.rsvpSummary?.maybeCount ?? 0),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  },

  listCities: async (filters?: { q?: string; country?: string }): Promise<EventCity[]> => {
    const query = new URLSearchParams();
    const q = filters?.q?.trim();
    const country = filters?.country?.trim().toUpperCase();
    if (q) query.append('q', q);
    if (country) query.append('country', country);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const cities = await get<BackendEventCityDTO[]>(`/social-events/cities${suffix}`);
    return cities.map(mapBackendEventCity);
  },

  getCitySubscriptions: async (): Promise<EventCity[]> => {
    const cities = await get<BackendEventCityDTO[]>('/social-events/me/city-subscriptions');
    return cities.map(mapBackendEventCity);
  },

  replaceCitySubscriptions: async (cities: EventCityInput[]): Promise<EventCity[]> => {
    const payload = {
      eventCities: cities.map((city) => ({
        eventCityInputName: city.name.trim(),
        eventCityInputCountryCode: city.countryCode.trim().toUpperCase(),
        eventCityInputTimeZone: city.timeZone?.trim() || null,
      })),
    };
    const updated = await put<BackendEventCityDTO[]>(
      '/social-events/me/city-subscriptions',
      payload,
    );
    return updated.map(mapBackendEventCity);
  },

  create: async (body: SocialEventCreate): Promise<SocialEvent> => {
    assertValidTicketPriceForCreate(body.ticketPrice);
    const backendBody = mapFrontendEventToBackend(body);
    const event = await post<BackendEventDTO>('/social-events/events', backendBody);
    return mapBackendEventToFrontend(event);
  },

  update: async (eventId: ID, body: SocialEventUpdate): Promise<SocialEvent> => {
    const existing = await Events.getById(eventId);
    const backendBody = mapFrontendEventToBackend(mergeEventUpdate(existing, body));
    const event = await put<BackendEventDTO>(`/social-events/events/${eventId}`, backendBody);
    return mapBackendEventToFrontend(event);
  },

  delete: async (eventId: ID): Promise<void> => {
    await del<void>(`/social-events/events/${eventId}`);
  },

  // Ticket sales
  listTicketTiers: async (eventId: ID): Promise<EventTicketTier[]> => {
    const tiers = await get<BackendTicketTierDTO[]>(`/social-events/events/${eventId}/ticket-tiers`);
    return tiers
      .map((tier) => mapTicketTierDto(tier, eventId))
      .sort((left, right) => {
        const leftPosition = left.position ?? Number.MAX_SAFE_INTEGER;
        const rightPosition = right.position ?? Number.MAX_SAFE_INTEGER;
        return leftPosition - rightPosition || left.priceCents - right.priceCents || left.name.localeCompare(right.name);
      });
  },

  listTicketOrders: async (eventId: ID, buyerPartyId?: ID | null): Promise<EventTicketOrder[]> => {
    const query = new URLSearchParams();
    const normalizedBuyerPartyId = normalizePositiveIntegerIdParam(buyerPartyId);
    if (normalizedBuyerPartyId) query.append('buyerPartyId', normalizedBuyerPartyId);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const orders = await get<BackendTicketOrderDTO[]>(`/social-events/events/${eventId}/ticket-orders${suffix}`);
    return orders.map((order) => mapTicketOrderDto(order, eventId));
  },

  listMyTicketOrders: async (status?: string): Promise<EventTicketOrder[]> => {
    const query = new URLSearchParams();
    const normalizedStatus = normalizeOptionalText(status);
    if (normalizedStatus) query.append('status', normalizedStatus);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const orders = await get<BackendTicketOrderDTO[]>(`/social-events/ticket-orders${suffix}`);
    return orders.map((order) => mapTicketOrderDto(order, ''));
  },

  buyTickets: async (input: EventTicketPurchaseInput): Promise<EventTicketOrder> => {
    const normalizedTierId = normalizePositiveIntegerIdParam(input.tierId);
    if (!normalizedTierId) {
      throw new Error('Selecciona un tipo de ticket válido.');
    }
    if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
      throw new Error('Cantidad inválida.');
    }

    const buyerPartyId = normalizePositiveIntegerIdParam(input.buyerPartyId);
    const buyerName = normalizeOptionalText(input.buyerName ?? null);
    const buyerEmail = normalizeOptionalText(input.buyerEmail ?? null);
    const payload = {
      ticketPurchaseTierId: normalizedTierId,
      ticketPurchaseQuantity: input.quantity,
      ...(buyerPartyId ? { ticketPurchaseBuyerPartyId: buyerPartyId } : {}),
      ...(buyerName ? { ticketPurchaseBuyerName: buyerName } : {}),
      ...(buyerEmail ? { ticketPurchaseBuyerEmail: buyerEmail } : {}),
    };
    const dto = await post<BackendTicketOrderDTO>(`/social-events/events/${input.eventId}/ticket-orders`, payload);
    return mapTicketOrderDto(dto, input.eventId);
  },

  createTicketPaymentSheet: async (
    input: EventTicketPurchaseInput,
    mobileSdkStripeVersion?: string | null,
  ): Promise<EventTicketPaymentIntent> => {
    const normalizedTierId = normalizePositiveIntegerIdParam(input.tierId);
    const normalizedStripeVersion = normalizeOptionalText(mobileSdkStripeVersion);
    if (!normalizedTierId) {
      throw new Error('Selecciona un tipo de ticket válido.');
    }
    if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
      throw new Error('Cantidad inválida.');
    }
    const buyerPartyId = normalizePositiveIntegerIdParam(input.buyerPartyId);
    const buyerName = normalizeOptionalText(input.buyerName ?? null);
    const buyerEmail = normalizeOptionalText(input.buyerEmail ?? null);
    const promoCode = normalizeOptionalText(input.promoCode ?? null);
    const checkoutKey = normalizeOptionalText(input.checkoutKey ?? null);
    const payload = {
      ticketPurchaseTierId: normalizedTierId,
      ticketPurchaseQuantity: input.quantity,
      ...(buyerPartyId ? { ticketPurchaseBuyerPartyId: buyerPartyId } : {}),
      ...(buyerName ? { ticketPurchaseBuyerName: buyerName } : {}),
      ...(buyerEmail ? { ticketPurchaseBuyerEmail: buyerEmail } : {}),
      ...(promoCode ? { ticketPurchasePromoCode: promoCode } : {}),
      ...(checkoutKey ? { ticketPurchaseIdempotencyKey: checkoutKey } : {}),
      ...(normalizedStripeVersion
        ? { ticketPurchaseMobileSdkStripeVersion: normalizedStripeVersion }
        : {}),
    };
    const dto = await post<BackendStripePaymentIntentDTO>('/social-events/stripe/create-payment-intent', payload);
    return mapStripePaymentIntentDto(dto);
  },

  updateTicketOrderStatus: async (
    eventId: ID,
    orderId: ID,
    status: 'paid' | 'cancelled' | 'refunded',
  ): Promise<EventTicketOrder> => {
    const normalizedOrderId = normalizePositiveIntegerIdParam(orderId);
    if (!normalizedOrderId) {
      throw new Error('Orden de tickets inválida.');
    }
    const dto = await put<BackendTicketOrderDTO>(
      `/social-events/events/${eventId}/ticket-orders/${encodeURIComponent(normalizedOrderId)}/status`,
      { ticketOrderStatus: status },
    );
    return mapTicketOrderDto(dto, eventId);
  },

  // RSVP management
  getMyRSVP: async (eventId: ID): Promise<EventRSVP | null> => {
    const normalizedEventId = normalizePositiveIntegerIdParam(eventId);
    if (!normalizedEventId) throw new Error('A positive event id is required for RSVP.');
    const rsvp = await get<BackendRsvpDTO | null>(`/social-events/events/${normalizedEventId}/rsvp`);
    return rsvp ? mapRsvpDto(rsvp, normalizedEventId) : null;
  },

  // Transitional component compatibility without exposing the organizer list.
  getRSVPs: async (eventId: ID): Promise<EventRSVP[]> => {
    const mine = await Events.getMyRSVP(eventId);
    return mine ? [mine] : [];
  },

  getRSVPSummary: async (eventId: ID): Promise<EventRSVPSummary> => {
    const normalizedEventId = normalizePositiveIntegerIdParam(eventId);
    if (!normalizedEventId) throw new Error('A positive event id is required for RSVP.');
    const summary = await get<BackendRsvpSummaryDTO>(`/social-events/events/${normalizedEventId}/rsvp-summary`);
    return {
      goingCount: Math.max(0, summary.rsvpAcceptedCount ?? 0),
      interestedCount: Math.max(0, summary.rsvpMaybeCount ?? 0),
    };
  },

  rsvp: async (body: EventRSVPCreate): Promise<EventRSVP> => {
    const normalizedEventId = normalizePositiveIntegerIdParam(body.eventId);
    if (!normalizedEventId) throw new Error('A positive event id is required for RSVP.');
    const backendStatus = mapFrontendRsvpStatus(body.status);
    if (!backendStatus) {
      throw new Error('RSVP status NONE cannot be submitted.');
    }
    const payload = {
      rsvpStatus: backendStatus,
      rsvpShowOnProfile: body.status === 'NOT_GOING' ? false : body.showOnProfile,
    };
    const result = await put<BackendRsvpDTO>(`/social-events/events/${normalizedEventId}/rsvp`, payload);
    return mapRsvpDto(result, normalizedEventId);
  },

  updateRSVP: async (body: EventRSVPCreate): Promise<EventRSVP> => {
    // Backend atomically upserts by authenticated session identity.
    return Events.rsvp(body);
  },

  deleteRSVP: async (eventId: ID): Promise<void> => {
    const normalizedEventId = normalizePositiveIntegerIdParam(eventId);
    if (!normalizedEventId) throw new Error('A positive event id is required for RSVP.');
    await del(`/social-events/events/${normalizedEventId}/rsvp`);
  },

  listRSVPFeed: async (partyId: ID, cursor?: string, limit = 20): Promise<EventRSVPFeedPage> => {
    const normalizedPartyId = normalizePositiveIntegerIdParam(partyId);
    if (!normalizedPartyId) throw new Error('A positive Party id is required to load RSVP activity.');
    const query = new URLSearchParams({ limit: String(Math.min(50, Math.max(1, limit))) });
    if (cursor?.trim()) query.set('cursor', cursor.trim());
    const page = await get<BackendRsvpFeedPageDTO>(`/social-events/profiles/${normalizedPartyId}/rsvp-feed?${query.toString()}`);
    return {
      items: (page.feedItems ?? []).flatMap((item) => {
        const status = normalizeRsvpStatus(item.feedStatus);
        const normalizedEventId = normalizePositiveIntegerIdParam(item.feedEventId);
        if (status !== 'GOING' && status !== 'INTERESTED') return [];
        if (!normalizedEventId || !item.feedEventTitle || !item.feedEventStart || !item.feedActionAt) return [];
        return [{
          type: 'event_rsvp' as const,
          eventId: normalizedEventId,
          status,
          title: item.feedEventTitle,
          startTime: item.feedEventStart,
          timezone: item.feedEventTimezone ?? null,
          imageUrl: normalizeSafeFeedImage(item.feedEventImageUrl),
          venueName: item.feedVenueName ?? null,
          city: item.feedCity ?? null,
          workflowStateCode: item.feedWorkflowStateCode ?? '',
          actionAt: item.feedActionAt,
          canonicalUrl: `/eventos/${normalizedEventId}`,
          canEdit: item.feedCanEdit === true,
          canShare: item.feedCanShare === true,
        }];
      }),
      nextCursor: page.feedNextCursor ?? null,
    };
  },

  // Invitations
  sendInvitation: async (body: EventInvitationCreate): Promise<EventInvitation> => {
    const fromPartyId = normalizeOptionalIdParam(body.fromUserId);
    const payload = {
      invitationEventId: String(body.eventId),
      invitationFromPartyId: fromPartyId ?? undefined,
      invitationToPartyId: String(body.toUserId),
      invitationStatus: body.status ?? 'PENDING',
      invitationMessage: body.message ?? null
    };
    const dto = await post<BackendInvitationDTO>(`/social-events/events/${body.eventId}/invitations`, payload);
    return mapInvitationDto(dto, body.eventId);
  },

  getInvitations: async (eventId: ID): Promise<EventInvitation[]> => {
    const list = await get<BackendInvitationDTO[]>(`/social-events/events/${eventId}/invitations`);
    return list.map((dto) => mapInvitationDto(dto, eventId));
  },

  respondToInvitation: async (
    eventId: ID,
    invitationId: ID,
    status: EventInvitationStatus,
    message?: string
  ): Promise<EventInvitation> => {
    const invitationIdKey = normalizeComparableId(invitationId);
    if (!invitationIdKey) {
      throw new Error('Invalid invitation id.');
    }
    const invitation = (await Events.getInvitations(eventId)).find(
      (item) => normalizeComparableId(item.id) === invitationIdKey,
    );
    if (!invitation) {
      throw new Error(`Invitation ${invitationIdKey} not found for event ${String(eventId)}.`);
    }

    const payload = {
      invitationToPartyId: String(invitation.toUserId),
      invitationStatus: status,
      invitationMessage: message ?? undefined
    };
    // Backend endpoint updates invitation status via PUT.
    const invitationPathId = encodeURIComponent(invitationIdKey);
    const dto = await put<BackendInvitationDTO>(
      `/social-events/events/${eventId}/invitations/${invitationPathId}`,
      payload
    );
    return mapInvitationDto(dto, eventId);
  },

  // Event moments
  listMoments: async (eventId: ID): Promise<EventMoment[]> => {
    const list = await get<BackendMomentDTO[]>(`/social-events/events/${eventId}/moments`);
    return list.map((dto, index) => mapMomentDto(dto, eventId, index));
  },

  createMoment: async (input: EventMomentCreateInput): Promise<EventMoment> => {
    const payload = {
      emCreateAuthorName: input.authorName,
      emCreateCaption: input.caption ?? null,
      emCreateMediaUrl: input.media.uri,
      emCreateMediaType: input.media.kind,
      emCreateMediaWidth: input.media.width ?? null,
      emCreateMediaHeight: input.media.height ?? null,
      emCreateMediaDurationMs: input.media.durationMs ?? null,
    };
    const dto = await post<BackendMomentDTO>(`/social-events/events/${input.eventId}/moments`, payload);
    return mapMomentDto(dto, input.eventId);
  },

  reactToMoment: async (
    eventId: ID,
    momentId: string,
    reaction: EventMomentReactionOption,
  ): Promise<EventMoment> => {
    const dto = await post<BackendMomentDTO>(
      `/social-events/events/${eventId}/moments/${encodeURIComponent(momentId)}/reactions`,
      { emrrReactionTypeId: requireCatalogUuid(reaction.id, 'emrrReactionTypeId') },
    );
    return mapMomentDto(dto, eventId);
  },

  commentOnMoment: async (input: EventMomentCommentInput): Promise<EventMomentComment> => {
    const dto = await post<BackendMomentCommentDTO>(
      `/social-events/events/${input.eventId}/moments/${encodeURIComponent(input.momentId)}/comments`,
      {
        emccAuthorName: input.authorName,
        emccBody: input.body,
      },
    );
    return mapMomentCommentDto(dto, input.momentId);
  }
};

function normalizeNonNegativeInteger(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function normalizePositiveInteger(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function normalizeCurrencyCode(value: string | null | undefined): string {
  const normalized = value?.trim().toUpperCase();
  return normalized || 'USD';
}

function normalizeBackendIdText(value: ID | null | undefined, fallback: ID): string {
  const normalized = normalizeComparableId(value ?? fallback);
  return normalized ?? String(fallback);
}

function mapTicketTierDto(dto: BackendTicketTierDTO, fallbackEventId: ID): EventTicketTier {
  const id = normalizeBackendIdText(dto.ticketTierId, `${String(fallbackEventId)}:tier`);
  return {
    id,
    eventId: normalizeBackendIdText(dto.ticketTierEventId, fallbackEventId),
    code: normalizeOptionalText(dto.ticketTierCode) ?? id,
    name: normalizeOptionalText(dto.ticketTierName) ?? 'Ticket',
    description: normalizeOptionalText(dto.ticketTierDescription),
    priceCents: normalizeNonNegativeInteger(dto.ticketTierPriceCents),
    currency: normalizeCurrencyCode(dto.ticketTierCurrency),
    quantityTotal: normalizeNonNegativeInteger(dto.ticketTierQuantityTotal),
    quantitySold: normalizeNonNegativeInteger(dto.ticketTierQuantitySold),
    salesStart: normalizeOptionalTimestamp(dto.ticketTierSalesStart),
    salesEnd: normalizeOptionalTimestamp(dto.ticketTierSalesEnd),
    active: dto.ticketTierActive !== false,
    position: typeof dto.ticketTierPosition === 'number' && Number.isSafeInteger(dto.ticketTierPosition)
      ? dto.ticketTierPosition
      : null,
  };
}

function mapTicketDto(dto: BackendTicketDTO, fallbackOrderId: ID, index = 0): EventTicket {
  const ticketId = normalizeBackendIdText(dto.ticketId, `${String(fallbackOrderId)}:ticket:${index}`);
  return {
    id: ticketId,
    eventId: normalizeBackendIdText(dto.ticketEventId, ''),
    tierId: normalizeBackendIdText(dto.ticketTierId, ''),
    orderId: normalizeBackendIdText(dto.ticketOrderId, fallbackOrderId),
    code: normalizeOptionalText(dto.ticketCode) ?? ticketId,
    status: normalizeOptionalText(dto.ticketStatus)?.toLowerCase() ?? 'issued',
    holderName: normalizeOptionalText(dto.ticketHolderName),
    holderEmail: normalizeOptionalText(dto.ticketHolderEmail),
    checkedInAt: normalizeOptionalTimestamp(dto.ticketCheckedInAt),
    createdAt: normalizeOptionalTimestamp(dto.ticketCreatedAt),
    updatedAt: normalizeOptionalTimestamp(dto.ticketUpdatedAt),
  };
}

function mapTicketOrderDto(dto: BackendTicketOrderDTO, fallbackEventId: ID): EventTicketOrder {
  const id = normalizeBackendIdText(dto.ticketOrderId, `${String(fallbackEventId)}:order`);
  const tickets = (dto.ticketOrderTickets ?? []).map((ticket, index) => mapTicketDto(ticket, id, index));
  return {
    id,
    eventId: normalizeBackendIdText(dto.ticketOrderEventId, fallbackEventId),
    tierId: normalizeBackendIdText(dto.ticketOrderTierId, ''),
    buyerPartyId: normalizeOptionalText(String(dto.ticketOrderBuyerPartyId ?? '')) || null,
    buyerName: normalizeOptionalText(dto.ticketOrderBuyerName),
    buyerEmail: normalizeOptionalText(dto.ticketOrderBuyerEmail),
    quantity: normalizePositiveInteger(dto.ticketOrderQuantity),
    amountCents: normalizeNonNegativeInteger(dto.ticketOrderAmountCents),
    currency: normalizeCurrencyCode(dto.ticketOrderCurrency),
    status: normalizeOptionalText(dto.ticketOrderStatusValue)?.toLowerCase() ?? 'pending',
    purchasedAt: normalizeOptionalTimestamp(dto.ticketOrderPurchasedAt),
    createdAt: normalizeOptionalTimestamp(dto.ticketOrderCreatedAt),
    updatedAt: normalizeOptionalTimestamp(dto.ticketOrderUpdatedAt),
    tickets,
  };
}

function requirePaymentSheetText(value: string | null | undefined, field: string): string {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    throw new Error(`Stripe PaymentSheet response missing ${field}.`);
  }
  return normalized;
}

function mapPaymentSheetParamsDto(dto: BackendPaymentSheetParamsDTO | null | undefined): EventTicketPaymentSheetParams {
  if (!dto) {
    throw new Error('Stripe PaymentSheet response missing payment sheet params.');
  }
  return {
    customerId: requirePaymentSheetText(dto.psCustomerId, 'customerId'),
    ephemeralKeySecret: requirePaymentSheetText(dto.psEphemeralKeySecret, 'ephemeralKeySecret'),
    paymentIntentClientSecret: requirePaymentSheetText(dto.psPaymentIntentClientSecret, 'paymentIntentClientSecret'),
    publishableKey: requirePaymentSheetText(dto.psPublishableKey, 'publishableKey'),
  };
}

function mapStripePaymentIntentDto(dto: BackendStripePaymentIntentDTO): EventTicketPaymentIntent {
  if (!Number.isSafeInteger(dto.spiAmountCents) || Number(dto.spiAmountCents) < 0) {
    throw new Error('Stripe PaymentSheet response missing a valid amount.');
  }
  const amountCents = Number(dto.spiAmountCents);
  const paymentSheet = dto.spiPaymentSheet
    ? mapPaymentSheetParamsDto(dto.spiPaymentSheet)
    : null;
  if (amountCents > 0 && !paymentSheet) {
    throw new Error('Stripe PaymentSheet response missing payment sheet params.');
  }
  return {
    clientSecret: amountCents === 0
      ? normalizeOptionalText(dto.spiClientSecret) ?? ''
      : requirePaymentSheetText(dto.spiClientSecret, 'clientSecret'),
    orderId: requirePaymentSheetText(String(dto.spiOrderId ?? ''), 'orderId'),
    amountCents,
    currency: normalizeCurrencyCode(dto.spiCurrency),
    paymentSheet,
  };
}

// Mapping functions to convert between backend EventDTO and frontend SocialEvent
function mapBackendEventToFrontend(
  e: BackendEventDTO,
  venueOverride?: SocialEvent['venue']
): SocialEvent {
  const nowIso = new Date().toISOString();
  const artists = (e.eventArtists ?? []).map((artist) => mapBackendArtistToFrontend(artist));
  const createdAt = normalizeOptionalTimestamp(e.eventCreatedAt) ?? nowIso;
  const updatedAt = normalizeOptionalTimestamp(e.eventUpdatedAt) ?? createdAt;
  const sources = (e.eventSources ?? []).map(mapBackendEventSource);
  return {
    id: e.eventId,
    eventTypeId: requireCatalogUuid(e.eventTypeId, 'eventTypeId'),
    title: e.eventTitle,
    description: e.eventDescription || null,
    startTime: e.eventStart, // ISO string from backend
    endTime: e.eventEnd ?? null,
    venueId: normalizeVenueId(e.eventVenueId),
    venue: venueOverride,
    artistIds: artists.map((a) => a.id),
    artists,
    createdBy: normalizePartyId(e.eventOrganizerPartyId),
    ticketPrice: normalizeTicketPrice(e.eventPriceCents),
    currency: normalizeCurrencyCode(e.eventCurrency),
    ticketUrl: e.eventTicketUrl ?? null,
    sources,
    imageUrl: e.eventImageUrl ?? null,
    isPublic: typeof e.eventIsPublic === 'boolean' ? e.eventIsPublic : true,
    workflowStateId: requireCatalogUuid(e.eventWorkflowStateId, 'eventWorkflowStateId'),
    workflowStateCode: requireNonBlankText(e.eventWorkflowStateCode, 'eventWorkflowStateCode'),
    workflowStateNameEs: requireNonBlankText(e.eventWorkflowStateNameEs, 'eventWorkflowStateNameEs'),
    workflowStateNameEn: requireNonBlankText(e.eventWorkflowStateNameEn, 'eventWorkflowStateNameEn'),
    publicListable: e.eventPublicListable === true,
    rsvpEligible: e.eventRsvpEligible === true,
    ticketPurchaseEnabled: e.eventTicketPurchaseEnabled === true,
    rsvpCount: Array.isArray(e.eventRsvps)
      ? e.eventRsvps.filter((rsvp) => normalizeRsvpStatus(rsvp.rsvpStatus) === 'GOING').length
      : 0,
    rsvpInterestedCount: Array.isArray(e.eventRsvps)
      ? e.eventRsvps.filter((rsvp) => normalizeRsvpStatus(rsvp.rsvpStatus) === 'INTERESTED').length
      : 0,
    createdAt,
    updatedAt
  };
}

function mapBackendEventSource(source: BackendEventSourceDTO): EventSource {
  return {
    provider: source.eventSourceProvider,
    label: source.eventSourceLabel,
    url: source.eventSourceUrl ?? null,
    priceCents: source.eventSourcePriceCents ?? null,
    currency: source.eventSourceCurrency ?? null,
    status: source.eventSourceStatus,
  };
}

function mapBackendEventCity(city: BackendEventCityDTO): EventCity {
  return {
    id: city.eventCityId,
    name: city.eventCityName,
    countryCode: city.eventCityCountryCode,
    timeZone: city.eventCityTimeZone ?? null,
    subscribed: city.eventCitySubscribed,
  };
}

function normalizeTicketPrice(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value / 100;
}

function normalizeTicketPriceInput(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return value;
}

function assertValidTicketPriceForCreate(value: unknown): void {
  if (value == null) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error('Ticket price must be a valid number greater than or equal to zero.');
  }
}

function toBackendTicketPriceCents(value: unknown): number | null {
  const normalized = normalizeTicketPriceInput(value);
  if (normalized === undefined) return null;
  return Math.round(normalized * 100);
}

function mapFrontendEventToBackend(body: SocialEventWrite) {
  const currency = body.currency?.trim().toUpperCase();
  return {
    eventTypeId: requireCatalogUuid(body.eventTypeId, 'eventTypeId'),
    ...(body.workflowStateId
      ? { eventWorkflowStateId: requireCatalogUuid(body.workflowStateId, 'eventWorkflowStateId') }
      : {}),
    eventTitle: body.title,
    eventDescription: body.description,
    eventStart: body.startTime,
    eventEnd: body.endTime ?? null,
    eventVenueId: normalizeBackendVenueId(body.venueId),
    eventPriceCents: toBackendTicketPriceCents(body.ticketPrice),
    ...(currency ? { eventCurrency: currency } : {}),
    eventCapacity: null,
    eventTicketUrl: body.ticketUrl ?? null,
    eventImageUrl: body.imageUrl ?? null,
    eventIsPublic: body.isPublic,
    eventArtists: body.artistIds?.map((id: ID) => ({ artistId: id })) || []
  };
}

function mergeEventUpdate(existing: SocialEvent, patch: SocialEventUpdate): SocialEventWrite {
  const existingTicketPrice = normalizeTicketPriceInput(existing.ticketPrice);

  const mergedDescription = hasOwn(patch, 'description')
    ? patch.description === null
      ? undefined
      : patch.description ?? existing.description ?? undefined
    : existing.description ?? undefined;

  const mergedVenueId = hasOwn(patch, 'venueId')
    ? patch.venueId === null
      ? null
      : patch.venueId ?? existing.venueId
    : existing.venueId;

  const mergedTicketPrice = (() => {
    if (!hasOwn(patch, 'ticketPrice')) return existingTicketPrice;
    if (patch.ticketPrice === null) return undefined;
    const patchTicketPrice = normalizeTicketPriceInput(patch.ticketPrice);
    return patchTicketPrice ?? existingTicketPrice;
  })();

  const mergedTicketUrl = hasOwn(patch, 'ticketUrl')
    ? patch.ticketUrl === null
      ? undefined
      : patch.ticketUrl ?? existing.ticketUrl ?? undefined
    : existing.ticketUrl ?? undefined;

  const mergedImageUrl = hasOwn(patch, 'imageUrl')
    ? patch.imageUrl === null
      ? undefined
      : patch.imageUrl ?? existing.imageUrl ?? undefined
    : existing.imageUrl ?? undefined;

  const mergedCurrency = hasOwn(patch, 'currency')
    ? patch.currency === null
      ? undefined
      : patch.currency ?? existing.currency ?? undefined
    : existing.currency ?? undefined;

  const mergedEndTime = hasOwn(patch, 'endTime')
    ? patch.endTime ?? null
    : existing.endTime;

  return {
    eventTypeId: patch.eventTypeId ?? existing.eventTypeId,
    title: patch.title ?? existing.title,
    description: mergedDescription,
    startTime: patch.startTime ?? existing.startTime,
    endTime: mergedEndTime,
    venueId: mergedVenueId,
    artistIds: patch.artistIds ?? existing.artistIds,
    ticketPrice: mergedTicketPrice,
    currency: mergedCurrency,
    ticketUrl: mergedTicketUrl,
    imageUrl: mergedImageUrl,
    isPublic: patch.isPublic ?? existing.isPublic,
    workflowStateId: patch.workflowStateId ?? existing.workflowStateId,
  };
}

function mapRsvpDto(dto: BackendRsvpDTO, fallbackEventId: ID): EventRSVP {
  const createdAt = normalizeOptionalTimestamp(dto.rsvpCreatedAt) ?? new Date().toISOString();
  const updatedAt =
    normalizeOptionalTimestamp(dto.rsvpUpdatedAt) ??
    normalizeOptionalTimestamp(dto.rsvpCreatedAt) ??
    createdAt;
  return {
    id: `self-${dto.rsvpEventId ?? fallbackEventId}`,
    eventId: dto.rsvpEventId ?? fallbackEventId,
    status: normalizeRsvpStatus(dto.rsvpStatus),
    showOnProfile: dto.rsvpShowOnProfile === true,
    createdAt,
    updatedAt
  };
}

function mapFrontendRsvpStatus(status: RSVPStatus): string | null {
  switch (status) {
    case 'GOING':
      return 'accepted';
    case 'INTERESTED':
      return 'maybe';
    case 'NOT_GOING':
      return 'declined';
    case 'NONE':
      return null;
  }

  return assertNever(status, 'RSVP status');
}

function mapInvitationStatus(raw: unknown): EventInvitationStatus {
  const normalized = String(raw || '').trim().toLowerCase();
  if (normalized === 'accepted') return 'ACCEPTED';
  if (normalized === 'declined') return 'DECLINED';
  return 'PENDING';
}

function mapInvitationDto(dto: BackendInvitationDTO, fallbackEventId: ID): EventInvitation {
  const createdAt = normalizeOptionalTimestamp(dto.invitationCreatedAt) ?? new Date().toISOString();
  const updatedAt =
    normalizeOptionalTimestamp(dto.invitationUpdatedAt) ??
    normalizeOptionalTimestamp(dto.invitationCreatedAt) ??
    null;
  return {
    id: dto.invitationId ?? `${dto.invitationToPartyId}-${dto.invitationEventId ?? fallbackEventId}`,
    eventId: dto.invitationEventId ?? fallbackEventId,
    fromUserId: dto.invitationFromPartyId ?? null,
    toUserId: dto.invitationToPartyId,
    status: mapInvitationStatus(dto.invitationStatus),
    message: dto.invitationMessage ?? null,
    createdAt,
    updatedAt
  };
}

function mapMomentCommentDto(dto: BackendMomentCommentDTO, fallbackMomentId: ID, index = 0): EventMomentComment {
  const createdAt = normalizeOptionalTimestamp(dto.emcCreatedAt) ?? new Date().toISOString();
  const normalizedCommentId = normalizeComparableId(dto.emcId ?? null);
  return {
    id: normalizedCommentId ?? `moment-comment:${String(fallbackMomentId)}:${index}`,
    authorName: normalizeOptionalText(dto.emcAuthorName) ?? 'Invitado',
    authorPartyId: normalizeIdentityPartyId(dto.emcAuthorPartyId),
    body: normalizeOptionalText(dto.emcBody) ?? '',
    createdAt,
  };
}

function mapMomentReactions(dto: BackendMomentDTO): EventMoment['reactions'] {
  const reactions: EventMoment['reactions'] = {};

  (dto.emReactions ?? []).forEach((reactionDto, index) => {
    const reactionTypeId = normalizeCatalogUuid(reactionDto.emrReactionTypeId);
    if (!reactionTypeId) return;

    const partyId = normalizeIdentityPartyId(reactionDto.emrPartyId);
    const actorKey = partyId ? `party:${partyId}` : `guest:${reactionTypeId}:${index}`;
    const actors = reactions[reactionTypeId] ?? [];
    if (!actors.includes(actorKey)) {
      reactions[reactionTypeId] = [...actors, actorKey];
    }
  });

  return reactions;
}

function inferMomentMimeType(kind: EventMoment['media']['kind'], mediaUrl: string): string {
  const normalizedUrl = mediaUrl.toLowerCase();
  if (kind === 'video') {
    if (normalizedUrl.endsWith('.mov')) return 'video/quicktime';
    if (normalizedUrl.endsWith('.webm')) return 'video/webm';
    return 'video/mp4';
  }

  if (normalizedUrl.endsWith('.png')) return 'image/png';
  if (normalizedUrl.endsWith('.webp')) return 'image/webp';
  if (normalizedUrl.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function mapMomentDto(dto: BackendMomentDTO, fallbackEventId: ID, index = 0): EventMoment {
  const createdAt = normalizeOptionalTimestamp(dto.emCreatedAt) ?? new Date().toISOString();
  const mediaUrl = normalizeOptionalText(dto.emMediaUrl) ?? '';
  const mediaKind = normalizeMomentMediaKind(dto.emMediaType);
  const normalizedMomentId = normalizeComparableId(dto.emId ?? null);
  const comments = (dto.emComments ?? [])
    .map((commentDto, commentIndex) => mapMomentCommentDto(commentDto, dto.emId ?? `remote:${index}`, commentIndex))
    .filter((comment) => comment.body.trim().length > 0)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

  return {
    id: normalizedMomentId ?? `remote-moment:${String(fallbackEventId)}:${index}`,
    eventId: normalizeComparableId(dto.emEventId ?? fallbackEventId) ?? String(fallbackEventId),
    authorName: normalizeOptionalText(dto.emAuthorName) ?? 'Invitado',
    authorPartyId: normalizeIdentityPartyId(dto.emAuthorPartyId),
    caption: normalizeOptionalText(dto.emCaption),
    media: {
      kind: mediaKind,
      uri: mediaUrl,
      mimeType: inferMomentMimeType(mediaKind, mediaUrl),
      width: typeof dto.emMediaWidth === 'number' ? dto.emMediaWidth : null,
      height: typeof dto.emMediaHeight === 'number' ? dto.emMediaHeight : null,
      durationMs: typeof dto.emMediaDurationMs === 'number' ? dto.emMediaDurationMs : null,
    },
    createdAt,
    reactions: mapMomentReactions(dto),
    comments,
  };
}
