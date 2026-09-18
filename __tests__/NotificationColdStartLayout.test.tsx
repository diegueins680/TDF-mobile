import React from 'react';
import { Text } from 'react-native';
import { act } from '@testing-library/react-native';
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import RootLayout from '../app/_layout';
import { redirectSystemPath } from '../app/+native-intent';

afterEach(() => jest.restoreAllMocks());

jest.mock('../src/providers/AppProviders', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  const { useRootNavigationState } = jest.requireActual('expo-router');
  function NavigationProbe() {
    const state = useRootNavigationState();
    return React.createElement(Text, { testID: 'root-navigation-key' }, state?.key ?? 'not-ready');
  }
  return { AppProviders: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children, React.createElement(NavigationProbe)) };
});
let mockAuthLoading = false;
let mockAuthSubscribers = new Set<() => void>();
jest.mock('../src/providers/AuthProvider', () => {
  const React = jest.requireActual('react');
  return { useAuth: () => {
    const loading = React.useSyncExternalStore((listener: () => void) => { mockAuthSubscribers.add(listener); return () => mockAuthSubscribers.delete(listener); }, () => mockAuthLoading);
    return { token: null, roles: [], modules: [], featureFlags: [], loading };
  } };
});
beforeEach(() => { mockAuthLoading = false; mockAuthSubscribers = new Set(); });
jest.mock('../src/providers/UserSettingsProvider', () => ({ useUserSettings: () => ({ locale: 'es' }) }));
jest.mock('../src/theme/ThemeProvider', () => ({ useAppTheme: () => ({ colorScheme: 'light', colors: {} }) }));
jest.mock('../src/analytics/AnalyticsProvider', () => {
  const analytics = { capture: jest.fn(), screen: jest.fn() };
  return { useAnalytics: () => analytics };
});
jest.mock('../src/providers/NetworkProvider', () => ({ NetworkBanner: () => null }));
jest.mock('../src/navigation/useNotificationResponses', () => ({ useNotificationResponses: () => {} }));

it.each([
  ['tdf:///notification/17', '/notifications?notificationId=17'],
  ['tdf:///access-requests/23', '/access-requests?request=23'],
])('the actual root guard preserves a signed-out cold start: %s', async (initialUrl, expected) => {
  const initial = jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(initialUrl);
  const push = jest.spyOn(router, 'push');
  function SignIn() {
    const { returnTo } = useLocalSearchParams<{ returnTo: string }>();
    return <Text>{returnTo}</Text>;
  }
  renderRouter({
    _layout: RootLayout,
    '+native-intent': { redirectSystemPath },
    notifications: () => <Text>Private notification</Text>,
    'access-requests': () => <Text>Private notification</Text>,
    auth: SignIn,
  }, { initialUrl });
  await waitFor(() => expect(screen.getByText(expected)).toBeTruthy());
  await waitFor(() => expect(initial).toHaveBeenCalled());
  expect(push).not.toHaveBeenCalled();
  expect(screen.queryByText('Private notification')).toBeNull();
});


it.each([
  ['tdf:///notification/17', '/notifications?notificationId=17'],
  ['tdf:///access-requests/23', '/access-requests?request=23'],
])('resolves a cold link while the persisted session is still loading: %s', async (initialUrl, expected) => {
  mockAuthLoading = true;
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(initialUrl);
  function SignIn() {
    const { returnTo } = useLocalSearchParams<{ returnTo: string }>();
    return <Text>{returnTo}</Text>;
  }
  renderRouter({
    _layout: RootLayout,
    '+native-intent': { redirectSystemPath },
    notifications: () => <Text>Private notification</Text>,
    'access-requests': () => <Text>Private notification</Text>,
    auth: SignIn,
  }, { initialUrl });
  expect(screen.queryByText('Private notification')).toBeNull();
  await waitFor(() => expect(screen.getByTestId('root-navigation-key').props.children).not.toBe('not-ready'));
  await act(async () => {
    mockAuthLoading = false;
    mockAuthSubscribers.forEach(listener => listener());
  });
  await waitFor(() => expect(screen.getByText(expected)).toBeTruthy());
  expect(screen.queryByText('Private notification')).toBeNull();
});
