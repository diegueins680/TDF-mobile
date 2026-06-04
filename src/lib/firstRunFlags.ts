/**
 * firstRunFlags.ts
 *
 * AsyncStorage-backed helpers that capture two independent signals used to
 * decide whether a user qualifies as "new":
 *
 *   1. Fresh install — has this device ever launched the app before?
 *   2. First signup  — has this partyId ever completed auth before?
 *
 * Once both signals fire for the same launch, callers persist a derived
 * cohort flag (`tdf-new-user-cohort:<partyId>`) so the cohort assignment is
 * stable across sessions instead of being recomputed every cold start.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const INSTALL_SEEN_KEY = 'tdf-install-seen';
export const SIGNUP_SEEN_PREFIX = 'tdf-signup-seen:';
export const NEW_USER_COHORT_PREFIX = 'tdf-new-user-cohort:';

const TRUTHY = '1';

const signupKey = (partyId: string): string => `${SIGNUP_SEEN_PREFIX}${partyId}`;
const cohortKey = (partyId: string): string => `${NEW_USER_COHORT_PREFIX}${partyId}`;

/** Returns true if no prior launch has been recorded on this device. */
export async function getIsFreshInstall(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(INSTALL_SEEN_KEY);
    return value !== TRUTHY;
  } catch {
    // On storage failure assume "not fresh" so we never accidentally bucket
    // an existing user into the new-user treatment arm.
    return false;
  }
}

/** Idempotently records that the app has launched at least once on this device. */
export async function markInstallSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(INSTALL_SEEN_KEY, TRUTHY);
  } catch {
    // Swallow — the next cold start will retry.
  }
}

/** Returns true if this partyId has never been seen in a successful auth before. */
export async function getIsFirstSignup(partyId: string): Promise<boolean> {
  if (!partyId) return false;
  try {
    const value = await AsyncStorage.getItem(signupKey(partyId));
    return value !== TRUTHY;
  } catch {
    return false;
  }
}

/** Records that a successful auth has occurred for the given partyId. */
export async function markSignupSeen(partyId: string): Promise<void> {
  if (!partyId) return;
  try {
    await AsyncStorage.setItem(signupKey(partyId), TRUTHY);
  } catch {
    // Swallow — next auth event will retry.
  }
}

/**
 * Returns the persisted new-user cohort flag, or null if no decision has
 * been recorded yet for this partyId.
 */
export async function getNewUserCohort(partyId: string): Promise<boolean | null> {
  if (!partyId) return null;
  try {
    const value = await AsyncStorage.getItem(cohortKey(partyId));
    if (value === null) return null;
    return value === TRUTHY;
  } catch {
    return null;
  }
}

/** Persists the new-user cohort decision for a given partyId. */
export async function setNewUserCohort(partyId: string, isNew: boolean): Promise<void> {
  if (!partyId) return;
  try {
    await AsyncStorage.setItem(cohortKey(partyId), isNew ? TRUTHY : '0');
  } catch {
    // Swallow.
  }
}

/**
 * Convenience helper: resolves the new-user cohort for the given partyId,
 * computing+persisting the decision the first time it is asked.
 *
 *   - If a cohort flag is already stored, return it (sticky).
 *   - Otherwise compute it from (freshInstall && firstSignup), persist, and
 *     mark both seen flags so the decision cannot drift on subsequent calls.
 *
 * `freshInstallAtBoot` should be the value captured at app boot, BEFORE we
 * called `markInstallSeen`. That snapshot is the only correct signal — by
 * the time auth completes we've already marked install seen for the session.
 */
export async function resolveNewUserCohort(
  partyId: string,
  freshInstallAtBoot: boolean,
): Promise<boolean> {
  if (!partyId) return false;

  const existing = await getNewUserCohort(partyId);
  if (existing !== null) {
    // Make sure the signup flag is set too so future logins on this device
    // never re-trigger the "first signup" branch for the same partyId.
    await markSignupSeen(partyId);
    return existing;
  }

  const firstSignup = await getIsFirstSignup(partyId);
  const isNew = freshInstallAtBoot && firstSignup;

  await setNewUserCohort(partyId, isNew);
  await markSignupSeen(partyId);
  return isNew;
}
