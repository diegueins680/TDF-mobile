import { Platform } from 'react-native';

// Lightweight haptic feedback using Expo's haptics if available,
// otherwise a no-op on platforms that don't support it.

let hapticsModule: any = null;

async function getHaptics() {
  if (hapticsModule) return hapticsModule;
  try {
    hapticsModule = await import('expo-haptics');
    return hapticsModule;
  } catch {
    return null;
  }
}

export async function impactLight() {
  if (Platform.OS === 'web') return;
  const haptics = await getHaptics();
  haptics?.impactAsync?.(haptics?.ImpactFeedbackStyle?.Light);
}

export async function impactMedium() {
  if (Platform.OS === 'web') return;
  const haptics = await getHaptics();
  haptics?.impactAsync?.(haptics?.ImpactFeedbackStyle?.Medium);
}

export async function impactHeavy() {
  if (Platform.OS === 'web') return;
  const haptics = await getHaptics();
  haptics?.impactAsync?.(haptics?.ImpactFeedbackStyle?.Heavy);
}

export async function notificationSuccess() {
  if (Platform.OS === 'web') return;
  const haptics = await getHaptics();
  haptics?.notificationAsync?.(haptics?.NotificationFeedbackType?.Success);
}

export async function notificationError() {
  if (Platform.OS === 'web') return;
  const haptics = await getHaptics();
  haptics?.notificationAsync?.(haptics?.NotificationFeedbackType?.Error);
}

export async function selectionChange() {
  if (Platform.OS === 'web') return;
  const haptics = await getHaptics();
  haptics?.selectionAsync?.();
}
