/**
 * FirstRunProvider.tsx
 *
 * Owns the "is this user new?" derivation used by the
 * `single-feature-onboarding-v1` A/B test. Lives INSIDE AuthProvider so we
 * can observe partyId. Eligibility comes from the backend's account-bound
 * signup marker, survives device changes, and ends permanently on completion.
 */
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

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
import { useAnalytics } from '../analytics/AnalyticsProvider';
import {
  clearPendingFirstValueCompletion,
  completeFirstValueWithRecovery,
  retryPendingFirstValueCompletion,
} from '../lib/onboardingIntent';
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
};

const FirstRunContext = createContext<FirstRunContextValue>({
  cohortReady: false,
  isNewUser: false,
  completeOnboarding: async () => null,
});

export function FirstRunProvider({ children }: PropsWithChildren) {
  const { partyId, token } = useAuth();
  const { isConnected } = useNetwork();
  const analytics = useAnalytics();

  const [cohortReady, setCohortReady] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const stateGenerationRef = useRef(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setRetryTrigger((current) => current + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const generation = ++stateGenerationRef.current;
    if (!partyId || !token) {
      setCohortReady(true);
      setIsNewUser(false);
      return;
    }

    if (!isConnected) {
      setCohortReady(true);
      setIsNewUser(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setCohortReady(false);
      let isNew = false;
      let recoveredForAnalytics: Awaited<ReturnType<typeof retryPendingFirstValueCompletion>> = null;
      try {
        const binding = captureAuthSession(token);
        let progress = await getOnboardingProgress(authSessionRequestConfig(binding));
        assertAuthSession(binding);
        if (!progress.completedAt) {
          const recovered = await retryPendingFirstValueCompletion(partyId, token);
          assertAuthSession(binding);
          if (recovered) {
            progress = recovered.result.progress;
            if (recovered.result.newlyCompleted) recoveredForAnalytics = recovered;
          }
        } else {
          await clearPendingFirstValueCompletion(partyId, token);
          assertAuthSession(binding);
        }
        isNew = progress.eligible;
      } catch {
        // Fail closed: network errors and legacy servers must never classify
        // an established account as a new-user experiment participant.
      }
      if (cancelled || generation !== stateGenerationRef.current) return;
      if (recoveredForAnalytics) {
        analytics.capture('first_value_completed', {
          platform: 'mobile',
          value: recoveredForAnalytics.value,
        });
        analytics.capture('onboarding_completed', {
          platform: 'mobile',
          reason: 'first_value',
          value: recoveredForAnalytics.value,
        });
      }
      setIsNewUser(isNew);
      setCohortReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [analytics, isConnected, partyId, retryTrigger, token]);

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
      const result = firstValue
        ? await completeFirstValueWithRecovery(partyId, firstValue, token)
        : await completeOnboardingProgress(
          undefined,
          authSessionRequestConfig(binding),
        );
      if (!result) return null;
      assertAuthSession(binding);
      stateGenerationRef.current += 1;
      setIsNewUser(result.progress.eligible);
      setCohortReady(true);
      return result;
    } catch {
      try {
        assertAuthSession(binding);
        // A failed optional exit must not trap this app session. First-value
        // failures retain eligibility so the user can retry the real action.
        if (!firstValue) {
          stateGenerationRef.current += 1;
          setIsNewUser(false);
          setCohortReady(true);
        }
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
