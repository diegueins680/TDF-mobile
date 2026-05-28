import { PropsWithChildren, ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';

import { queryClient } from '../lib/queryClient';
import {
  STRIPE_MERCHANT_IDENTIFIER,
  STRIPE_PUBLISHABLE_KEY
} from '../lib/stripeConfig';
import { AuthProvider } from './AuthProvider';
import { UserSettingsProvider } from './UserSettingsProvider';

// Falls through when no publishable key is configured so the app still boots in
// environments without Stripe credentials (e.g. CI, dev shells with no .env).
function MaybeStripeProvider({ children }: { children: ReactNode }) {
  if (!STRIPE_PUBLISHABLE_KEY) {
    return <>{children}</>;
  }
  return (
    <StripeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier={STRIPE_MERCHANT_IDENTIFIER}
    >
      {children}
    </StripeProvider>
  );
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <UserSettingsProvider>
            <MaybeStripeProvider>{children}</MaybeStripeProvider>
          </UserSettingsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
