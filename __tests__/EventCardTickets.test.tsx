import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { EventCard } from '../src/components/EventCard';
import type { SocialEvent } from '../src/types';

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
  eventTypeId: '41000000-0000-4000-8000-000000000001',
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
  workflowStateId: '00000000-0000-4000-8000-000000000233',
  workflowStateCode: 'on_sale',
  workflowStateNameEs: 'En venta',
  workflowStateNameEn: 'On sale',
  publicListable: true,
  ticketPurchaseEnabled: true,
  rsvpCount: 8,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('EventCard ticket discovery', () => {
  beforeEach(() => jest.clearAllMocks());

  it('takes buyers directly to the dedicated checkout', () => {
    render(<EventCard event={event} />);

    fireEvent.press(screen.getByRole('button', { name: 'Ver entradas para TDF Showcase' }));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/ticketCheckout', params: { eventId: '42' } });
    expect(mockCapture).toHaveBeenCalledWith('ticket_cta_tapped', {
      event_id: '42',
      source: 'event_card',
    });
  });

  it('labels explicit zero price as free', () => {
    render(<EventCard event={{ ...event, ticketPrice: 0 }} />);
    expect(screen.getByText('Gratis')).toBeTruthy();
  });

  it('keeps the ticket CTA visible for announced events before a summary price exists', () => {
    render(<EventCard event={{ ...event, ticketPrice: undefined }} />);
    expect(screen.getByRole('button', { name: 'Ver entradas para TDF Showcase' })).toBeTruthy();
  });

  it('renders an event whose official end is not confirmed', () => {
    render(<EventCard event={{ ...event, endTime: null }} />);

    expect(screen.getByText('TDF Showcase')).toBeTruthy();
    expect(screen.queryByText(/Invalid Date/i)).toBeNull();
  });

  it('exposes saved state and the event identity without limiting system text scaling', () => {
    const onToggleSaved = jest.fn();
    render(
      <EventCard
        event={event}
        saved
        onToggleSaved={onToggleSaved}
        saveStatus="ready"
      />,
    );

    const saveButton = screen.getByRole('button', { name: 'Remove TDF Showcase from my saved events' });
    expect(saveButton.props.accessibilityState).toMatchObject({ selected: true, disabled: false });
    fireEvent.press(saveButton);
    expect(onToggleSaved).toHaveBeenCalledTimes(1);
    expect(screen.getByText('TDF Showcase').props.maxFontSizeMultiplier).toBeUndefined();
  });

  it('does not let an unknown saved state become a duplicate save', () => {
    const onToggleSaved = jest.fn();
    render(
      <EventCard
        event={event}
        onToggleSaved={onToggleSaved}
        saveStatus="loading"
      />,
    );

    const saveButton = screen.getByRole('button', { name: 'Save TDF Showcase' });
    expect(saveButton.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(screen.getByText('Loading saved events…')).toBeTruthy();
    fireEvent.press(saveButton);
    expect(onToggleSaved).not.toHaveBeenCalled();
  });
});
