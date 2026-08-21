import AsyncStorage from '@react-native-async-storage/async-storage';

export const SIGNUP_COMPLETED_PREFIX = 'tdf-signup-completed-at:';
export const ONBOARDING_COMPLETED_PREFIX = 'tdf-new-user-onboarding-completed-at:';
export const EXPERIMENT_EXPOSURE_PREFIX = 'tdf-experiment-exposed:';
export const NEW_USER_WINDOW_MS = 24 * 60 * 60 * 1000;

const signupKey = (partyId: string) => `${SIGNUP_COMPLETED_PREFIX}${partyId}`;
const completedKey = (partyId: string) => `${ONBOARDING_COMPLETED_PREFIX}${partyId}`;
const exposureKey = (partyId: string, experimentId: string) =>
  `${EXPERIMENT_EXPOSURE_PREFIX}${partyId}:${experimentId}`;

export async function markSignupCompleted(partyId: string, now = Date.now()): Promise<void> {
  if (!partyId) return;
  try {
    await AsyncStorage.setItem(signupKey(partyId), String(now));
  } catch {
    // Account creation must succeed even when local storage is unavailable.
  }
}

export async function markNewUserOnboardingCompleted(partyId: string, now = Date.now()): Promise<void> {
  if (!partyId) return;
  try {
    await AsyncStorage.setItem(completedKey(partyId), String(now));
  } catch {
    // Best effort. A failed write may show the experience once more.
  }
}

export async function resolveNewUserCohort(partyId: string, now = Date.now()): Promise<boolean> {
  if (!partyId) return false;
  try {
    const [signupAtRaw, completedAtRaw] = await AsyncStorage.multiGet([
      signupKey(partyId),
      completedKey(partyId),
    ]);
    if (completedAtRaw?.[1]) return false;
    const signupAtValue = signupAtRaw?.[1];
    if (!signupAtValue) return false;
    const signupAt = Number(signupAtValue);
    return Number.isFinite(signupAt) && signupAt <= now && now - signupAt <= NEW_USER_WINDOW_MS;
  } catch {
    // Fail closed: existing users must never be misclassified as new.
    return false;
  }
}

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
