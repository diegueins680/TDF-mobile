import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import Bookings from '../app/(tabs)/bookings';

const mockMutate = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(({ queryKey }: { queryKey: string[] }) => queryKey[0] === 'bookings'
    ? { data: [], isLoading: false, isError: false }
    : { data: [{ scId: 7, scName: 'Grabación', scDefaultDurationMinutes: 90 }], isLoading: false, isError: false }),
  useMutation: jest.fn(() => ({ mutate: mockMutate, isPending: false })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));
jest.mock('../src/api/bookings', () => ({ createBooking: jest.fn(), listBookings: jest.fn() }));
jest.mock('../src/lib/serviceCatalogSnapshot', () => ({ loadServiceOfferingSnapshot: jest.fn() }));
jest.mock('../src/components/reviews/ExperienceReviews', () => ({ ExperienceReviews: () => null }));

type AlertButton = { text?: string; style?: string; onPress?: () => void };

describe('Bookings quick session', () => {
  beforeEach(() => jest.clearAllMocks());

  it('names the booking and waits for confirmation before creating it', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    render(<Bookings />);

    fireEvent.press(screen.getByLabelText('Crear sesión rápida de Grabación'));

    expect(mockMutate).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      '¿Reservar Grabación ahora?',
      'Se creará una reserva que empieza en este momento y dura 90 minutos.',
      expect.any(Array),
    );
    const buttons = alertSpy.mock.calls[0]?.[2] as AlertButton[];
    expect(buttons.map((button) => button.text)).toEqual(['Cancelar', 'Reservar ahora']);
    expect(buttons[0]?.style).toBe('cancel');
    expect(buttons[0]?.onPress).toBeUndefined();

    buttons[1]?.onPress?.();

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const payload = mockMutate.mock.calls[0]?.[0] as { title: string; start: string; end: string; serviceOfferingId: number };
    expect(payload.title).toBe('Grabación');
    expect(payload.serviceOfferingId).toBe(7);
    expect(new Date(payload.end).getTime() - new Date(payload.start).getTime()).toBe(90 * 60 * 1000);
  });
});
