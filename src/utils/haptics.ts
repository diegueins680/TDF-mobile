import { Platform } from 'react-native';

// Lightweight haptic feedback using Expo's haptics if available,
// otherwise a no-op on platforms that don't support it.

interface HapticsModule {
  ImpactFeedbackStyle?: {
    Light?: unknown;
    Medium?: unknown;
    Heavy?: unknown;
  };
  NotificationFeedbackType?: {
    Success?: unknown;
    Error?: unknown;
  };
  impactAsync?: (style?: unknown) => Promise<void>;
  notificationAsync?: (type?: unknown) => Promise<void>;
  selectionAsync?: () => Promise<void>;
}

let hapticsModule: HapticsModule | null = null;

async function getHaptics(): Promise<HapticsModule | null> {
  if (hapticsModule) return hapticsModule;
  try {
    // @ts-expect-error expo-haptics is an optional runtime module and is intentionally not a hard dependency.
    hapticsModule = await import('expo-haptics') as HapticsModule;
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
