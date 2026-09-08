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
import {
  assertAuthSession,
  authSessionRequestConfig,
  captureAuthSession,
  type AuthSessionBinding,
} from '../api/client';
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
  const { partyId, token } = useAuth();

  const [cohortReady, setCohortReady] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    if (!partyId || !token) {
      setCohortReady(true);
      setIsNewUser(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setCohortReady(false);
      let isNew = false;
      try {
        const binding = captureAuthSession(token);
        const progress = await getOnboardingProgress(authSessionRequestConfig(binding));
        assertAuthSession(binding);
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
  }, [partyId, token]);

  const completeOnboarding = useCallback(async (
    firstValue?: OnboardingFirstValue,
  ): Promise<OnboardingCompletionResult | null> => {
    if (!partyId || !token) return null;
    let binding: AuthSessionBinding;
    try {
      binding = captureAuthSession(token);
    } catch {
      return null;
    }
    try {
      const result = await completeOnboardingProgress(
        firstValue,
        authSessionRequestConfig(binding),
      );
      assertAuthSession(binding);
      setIsNewUser(result.progress.eligible);
      return result;
    } catch {
      try {
        assertAuthSession(binding);
        // A failed optional exit must not trap this app session. First-value
        // failures retain eligibility so the user can retry the real action.
        if (!firstValue) setIsNewUser(false);
      } catch {
        // A replaced session owns its own eligibility state.
      }
      return null;
    }
  }, [partyId, token]);

  return (
    <FirstRunContext.Provider value={{ cohortReady, isNewUser, completeOnboarding }}>
      {children}
    </FirstRunContext.Provider>
  );
}

export function useFirstRun(): FirstRunContextValue {
  return useContext(FirstRunContext);
}
