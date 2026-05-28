import { http } from './client';
import { MOBILE_SDK_STRIPE_VERSION } from '../lib/stripeConfig';

// Mirrors the optional `spiPaymentSheet` block returned by the backend when a
// request includes `ticketPurchaseMobileSdkStripeVersion`.
export interface PaymentSheetParams {
  psCustomerId: string;
  psEphemeralKeySecret: string;
  psPaymentIntentClientSecret: string;
  psPublishableKey: string;
}

export interface StripePaymentIntentResponse {
  spiClientSecret: string;
  spiOrderId: string;
  spiAmountCents: number;
  spiCurrency: string;
  spiPaymentSheet?: PaymentSheetParams | null;
}

export interface TicketPaymentSheetRequest {
  tierId: string;
  quantity: number;
  buyerName?: string;
  buyerEmail?: string;
  buyerPartyId?: string;
  promoCode?: string;
}

// Drives the backend's existing POST /social-events/stripe/create-payment-intent
// down its mobile branch (the one that returns customer + ephemeral key).
//
// The backend creates the ticket order in `pending` status before returning;
// the order flips to `paid` via the `payment_intent.succeeded` webhook after
// PaymentSheet confirms the payment client-side. We never trust the client's
// own confirmation event for state changes.
export async function createTicketPaymentSheet(
  request: TicketPaymentSheetRequest
): Promise<StripePaymentIntentResponse> {
  const body = {
    ticketPurchaseTierId: request.tierId,
    ticketPurchaseQuantity: request.quantity,
    ticketPurchaseBuyerPartyId: request.buyerPartyId ?? null,
    ticketPurchaseBuyerName: request.buyerName ?? null,
    ticketPurchaseBuyerEmail: request.buyerEmail ?? null,
    ticketPurchasePromoCode: request.promoCode ?? null,
    ticketPurchaseMobileSdkStripeVersion: MOBILE_SDK_STRIPE_VERSION
  };

  const response = await http.post<StripePaymentIntentResponse>(
    '/social-events/stripe/create-payment-intent',
    body
  );

  if (!response.data.spiPaymentSheet) {
    // Defensive: the backend should always return paymentSheet params when
    // we send a mobile sdk version. If it doesn't, something's misconfigured
    // server-side (e.g. STRIPE_PUBLISHABLE_KEY not set in tdf-hq env).
    throw new Error(
      'Backend did not return PaymentSheet parameters. Check tdf-hq STRIPE_PUBLISHABLE_KEY.'
    );
  }

  return response.data;
}
