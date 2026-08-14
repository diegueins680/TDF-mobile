import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { EventCard } from '../src/components/EventCard';
import type { SocialEvent } from '../src/types';
import { renderWithTheme } from '../test/renderWithTheme';

const mockPush = jest.fn();
const mockCapture = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../src/analytics/AnalyticsProvider', () => ({
  useAnalytics: () => ({ capture: mockCapture }),
}));

jest.mock('../src/providers/UserSettingsProvider', () => ({
  useUserSettings: () => ({ locale: 'en', timezone: 'UTC' }),
}));

const event: SocialEvent = {
  id: '42',
  title: 'TDF Showcase',
  startTime: '2027-01-01T20:00:00.000Z',
  endTime: '2027-01-01T22:00:00.000Z',
  venueId: '3',
  venue: {
    id: '3',
    name: 'Sala TDF',
    address: 'Quito',
    city: 'Quito',
    latitude: 0,
    longitude: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  artistIds: [],
  createdBy: '7',
  ticketPrice: 25,
  isPublic: true,
  status: 'on_sale',
  rsvpCount: 8,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('EventCard ticket discovery', () => {
  beforeEach(() => jest.clearAllMocks());

  it('takes buyers directly to the dedicated checkout', () => {
    renderWithTheme(<EventCard event={event} />);

    fireEvent.press(screen.getByRole('button', { name: 'Ver entradas para TDF Showcase' }));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/ticketCheckout', params: { eventId: '42' } });
    expect(mockCapture).toHaveBeenCalledWith('ticket_cta_tapped', {
      event_id: '42',
      source: 'event_card',
    });
  });

  it('labels explicit zero price as free', () => {
    renderWithTheme(<EventCard event={{ ...event, ticketPrice: 0 }} />);
    expect(screen.getByText('Gratis')).toBeTruthy();
  });

  it('keeps the ticket CTA visible for announced events before a summary price exists', () => {
    renderWithTheme(<EventCard event={{ ...event, status: 'announced', ticketPrice: undefined }} />);
    expect(screen.getByRole('button', { name: 'Ver entradas para TDF Showcase' })).toBeTruthy();
  });
});
