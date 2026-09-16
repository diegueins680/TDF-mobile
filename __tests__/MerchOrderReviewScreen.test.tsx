import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockOrderId = '10000000-0000-4000-8000-000000000001';
let mockRouteOrderId: string | undefined = mockOrderId;
let mockLocale = 'en';
const mockRefetch = jest.fn();
const mockMutate = jest.fn();
let mockQueryState: Record<string, unknown>;

const eligibility = {
  orderId: mockOrderId,
  storeId: '20000000-0000-4000-8000-000000000001',
  orderState: 'fulfilled',
  fulfillmentState: 'delivered',
  storeReview: {
    eligible: false,
    state: 'period_expired',
    reviewId: '30000000-0000-4000-8000-000000000001',
    currentRevision: 1,
    deadline: '2026-08-01T00:00:00Z',
  },
  productLines: [
    {
      lineId: '40000000-0000-4000-8000-000000000001',
      productId: '50000000-0000-4000-8000-000000000001',
      productName: 'Tour shirt',
      fulfillmentState: 'delivered',
      eligible: true,
      state: 'edit_available',
      reviewId: '60000000-0000-4000-8000-000000000001',
      currentRevision: 2,
    },
    {
      lineId: '40000000-0000-4000-8000-000000000002',
      productId: '50000000-0000-4000-8000-000000000002',
      productName: 'Vinyl record',
      fulfillmentState: 'preparing',
      eligible: false,
      state: 'available',
      reviewId: null,
      currentRevision: 0,
    },
  ],
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ orderId: mockRouteOrderId }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(() => mockQueryState),
  useMutation: jest.fn(() => ({ mutate: mockMutate, isPending: false, isError: false })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));

jest.mock('../src/providers/UserSettingsProvider', () => ({
  useUserSettings: () => ({ locale: mockLocale }),
}));

jest.mock('../src/theme/ThemeProvider', () => ({
  useAppTheme: () => ({ colors: {
    canvas: '#fff', surface: '#fff', textPrimary: '#111', textSecondary: '#555',
    actionPrimary: '#6200ee', actionPrimaryContrast: '#fff', border: '#999', danger: '#b91c1c',
  } }),
}));

jest.mock('../src/api/merchReputation', () => ({
  MerchReputation: {
    eligibility: jest.fn(),
    submitStore: jest.fn(),
    submitProduct: jest.fn(),
  },
}));

const MerchOrderReviewScreen = require('../app/merch/review').default;

const readyQuery = (data = eligibility) => ({
  data,
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: mockRefetch,
});

describe('Merch order review screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteOrderId = mockOrderId;
    mockLocale = 'en';
    mockQueryState = readyQuery();
  });

  it('labels expired, editable, and not-yet-received states without merging store and product ratings', () => {
    render(<MerchOrderReviewScreen />);

    expect(screen.getByRole('header', { name: 'Review your purchase' })).toBeTruthy();
    expect(screen.getByText('Review period expired')).toBeTruthy();
    expect(screen.getByText('Product rating · Review submitted · Editing available')).toBeTruthy();
    expect(screen.getByText('Product rating · Available after receiving this line')).toBeTruthy();

    fireEvent.press(screen.getByText('Tour shirt'));
    expect(screen.getByRole('header', { name: 'Tour shirt' })).toBeTruthy();
    expect(screen.getByText('Matches the description')).toBeTruthy();
    expect(screen.getByText('Product quality')).toBeTruthy();
    expect(screen.queryByText('Communication')).toBeNull();
    expect(screen.getByText('Save changes')).toBeTruthy();
    expect(screen.getByLabelText('Overall rating: 5 of 5')).toBeTruthy();
    expect(screen.getByLabelText('Matches the description: 5 of 5')).toBeTruthy();
    expect(screen.getByLabelText('Product quality: 5 of 5')).toBeTruthy();
  });

  it('shows the conditional resolution dimension and submits governed store dimensions in Spanish', () => {
    mockLocale = 'es';
    mockQueryState = readyQuery({
      ...eligibility,
      storeReview: { ...eligibility.storeReview, eligible: true, state: 'available', reviewId: null, currentRevision: 0 },
    });
    render(<MerchOrderReviewScreen />);

    fireEvent.press(screen.getByText('Experiencia con la tienda'));
    expect(screen.queryByText('Resolución de problemas')).toBeNull();
    fireEvent.press(screen.getByRole('checkbox', { name: /Hubo un problema que resolver/ }));
    expect(screen.getByText('Resolución de problemas')).toBeTruthy();

    [
      'Evaluación general: 5 de 5',
      'Preparación y despacho: 5 de 5',
      'Comunicación: 5 de 5',
      'Empaque: 5 de 5',
      'Resolución de problemas: 5 de 5',
    ].forEach((label) => fireEvent.press(screen.getByLabelText(label)));
    fireEvent.changeText(screen.getByLabelText('Comentario opcional'), 'La solución fue clara.');
    fireEvent.press(screen.getByText('Enviar evaluación'));

    expect(mockMutate).toHaveBeenCalledWith({
      overallRating: 5,
      issueOccurred: true,
      comment: 'La solución fue clara.',
      dimensions: {
        preparation_dispatch: 5,
        communication: 5,
        packaging: 5,
        problem_resolution: 5,
      },
      expectedRevision: 0,
    });
  });

  it('clears draft values when the buyer switches subjects', () => {
    mockLocale = 'es';
    mockQueryState = readyQuery({
      ...eligibility,
      storeReview: { ...eligibility.storeReview, eligible: true, state: 'available', reviewId: null, currentRevision: 0 },
    });
    render(<MerchOrderReviewScreen />);

    fireEvent.press(screen.getByText('Experiencia con la tienda'));
    fireEvent.press(screen.getByLabelText('Evaluación general: 5 de 5'));
    fireEvent.changeText(screen.getByLabelText('Comentario opcional'), 'Borrador temporal');
    fireEvent.press(screen.getByText('Tour shirt'));

    expect(screen.getByLabelText('Comentario opcional').props.value).toBe('');
    expect(screen.getByLabelText('Evaluación general: 5 de 5').props.accessibilityState.selected).toBe(false);
  });

  it('offers a recoverable retry and handles a missing order identifier', () => {
    mockQueryState = { data: undefined, isLoading: false, isFetching: false, isError: true, refetch: mockRefetch };
    const view = render(<MerchOrderReviewScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);

    mockRouteOrderId = undefined;
    mockQueryState = readyQuery(undefined);
    view.rerender(<MerchOrderReviewScreen />);
    expect(screen.getByRole('alert', { name: 'A valid order is required to review.' })).toBeTruthy();
  });
});
