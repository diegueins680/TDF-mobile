import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  recordExperimentExposure,
  type ExperimentExposureResult,
} from '../api/experiments';
import type { OnboardingFirstValue } from '../api/onboarding';

export const PENDING_EXPERIMENT_CONVERSION_PREFIX =
  'tdf-onboarding-experiment-conversion:party:';

export type PendingExperimentConversion = {
  experimentId: string;
  experimentVersion: number;
  variant: string;
  firstValue: OnboardingFirstValue;
};

const FIRST_VALUES = new Set<OnboardingFirstValue>([
  'artist_followed',
  'access_requested',
  'event_saved',
  'moment_reaction',
]);

const pendingExperimentConversionKey = (
  partyId: string,
  experimentId: string,
): string => `${PENDING_EXPERIMENT_CONVERSION_PREFIX}${encodeURIComponent(partyId)}:${encodeURIComponent(experimentId)}`;

const parsePendingExperimentConversion = (
  raw: string | null,
  experimentId: string,
): PendingExperimentConversion | null => {
  if (!raw) return null;
  try {
    const candidate = JSON.parse(raw) as Partial<PendingExperimentConversion>;
    if (
      candidate.experimentId !== experimentId
      || typeof candidate.experimentVersion !== 'number'
      || !Number.isInteger(candidate.experimentVersion)
      || candidate.experimentVersion < 1
      || typeof candidate.variant !== 'string'
      || !candidate.variant.trim()
      || typeof candidate.firstValue !== 'string'
      || !FIRST_VALUES.has(candidate.firstValue as OnboardingFirstValue)
    ) return null;
    return {
      experimentId: candidate.experimentId,
      experimentVersion: candidate.experimentVersion,
      variant: candidate.variant,
      firstValue: candidate.firstValue as OnboardingFirstValue,
    };
  } catch {
    return null;
  }
};

export async function persistPendingExperimentConversion(
  rawPartyId: string | null | undefined,
  conversion: PendingExperimentConversion,
  stillOwnsParty: () => boolean = () => true,
): Promise<boolean> {
  const partyId = rawPartyId?.trim();
  if (!partyId || !stillOwnsParty()) return false;
  try {
    await AsyncStorage.setItem(
      pendingExperimentConversionKey(partyId, conversion.experimentId),
      JSON.stringify(conversion),
    );
    return stillOwnsParty();
  } catch {
    return false;
  }
}

export async function readPendingExperimentConversion(
  rawPartyId: string | null | undefined,
  experimentId: string,
  stillOwnsParty: () => boolean = () => true,
): Promise<PendingExperimentConversion | null> {
  const partyId = rawPartyId?.trim();
  if (!partyId || !experimentId || !stillOwnsParty()) return null;
  const key = pendingExperimentConversionKey(partyId, experimentId);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!stillOwnsParty()) return null;
    const conversion = parsePendingExperimentConversion(raw, experimentId);
    if (raw && !conversion && stillOwnsParty()) {
      await AsyncStorage.removeItem(key);
    }
    return stillOwnsParty() ? conversion : null;
  } catch {
    return null;
  }
}

export async function clearPendingExperimentConversionIfCurrent(
  rawPartyId: string | null | undefined,
  conversion: PendingExperimentConversion,
  stillOwnsParty: () => boolean = () => true,
): Promise<void> {
  const partyId = rawPartyId?.trim();
  if (!partyId || !stillOwnsParty()) return;
  const key = pendingExperimentConversionKey(partyId, conversion.experimentId);
  try {
    if (
      stillOwnsParty()
      && await AsyncStorage.getItem(key) === JSON.stringify(conversion)
      && stillOwnsParty()
    ) {
      await AsyncStorage.removeItem(key);
    }
  } catch {
    // A later lifecycle pass can safely retry the idempotent reconciliation.
  }
}

export async function markExperimentExposedOnce(
  partyId: string,
  experimentId: string,
): Promise<ExperimentExposureResult | null> {
  if (!partyId || !experimentId) return null;
  try {
    return await recordExperimentExposure(experimentId);
  } catch {
    return null;
  }
}
