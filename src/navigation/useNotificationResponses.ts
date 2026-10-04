import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter, useRootNavigationState, type Href } from 'expo-router';
import { loadNativeNotifications } from './nativeNotifications';
import { notificationResponseTarget } from './notificationResponses';

export function useNotificationResponses() {
  const router = useRouter();
  const navigationKey = useRootNavigationState()?.key;
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web' || !navigationKey) return;
    let active = true;
    let subscription: { remove(): void } | undefined;
    void loadNativeNotifications().then(async (notifications) => {
      if (!active) return;
      const open = (response: import('expo-notifications').NotificationResponse | null) => {
        if (!active || !response || response.actionIdentifier !== notifications.DEFAULT_ACTION_IDENTIFIER) return;
        const ident = response.notification.request.identifier;
        const target = notificationResponseTarget(response.notification.request.content.data);
        if (!target || handled.current === ident) return;
        router.push(target as Href);
        handled.current = ident;
        void notifications.clearLastNotificationResponseAsync().catch(() => {});
      };
      subscription = notifications.addNotificationResponseReceivedListener(open);
      open(await notifications.getLastNotificationResponseAsync());
    }).catch(() => { /* Unsupported native runtime: standard deep links still work. */ });
    return () => { active = false; subscription?.remove(); };
  }, [router, navigationKey]);
}
