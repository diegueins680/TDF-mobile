import { useEffect } from 'react';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppProviders } from '../src/providers/AppProviders';
import { useAnalytics } from '../src/analytics/AnalyticsProvider';
import { useAppTheme } from '../src/theme/ThemeProvider';

function RootNavigator() {
  const { colorScheme } = useAppTheme();
  const analytics = useAnalytics();
  const pathname = usePathname();

  useEffect(() => {
    analytics.screen(pathname, { screen_path: pathname, automatic: true });
  }, [analytics, pathname]);

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="about" />
        <Stack.Screen name="catalogs" />
        <Stack.Screen name="catalogEditor" />
        <Stack.Screen name="input-list/[id]" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
