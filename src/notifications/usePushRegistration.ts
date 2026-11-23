import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '../providers/AuthProvider';
import { loadNativeNotifications } from '../navigation/nativeNotifications';
import { syncPushRegistration } from './pushSubscriptions';

/**
 * Silently registers the signed-in party's Expo push token once a session is
 * known, and again whenever the OS rotates the device token. Never prompts:
 * the permission request lives in PushPermissionPrompt.
 */
export function usePushRegistration() {
  const { token, partyId } = useAuth();
  useEffect(() => {
    if (Platform.OS === 'web' || !token || !partyId) return;
    let active = true;
    let subscription: { remove(): void } | undefined;
    const sync = () => {
      if (active) void syncPushRegistration({ partyId, authorization: token });
    };
    sync();
    void loadNativeNotifications().then((Notifications) => {
      if (!active) return;
      // The listener receives the native token; re-deriving the Expo token
      // inside sync keeps the backend on the current one.
      subscription = Notifications.addPushTokenListener(sync);
    }).catch(() => { /* Unsupported runtime. */ });
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [token, partyId]);
}
