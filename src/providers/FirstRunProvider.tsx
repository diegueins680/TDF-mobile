/**
 * FirstRunProvider.tsx
 *
 * Owns the "is this user new?" derivation used by the
 * `single-feature-onboarding-v1` A/B test. Lives INSIDE AuthProvider so we
 * can observe partyId. Eligibility comes from the backend's account-bound
 * signup marker, survives device changes, and ends permanently on completion.
 */
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useState } from 'react';

import {
  completeOnboardingProgress,
  getOnboardingProgress,
  type OnboardingCompletionResult,
  type OnboardingFirstValue,
} from '../api/onboarding';
import { useAuth } from './AuthProvider';

type FirstRunContextValue = {
  /** True once we've resolved the cohort for the active partyId (or there is none). */
  cohortReady: boolean;
  /** Whether the active partyId qualifies as a brand-new user. */
  isNewUser: boolean;
  completeOnboarding: (
    firstValue?: OnboardingFirstValue,
  ) => Promise<OnboardingCompletionResult | null>;
};

const FirstRunContext = createContext<FirstRunContextValue>({
  cohortReady: false,
  isNewUser: false,
  completeOnboarding: async () => null,
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
      let isNew = false;
      try {
        const progress = await getOnboardingProgress();
        isNew = progress.eligible;
      } catch {
        // Fail closed: network errors and legacy servers must never classify
        // an established account as a new-user experiment participant.
      }
      if (cancelled) return;
      setIsNewUser(isNew);
      setCohortReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [partyId]);

  const completeOnboarding = useCallback(async (
    firstValue?: OnboardingFirstValue,
  ): Promise<OnboardingCompletionResult | null> => {
    if (!partyId) return null;
    try {
      return await completeOnboardingProgress(firstValue);
    } catch {
      // Leaving optional onboarding must not trap the current app session.
      return null;
    } finally {
      setIsNewUser(false);
    }
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
