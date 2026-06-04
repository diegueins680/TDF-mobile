/**
 * useExperimentEvent.ts
 *
 * Hook for tracking experiment lifecycle events into the analytics
 * destination (PostHog, via AnalyticsProvider).
 *
 * The previous implementation posted to a non-existent
 * `/api/v1/events` backend endpoint and was effectively a no-op. It now
 * routes through the shared analytics client so experiment events show
 * up alongside every other product event.
 *
 * Usage:
 *   const { track } = useExperimentEvent();
 *   track('experiment_viewed', { experimentId: 'single-feature-onboarding-v1', variant: 'treatment_singlefeature' });
 *   track('experiment_converted', { experimentId: 'single-feature-onboarding-v1', variant: 'treatment_singlefeature', value: 1 });
 */
import { useCallback } from 'react';

import { useAnalytics } from '../analytics/AnalyticsProvider';

export interface ExperimentEventParams {
  experimentId: string;
  variant: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export function useExperimentEvent() {
  const analytics = useAnalytics();

  const track = useCallback(
    (event: string, params: ExperimentEventParams) => {
      analytics.capture(event, {
        experimentId: params.experimentId,
        variant: params.variant,
        userId: params.userId,
        ...params.metadata,
      });
    },
    [analytics]
  );

  return { track };
}
