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
  reconcileOnboardingProgress,
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
  const reconciliationInFlightRef = useRef<{
    sessionKey: string;
    request: Promise<OnboardingCompletionResult>;
  } | null>(null);

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
      let reconciledFirstValue: OnboardingFirstValue | null = null;
      try {
        const binding = captureAuthSession(token);
        const sessionKey = `${partyId}:${binding.version}`;
        let inFlight = reconciliationInFlightRef.current;
        if (!inFlight || inFlight.sessionKey !== sessionKey) {
          const request = reconcileOnboardingProgress(authSessionRequestConfig(binding));
          inFlight = { sessionKey, request };
          reconciliationInFlightRef.current = inFlight;
          void request.then(
            () => {
              if (reconciliationInFlightRef.current?.request === request) {
                reconciliationInFlightRef.current = null;
              }
            },
            () => {
              if (reconciliationInFlightRef.current?.request === request) {
                reconciliationInFlightRef.current = null;
              }
            },
          );
        }
        const result = await inFlight.request;
        assertAuthSession(binding);
        const progress = result.progress;
        if (progress.completedAt) {
          await clearPendingFirstValueCompletion(partyId, token);
          assertAuthSession(binding);
        }
        if (result.newlyCompleted && progress.firstValue) {
          reconciledFirstValue = progress.firstValue;
        }
        isNew = progress.eligible;
      } catch {
        // Fail closed: network errors and legacy servers must never classify
        // an established account as a new-user experiment participant.
      }
      if (cancelled || generation !== stateGenerationRef.current) return;
      if (reconciledFirstValue) {
        analytics.capture('first_value_completed', {
          platform: 'mobile',
          value: reconciledFirstValue,
        });
        analytics.capture('onboarding_completed', {
          platform: 'mobile',
          reason: 'first_value',
          value: reconciledFirstValue,
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
      const sessionKey = `${partyId}:${binding.version}`;
      const inFlight = reconciliationInFlightRef.current;
      if (inFlight?.sessionKey === sessionKey) {
        try {
          const reconciled = await inFlight.request;
          assertAuthSession(binding);
          if (reconciled.progress.completedAt) {
            // The provider hydration path owns analytics for this response.
            // Returning a non-winning result prevents a direct caller from
            // emitting the same completion a second time.
            return { ...reconciled, newlyCompleted: false };
          }
        } catch {
          assertAuthSession(binding);
          // A failed reconciliation must not block the direct handshake.
        }
      }
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
