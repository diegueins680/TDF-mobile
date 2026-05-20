/**
 * useExperimentEvent.ts
 *
 * Hook for tracking experiment events.
 * Sends events to backend analytics endpoint.
 *
 * Usage:
 *   const { track } = useExperimentEvent();
 *   track('experiment_viewed', { experimentId: 'streak-counter-v1', variant: 'treatment' });
 *   track('experiment_converted', { experimentId: 'streak-counter-v1', variant: 'treatment', value: 1 });
 */

import { useCallback } from 'react';

interface EventPayload {
  event: string;
  experimentId: string;
  variant: string;
  timestamp: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:8080';

export function useExperimentEvent() {
  const track = useCallback(async (
    event: string,
    params: {
      experimentId: string;
      variant: string;
      userId?: string;
      metadata?: Record<string, unknown>;
    }
  ) => {
    const payload: EventPayload = {
      event,
      experimentId: params.experimentId,
      variant: params.variant,
      timestamp: new Date().toISOString(),
      userId: params.userId,
      metadata: params.metadata,
    };

    try {
      // Fire-and-forget to avoid blocking UI
      fetch(`${API_BASE}/api/v1/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(err => {
        // Silently fail — analytics should never crash the app
        console.warn('Experiment event failed:', err);
      });
    } catch (err) {
      console.warn('Experiment event tracking error:', err);
    }
  }, []);

  return { track };
}
