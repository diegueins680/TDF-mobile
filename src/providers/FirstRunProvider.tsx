/**
 * FirstRunProvider.tsx
 *
 * Owns the "is this user new?" derivation used by the
 * `single-feature-onboarding-v1` A/B test. Lives INSIDE AuthProvider so we
 * can observe partyId. Eligibility comes from the backend's account-bound
 * signup marker, survives device changes, and ends permanently on completion.
 */
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import {
  completeOnboardingProgress,
  getOnboardingProgress,
  type OnboardingCompletionResult,
  type OnboardingFirstValue,
  type OnboardingProgress,
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
  const intentRecoveryRef = useRef<{
    partyId: string;
    promise: Promise<void>;
  } | null>(null);
  const firstValueRecoveryRef = useRef<{
    partyId: string;
    promise: Promise<RetriedFirstValueCompletion | null>;
  } | null>(null);
  const progressRecoveryRef = useRef<{
    partyId: string;
    promise: Promise<OnboardingProgress | null>;
  } | null>(null);
  const locallyExitedPartyIdRef = useRef<string | null>(null);
  const [state, setState] = useState<FirstRunState>({
    partyId: null,
    cohortReady: false,
    isNewUser: false,
    replayedFirstValueCompletion: null,
  });

  useEffect(() => {
    if (!partyId) {
      locallyExitedPartyIdRef.current = null;
      setState({
        partyId: null,
        cohortReady: true,
        isNewUser: false,
        replayedFirstValueCompletion: null,
      });
      return;
    }
    if (locallyExitedPartyIdRef.current !== partyId) {
      locallyExitedPartyIdRef.current = null;
    }

    let cancelled = false;
    const loadOnboardingProgress = (): Promise<OnboardingProgress | null> => {
      const activeRecovery = progressRecoveryRef.current;
      if (activeRecovery?.partyId === partyId) return activeRecovery.promise;

      const promise = getOnboardingProgress()
        .catch(() => null)
        .finally(() => {
          if (progressRecoveryRef.current?.promise === promise) {
            progressRecoveryRef.current = null;
          }
        });
      progressRecoveryRef.current = { partyId, promise };
      return promise;
    };
    const replayPendingIntent = (): Promise<void> => {
      const activeRecovery = intentRecoveryRef.current;
      if (activeRecovery?.partyId === partyId) return activeRecovery.promise;

      const promise = retryPendingOnboardingIntent(
        partyId,
        () => !cancelled && ownsParty(partyId),
      )
        .then(() => undefined)
        .catch(() => undefined)
        .finally(() => {
          if (intentRecoveryRef.current?.promise === promise) {
            intentRecoveryRef.current = null;
          }
        });
      intentRecoveryRef.current = { partyId, promise };
      return promise;
    };
    const replayPendingFirstValue = (): Promise<RetriedFirstValueCompletion | null> => {
      const activeRecovery = firstValueRecoveryRef.current;
      if (activeRecovery?.partyId === partyId) return activeRecovery.promise;

      const promise = retryPendingFirstValueCompletion(
        partyId,
        () => !cancelled && ownsParty(partyId),
      )
        .catch(() => null)
        .finally(() => {
          if (firstValueRecoveryRef.current?.promise === promise) {
            firstValueRecoveryRef.current = null;
          }
        });
      firstValueRecoveryRef.current = { partyId, promise };
      return promise;
    };
    const applyReplayedFirstValue = (replayed: RetriedFirstValueCompletion | null) => {
      if (!replayed || cancelled || !ownsParty(partyId)) return;
      setState((current) => current.partyId === partyId
        ? {
          ...current,
          cohortReady: true,
          isNewUser: locallyExitedPartyIdRef.current === partyId
            ? false
            : replayed.result.progress.eligible,
          replayedFirstValueCompletion: replayed,
        }
        : current);
    };
    const refreshFirstRunState = async (): Promise<void> => {
      const progressPromise = loadOnboardingProgress();
      const replayPromise = replayPendingFirstValue();
      void replayPromise.then(applyReplayedFirstValue);
      const [progress, replayed] = await Promise.all([progressPromise, replayPromise]);
      if (cancelled || !ownsParty(partyId)) return;
      setState((current) => {
        if (current.partyId !== partyId) return current;
        const effectiveReplay = replayed ?? current.replayedFirstValueCompletion;
        return {
          partyId,
          cohortReady: true,
          isNewUser: locallyExitedPartyIdRef.current === partyId
            ? false
            : effectiveReplay?.result.progress.eligible
              ?? progress?.eligible
              ?? false,
          replayedFirstValueCompletion: effectiveReplay,
        };
      });
    };

    setState({
      partyId,
      cohortReady: false,
      isNewUser: false,
      replayedFirstValueCompletion: null,
    });
    void replayPendingIntent();
    void refreshFirstRunState();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      void replayPendingIntent();
      void refreshFirstRunState();
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [ownsParty, partyId]);

  const completeOnboarding = useCallback(async (
    firstValue?: OnboardingFirstValue,
  ): Promise<OnboardingCompletionResult | null> => {
    const ownerPartyId = partyId;
    if (!ownerPartyId || !ownsParty(ownerPartyId)) return null;
    locallyExitedPartyIdRef.current = ownerPartyId;
    setState((current) => current.partyId === ownerPartyId
      ? { ...current, isNewUser: false }
      : current);
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
