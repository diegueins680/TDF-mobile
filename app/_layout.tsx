import { useEffect, useMemo, type ReactNode } from 'react';
import { Redirect, Stack, type Href, usePathname, useSegments, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';

import { AppProviders } from '../src/providers/AppProviders';
import { useAnalytics } from '../src/analytics/AnalyticsProvider';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { useAuth } from '../src/providers/AuthProvider';
import { useUserSettings } from '../src/providers/UserSettingsProvider';
import { FeatureAccessNotice } from '../src/components/FeatureAccessNotice';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { NetworkBanner } from '../src/providers/NetworkProvider';
import { evaluateFeatureAccess, getFeaturesByMobilePath } from '../src/features/featureRegistry';

function RootNavigator() {
  const { colorScheme } = useAppTheme();
  const analytics = useAnalytics();
  const pathname = usePathname();

  useEffect(() => {
    analytics.screen(pathname, { screen_path: pathname, automatic: true });
  }, [analytics, pathname]);

  useEffect(() => {
    if (typeof document !== 'undefined') document.title = 'TDF Mobile';
  }, []);

  return (
    <MobileRouteGuard>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, title: 'TDF Mobile' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="about" />
        <Stack.Screen name="operations" />
        <Stack.Screen name="catalogs" />
        <Stack.Screen name="catalogEditor" />
        <Stack.Screen name="input-list/[id]" />
      </Stack>
    </MobileRouteGuard>
  );
}

function handleDeepLink(url: string, router: ReturnType<typeof useRouter>) {
  try {
    const { path } = Linking.parse(url);
    if (!path) return;

    if (path.startsWith('event/')) {
      const eventId = path.replace('event/', '');
      router.push(`/eventDetail?eventId=${eventId}`);
    } else if (path.startsWith('artist/')) {
      const artistId = path.replace('artist/', '');
      router.push(`/artistDetail?artistId=${artistId}`);
    } else if (path === 'stripe-redirect') {
      router.push('/tickets');
    }
    // Add more routes as needed
  } catch (e) {
    console.warn('Failed to handle deep link:', url, e);
  }
}

function MobileRouteGuard({ children }: { children: ReactNode }) {
  const segments = useSegments();
  const router = useRouter();
  const analytics = useAnalytics();
  const { token, roles, modules, featureFlags, loading } = useAuth();
  const { locale } = useUserSettings();
  const { colors } = useAppTheme();
  const routePath = segments.length > 0 ? `/${segments.join('/')}` : '/';
  const features = useMemo(() => getFeaturesByMobilePath(routePath), [routePath]);
  const decisions = useMemo(() => features.map((feature) => evaluateFeatureAccess(feature, {
    authenticated: Boolean(token?.trim()), roles, modules, featureFlags,
  }, feature.routeAction)), [featureFlags, features, modules, roles, token]);
  const technical = features.some((feature) => feature.technical);
  const allowed = decisions.some((decision) => decision.state === 'allowed');
  const locked = decisions.find((decision) => decision.state === 'locked');
  const concealed = decisions.find((decision) => decision.state === 'concealed');
  const requiresAuthentication = features.length > 0
    && features.every((feature) => feature.requiredAuth === 'authenticated');
  const unresolved = features.length === 0;
  const forbidden = !loading && !technical && !unresolved && Boolean(token?.trim()) && !allowed;

  useEffect(() => {
    const handleInitialUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        handleDeepLink(initialUrl, router);
      }
    };

    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url, router);
    });

    handleInitialUrl();

    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    if (unresolved) {
      analytics.capture('feature_destination_unresolved', { platform: 'mobile', route_shape: routePath.replace(/\d+/g, ':id') });
    } else if (forbidden) {
      analytics.capture('feature_403_viewed', {
        platform: 'mobile',
        feature_id: (locked ?? concealed)?.feature.id ?? 'unknown',
        reason: (locked ?? concealed)?.reason ?? 'unknown',
      });
    } else if (allowed && features.length > 0) {
      analytics.capture('feature_navigation_selected', {
        platform: 'mobile',
        feature_id: features.map((f) => f.id).join(','),
        route: routePath.replace(/\d+/g, ':id'),
      });
    }
  }, [allowed, analytics, concealed, features, forbidden, locked, routePath, unresolved]);

  if (technical) return children;
  if (loading && requiresAuthentication) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator size="large" color={colors.actionPrimary} accessibilityLabel={locale.startsWith('en') ? 'Loading session' : 'Cargando sesión'} />
      </View>
    );
  }
  if (requiresAuthentication && !token?.trim()) {
    return <Redirect href={{ pathname: '/auth', params: { returnTo: routePath } } as Href} />;
  }
  if (allowed) return children;
  if (locked || concealed) {
    const decision = (locked ?? concealed)!;
    return <FeatureAccessNotice decision={decision} action={decision.feature.routeAction} locale={locale} />;
  }
  return (
    <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
      <Text accessibilityRole="header" style={[styles.unavailableTitle, { color: colors.textPrimary }]}>
        {locale.startsWith('en') ? 'Destination unavailable' : 'Destino no disponible'}
      </Text>
      <Text style={[styles.unavailableBody, { color: colors.textSecondary }]}>
        {locale.startsWith('en')
          ? 'This route is not registered as a user-facing destination.'
          : 'Esta ruta no está registrada como destino para usuarios.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center', gap: 12 },
  unavailableTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  unavailableBody: { fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 440 },
});

export default function RootLayout() {
  return (
    <AppProviders>
      <ErrorBoundary>
        <NetworkBanner />
        <RootNavigator />
      </ErrorBoundary>
    </AppProviders>
  );
}
