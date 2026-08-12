import { PropsWithChildren } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnalyticsProvider } from '../analytics/AnalyticsProvider';
import { ExperimentProvider } from '../experiments/ExperimentProvider';
import { OptionalStripeProvider } from '../lib/nativeStripe';
import { queryClient } from '../lib/queryClient';
import { AuthProvider } from './AuthProvider';
import { FirstRunProvider } from './FirstRunProvider';
import { NetworkProvider } from './NetworkProvider';
import { UserSettingsProvider } from './UserSettingsProvider';
import { AppThemeProvider } from '../theme/ThemeProvider';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? '';
const STRIPE_MERCHANT_IDENTIFIER =
  process.env.STRIPE_MERCHANT_IDENTIFIER?.trim() || process.env.EXPO_PUBLIC_STRIPE_MERCHANT_IDENTIFIER?.trim() || undefined;

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <OptionalStripeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier={STRIPE_MERCHANT_IDENTIFIER}
      urlScheme="tdf"
      setReturnUrlSchemeOnAndroid
    >
      <SafeAreaProvider>
        <AppThemeProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              {/* AnalyticsProvider must sit inside AuthProvider so it can observe partyId. */}
              <AnalyticsProvider>
                <UserSettingsProvider>
                  {/* FirstRunProvider derives the new-user cohort used by
                      single-feature-onboarding-v1 and persists install/signup seen flags. */}
                  <FirstRunProvider>
                    {/* ExperimentProvider sits inside Analytics so assignment events have a destination. */}
                    <ExperimentProvider>
                      <NetworkProvider>{children}</NetworkProvider>
                    </ExperimentProvider>
                  </FirstRunProvider>
                </UserSettingsProvider>
              </AnalyticsProvider>
            </AuthProvider>
          </QueryClientProvider>
        </AppThemeProvider>
      </SafeAreaProvider>
    </OptionalStripeProvider>
  );
}
