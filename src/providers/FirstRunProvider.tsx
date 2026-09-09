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
  completeFirstValueWithRetry,
  retryPendingOnboardingIntent,
  retryPendingFirstValueCompletion,
  type RetriedFirstValueCompletion,
} from '../lib/onboardingIntent';
import { usePartyOwnership } from '../hooks/usePartyOwnership';
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

type FirstRunState = {
  partyId: string | null;
  cohortReady: boolean;
  isNewUser: boolean;
  replayedFirstValueCompletion: RetriedFirstValueCompletion | null;
};

export function FirstRunProvider({ children }: PropsWithChildren) {
  const { partyId } = useAuth();
  const ownsParty = usePartyOwnership(partyId);
  const [state, setState] = useState<FirstRunState>({
    partyId: null,
    cohortReady: false,
    isNewUser: false,
    replayedFirstValueCompletion: null,
  });

  useEffect(() => {
    if (!partyId) {
      setState({
        partyId: null,
        cohortReady: true,
        isNewUser: false,
        replayedFirstValueCompletion: null,
      });
      return;
    }

    let cancelled = false;
    setState({
      partyId,
      cohortReady: false,
      isNewUser: false,
      replayedFirstValueCompletion: null,
    });
    (async () => {
      let isNew = false;
      let replayed: RetriedFirstValueCompletion | null = null;
      void retryPendingOnboardingIntent(
        partyId,
        () => !cancelled && ownsParty(partyId),
      );
      try {
        const progress = await getOnboardingProgress();
        if (cancelled || !ownsParty(partyId)) return;
        replayed = await retryPendingFirstValueCompletion(
          partyId,
          () => ownsParty(partyId),
        );
        if (cancelled || !ownsParty(partyId)) return;
        isNew = replayed?.result.progress.eligible ?? progress.eligible;
      } catch {
        // Fail closed: network errors and legacy servers must never classify
        // an established account as a new-user experiment participant.
      }
      if (cancelled || !ownsParty(partyId)) return;
      setState({
        partyId,
        cohortReady: true,
        isNewUser: isNew,
        replayedFirstValueCompletion: replayed,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [ownsParty, partyId]);

  const completeOnboarding = useCallback(async (
    firstValue?: OnboardingFirstValue,
  ): Promise<OnboardingCompletionResult | null> => {
    const ownerPartyId = partyId;
    if (!ownerPartyId || !ownsParty(ownerPartyId)) return null;
    try {
      const result = firstValue
        ? await completeFirstValueWithRetry(
          ownerPartyId,
          firstValue,
          () => ownsParty(ownerPartyId),
        )
        : await completeOnboardingProgress();
      return ownsParty(ownerPartyId) ? result : null;
    } catch {
      // Leaving optional onboarding must not trap the current app session.
      return null;
    } finally {
      if (ownsParty(ownerPartyId)) {
        setState((current) => current.partyId === ownerPartyId
          ? { ...current, isNewUser: false }
          : current);
      }
    }
  }, [ownsParty, partyId]);

  const stateIsCurrent = state.partyId === partyId;

  return (
    <FirstRunContext.Provider value={{
      cohortReady: stateIsCurrent && state.cohortReady,
      isNewUser: stateIsCurrent && state.isNewUser,
      completeOnboarding,
      replayedFirstValueCompletion: stateIsCurrent
        ? state.replayedFirstValueCompletion
        : null,
    }}>
      {children}
    </FirstRunContext.Provider>
  );
}

export function useFirstRun(): FirstRunContextValue {
  return useContext(FirstRunContext);
}
