jest.mock('../src/api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  del: jest.fn(),
}));

import { Artists } from '../src/api/artists';
import { Events } from '../src/api/events';
import { Venues } from '../src/api/venues';

const { get, post, put } = jest.requireMock('../src/api/client') as {
  get: jest.Mock;
  post: jest.Mock;
  put: jest.Mock;
};
const ISO_TIMESTAMP_PREFIX = /^\d{4}-\d{2}-\d{2}T/;

describe('Social API mapper sanitization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Artists.list uses party id fallback when artist id is missing', async () => {
    get.mockResolvedValueOnce([
      {
        artistPartyId: '55',
        partyId: '55',
        artistName: 'Fallback Artist',
      },
    ]);

    const artists = await Artists.list();

    expect(artists).toHaveLength(1);
    expect(artists[0]?.id).toBe(55);
    expect(artists[0]?.partyId).toBe(55);
  });

  it('Artists.create removes null and blank social links from payload', async () => {
    post.mockResolvedValueOnce({
      artistId: 9,
      artistPartyId: 55,
      artistName: 'Sanitized Artist',
      artistSocialLinks: {
        instagram: '@artist',
        spotify: 'https://open.spotify.com/artist/abc',
      },
    });

    await Artists.create({
      partyId: 55,
      name: 'Sanitized Artist',
      instagramHandle: ' @artist ',
      socialLinks: {
        spotify: ' https://open.spotify.com/artist/abc ',
        twitter: null,
        youtube: '   ',
      },
    });

    expect(post).toHaveBeenCalledWith(
      '/social-events/artists',
      expect.objectContaining({
        artistSocialLinks: {
          instagram: '@artist',
          spotify: 'https://open.spotify.com/artist/abc',
        },
      }),
    );
  });

  it('Artists.list preserves oversized digit ids and falls back on invalid numeric ids', async () => {
    get.mockResolvedValueOnce([
      {
        artistId: '90071992547409931234',
        artistPartyId: '55',
        artistName: 'Big Numeric String Artist',
      },
      {
        artistId: -9,
        artistPartyId: 44,
        artistName: 'Fallback Artist',
      },
    ]);

    const artists = await Artists.list();

    expect(artists).toHaveLength(2);
    expect(artists[0]?.id).toBe('90071992547409931234');
    expect(typeof artists[0]?.id).toBe('string');
    expect(artists[1]?.id).toBe(44);
    expect(artists[1]?.partyId).toBe(44);
  });

  it('Artists.list replaces blank timestamp fields with ISO defaults', async () => {
    get.mockResolvedValueOnce([
      {
        artistId: 11,
        artistPartyId: 11,
        artistName: 'Timestamp Artist',
        artistCreatedAt: '  ',
        artistUpdatedAt: '',
      },
    ]);

    const artists = await Artists.list();

    expect(artists).toHaveLength(1);
    expect(artists[0]?.createdAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(artists[0]?.updatedAt).toMatch(ISO_TIMESTAMP_PREFIX);
  });

  it('Artists.list replaces impossible ISO timestamps with safe defaults', async () => {
    get.mockResolvedValueOnce([
      {
        artistId: 11,
        artistPartyId: 11,
        artistName: 'Timestamp Artist',
        artistCreatedAt: '2026-02-30T10:00:00.000Z',
        artistUpdatedAt: '2026-13-01T00:00:00.000Z',
      },
    ]);

    const artists = await Artists.list();

    expect(artists).toHaveLength(1);
    expect(artists[0]?.createdAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(artists[0]?.updatedAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(artists[0]?.createdAt).not.toBe('2026-02-30T10:00:00.000Z');
    expect(artists[0]?.updatedAt).not.toBe('2026-13-01T00:00:00.000Z');
  });

  it('Venues.list trims contact metadata and ignores blank derived state', async () => {
    get.mockResolvedValueOnce([
      {
        venueId: ' 7 ',
        venueName: 'Sala Centro',
        venueAddress: '  Av. 123 ',
        venueCity: 'Quito,   ',
        venueState: '',
        venueCountry: ' EC ',
        venueLat: -0.18,
        venueLng: -78.47,
        venueContact: {
          phone: '   ',
          website: ' https://venue.example ',
        },
        venuePhone: null,
        venueWebsite: null,
      },
    ]);

    const venues = await Venues.list();

    expect(venues).toHaveLength(1);
    expect(venues[0]?.id).toBe(7);
    expect(venues[0]?.address).toBe('Av. 123');
    expect(venues[0]?.country).toBe('EC');
    expect(venues[0]?.state).toBeNull();
    expect(venues[0]?.phoneNumber).toBeNull();
    expect(venues[0]?.website).toBe('https://venue.example');
  });

  it('Venues.list preserves oversized digit ids without unsafe numeric coercion', async () => {
    get.mockResolvedValueOnce([
      {
        venueId: '90071992547409931234',
        venueName: 'Large Id Venue',
        venueAddress: 'Av. 99',
        venueCity: 'Quito',
        venueCountry: 'EC',
        venueLat: -0.18,
        venueLng: -78.47,
      },
    ]);

    const venues = await Venues.list();

    expect(venues).toHaveLength(1);
    expect(venues[0]?.id).toBe('90071992547409931234');
    expect(typeof venues[0]?.id).toBe('string');
  });

  it('Venues.list sanitizes invalid numeric coordinate/capacity values', async () => {
    get.mockResolvedValueOnce([
      {
        venueId: 8,
        venueName: 'Broken Venue',
        venueAddress: 'Av. 404',
        venueCity: 'Quito',
        venueLat: Number.NaN,
        venueLng: Number.POSITIVE_INFINITY,
        venueCapacity: Number.NEGATIVE_INFINITY,
      },
    ]);

    const venues = await Venues.list();

    expect(venues).toHaveLength(1);
    expect(venues[0]?.latitude).toBe(0);
    expect(venues[0]?.longitude).toBe(0);
    expect(venues[0]?.capacity).toBeNull();
  });

  it('Venues.list replaces blank timestamp fields with ISO defaults', async () => {
    get.mockResolvedValueOnce([
      {
        venueId: 12,
        venueName: 'Timestamp Venue',
        venueAddress: 'Av. 123',
        venueCity: 'Quito',
        venueCreatedAt: ' ',
        venueUpdatedAt: '   ',
      },
    ]);

    const venues = await Venues.list();

    expect(venues).toHaveLength(1);
    expect(venues[0]?.createdAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(venues[0]?.updatedAt).toMatch(ISO_TIMESTAMP_PREFIX);
  });

  it('Venues.list replaces impossible ISO timestamps with safe defaults', async () => {
    get.mockResolvedValueOnce([
      {
        venueId: 12,
        venueName: 'Timestamp Venue',
        venueAddress: 'Av. 123',
        venueCity: 'Quito',
        venueCreatedAt: '2026-02-31T12:00:00.000Z',
        venueUpdatedAt: '2026-11-31T12:00:00.000Z',
      },
    ]);

    const venues = await Venues.list();

    expect(venues).toHaveLength(1);
    expect(venues[0]?.createdAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(venues[0]?.updatedAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(venues[0]?.createdAt).not.toBe('2026-02-31T12:00:00.000Z');
    expect(venues[0]?.updatedAt).not.toBe('2026-11-31T12:00:00.000Z');
  });

  it('Events.list sanitizes invalid ticket price values from backend payloads', async () => {
    get.mockResolvedValueOnce([
      {
        eventId: 101,
        eventTitle: 'Broken Price Event',
        eventStart: '2026-01-01T00:00:00.000Z',
        eventEnd: '2026-01-01T01:00:00.000Z',
        eventVenueId: null,
        eventPriceCents: Number.NaN,
        eventIsPublic: true,
      },
      {
        eventId: 102,
        eventTitle: 'Negative Price Event',
        eventStart: '2026-01-01T00:00:00.000Z',
        eventEnd: '2026-01-01T01:00:00.000Z',
        eventVenueId: null,
        eventPriceCents: -500,
        eventIsPublic: true,
      },
      {
        eventId: 103,
        eventTitle: 'Free Event',
        eventStart: '2026-01-01T00:00:00.000Z',
        eventEnd: '2026-01-01T01:00:00.000Z',
        eventVenueId: null,
        eventPriceCents: 0,
        eventCurrency: 'eur',
        eventIsPublic: true,
      },
    ]);

    const events = await Events.list();

    expect(events).toHaveLength(3);
    expect(events[0]?.ticketPrice).toBeNull();
    expect(events[1]?.ticketPrice).toBeNull();
    expect(events[2]?.ticketPrice).toBe(0);
    expect(events[2]?.currency).toBe('EUR');
  });

  it('Events.list orders upcoming events nearest-first and maps sale status', async () => {
    get.mockResolvedValueOnce([
      {
        eventId: 302,
        eventTitle: 'Evento lejano',
        eventStart: '2027-01-02T20:00:00.000Z',
        eventEnd: '2027-01-02T22:00:00.000Z',
        eventVenueId: null,
        eventIsPublic: true,
        eventStatus: 'announced',
      },
      {
        eventId: 301,
        eventTitle: 'Evento próximo',
        eventStart: '2027-01-01T20:00:00.000Z',
        eventEnd: '2027-01-01T22:00:00.000Z',
        eventVenueId: null,
        eventIsPublic: true,
        eventStatus: 'on_sale',
      },
    ]);

    const events = await Events.list({ upcomingOnly: true });

    expect(events.map((event) => event.id)).toEqual([301, 302]);
    expect(events[0]?.status).toBe('on_sale');
  });

  it('Events mappers sanitize blank timestamp fields across events, RSVPs, and invitations', async () => {
    get
      .mockResolvedValueOnce([
        {
          eventId: 201,
          eventTitle: 'Timestamp Event',
          eventStart: '2026-01-01T00:00:00.000Z',
          eventEnd: '2026-01-01T01:00:00.000Z',
          eventVenueId: null,
          eventCreatedAt: '   ',
          eventUpdatedAt: ' ',
        },
      ])
      .mockResolvedValueOnce([
        {
          rsvpId: 1,
          rsvpEventId: 201,
          rsvpPartyId: 300,
          rsvpStatus: 'accepted',
          rsvpCreatedAt: ' ',
          rsvpUpdatedAt: '   ',
        },
      ])
      .mockResolvedValueOnce([
        {
          invitationId: 1,
          invitationEventId: 201,
          invitationToPartyId: 300,
          invitationCreatedAt: '   ',
          invitationUpdatedAt: ' ',
        },
      ]);

    const events = await Events.list();
    const rsvps = await Events.getRSVPs(201);
    const invitations = await Events.getInvitations(201);

    expect(events).toHaveLength(1);
    expect(events[0]?.createdAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(events[0]?.updatedAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(rsvps).toHaveLength(1);
    expect(rsvps[0]?.createdAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(rsvps[0]?.updatedAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(invitations).toHaveLength(1);
    expect(invitations[0]?.createdAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(invitations[0]?.updatedAt).toBeNull();
  });

  it('Events mappers sanitize impossible ISO timestamps across events, RSVPs, and invitations', async () => {
    get
      .mockResolvedValueOnce([
        {
          eventId: 202,
          eventTitle: 'Timestamp Event',
          eventStart: '2026-01-01T00:00:00.000Z',
          eventEnd: '2026-01-01T01:00:00.000Z',
          eventVenueId: null,
          eventCreatedAt: '2026-02-30T08:00:00.000Z',
          eventUpdatedAt: '2026-11-31T08:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          rsvpId: 1,
          rsvpEventId: 202,
          rsvpPartyId: 300,
          rsvpStatus: 'accepted',
          rsvpCreatedAt: '2026-02-29T08:00:00.000Z',
          rsvpUpdatedAt: '2026-13-01T08:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          invitationId: 1,
          invitationEventId: 202,
          invitationToPartyId: 300,
          invitationCreatedAt: '2026-02-31T08:00:00.000Z',
          invitationUpdatedAt: '2026-04-31T08:00:00.000Z',
        },
      ]);

    const events = await Events.list();
    const rsvps = await Events.getRSVPs(202);
    const invitations = await Events.getInvitations(202);

    expect(events).toHaveLength(1);
    expect(events[0]?.createdAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(events[0]?.updatedAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(events[0]?.createdAt).not.toBe('2026-02-30T08:00:00.000Z');
    expect(events[0]?.updatedAt).not.toBe('2026-11-31T08:00:00.000Z');

    expect(rsvps).toHaveLength(1);
    expect(rsvps[0]?.createdAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(rsvps[0]?.updatedAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(rsvps[0]?.createdAt).not.toBe('2026-02-29T08:00:00.000Z');
    expect(rsvps[0]?.updatedAt).not.toBe('2026-13-01T08:00:00.000Z');

    expect(invitations).toHaveLength(1);
    expect(invitations[0]?.createdAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(invitations[0]?.updatedAt).toBeNull();
  });

  it('Events.listTicketTiers maps backend ticket tier fields', async () => {
    get.mockResolvedValueOnce([
      {
        ticketTierId: '3',
        ticketTierEventId: '42',
        ticketTierCode: 'ga',
        ticketTierName: 'General',
        ticketTierDescription: 'Entrada general',
        ticketTierPriceCents: 3500,
        ticketTierCurrency: 'usd',
        ticketTierQuantityTotal: 100,
        ticketTierQuantitySold: 12,
        ticketTierActive: true,
        ticketTierPosition: 1,
      },
    ]);

    const tiers = await Events.listTicketTiers('42');

    expect(get).toHaveBeenCalledWith('/social-events/events/42/ticket-tiers');
    expect(tiers[0]).toEqual(
      expect.objectContaining({
        id: '3',
        eventId: '42',
        name: 'General',
        priceCents: 3500,
        currency: 'USD',
        quantityTotal: 100,
        quantitySold: 12,
        active: true,
      }),
    );
  });

  it('Events.listTicketOrders filters by buyer party id and maps orders', async () => {
    get.mockResolvedValueOnce([
      {
        ticketOrderId: '9',
        ticketOrderEventId: '42',
        ticketOrderTierId: '3',
        ticketOrderBuyerPartyId: '7',
        ticketOrderQuantity: 2,
        ticketOrderAmountCents: 7000,
        ticketOrderCurrency: 'usd',
        ticketOrderStatusValue: 'paid',
        ticketOrderTickets: [
          {
            ticketId: '11',
            ticketEventId: '42',
            ticketTierId: '3',
            ticketOrderId: '9',
            ticketCode: 'TDF-ABC',
            ticketStatus: 'issued',
          },
        ],
      },
    ]);

    const orders = await Events.listTicketOrders('42', '7');

    expect(get).toHaveBeenCalledWith('/social-events/events/42/ticket-orders?buyerPartyId=7');
    expect(orders[0]).toEqual(
      expect.objectContaining({
        id: '9',
        status: 'paid',
        quantity: 2,
        amountCents: 7000,
      }),
    );
    expect(orders[0]?.tickets[0]?.code).toBe('TDF-ABC');
  });

  it('Events.createTicketPaymentSheet requests mobile PaymentSheet params', async () => {
    post.mockResolvedValueOnce({
      spiClientSecret: 'pi_secret',
      spiOrderId: '9',
      spiAmountCents: 8000,
      spiCurrency: 'usd',
      spiPaymentSheet: {
        psCustomerId: 'cus_123',
        psEphemeralKeySecret: 'ek_secret',
        psPaymentIntentClientSecret: 'pi_secret',
        psPublishableKey: 'pk_test_123',
      },
    });

    const intent = await Events.createTicketPaymentSheet(
      {
        eventId: '42',
        tierId: '3',
        quantity: 2,
        buyerPartyId: '7',
        buyerName: 'Ana',
        buyerEmail: 'ana@example.com',
        checkoutKey: 'tdf-checkout-abc123',
      },
      '2026-04-22.dahlia',
    );

    expect(post).toHaveBeenCalledWith('/social-events/stripe/create-payment-intent', {
      ticketPurchaseTierId: '3',
      ticketPurchaseQuantity: 2,
      ticketPurchaseBuyerPartyId: '7',
      ticketPurchaseBuyerName: 'Ana',
      ticketPurchaseBuyerEmail: 'ana@example.com',
      ticketPurchaseIdempotencyKey: 'tdf-checkout-abc123',
      ticketPurchaseMobileSdkStripeVersion: '2026-04-22.dahlia',
    });
    expect(intent).toEqual({
      clientSecret: 'pi_secret',
      orderId: '9',
      amountCents: 8000,
      currency: 'USD',
      paymentSheet: {
        customerId: 'cus_123',
        ephemeralKeySecret: 'ek_secret',
        paymentIntentClientSecret: 'pi_secret',
        publishableKey: 'pk_test_123',
      },
    });
  });

  it('accepts an idempotent zero-total checkout without requiring a Stripe SDK version', async () => {
    post.mockResolvedValueOnce({
      spiClientSecret: '',
      spiOrderId: '10',
      spiAmountCents: 0,
      spiCurrency: 'USD',
      spiPaymentSheet: null,
    });

    await expect(Events.createTicketPaymentSheet(
      {
        eventId: '42',
        tierId: '3',
        quantity: 1,
        buyerEmail: 'ana@example.com',
        promoCode: 'INVITADO',
        checkoutKey: 'tdf-free-checkout-123',
      },
    )).resolves.toEqual({
      clientSecret: '',
      orderId: '10',
      amountCents: 0,
      currency: 'USD',
      paymentSheet: null,
    });
    expect(post).toHaveBeenCalledWith('/social-events/stripe/create-payment-intent', {
      ticketPurchaseTierId: '3',
      ticketPurchaseQuantity: 1,
      ticketPurchaseBuyerEmail: 'ana@example.com',
      ticketPurchasePromoCode: 'INVITADO',
      ticketPurchaseIdempotencyKey: 'tdf-free-checkout-123',
    });
  });

  it('Events.updateTicketOrderStatus posts the ticket order status payload', async () => {
    put.mockResolvedValueOnce({
      ticketOrderId: '9',
      ticketOrderEventId: '42',
      ticketOrderTierId: '3',
      ticketOrderQuantity: 2,
      ticketOrderAmountCents: 8000,
      ticketOrderCurrency: 'USD',
      ticketOrderStatusValue: 'cancelled',
      ticketOrderTickets: [],
    });

    const order = await Events.updateTicketOrderStatus('42', '9', 'cancelled');

    expect(put).toHaveBeenCalledWith('/social-events/events/42/ticket-orders/9/status', {
      ticketOrderStatus: 'cancelled',
    });
    expect(order.status).toBe('cancelled');
  });

  it('Events.listMyTicketOrders loads the authenticated buyer history across events', async () => {
    get.mockResolvedValueOnce([
      {
        ticketOrderId: '9',
        ticketOrderEventId: '42',
        ticketOrderTierId: '3',
        ticketOrderQuantity: 1,
        ticketOrderAmountCents: 2500,
        ticketOrderCurrency: 'USD',
        ticketOrderStatusValue: 'paid',
        ticketOrderTickets: [],
      },
    ]);

    const orders = await Events.listMyTicketOrders('paid');

    expect(get).toHaveBeenCalledWith('/social-events/ticket-orders?status=paid');
    expect(orders[0]).toEqual(expect.objectContaining({ eventId: '42', status: 'paid' }));
  });
});
