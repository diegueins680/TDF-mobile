import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import TicketCheckoutScreen from '../app/ticketCheckout';

const mockInvalidateQueries = jest.fn();
const mockRefetchOrders = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockCapture = jest.fn();
const mockScreenEvent = jest.fn();
const mockBuyTickets = jest.fn();
const mockCreatePaymentSheet = jest.fn();
const mockUpdateOrderStatus = jest.fn();
const mockInitStripe = jest.fn();
const mockInitPaymentSheet = jest.fn();
const mockPresentPaymentSheet = jest.fn();
let mockTierPriceCents = 2500;
let mockIncludeUnavailableTier = false;
let mockTierQueryError = false;

const mockMutationRunner = jest.fn((options) => ({
  mutate: () => {
    Promise.resolve()
      .then(() => options.mutationFn())
      .then((result) => options.onSuccess?.(result))
      .catch((error) => options.onError?.(error));
  },
  isPending: false,
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('react-native-qrcode-svg', () => 'QRCode');

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ eventId: '42' }),
  useRouter: () => ({ back: jest.fn(), push: mockPush, replace: mockReplace }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: (options: unknown) => mockMutationRunner(options),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: () => ({ token: 'Bearer token', partyId: '7', loading: false }),
}));

jest.mock('../src/providers/UserSettingsProvider', () => ({
  useUserSettings: () => ({ displayName: 'Ana' }),
}));

jest.mock('../src/analytics/AnalyticsProvider', () => ({
  useAnalytics: () => ({ capture: mockCapture, screen: mockScreenEvent }),
}));

jest.mock('../src/api/events', () => ({
  Events: {
    getById: jest.fn(),
    listTicketTiers: jest.fn(),
    listTicketOrders: jest.fn(),
    buyTickets: (...args: unknown[]) => mockBuyTickets(...args),
    createTicketPaymentSheet: (...args: unknown[]) => mockCreatePaymentSheet(...args),
    updateTicketOrderStatus: (...args: unknown[]) => mockUpdateOrderStatus(...args),
  },
}));

jest.mock('../src/api/parties', () => ({
  getParty: jest.fn(),
}));

jest.mock('../src/lib/nativeStripe', () => ({
  getStripeCoreApiVersion: jest.fn(async () => '2026-04-22.dahlia'),
  initNativeStripe: (...args: unknown[]) => mockInitStripe(...args),
  initNativePaymentSheet: (...args: unknown[]) => mockInitPaymentSheet(...args),
  presentNativePaymentSheet: (...args: unknown[]) => mockPresentPaymentSheet(...args),
}));

const mockUseQuery = jest.mocked(require('@tanstack/react-query').useQuery as jest.Mock);

const paidOrder = {
  id: '9',
  eventId: '42',
  tierId: '3',
  buyerPartyId: '7',
  buyerName: 'Ana',
  buyerEmail: 'ana@example.com',
  quantity: 1,
  amountCents: 2500,
  currency: 'USD',
  status: 'paid',
  purchasedAt: '2026-07-12T18:00:00.000Z',
  tickets: [{
    id: '11',
    eventId: '42',
    tierId: '3',
    orderId: '9',
    code: 'TDF-ABC123',
    status: 'issued',
  }],
};
let mockOrders: Array<typeof paidOrder> = [];

