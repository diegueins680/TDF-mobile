/**
 * ExperimentProvider.tsx
 *
 * React Context for A/B testing in tdf-mobile.
 * Loads server-authoritative, Party-bound experiment assignments.
 *
 * Usage:
 *   const { getVariant } = useExperiments();
 *   const variant = getVariant('streak-counter-v1'); // 'control' | 'treatment'
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getAnalyticsClient } from '../analytics/posthog';
import { getExperimentAssignment } from '../api/experiments';
import { usePartyOwnership } from '../hooks/usePartyOwnership';
import { useAuth } from '../providers/AuthProvider';
import { useNetwork } from '../providers/NetworkProvider';

export type ExperimentVariant = 'control' | 'treatment' | string;

interface ExperimentConfig {
  id: string;
}

interface ExperimentContextType {
  getVariant: (experimentId: string) => ExperimentVariant | null;
  isExperimentEnabled: (experimentId: string) => boolean;
  isReady: boolean;
}

const ExperimentContext = createContext<ExperimentContextType>({
  getVariant: () => null,
  isExperimentEnabled: () => false,
  isReady: false,
});

// Define active experiments here
const ACTIVE_EXPERIMENTS: ExperimentConfig[] = [
  {
    // Single-feature onboarding test: show brand-new users only Event
    // Moments + reactions instead of the full app surface. Hypothesis: a
    // tighter first-run focus improves D1 activation (first reaction
    // within 24h of signup).
    id: 'single-feature-onboarding-v1',
    // The backend rollout flag remains false until activation is explicitly approved.
  },
];

export const ExperimentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { partyId } = useAuth();
  const { isConnected } = useNetwork();
  const ownsParty = usePartyOwnership(partyId);
  const recoveryTriggerRef = useRef<(() => void) | null>(null);
  const previousConnectivityRef = useRef(isConnected);
  const assignmentRecoveryRef = useRef<{
    partyId: string;
    promise: Promise<void>;
  } | null>(null);
  const [variants, setVariants] = useState<Record<string, ExperimentVariant>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [resolvedPartyId, setResolvedPartyId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!partyId) {
      recoveryTriggerRef.current = null;
      setVariants({});
      setEnabled({});
      setResolvedPartyId(null);
      setIsReady(true);
      return;
    }

    let cancelled = false;
    const recoverAssignments = (): Promise<void> => {
      const activeRecovery = assignmentRecoveryRef.current;
      if (activeRecovery?.partyId === partyId) return activeRecovery.promise;

      const nextVariants: Record<string, ExperimentVariant> = {};
      const nextEnabled: Record<string, boolean> = {};
      let succeeded = false;
      const promise = (async () => {
        try {
          const analytics = getAnalyticsClient();
          for (const exp of ACTIVE_EXPERIMENTS) {
            const assignment = await getExperimentAssignment(exp.id);
            if (cancelled || !ownsParty(partyId)) return;
            nextVariants[exp.id] = assignment.variant;
            nextEnabled[exp.id] = assignment.experimentEnabled && assignment.experimentEligible;
            if (assignment.newlyAssigned) {
              analytics.capture('experiment_assigned', {
                experimentId: exp.id,
                experimentVersion: assignment.experimentVersion,
                variant: assignment.variant,
                source: 'authenticated_identity_server',
              });
            }
          }
          succeeded = true;
        } catch (err) {
          if (!cancelled && ownsParty(partyId)) console.error('Experiment init failed:', err);
        }
        if (cancelled || !ownsParty(partyId)) return;
        setVariants(succeeded ? nextVariants : {});
        setEnabled(succeeded ? nextEnabled : {});
        setResolvedPartyId(partyId);
        setIsReady(true);
      })().finally(() => {
        if (assignmentRecoveryRef.current?.promise === promise) {
          assignmentRecoveryRef.current = null;
        }
      });
      assignmentRecoveryRef.current = { partyId, promise };
      return promise;
    };
    const recover = () => {
      void recoverAssignments();
    };

    setVariants({});
    setEnabled({});
    setResolvedPartyId(null);
    setIsReady(false);
    recoveryTriggerRef.current = recover;
    recover();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') recover();
    });
    return () => {
      cancelled = true;
      if (recoveryTriggerRef.current === recover) {
        recoveryTriggerRef.current = null;
      }
      subscription.remove();
    };
  }, [ownsParty, partyId]);

  useEffect(() => {
    const wasConnected = previousConnectivityRef.current;
    previousConnectivityRef.current = isConnected;
    if (!wasConnected && isConnected) recoveryTriggerRef.current?.();
  }, [isConnected]);

  const identityReady = isReady && resolvedPartyId === partyId;

  const getVariant = (experimentId: string): ExperimentVariant | null =>
    identityReady ? variants[experimentId] || null : null;

  const isExperimentEnabled = (experimentId: string): boolean =>
    identityReady && enabled[experimentId] === true;

  return (
    <ExperimentContext.Provider value={{ getVariant, isExperimentEnabled, isReady: identityReady }}>
      {children}
    </ExperimentContext.Provider>
  );
};

export const useExperiments = () => useContext(ExperimentContext);
