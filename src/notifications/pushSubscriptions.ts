import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { isCurrentAuthToken, normalizeAuthToken } from '../api/client';
import { registerPushSubscription, revokePushSubscription } from '../api/pushSubscriptions';
import { loadNativeNotifications } from '../navigation/nativeNotifications';

type NotificationsModule = typeof import('expo-notifications');

/** Last token successfully registered for a party on this device. Holds no
 * session credential; it only lets us skip duplicate registrations and know
 * which token to revoke on logout. */
export const PUSH_SUBSCRIPTION_RECORD_KEY = 'tdf-push-subscription-v1';
/** Set once the in-app explanation was answered (accepted or dismissed). */
export const PUSH_PERMISSION_PROMPT_KEY = 'tdf-push-permission-prompt-v1';
export const DEFAULT_ANDROID_CHANNEL_ID = 'default';
export const PUSH_REVOKE_TIMEOUT_MS = 4_000;

type StoredSubscription = { token: string; partyId: string };

export type PushSyncResult =
  | 'registered'
  | 'unchanged'
  | 'denied'
  | 'unsupported'
  | 'stale-session'
  | 'failed';

export type PushPermissionState = 'granted' | 'undetermined' | 'denied' | 'unsupported';

const loadNotifications = async (): Promise<NotificationsModule | null> => {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  try {
    return await loadNativeNotifications();
  } catch {
    return null;
  }
};

export const readExpoProjectId = (): string | null => {
  const fromConfig = (Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined)?.eas?.projectId;
  const fromEas = (Constants as { easConfig?: { projectId?: unknown } | null }).easConfig?.projectId;
  const projectId = typeof fromConfig === 'string' && fromConfig.trim() ? fromConfig : fromEas;
  return typeof projectId === 'string' && projectId.trim() ? projectId.trim() : null;
};

const readStoredSubscription = async (): Promise<StoredSubscription | null> => {
  try {
    const raw = await AsyncStorage.getItem(PUSH_SUBSCRIPTION_RECORD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSubscription>;
    return typeof parsed.token === 'string' && typeof parsed.partyId === 'string'
      ? { token: parsed.token, partyId: parsed.partyId }
      : null;
  } catch {
    return null;
  }
};

const writeStoredSubscription = async (value: StoredSubscription | null) => {
  try {
    if (value) await AsyncStorage.setItem(PUSH_SUBSCRIPTION_RECORD_KEY, JSON.stringify(value));
    else await AsyncStorage.removeItem(PUSH_SUBSCRIPTION_RECORD_KEY);
  } catch {
    // Losing the record only causes one extra idempotent registration later.
  }
};

let androidChannelReady: Promise<void> | null = null;

/** Android 8+ needs a channel to display pushes, and Android 13+ only shows the
 * permission dialog once a channel exists. */
export const ensureDefaultAndroidChannel = (Notifications: NotificationsModule): Promise<void> => {
  if (Platform.OS !== 'android') return Promise.resolve();
  androidChannelReady ??= Notifications.setNotificationChannelAsync(DEFAULT_ANDROID_CHANNEL_ID, {
    name: 'Mensajes y avisos',
    importance: Notifications.AndroidImportance.HIGH,
  }).then(() => undefined).catch(() => {
    androidChannelReady = null;
  });
  return androidChannelReady;
};

export async function getPushPermissionState(): Promise<PushPermissionState> {
  const Notifications = await loadNotifications();
  if (!Notifications) return 'unsupported';
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.granted) return 'granted';
    return permission.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unsupported';
  }
}

let inFlight: Promise<PushSyncResult> | null = null;

/**
 * Registers this device's Expo push token for `partyId`. Silent unless
 * `requestPermission` is set; never throws.
 */
export function syncPushRegistration(options: {
  partyId: string;
  authorization: string;
  requestPermission?: boolean;
}): Promise<PushSyncResult> {
  const run = async (): Promise<PushSyncResult> => {
    const Notifications = await loadNotifications();
    if (!Notifications) return 'unsupported';
    try {
      await ensureDefaultAndroidChannel(Notifications);
      let permission = await Notifications.getPermissionsAsync();
      if (!permission.granted && options.requestPermission && permission.canAskAgain) {
        permission = await Notifications.requestPermissionsAsync();
      }
      if (!permission.granted) return 'denied';

      const projectId = readExpoProjectId();
      if (!projectId) return 'unsupported';
      let token: string;
      try {
        const result = await Notifications.getExpoPushTokenAsync({ projectId });
        token = typeof result.data === 'string' ? result.data.trim() : '';
      } catch {
        // Simulators and builds without FCM/APNs credentials cannot issue a token.
        return 'unsupported';
      }
      if (!token) return 'unsupported';

      const stored = await readStoredSubscription();
      if (stored?.token === token && stored.partyId === options.partyId) return 'unchanged';
      if (!isCurrentAuthToken(options.authorization)) return 'stale-session';

      await registerPushSubscription(
        { provider: 'expo', token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
        { headers: { Authorization: normalizeAuthToken(options.authorization) } },
      );
      // If the session ended meanwhile, keep no record so the next sign-in
      // registers again instead of trusting a possibly revoked binding.
      if (!isCurrentAuthToken(options.authorization)) return 'stale-session';
      await writeStoredSubscription({ token, partyId: options.partyId });
      return 'registered';
    } catch {
      return 'failed';
    }
  };
  // Serialize so the session effect and the token listener cannot race into
  // duplicate registrations.
  const next = (inFlight ?? Promise.resolve<PushSyncResult>('unchanged')).catch(() => 'failed' as const).then(run);
  inFlight = next;
  return next;
}

/** Records that the user answered the in-app explanation, then asks the OS. */
export async function requestPushPermission(options: {
  partyId: string;
  authorization: string;
}): Promise<PushSyncResult> {
  try {
    await AsyncStorage.setItem(PUSH_PERMISSION_PROMPT_KEY, 'answered');
  } catch {
    // The OS remembers the answer even if our flag could not be stored.
  }
  return syncPushRegistration({ ...options, requestPermission: true });
}

export async function dismissPushPermissionPrompt(): Promise<void> {
  try {
    await AsyncStorage.setItem(PUSH_PERMISSION_PROMPT_KEY, 'dismissed');
  } catch {
    // Best effort; the card simply reappears next time.
  }
}

export async function hasAnsweredPushPermissionPrompt(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PUSH_PERMISSION_PROMPT_KEY)) !== null;
  } catch {
    return true;
  }
}

/**
 * Revokes the token registered on this device using the given (still valid)
 * session credential. Bounded by a timeout and never throws, so logout can
 * always continue.
 */
export async function revokePushRegistration(
  authorization: string | null | undefined,
  timeoutMs = PUSH_REVOKE_TIMEOUT_MS,
): Promise<void> {
  const header = normalizeAuthToken(authorization);
  // Let a registration that is already on the wire settle so its record can be
  // revoked too, but never hold logout hostage to it.
  if (inFlight) {
    await Promise.race([
      inFlight.catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, Math.min(timeoutMs, 1_000))),
    ]);
  }
  const stored = await readStoredSubscription();
  if (!stored) return;
  try {
    if (header) {
      await revokePushSubscription(stored.token, { headers: { Authorization: header }, timeout: timeoutMs });
    }
  } catch {
    // The backend also drops tokens that Expo reports as unregistered.
  } finally {
    await writeStoredSubscription(null);
  }
}

/** Test-only reset of module state. */
export const __resetPushSubscriptionStateForTests = () => {
  androidChannelReady = null;
  inFlight = null;
};
