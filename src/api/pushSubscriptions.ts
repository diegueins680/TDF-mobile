import type { AxiosRequestConfig } from 'axios';

import { post } from './client';

export type PushSubscriptionPlatform = 'ios' | 'android';

export type PushSubscriptionRegistration = {
  provider: 'expo';
  token: string;
  platform: PushSubscriptionPlatform;
};

/** Binds an Expo push token to the authenticated party (idempotent, 204). */
export const registerPushSubscription = (
  body: PushSubscriptionRegistration,
  config?: AxiosRequestConfig,
): Promise<void> => post<void>('/notifications/push-subscriptions', body, config);

/** Removes the token from the authenticated party. Requires the session, so it
 * must be sent before the local session is cleared. */
export const revokePushSubscription = (
  token: string,
  config?: AxiosRequestConfig,
): Promise<void> => post<void>('/notifications/push-subscriptions/revoke', { token }, config);
