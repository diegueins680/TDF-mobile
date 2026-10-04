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
  reconcileOnboardingProgress,
  type OnboardingCompletionResult,
  type OnboardingFirstValue,
  type OnboardingProgress,
} from '../api/onboarding';
import {
  isOnboardingFirstValue,
  completeOnboardingExitWithRetry,
  completeFirstValueWithRetry,
  retryPendingOnboardingIntent,
  retryPendingOnboardingExit,
  retryPendingFirstValueCompletion,
  type RetriedFirstValueCompletion,
  type RetriedOnboardingExit,
} from '../lib/onboardingIntent';
import { assertAuthSession, authSessionRequestConfig, captureAuthSession, getAuthToken } from '../api/client';
import { useAnalytics } from '../analytics/AnalyticsProvider';
import { readPendingExperimentConversion } from '../lib/firstRunFlags';
import { usePartyOwnership } from '../hooks/usePartyOwnership';
import { useAuth } from './AuthProvider';
import { useNetwork } from './NetworkProvider';

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
  const { isConnected } = useNetwork();
  const ownsParty = usePartyOwnership(partyId);
  const analytics = useAnalytics();
  const recoveryTriggerRef = useRef<(() => void) | null>(null);
  const previousConnectivityRef = useRef(isConnected);
  const intentRecoveryRef = useRef<{
    partyId: string;
    promise: Promise<void>;
  } | null>(null);
  const firstValueRecoveryRef = useRef<{
    partyId: string;
    promise: Promise<RetriedFirstValueCompletion | null>;
  } | null>(null);
  const exitRecoveryRef = useRef<{
    partyId: string;
    promise: Promise<RetriedOnboardingExit | null>;
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
      recoveryTriggerRef.current = null;
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

    // Session replacement must not share an older account request, even if
    // the Party id is reused after a token refresh or A -> B -> A transition.
    progressRecoveryRef.current = null;
    firstValueRecoveryRef.current = null;
    exitRecoveryRef.current = null;
    intentRecoveryRef.current = null;
    let cancelled = false;
    const captureReconciledCompletion = async (result: OnboardingCompletionResult) => {
      const value = result.progress.firstValue;
      if (!result.newlyCompleted || !isOnboardingFirstValue(value)) return;
      const pendingConversion = await readPendingExperimentConversion(
        partyId, 'single-feature-onboarding-v1', () => !cancelled && ownsParty(partyId),
      );
      // A matching durable experiment queue owns its conversion and first-value
      // analytics. Other winning completions are attributed by this request once.
      if (!cancelled && ownsParty(partyId) && pendingConversion?.firstValue !== value) {
        analytics.capture('first_value_completed', { platform: 'mobile', value });
        analytics.capture('onboarding_completed', { platform: 'mobile', reason: 'first_value', value });
      }
    };
    const loadOnboardingProgress = (): Promise<OnboardingProgress | null> => {
      const activeRecovery = progressRecoveryRef.current;
      if (activeRecovery?.partyId === partyId) return activeRecovery.promise;

      const promise = (async () => {
        const binding = captureAuthSession(getAuthToken());
        const result = await reconcileOnboardingProgress(authSessionRequestConfig(binding));
        assertAuthSession(binding);
        await captureReconciledCompletion(result);
        return result.progress;
      })()
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
        .then(async (replayed) => {
          if (replayed) await captureReconciledCompletion(replayed.result);
          return replayed;
        })
        .catch(() => null)
        .finally(() => {
          if (firstValueRecoveryRef.current?.promise === promise) {
            firstValueRecoveryRef.current = null;
          }
        });
      firstValueRecoveryRef.current = { partyId, promise };
      return promise;
    };
    const replayPendingExit = (): Promise<RetriedOnboardingExit | null> => {
      const activeRecovery = exitRecoveryRef.current;
      if (activeRecovery?.partyId === partyId) return activeRecovery.promise;

      const promise = retryPendingOnboardingExit(
        partyId,
        () => !cancelled && ownsParty(partyId),
      )
        .catch(() => null)
        .finally(() => {
          if (exitRecoveryRef.current?.promise === promise) {
            exitRecoveryRef.current = null;
          }
        });
      exitRecoveryRef.current = { partyId, promise };
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
      const exitPromise = replayPendingExit();
      void Promise.all([replayPromise, exitPromise]).then(([replayed, recoveredExit]) => {
        if (recoveredExit && !cancelled && ownsParty(partyId)) {
          locallyExitedPartyIdRef.current = partyId;
          setState((current) => current.partyId === partyId
            ? { ...current, cohortReady: true, isNewUser: false }
            : current);
          return;
        }
        applyReplayedFirstValue(replayed);
      });
      const [progress, replayed, recoveredExit] = await Promise.all([
        progressPromise,
        replayPromise,
        exitPromise,
      ]);
      if (cancelled || !ownsParty(partyId)) return;
      if (recoveredExit) locallyExitedPartyIdRef.current = partyId;
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
    const recoverFirstRun = () => {
      void replayPendingIntent();
      void refreshFirstRunState();
    };

    setState({
      partyId,
      cohortReady: false,
      isNewUser: false,
      replayedFirstValueCompletion: null,
    });
    recoveryTriggerRef.current = recoverFirstRun;
    recoverFirstRun();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      recoverFirstRun();
    });

    return () => {
      cancelled = true;
      if (recoveryTriggerRef.current === recoverFirstRun) {
        recoveryTriggerRef.current = null;
      }
      subscription.remove();
    };
  }, [analytics, ownsParty, partyId]);

  useEffect(() => {
    const wasConnected = previousConnectivityRef.current;
    previousConnectivityRef.current = isConnected;
    if (!wasConnected && isConnected) recoveryTriggerRef.current?.();
  }, [isConnected]);

  const completeOnboarding = useCallback(async (
    firstValue?: OnboardingFirstValue,
  ): Promise<OnboardingCompletionResult | null> => {
    const ownerPartyId = partyId;
    if (!ownerPartyId || !ownsParty(ownerPartyId)) return null;
    if (!firstValue) {
      locallyExitedPartyIdRef.current = ownerPartyId;
      setState((current) => current.partyId === ownerPartyId
        ? { ...current, isNewUser: false } : current);
    }
    try {
      const activeProgress = progressRecoveryRef.current;
      if (firstValue && activeProgress?.partyId === ownerPartyId) {
        const progress = await activeProgress.promise;
        if (!ownsParty(ownerPartyId)) return null;
        if (progress?.completedAt) return { progress, newlyCompleted: false };
      }
      const result = firstValue
        ? await completeFirstValueWithRetry(
          ownerPartyId,
          firstValue,
          () => ownsParty(ownerPartyId),
        )
        : await completeOnboardingExitWithRetry(
          ownerPartyId,
          () => ownsParty(ownerPartyId),
        );
      if (!ownsParty(ownerPartyId)) return null;
      if (firstValue && result) {
        // A concurrent server-evidenced action may win with a different value.
        // The caller owns analytics for its requested value only.
        const actualValue = result.progress.firstValue;
        if (result.newlyCompleted && isOnboardingFirstValue(actualValue) && actualValue !== firstValue) {
          const conversion = await readPendingExperimentConversion(
            ownerPartyId, 'single-feature-onboarding-v1', () => ownsParty(ownerPartyId),
          );
          if (!ownsParty(ownerPartyId)) return null;
          if (conversion?.firstValue !== actualValue) {
            analytics.capture('first_value_completed', { platform: 'mobile', value: actualValue });
            analytics.capture('onboarding_completed', { platform: 'mobile', reason: 'first_value', value: actualValue });
          }
        }
        setState((current) => current.partyId === ownerPartyId
          ? { ...current, cohortReady: true, isNewUser: result.progress.eligible } : current);
      }
      return result;
    } catch {
      // Leaving optional onboarding must not trap the current app session.
      return null;
    } finally {
      if (!firstValue && ownsParty(ownerPartyId)) {
        setState((current) => current.partyId === ownerPartyId
          ? { ...current, isNewUser: false }
          : current);
      }
    }
  }, [analytics, ownsParty, partyId]);

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
