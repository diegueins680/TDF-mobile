import AsyncStorage from '@react-native-async-storage/async-storage';

export const EXPERIMENT_EXPOSURE_PREFIX = 'tdf-experiment-exposed:';

const exposureKey = (partyId: string, experimentId: string) =>
  `${EXPERIMENT_EXPOSURE_PREFIX}${partyId}:${experimentId}`;

export async function markExperimentExposedOnce(partyId: string, experimentId: string): Promise<boolean> {
  if (!partyId || !experimentId) return false;
  try {
    const key = exposureKey(partyId, experimentId);
    if (await AsyncStorage.getItem(key)) return false;
    await AsyncStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}
