import { useCallback, useState } from 'react';
import { useStripe } from '@stripe/stripe-react-native';

import {
  StripePaymentIntentResponse,
  TicketPaymentSheetRequest,
  createTicketPaymentSheet
} from '../api/ticketing';
import {
  STRIPE_MERCHANT_DISPLAY_NAME,
  isStripeConfigured
} from '../lib/stripeConfig';

export type TicketPurchaseStatus =
  | 'idle'
  | 'preparing'
  | 'awaitingUser'
  | 'confirmed'
  | 'canceled'
  | 'failed';

export interface TicketPurchaseState {
  status: TicketPurchaseStatus;
  orderId?: string;
  errorMessage?: string;
}

const initialState: TicketPurchaseState = { status: 'idle' };

// PaymentSheet checkout flow for ticket purchase.
//
// Lifecycle from the caller's perspective:
//   1. buyTickets(request) ->
//   2. Backend creates the order + customer-attached PaymentIntent + ephemeral key
//   3. PaymentSheet UI shown to the user
//   4. On confirm, the `payment_intent.succeeded` webhook flips the order to
//      `paid` server-side. The status reported here is "confirmed" once the SDK
//      reports a successful local confirmation; the canonical source of truth
//      remains the backend order status.
export function useTicketPurchase() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [state, setState] = useState<TicketPurchaseState>(initialState);

  const reset = useCallback(() => setState(initialState), []);

  const buyTickets = useCallback(
    async (request: TicketPaymentSheetRequest): Promise<TicketPurchaseState> => {
      if (!isStripeConfigured()) {
        const failed: TicketPurchaseState = {
          status: 'failed',
          errorMessage: 'Stripe is not configured on this build.'
        };
        setState(failed);
        return failed;
      }

      setState({ status: 'preparing' });
      let paymentResponse: StripePaymentIntentResponse;
      try {
        paymentResponse = await createTicketPaymentSheet(request);
      } catch (e) {
        const failed: TicketPurchaseState = {
          status: 'failed',
          errorMessage: e instanceof Error ? e.message : 'Failed to create payment'
        };
        setState(failed);
        return failed;
      }

      const sheet = paymentResponse.spiPaymentSheet!;
      const initResult = await initPaymentSheet({
        merchantDisplayName: STRIPE_MERCHANT_DISPLAY_NAME,
        customerId: sheet.psCustomerId,
        customerEphemeralKeySecret: sheet.psEphemeralKeySecret,
        paymentIntentClientSecret: sheet.psPaymentIntentClientSecret,
        allowsDelayedPaymentMethods: true,
        returnURL: 'tdf://stripe-redirect'
      });

      if (initResult.error) {
        const failed: TicketPurchaseState = {
          status: 'failed',
          orderId: paymentResponse.spiOrderId,
          errorMessage: initResult.error.message
        };
        setState(failed);
        return failed;
      }

      setState({ status: 'awaitingUser', orderId: paymentResponse.spiOrderId });
      const presentResult = await presentPaymentSheet();

      if (presentResult.error) {
        // Stripe RN reports a "Canceled" code when the user dismisses the sheet.
        const isCancel = presentResult.error.code === 'Canceled';
        const next: TicketPurchaseState = {
          status: isCancel ? 'canceled' : 'failed',
          orderId: paymentResponse.spiOrderId,
          errorMessage: isCancel ? undefined : presentResult.error.message
        };
        setState(next);
        return next;
      }

      const confirmed: TicketPurchaseState = {
        status: 'confirmed',
        orderId: paymentResponse.spiOrderId
      };
      setState(confirmed);
      return confirmed;
    },
    [initPaymentSheet, presentPaymentSheet]
  );

  return { state, buyTickets, reset };
}
