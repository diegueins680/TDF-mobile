import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'tdf-onboarding-seen';

export async function getOnboardingSeen(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored === '1';
  } catch {
    return false;
  }
}

export async function setOnboardingSeen(seen: boolean): Promise<void> {
  try {
    if (seen) {
      await AsyncStorage.setItem(STORAGE_KEY, '1');
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors to avoid blocking navigation.
  }
}
