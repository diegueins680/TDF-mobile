import React from 'react';
import { act, render, screen } from '@testing-library/react-native';

let mockAuth = { loading: false, token: null as string | null };
const mockSeen = jest.fn<Promise<boolean>, []>();
jest.mock('../src/providers/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('../src/lib/onboarding', () => ({ getOnboardingSeen: () => mockSeen() }));
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native');
    return <Text testID="destination">{href}</Text>;
  },
}));
const Index = require('../app/index').default;
const { MOBILE_LANDING_ROUTE } = require('../src/navigation/mobileSurface');

describe('cold launch with a persisted session', () => {
  beforeEach(() => { mockAuth = { loading: false, token: null }; mockSeen.mockReset(); });
  it('opens the existing landing route after deep-link login even without a seen marker', async () => {
    mockAuth.token = 'synthetic-current-session'; mockSeen.mockResolvedValue(false);
    render(<Index />); await act(async () => {});
    expect(screen.getByTestId('destination').props.children).toBe(MOBILE_LANDING_ROUTE);
  });
  it('does not wait for optional marker storage once current authentication is ready', async () => {
    mockAuth.token = 'synthetic-current-session'; mockSeen.mockReturnValue(new Promise(() => {}));
    render(<Index />);
    expect(screen.getByTestId('destination').props.children).toBe(MOBILE_LANDING_ROUTE);
  });
  it('waits for authentication hydration despite a remembered marker', async () => {
    mockAuth = { loading: true, token: 'synthetic-stale-session' }; mockSeen.mockResolvedValue(true);
    const view = render(<Index />); await act(async () => {});
    expect(screen.queryByTestId('destination')).toBeNull();
    mockAuth = { loading: false, token: null }; view.rerender(<Index />);
    expect(screen.getByTestId('destination').props.children).toBe(MOBILE_LANDING_ROUTE);
  });
  it.each([false, true])('preserves the anonymous first/return visit for seen=%s', async seen => {
    mockSeen.mockResolvedValue(seen); render(<Index />); await act(async () => {});
    expect(screen.getByTestId('destination').props.children).toBe(seen ? MOBILE_LANDING_ROUTE : '/onboarding');
  });
});
