import { Platform } from 'react-native';

import { registerOperationsPushSubscription } from '../api/operations';

type ExpoNotificationsModule = typeof import('expo-notifications');

const loadNotifications = async (): Promise<ExpoNotificationsModule | null> => {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
};

export type PushRegistrationResult =
  | { state: 'registered' }
  | { state: 'unsupported' }
  | { state: 'denied' };

/** Registers only an OS-issued token. The API encrypts it at rest and binds it to
 * the authenticated party and organization; notification bodies must remain
 * metadata-free until the deep link is authorized and fetched from the API. */
export async function registerOperationsPush(
  organizationId: string,
): Promise<PushRegistrationResult> {
  const Notifications = await loadNotifications();
  if (!Notifications) return { state: 'unsupported' };

  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return { state: 'denied' };

  const token = await Notifications.getDevicePushTokenAsync();
  if (typeof token.data !== 'string' || !token.data.trim()) return { state: 'unsupported' };

  await registerOperationsPushSubscription({
    organizationId,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    deviceToken: token.data.trim(),
    requestId: globalThis.crypto?.randomUUID?.() ?? `push-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sourceClient: 'tdf-mobile',
  });
  return { state: 'registered' };
}
