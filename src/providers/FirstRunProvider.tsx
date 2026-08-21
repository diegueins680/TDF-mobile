/**
 * FirstRunProvider.tsx
 *
 * Owns the "is this user new?" derivation used by the
 * `single-feature-onboarding-v1` A/B test. Lives INSIDE AuthProvider so we
 * can observe partyId. Eligibility is tied to a successful signup timestamp,
 * expires after 24 hours, and ends permanently when onboarding completes.
 */
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useState } from 'react';

import { markNewUserOnboardingCompleted, resolveNewUserCohort } from '../lib/firstRunFlags';
import { useAuth } from './AuthProvider';

type FirstRunContextValue = {
  /** True once we've resolved the cohort for the active partyId (or there is none). */
  cohortReady: boolean;
  /** Whether the active partyId qualifies as a brand-new user. */
  isNewUser: boolean;
  completeOnboarding: () => Promise<void>;
};

const FirstRunContext = createContext<FirstRunContextValue>({
  cohortReady: false,
  isNewUser: false,
  completeOnboarding: async () => undefined,
});

export function FirstRunProvider({ children }: PropsWithChildren) {
  const { partyId } = useAuth();

  const [cohortReady, setCohortReady] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    if (!partyId) {
      setCohortReady(true);
      setIsNewUser(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setCohortReady(false);
      const isNew = await resolveNewUserCohort(partyId);
      if (cancelled) return;
      setIsNewUser(isNew);
      setCohortReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [partyId]);

  const completeOnboarding = useCallback(async () => {
    if (!partyId) return;
    await markNewUserOnboardingCompleted(partyId);
    setIsNewUser(false);
  }, [partyId]);

  return (
    <FirstRunContext.Provider value={{ cohortReady, isNewUser, completeOnboarding }}>
      {children}
    </FirstRunContext.Provider>
  );
}

export function useFirstRun(): FirstRunContextValue {
  return useContext(FirstRunContext);
}
