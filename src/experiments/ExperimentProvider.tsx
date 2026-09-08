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

import React, { createContext, useContext, useEffect, useState } from 'react';

import { getAnalyticsClient } from '../analytics/posthog';
import { getExperimentAssignment } from '../api/experiments';
import { useAuth } from '../providers/AuthProvider';

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
  const [variants, setVariants] = useState<Record<string, ExperimentVariant>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [resolvedPartyId, setResolvedPartyId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!partyId) {
        setVariants({});
        setEnabled({});
        setResolvedPartyId(null);
        setIsReady(true);
        return;
      }
      setIsReady(false);
      const nextVariants: Record<string, ExperimentVariant> = {};
      const nextEnabled: Record<string, boolean> = {};
      try {
        const analytics = getAnalyticsClient();
        for (const exp of ACTIVE_EXPERIMENTS) {
          const assignment = await getExperimentAssignment(exp.id);
          if (cancelled) return;
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
      } catch (err) {
        if (!cancelled) console.error('Experiment init failed:', err);
      } finally {
        if (!cancelled) {
          setVariants(nextVariants);
          setEnabled(nextEnabled);
          setResolvedPartyId(partyId);
          setIsReady(true);
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [partyId]);

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
