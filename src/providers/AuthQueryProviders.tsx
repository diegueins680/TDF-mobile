import { PropsWithChildren, useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { createQueryClient } from '../lib/queryClient';
import { AuthProvider, useAuth } from './AuthProvider';

function QueryScope({ children }: PropsWithChildren) {
  const [client] = useState(createQueryClient);
  useEffect(() => () => client.clear(), [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function AuthQueryBoundary({ children }: PropsWithChildren) {
  const { sessionEpoch, token, partyId, roles, modules, featureFlags } = useAuth();
  const scope = JSON.stringify([
    sessionEpoch, token, partyId,
    [...roles].sort(), [...modules].sort(), [...featureFlags].sort(),
  ]);
  const [boundary, setBoundary] = useState({ scope, epoch: 0 });
  // Select a fresh occurrence before children commit. Credentials never become
  // React keys; returning to A after B cannot reuse A's retired client.
  if (scope !== boundary.scope) {
    setBoundary({ scope, epoch: boundary.epoch + 1 });
    return null;
  }
  return <QueryScope key={boundary.epoch}>{children}</QueryScope>;
}

/** Production composition: auth survives while all query consumers remount. */
export function AuthQueryProviders({ children }: PropsWithChildren) {
  return <AuthProvider><AuthQueryBoundary>{children}</AuthQueryBoundary></AuthProvider>;
}
