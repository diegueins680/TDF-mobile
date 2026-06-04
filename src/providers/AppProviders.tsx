import { PropsWithChildren } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnalyticsProvider } from '../analytics/AnalyticsProvider';
import { ExperimentProvider } from '../experiments/ExperimentProvider';
import { queryClient } from '../lib/queryClient';
import { AuthProvider } from './AuthProvider';
import { UserSettingsProvider } from './UserSettingsProvider';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {/* AnalyticsProvider must sit inside AuthProvider so it can observe partyId. */}
          <AnalyticsProvider>
            <UserSettingsProvider>
              {/* ExperimentProvider sits inside Analytics so assignment events have a destination. */}
              <ExperimentProvider>{children}</ExperimentProvider>
            </UserSettingsProvider>
          </AnalyticsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
