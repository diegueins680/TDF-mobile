import { Platform } from 'react-native';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAnalyticsClient } from '../analytics/posthog';
import { nextParticipation, PARTICIPATION_KEY } from './metadata';
let pending: Promise<void> = Promise.resolve();
export function recordMobileSession() {
  pending = pending.then(async () => {
    const raw = await AsyncStorage.getItem(PARTICIPATION_KEY);
    const state = nextParticipation(raw, Date.now());
    await AsyncStorage.setItem(PARTICIPATION_KEY, JSON.stringify(state));
    if (!raw) getAnalyticsClient().capture('mobile_first_open', { surface: 'native_app', platform: Platform.OS, app_version: Application.nativeApplicationVersion, app_build: Application.nativeBuildVersion, measurement: 'first_observed_launch_not_store_install' });
  }).catch(() => { /* Optional measurement never blocks app startup. */ });
  return pending;
}
