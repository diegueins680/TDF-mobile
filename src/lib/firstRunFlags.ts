import { recordExperimentExposure } from '../api/experiments';

export async function markExperimentExposedOnce(partyId: string, experimentId: string): Promise<boolean> {
  if (!partyId || !experimentId) return false;
  try {
    const result = await recordExperimentExposure(experimentId);
    return result.assignment.experimentEligible && result.newlyExposed;
  } catch {
    return false;
  }
}
