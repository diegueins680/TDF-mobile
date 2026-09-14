import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

import TicketCheckoutScreen from '../app/ticketCheckout';

const mockInvalidateQueries = jest.fn();
const mockRefetchOrders = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockCapture = jest.fn();
const mockScreenEvent = jest.fn();
const mockBuyTickets = jest.fn();
const mockCreatePaymentSheet = jest.fn();
let mockTierPriceCents = 2500;
let mockIncludeUnavailableTier = false;
let mockTierQueryError = false;
let mockAuthToken: string | null = 'Bearer token';
let mockAuthPartyId: string | null = '7';
let mockAuthDisplayName: string | null = 'Ana';

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
  useAuth: () => ({
    token: mockAuthToken,
    partyId: mockAuthPartyId,
    session: mockAuthDisplayName ? { displayName: mockAuthDisplayName } : null,
    loading: false,
    clearToken: jest.fn(),
  }),
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
  },
}));

jest.mock('../src/api/parties', () => ({
  getParty: jest.fn(),
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

describe('MOB-PER-02-TICKET-IDEMPOTENCY: ticket checkout', () => {
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
    mockAuthToken = 'Bearer token';
    mockAuthPartyId = '7';
    mockAuthDisplayName = 'Ana';
    mockOrders = [];
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
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

  it('offers intent-preserving signup and login instead of spinning for anonymous buyers', async () => {
    mockAuthToken = null;
    mockAuthPartyId = null;
    mockAuthDisplayName = null;

    render(<TicketCheckoutScreen />);

    expect(await screen.findByText('Inicia sesión para comprar entradas')).toBeTruthy();
    expect(screen.getByText(/TDF Showcase/)).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Crear cuenta para comprar entradas' }));
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/auth',
      params: {
        mode: 'signup',
        intent: 'events',
        returnTo: '/ticketCheckout?eventId=42',
      },
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

  it('confirms an authoritative free tier without opening an external checkout', async () => {
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
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(await screen.findByText('¡Entradas confirmadas!')).toBeTruthy();
  });

  it('opens the canonical web checkout for paid tickets without forwarding customer PII', async () => {
    render(<TicketCheckoutScreen />);

    await screen.findByDisplayValue('ana@example.com');
    fireEvent.press(screen.getByRole('button', { name: 'Agregar una entrada' }));
    fireEvent.press(screen.getByRole('button', { name: /Pagar/i }));

    await waitFor(() => expect(Linking.openURL).toHaveBeenCalledTimes(1));
    const checkoutUrl = jest.mocked(Linking.openURL).mock.calls[0][0];
    expect(checkoutUrl).toBe('https://tdf-app.pages.dev/eventos/42/entradas?tierId=3&quantity=2&source=mobile');
    expect(checkoutUrl).not.toMatch(/Ana|ana%40example\.com|promo/i);
    expect(mockCreatePaymentSheet).not.toHaveBeenCalled();
    expect(mockBuyTickets).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(await screen.findByText('Checkout seguro abierto')).toBeTruthy();
  });

  it('does not invoke a legacy payment endpoint when the secure checkout cannot open', async () => {
    jest.mocked(Linking.canOpenURL).mockResolvedValue(false);
    render(<TicketCheckoutScreen />);

    await screen.findByDisplayValue('ana@example.com');
    fireEvent.press(screen.getByRole('button', { name: /Pagar/i }));

    expect(await screen.findByText('No pudimos completar la compra')).toBeTruthy();
    expect(screen.getByText('No pudimos abrir el checkout seguro de TDF Records.')).toBeTruthy();
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(mockCreatePaymentSheet).not.toHaveBeenCalled();
  });

  it('keeps promo entry in the canonical checkout and out of the redirect URL', async () => {
    render(<TicketCheckoutScreen />);

    await screen.findByDisplayValue('ana@example.com');
    fireEvent.press(screen.getByText('¿Tienes un código promocional?'));
    fireEvent.changeText(screen.getByLabelText('Código promocional'), 'invitado');
    fireEvent.press(screen.getByRole('button', { name: /Validar código promocional/i }));

    await waitFor(() => expect(Linking.openURL).toHaveBeenCalledTimes(1));
    expect(jest.mocked(Linking.openURL).mock.calls[0][0]).not.toContain('INVITADO');
    expect(mockCreatePaymentSheet).not.toHaveBeenCalled();
  });

  it('reuses the free-checkout key when a create response is lost', async () => {
    mockTierPriceCents = 0;
    mockCreatePaymentSheet.mockRejectedValue(new Error('Sin respuesta del servidor'));
    render(<TicketCheckoutScreen />);

    await screen.findByDisplayValue('ana@example.com');
    const payButton = screen.getByRole('button', { name: /Confirmar .* gratis/i });
    fireEvent.press(payButton);
    await waitFor(() => expect(mockCreatePaymentSheet).toHaveBeenCalledTimes(1));
    fireEvent.press(payButton);
    await waitFor(() => expect(mockCreatePaymentSheet).toHaveBeenCalledTimes(2));

    const firstInput = mockCreatePaymentSheet.mock.calls[0][0];
    const secondInput = mockCreatePaymentSheet.mock.calls[1][0];
    expect(firstInput.checkoutKey).toMatch(/^tdf-/);
    expect(secondInput.checkoutKey).toBe(firstInput.checkoutKey);
  });

  it('rotates and retries a free-checkout key once when the server confirms the prior checkout is closed', async () => {
    mockTierPriceCents = 0;
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
    fireEvent.press(screen.getByRole('button', { name: /Confirmar .* gratis/i }));

    await waitFor(() => expect(mockCreatePaymentSheet).toHaveBeenCalledTimes(2));
    const firstKey = jest.mocked(AsyncStorage.setItem).mock.calls[0][1];
    const retryKey = jest.mocked(AsyncStorage.setItem).mock.calls[1][1];
    expect(retryKey).toMatch(/^tdf-/);
    expect(retryKey).not.toBe(firstKey);
    expect(await screen.findByText('¡Entradas confirmadas!')).toBeTruthy();
  });

  it('stops after one rotated free-checkout retry when the replacement checkout also conflicts', async () => {
    mockTierPriceCents = 0;
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
    fireEvent.press(screen.getByRole('button', { name: /Confirmar .* gratis/i }));

    await screen.findByText('No pudimos completar la compra');
    expect(mockCreatePaymentSheet).toHaveBeenCalledTimes(2);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
  });

  it('does not rotate a free-checkout key for a different idempotency conflict', async () => {
    mockTierPriceCents = 0;
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
    fireEvent.press(screen.getByRole('button', { name: /Confirmar .* gratis/i }));

    await waitFor(() => expect(mockCreatePaymentSheet).toHaveBeenCalledTimes(1));
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it('includes the normalized buyer name in the free-checkout fingerprint', async () => {
    mockTierPriceCents = 0;
    mockCreatePaymentSheet.mockRejectedValue(new Error('Sin respuesta del servidor'));
    render(<TicketCheckoutScreen />);

    await screen.findByDisplayValue('ana@example.com');
    const payButton = screen.getByRole('button', { name: /Confirmar .* gratis/i });
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
