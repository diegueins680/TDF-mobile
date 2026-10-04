import React from 'react';
import { Text } from 'react-native';
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Redirect, useLocalSearchParams, useUnstableGlobalHref } from 'expo-router';
import { redirectSystemPath } from '../app/+native-intent';
import { currentRouteReturnTo } from '../src/navigation/deepLinks';

describe('notification native intents', () => {
  it.each([true, false])('rewrites system links before routing (initial=%s)', (initial) => {
    for (const alias of ['notification', 'notifications', 'notificaciones']) {
      expect(redirectSystemPath({ path: `tdf://${alias}/17`, initial })).toBe('/notifications?notificationId=17');
      expect(redirectSystemPath({ path: `tdf:///${alias}/17`, initial })).toBe('/notifications?notificationId=17');
    }
    expect(redirectSystemPath({ path: '/notification/17', initial })).toBe('/notifications?notificationId=17');
    expect(redirectSystemPath({ path: 'tdf://access-requests/23', initial })).toBe('/access-requests?request=23');
    expect(redirectSystemPath({ path: 'tdf://notification/17?returnTo=https://evil.example', initial })).toBe('/notifications?notificationId=17');
  });

  it('gives invalid notification identities an authorized fallback', () => {
    for (const id of ['0', '-1', 'NaN', '9007199254740992', '17/extra']) {
      expect(redirectSystemPath({ path: `tdf://notification/${id}`, initial: true })).toBe('/notifications');
    }
    expect(redirectSystemPath({ path: 'tdf://access-requests/invalid', initial: true })).toBe('/access-requests');
  });

  it('preserves existing authentication, OAuth and unrelated link handling', () => {
    for (const path of ['/auth?returnTo=%2Ftickets', 'tdf://auth', 'tdf://event/7', 'com.googleusercontent.apps.example:/oauthredirect', 'https://evil.example/notification/17']) {
      expect(redirectSystemPath({ path, initial: true })).toBe(path);
    }
  });

  it.each([
    ['tdf:///notification/17', '/notifications?notificationId=17'],
    ['tdf:///access-requests/23', '/access-requests?request=23'],
  ])('preserves the exact cold-start destination through the router and sign-in: %s', async (initialUrl, expected) => {
    function ProtectedDestination() {
      const href = useUnstableGlobalHref();
      return <Redirect href={{ pathname: '/auth', params: { returnTo: currentRouteReturnTo(expected.split('?')[0], href) ?? '' } }} />;
    }
    function SignIn() {
      const { returnTo } = useLocalSearchParams<{ returnTo: string }>();
      return <Text>{returnTo}</Text>;
    }
    renderRouter({
      '+native-intent': { redirectSystemPath },
      notifications: ProtectedDestination,
      'access-requests': ProtectedDestination,
      auth: SignIn,
    }, { initialUrl });
    await waitFor(() => expect(screen.getByText(expected)).toBeTruthy());
  });
});
