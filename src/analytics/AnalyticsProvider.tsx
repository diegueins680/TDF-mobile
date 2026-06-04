/**
 * AnalyticsProvider.tsx
 *
 * Wires PostHog into the React tree. Identifies the user when AuthProvider
 * has a partyId, resets on logout. Exposes useAnalytics() everywhere below.
 *
 * Must be mounted INSIDE AuthProvider so it can observe partyId.
 */
import { PropsWithChildren, createContext, useContext, useEffect, useMemo } from 'react';

import { useAuth } from '../providers/AuthProvider';
import { getAnalyticsClient, type AnalyticsClient } from './posthog';

const AnalyticsContext = createContext<AnalyticsClient | null>(null);

export function AnalyticsProvider({ children }: PropsWithChildren) {
  const client = useMemo(() => getAnalyticsClient(), []);
  const { partyId } = useAuth();

  // Identify when partyId is known; reset when it goes away (logout).
  useEffect(() => {
    if (!client.ready) return;
    if (partyId) {
      client.identify(partyId);
    } else {
      client.reset();
    }
  }, [client, partyId]);

  return <AnalyticsContext.Provider value={client}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics(): AnalyticsClient {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) {
    // Lazily fall back to the singleton so screens used outside the provider
    // (tests, storybooks) do not blow up.
    return getAnalyticsClient();
  }
  return ctx;
}
