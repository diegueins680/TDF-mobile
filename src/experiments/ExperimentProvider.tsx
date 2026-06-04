/**
 * ExperimentProvider.tsx
 *
 * React Context for A/B testing in tdf-mobile.
 * Assigns users to experiment variants and persists in AsyncStorage.
 *
 * Usage:
 *   const { getVariant } = useExperiments();
 *   const variant = getVariant('streak-counter-v1'); // 'control' | 'treatment'
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getAnalyticsClient } from '../analytics/posthog';

export type ExperimentVariant = 'control' | 'treatment' | string;

interface ExperimentConfig {
  id: string;
  variants: ExperimentVariant[];
  weights?: number[]; // Must sum to 1, defaults to equal
}

interface ExperimentContextType {
  getVariant: (experimentId: string) => ExperimentVariant | null;
  isReady: boolean;
}

const ExperimentContext = createContext<ExperimentContextType>({
  getVariant: () => null,
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
    variants: ['control', 'treatment_singlefeature'],
    weights: [0.5, 0.5],
  },
];

const STORAGE_KEY = '@experiments:variants';

function assignVariant(experiment: ExperimentConfig): ExperimentVariant {
  const weights = experiment.weights ||
    Array(experiment.variants.length).fill(1 / experiment.variants.length);

  const random = Math.random();
  let cumulative = 0;

  for (let i = 0; i < experiment.variants.length; i++) {
    cumulative += weights[i];
    if (random <= cumulative) {
      return experiment.variants[i];
    }
  }

  return experiment.variants[0];
}

export const ExperimentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [variants, setVariants] = useState<Record<string, ExperimentVariant>>({});
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        // Load existing assignments
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const existing: Record<string, ExperimentVariant> = stored ? JSON.parse(stored) : {};

        // Assign new variants for experiments not yet seen, and emit an
        // analytics event for each *new* assignment so PostHog dashboards
        // can bucket downstream events by variant.
        const updated = { ...existing };
        const analytics = getAnalyticsClient();
        for (const exp of ACTIVE_EXPERIMENTS) {
          if (!updated[exp.id]) {
            const assigned = assignVariant(exp);
            updated[exp.id] = assigned;
            analytics.capture('experiment_assigned', {
              experimentId: exp.id,
              variant: assigned,
              source: 'client_local',
            });
          }
        }

        // Save updated assignments
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        setVariants(updated);
      } catch (err) {
        console.error('Experiment init failed:', err);
      } finally {
        setIsReady(true);
      }
    }

    init();
  }, []);

  const getVariant = (experimentId: string): ExperimentVariant | null => {
    return variants[experimentId] || null;
  };

  return (
    <ExperimentContext.Provider value={{ getVariant, isReady }}>
      {children}
    </ExperimentContext.Provider>
  );
};

export const useExperiments = () => useContext(ExperimentContext);