describe('Ticket checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const storage: Record<string, string> = {};
    jest.mocked(AsyncStorage.getItem).mockImplementation(async (key) => storage[key] ?? null);
    jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage[key] = value;
    });
    jest.mocked(AsyncStorage.removeItem).mockImplementation(async (key) => {
      delete storage[key];
    });
    mockTierPriceCents = 2500;
    mockIncludeUnavailableTier = false;
    mockTierQueryError = false;
    mockOrders = [];
    mockInitStripe.mockResolvedValue(undefined);
    mockInitPaymentSheet.mockResolvedValue({});
    mockPresentPaymentSheet.mockResolvedValue({});
    mockUpdateOrderStatus.mockResolvedValue({ status: 'cancelled' });
    mockBuyTickets.mockResolvedValue({ ...paidOrder, amountCents: 0 });
    mockCreatePaymentSheet.mockResolvedValue({
      orderId: '9',
      amountCents: 2500,
      currency: 'USD',
      paymentSheet: {
        customerId: 'cus_123',
        ephemeralKeySecret: 'ek_secret',
        paymentIntentClientSecret: 'pi_secret',
        publishableKey: 'pk_test',
      },
    });

    mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[0] === 'event') {
        return {
          data: {
            id: '42',
            title: 'TDF Showcase',
            startTime: '2026-08-12T20:00:00.000Z',
            endTime: '2026-08-12T23:00:00.000Z',
            isPublic: true,
            workflowStateId: '00000000-0000-4000-8000-000000000233',
            workflowStateCode: 'on_sale',
            workflowStateNameEs: 'En venta',
            workflowStateNameEn: 'On sale',
            publicListable: true,
            ticketPurchaseEnabled: true,
            venue: { name: 'Sala TDF', city: 'Quito' },
          },
          isLoading: false,
          isError: false,
          refetch: jest.fn(),
        };
      }
      if (queryKey[0] === 'event-ticket-tiers') {
        const tiers = [{
          id: '3',
          eventId: '42',
          code: 'GENERAL',
          name: 'General',
          description: 'Acceso general',
          priceCents: mockTierPriceCents,
          currency: 'USD',
          quantityTotal: 10,
          quantitySold: 2,
          active: true,
        }];
        if (mockIncludeUnavailableTier) {
          tiers.push({
            id: '4',
            eventId: '42',
            code: 'PREVENTA',
            name: 'Preventa',
            description: 'Cupo agotado',
            priceCents: 1500,
            currency: 'USD',
            quantityTotal: 2,
            quantitySold: 2,
            active: false,
          });
        }
        return {
          data: tiers,
          isLoading: false,
          isError: mockTierQueryError,
          refetch: jest.fn(),
        };
      }
      if (queryKey[0] === 'ticket-checkout-party') {
        return {
          data: { id: 7, name: 'Ana Fan', email: 'ana@example.com' },
          isLoading: false,
          isError: false,
        };
      }
      if (queryKey[0] === 'event-ticket-orders') {
        return {
          data: mockOrders,
          isLoading: false,
          isError: false,
          refetch: mockRefetchOrders,
        };
      }
      return { data: undefined, isLoading: false, isError: false, refetch: jest.fn() };
    });
  });

  it('prefills delivery data and updates quantity and total with an accessible stepper', async () => {
    render(<TicketCheckoutScreen />);

    expect(await screen.findByDisplayValue('ana@example.com')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /General.*25/i }).props.accessibilityState).toMatchObject({ selected: true });

    fireEvent.press(screen.getByRole('button', { name: 'Agregar una entrada' }));
    expect(screen.getByLabelText('2 entradas')).toBeTruthy();
    expect(screen.getAllByText(/50[,.]00/).length).toBeGreaterThan(0);
  });

  it('shows unavailable tiers but prevents selecting them', async () => {
    mockIncludeUnavailableTier = true;
    render(<TicketCheckoutScreen />);

    const tier = await screen.findByRole('radio', { name: /Preventa/i });
    expect(tier.props.accessibilityState).toMatchObject({ selected: false, disabled: true });
    fireEvent.press(tier);
    expect(screen.getByRole('radio', { name: /General/i }).props.accessibilityState)
      .toMatchObject({ selected: true, disabled: false });
  });

  it('shows an inline email error before creating an order', async () => {
    render(<TicketCheckoutScreen />);
    const email = await screen.findByDisplayValue('ana@example.com');
    fireEvent.changeText(email, 'correo-invalido');

    fireEvent.press(screen.getByRole('button', { name: /Pagar/i }));

    expect(await screen.findByText('Ingresa un correo válido.')).toBeTruthy();
    expect(mockCreatePaymentSheet).not.toHaveBeenCalled();
    expect(mockBuyTickets).not.toHaveBeenCalled();
  });

  it('confirms an authoritative free tier without opening Stripe', async () => {
    mockTierPriceCents = 0;
    mockCreatePaymentSheet.mockResolvedValue({
      orderId: '10',
      amountCents: 0,
      currency: 'USD',
      clientSecret: '',
      paymentSheet: null,
    });
    render(<TicketCheckoutScreen />);

    await screen.findByDisplayValue('ana@example.com');
    fireEvent.press(screen.getByRole('button', { name: /Confirmar 1 entrada gratis/i }));

    await waitFor(() => expect(mockCreatePaymentSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: '42',
        tierId: '3',
        quantity: 1,
        buyerEmail: 'ana@example.com',
        checkoutKey: expect.stringMatching(/^tdf-/),
      }),
      undefined,
    ));
    expect(mockBuyTickets).not.toHaveBeenCalled();
    expect(mockInitStripe).not.toHaveBeenCalled();
    expect(await screen.findByText('¡Entradas confirmadas!')).toBeTruthy();
  });

  it('confirms a server-issued 100% promo without opening Stripe', async () => {
    mockCreatePaymentSheet.mockResolvedValue({
      orderId: '10',
      amountCents: 0,
      currency: 'USD',
      clientSecret: '',
      paymentSheet: null,
    });
    render(<TicketCheckoutScreen />);

    await screen.findByDisplayValue('ana@example.com');
    fireEvent.press(screen.getByText('¿Tienes un código promocional?'));
    fireEvent.changeText(screen.getByLabelText('Código promocional'), 'invitado');
    fireEvent.press(screen.getByRole('button', { name: /Validar código promocional/i }));

    await waitFor(() => expect(mockCreatePaymentSheet).toHaveBeenCalledWith(
      expect.objectContaining({ promoCode: 'INVITADO' }),
      expect.any(String),
    ));
    expect(mockInitStripe).not.toHaveBeenCalled();
    expect(await screen.findByText('¡Entradas confirmadas!')).toBeTruthy();
  });

  it('releases a pending reservation when PaymentSheet is cancelled', async () => {
    mockPresentPaymentSheet.mockResolvedValue({ error: { code: 'Canceled' } });
    render(<TicketCheckoutScreen />);

    await screen.findByDisplayValue('ana@example.com');
    fireEvent.press(screen.getByRole('button', { name: /Pagar/i }));

    await waitFor(() => expect(mockUpdateOrderStatus).toHaveBeenCalledWith('42', '9', 'cancelled'));
    expect(await screen.findByText('Pago cancelado')).toBeTruthy();
    expect(screen.getByText('No se realizó el cobro y la reserva fue liberada.')).toBeTruthy();
  });

  it('keeps an ambiguous PaymentSheet result pending for webhook reconciliation', async () => {
    mockPresentPaymentSheet.mockResolvedValue({ error: { code: 'Failed', message: 'Bridge disconnected' } });
    render(<TicketCheckoutScreen />);

    await screen.findByDisplayValue('ana@example.com');
    fireEvent.press(screen.getByRole('button', { name: /Pagar/i }));

    expect(await screen.findByText('Estamos verificando el pago')).toBeTruthy();
    expect(mockUpdateOrderStatus).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(screen.getByText(/No vuelvas a pagar todavía/)).toBeTruthy();
  });

  it('retains the key after PaymentSheet succeeds until the order becomes terminal', async () => {
    const view = render(<TicketCheckoutScreen />);

    await screen.findByDisplayValue('ana@example.com');
    fireEvent.press(screen.getByRole('button', { name: /Pagar/i }));

    expect(await screen.findByText('¡Pago recibido!')).toBeTruthy();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();

    mockOrders = [{ ...paidOrder, status: 'paid' }];
    view.rerender(<TicketCheckoutScreen />);

    await waitFor(() => expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(1));
  });

  it('reuses the checkout key when a create-payment response is lost', async () => {
    mockCreatePaymentSheet.mockRejectedValue(new Error('Sin respuesta del servidor'));
    render(<TicketCheckoutScreen />);

    await screen.findByDisplayValue('ana@example.com');
    const payButton = screen.getByRole('button', { name: /Pagar/i });
    fireEvent.press(payButton);
    await waitFor(() => expect(mockCreatePaymentSheet).toHaveBeenCalledTimes(1));
    fireEvent.press(payButton);
    await waitFor(() => expect(mockCreatePaymentSheet).toHaveBeenCalledTimes(2));

    const firstInput = mockCreatePaymentSheet.mock.calls[0][0];
    const secondInput = mockCreatePaymentSheet.mock.calls[1][0];
    expect(firstInput.checkoutKey).toMatch(/^tdf-/);
    expect(secondInput.checkoutKey).toBe(firstInput.checkoutKey);
  });

  it('rotates and retries once when the server confirms the prior checkout is closed', async () => {
    mockCreatePaymentSheet
      .mockRejectedValueOnce({
        isAxiosError: true,
        message: 'Ticket checkout is already closed; start a new checkout',
        response: {
          status: 409,
          data: 'Ticket checkout is already closed; start a new checkout',
        },
      })
      .mockResolvedValueOnce({
        orderId: '10',
        amountCents: 0,
        currency: 'USD',
        clientSecret: '',
        paymentSheet: null,
      });
    render(<TicketCheckoutScreen />);

    await screen.findByDisplayValue('ana@example.com');
    fireEvent.press(screen.getByRole('button', { name: /Pagar/i }));

    await waitFor(() => expect(mockCreatePaymentSheet).toHaveBeenCalledTimes(2));
    const firstKey = jest.mocked(AsyncStorage.setItem).mock.calls[0][1];
    const retryKey = jest.mocked(AsyncStorage.setItem).mock.calls[1][1];
    expect(retryKey).toMatch(/^tdf-/);
    expect(retryKey).not.toBe(firstKey);
    expect(await screen.findByText('¡Entradas confirmadas!')).toBeTruthy();
  });

  it('stops after one rotated retry when the replacement checkout also conflicts', async () => {
    mockCreatePaymentSheet.mockRejectedValue({
      isAxiosError: true,
      message: 'Ticket checkout is already closed; start a new checkout',
      response: {
        status: 409,
        data: 'Ticket checkout is already closed; start a new checkout',
      },
    });
    render(<TicketCheckoutScreen />);

    await screen.findByDisplayValue('ana@example.com');
    fireEvent.press(screen.getByRole('button', { name: /Pagar/i }));

    await screen.findByText('No pudimos completar la compra');
    expect(mockCreatePaymentSheet).toHaveBeenCalledTimes(2);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
  });

  it('does not rotate a key for a different idempotency conflict', async () => {
    mockCreatePaymentSheet.mockRejectedValue({
      isAxiosError: true,
      message: 'ticketPurchaseIdempotencyKey was already used for different checkout details',
      response: {
        status: 409,
        data: 'ticketPurchaseIdempotencyKey was already used for different checkout details',
      },
    });
    render(<TicketCheckoutScreen />);

    await screen.findByDisplayValue('ana@example.com');
    fireEvent.press(screen.getByRole('button', { name: /Pagar/i }));

    await waitFor(() => expect(mockCreatePaymentSheet).toHaveBeenCalledTimes(1));
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it('includes the normalized buyer name in the checkout fingerprint', async () => {
    mockCreatePaymentSheet.mockRejectedValue(new Error('Sin respuesta del servidor'));
    render(<TicketCheckoutScreen />);

    await screen.findByDisplayValue('ana@example.com');
    const payButton = screen.getByRole('button', { name: /Pagar/i });
    fireEvent.press(payButton);
    await waitFor(() => expect(mockCreatePaymentSheet).toHaveBeenCalledTimes(1));

    fireEvent.changeText(screen.getByLabelText('Nombre para las entradas'), 'Beatriz');
    fireEvent.press(payButton);
    await waitFor(() => expect(mockCreatePaymentSheet).toHaveBeenCalledTimes(2));

    expect(mockCreatePaymentSheet.mock.calls[1][0].checkoutKey)
      .not.toBe(mockCreatePaymentSheet.mock.calls[0][0].checkoutKey);
  });

  it('offers retry when availability fails instead of rendering a free state', () => {
    mockTierQueryError = true;
    render(<TicketCheckoutScreen />);

    expect(screen.getByText('No pudimos cargar las entradas')).toBeTruthy();
    expect(screen.queryByText('Gratis')).toBeNull();
    expect(screen.getByText('Reintentar')).toBeTruthy();
  });
});
