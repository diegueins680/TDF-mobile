/**
 * FirstRunProvider.tsx
 *
 * Owns the "is this user new?" derivation used by the
 * `single-feature-onboarding-v1` A/B test. Lives INSIDE AuthProvider so we
 * can observe partyId. Eligibility comes from the backend's account-bound
 * signup marker, survives device changes, and ends permanently on completion.
 */
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import {
  completeOnboardingProgress,
  getOnboardingProgress,
  type OnboardingCompletionResult,
  type OnboardingFirstValue,
} from '../api/onboarding';
import {
  completeFirstValueWithRetry,
  retryPendingFirstValueCompletion,
  type RetriedFirstValueCompletion,
} from '../lib/onboardingIntent';
import { useAuth } from './AuthProvider';

type FirstRunContextValue = {
  /** True once we've resolved the cohort for the active partyId (or there is none). */
  cohortReady: boolean;
  /** Whether the active partyId qualifies as a brand-new user. */
  isNewUser: boolean;
  completeOnboarding: (
    firstValue?: OnboardingFirstValue,
  ) => Promise<OnboardingCompletionResult | null>;
  replayedFirstValueCompletion: RetriedFirstValueCompletion | null;
};

const FirstRunContext = createContext<FirstRunContextValue>({
  cohortReady: false,
  isNewUser: false,
  completeOnboarding: async () => null,
  replayedFirstValueCompletion: null,
});

export function FirstRunProvider({ children }: PropsWithChildren) {
  const { partyId } = useAuth();
  const activePartyIdRef = useRef(partyId);
  activePartyIdRef.current = partyId;

  const [cohortReady, setCohortReady] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [replayedFirstValueCompletion, setReplayedFirstValueCompletion] =
    useState<RetriedFirstValueCompletion | null>(null);

  useEffect(() => {
    if (!partyId) {
      setCohortReady(true);
      setIsNewUser(false);
      setReplayedFirstValueCompletion(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setCohortReady(false);
      setReplayedFirstValueCompletion(null);
      let isNew = false;
      try {
        const progress = await getOnboardingProgress();
        if (cancelled) return;
        const replayed = await retryPendingFirstValueCompletion(
          partyId,
          () => activePartyIdRef.current === partyId,
        );
        if (cancelled) return;
        setReplayedFirstValueCompletion(replayed);
        isNew = replayed?.result.progress.eligible ?? progress.eligible;
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
      return firstValue
        ? await completeFirstValueWithRetry(
          partyId,
          firstValue,
          () => activePartyIdRef.current === partyId,
        )
        : await completeOnboardingProgress();
    } catch {
      // Leaving optional onboarding must not trap the current app session.
      return null;
    } finally {
      setIsNewUser(false);
    }
  }, [partyId]);

  return (
    <FirstRunContext.Provider value={{
      cohortReady,
      isNewUser,
      completeOnboarding,
      replayedFirstValueCompletion,
    }}>
      {children}
    </FirstRunContext.Provider>
  );
}

export function useFirstRun(): FirstRunContextValue {
  return useContext(FirstRunContext);
}
