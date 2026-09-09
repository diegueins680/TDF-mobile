import {
  recordExperimentExposure,
  type ExperimentExposureResult,
} from '../api/experiments';

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
