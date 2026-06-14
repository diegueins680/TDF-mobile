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
        eventIsPublic: true,
      },
    ]);

    const events = await Events.list();

    expect(events).toHaveLength(3);
    expect(events[0]?.ticketPrice).toBeNull();
    expect(events[1]?.ticketPrice).toBeNull();
    expect(events[2]?.ticketPrice).toBe(0);
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

  it('Events.listTicketTiers maps ticket inventory defensively', async () => {
    get.mockResolvedValueOnce([
      {
        ticketTierId: 'tier-1',
        ticketTierEventId: 'event-1',
        ticketTierCode: ' ga ',
        ticketTierName: ' General ',
        ticketTierPriceCents: Number.NaN,
        ticketTierCurrency: ' usd ',
        ticketTierQuantityTotal: 100.7,
        ticketTierQuantitySold: -5,
        ticketTierActive: null,
        ticketTierSalesStart: ' ',
      },
    ]);

    const tiers = await Events.listTicketTiers('event-1');

    expect(get).toHaveBeenCalledWith('/social-events/events/event-1/ticket-tiers');
    expect(tiers).toHaveLength(1);
    expect(tiers[0]).toEqual(
      expect.objectContaining({
        id: 'tier-1',
        eventId: 'event-1',
        code: 'ga',
        name: 'General',
        priceCents: 0,
        currency: 'USD',
        quantityTotal: 100,
        quantitySold: 0,
        active: true,
        salesStart: null,
      }),
    );
  });

  it('Events.listTicketOrders maps orders, tickets, and query filters', async () => {
    get.mockResolvedValueOnce([
      {
        ticketOrderId: 'order-1',
        ticketOrderEventId: 'event-1',
        ticketOrderTierId: 'tier-1',
        ticketOrderBuyerPartyId: 'buyer-1',
        ticketOrderQuantity: 2,
        ticketOrderAmountCents: 5000,
        ticketOrderCurrency: 'usd',
        ticketOrderStatusValue: 'paid',
        ticketOrderTickets: [
          {
            ticketId: 'ticket-1',
            ticketCode: 'ABC123',
            ticketStatus: 'issued',
          },
        ],
      },
    ]);

    const orders = await Events.listTicketOrders('event-1', { buyerPartyId: ' buyer-1 ', status: ' paid ' });

    expect(get).toHaveBeenCalledWith('/social-events/events/event-1/ticket-orders?buyerPartyId=buyer-1&status=paid');
    expect(orders).toHaveLength(1);
    expect(orders[0]).toEqual(
      expect.objectContaining({
        id: 'order-1',
        eventId: 'event-1',
        tierId: 'tier-1',
        buyerPartyId: 'buyer-1',
        quantity: 2,
        amountCents: 5000,
        currency: 'USD',
        status: 'paid',
      }),
    );
    expect(orders[0]?.tickets[0]).toEqual(
      expect.objectContaining({
        id: 'ticket-1',
        code: 'ABC123',
        status: 'issued',
      }),
    );
  });

  it('Events.buyTickets posts the backend ticket purchase payload', async () => {
    post.mockResolvedValueOnce({
      ticketOrderId: 'order-2',
      ticketOrderEventId: 'event-1',
      ticketOrderTierId: 'tier-1',
      ticketOrderQuantity: 2,
      ticketOrderAmountCents: 7000,
      ticketOrderCurrency: 'USD',
      ticketOrderStatusValue: 'paid',
      ticketOrderTickets: [],
    });

    const order = await Events.buyTickets({
      eventId: 'event-1',
      tierId: 'tier-1',
      quantity: 2,
      buyerPartyId: ' 7 ',
      buyerName: ' Ana ',
      buyerEmail: ' ',
    });

    expect(post).toHaveBeenCalledWith('/social-events/events/event-1/ticket-orders', {
      ticketPurchaseTierId: 'tier-1',
      ticketPurchaseQuantity: 2,
      ticketPurchaseBuyerPartyId: '7',
      ticketPurchaseBuyerName: 'Ana',
      ticketPurchaseBuyerEmail: null,
    });
    expect(order.quantity).toBe(2);
    expect(order.amountCents).toBe(7000);
  });

  it('Events.createTicketPaymentSheet requests mobile PaymentSheet params', async () => {
    post.mockResolvedValueOnce({
      spiClientSecret: 'pi_secret',
      spiOrderId: 'order-3',
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
        eventId: 'event-1',
        tierId: 'tier-1',
        quantity: 2,
        buyerPartyId: '7',
        buyerName: 'Ana',
        buyerEmail: 'ana@example.com',
      },
      '2026-04-22.dahlia',
    );

    expect(post).toHaveBeenCalledWith('/social-events/stripe/create-payment-intent', {
      ticketPurchaseTierId: 'tier-1',
      ticketPurchaseQuantity: 2,
      ticketPurchaseBuyerPartyId: '7',
      ticketPurchaseBuyerName: 'Ana',
      ticketPurchaseBuyerEmail: 'ana@example.com',
      ticketPurchaseMobileSdkStripeVersion: '2026-04-22.dahlia',
    });
    expect(intent).toEqual({
      clientSecret: 'pi_secret',
      orderId: 'order-3',
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

  it('Events.updateTicketOrderStatus posts the ticket order status payload', async () => {
    put.mockResolvedValueOnce({
      ticketOrderId: 'order-3',
      ticketOrderEventId: 'event-1',
      ticketOrderTierId: 'tier-1',
      ticketOrderQuantity: 2,
      ticketOrderAmountCents: 8000,
      ticketOrderCurrency: 'USD',
      ticketOrderStatusValue: 'cancelled',
      ticketOrderTickets: [],
    });

    const order = await Events.updateTicketOrderStatus('event-1', 'order-3', 'cancelled');

    expect(put).toHaveBeenCalledWith('/social-events/events/event-1/ticket-orders/order-3/status', {
      ticketOrderStatus: 'cancelled',
    });
    expect(order.status).toBe('cancelled');
  });
});
