import React from 'react';
import { Text } from 'react-native';
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import RootLayout from '../app/_layout';
import { redirectSystemPath } from '../app/+native-intent';

afterEach(() => jest.restoreAllMocks());

jest.mock('../src/providers/AppProviders', () => ({ AppProviders: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../src/providers/AuthProvider', () => ({ useAuth: () => ({ token: null, roles: [], modules: [], featureFlags: [], loading: false }) }));
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
