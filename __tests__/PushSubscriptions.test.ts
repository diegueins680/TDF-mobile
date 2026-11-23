import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import {
  PUSH_SUBSCRIPTION_RECORD_KEY,
  __resetPushSubscriptionStateForTests,
  requestPushPermission,
  revokePushRegistration,
  syncPushRegistration,
} from '../src/notifications/pushSubscriptions';
import { registerPushSubscription, revokePushSubscription } from '../src/api/pushSubscriptions';
import { isCurrentAuthToken } from '../src/api/client';

const mockNotifications = {
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
};

jest.mock('../src/navigation/nativeNotifications', () => ({
  loadNativeNotifications: () => Promise.resolve(mockNotifications),
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'synthetic-project-id' } } } },
}));
jest.mock('../src/api/pushSubscriptions', () => ({
  registerPushSubscription: jest.fn(),
  revokePushSubscription: jest.fn(),
}));
jest.mock('../src/api/client', () => ({
  isCurrentAuthToken: jest.fn(() => true),
  normalizeAuthToken: (value?: string | null) => (value ? (value.startsWith('Bearer ') ? value : `Bearer ${value}`) : undefined),
}));

const register = jest.mocked(registerPushSubscription);
const revoke = jest.mocked(revokePushSubscription);
const TOKEN = 'ExponentPushToken[synthetic-device]';
const session = { partyId: '42', authorization: 'Bearer synthetic-session' };
const originalOS = Platform.OS;
const setOS = (value: string) => Object.defineProperty(Platform, 'OS', { configurable: true, value });

beforeEach(async () => {
  jest.clearAllMocks();
  __resetPushSubscriptionStateForTests();
  await AsyncStorage.clear();
  setOS('ios');
  jest.mocked(isCurrentAuthToken).mockReturnValue(true);
  mockNotifications.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true, status: 'granted' });
  mockNotifications.requestPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true, status: 'granted' });
  mockNotifications.getExpoPushTokenAsync.mockResolvedValue({ type: 'expo', data: TOKEN });
  mockNotifications.setNotificationChannelAsync.mockResolvedValue(null);
  register.mockResolvedValue(undefined);
  revoke.mockResolvedValue(undefined);
});
afterAll(() => setOS(originalOS));

describe('Expo push registration', () => {
  it('registers the Expo token with the session credential when permission is granted', async () => {
    await expect(syncPushRegistration(session)).resolves.toBe('registered');
    expect(mockNotifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'synthetic-project-id' });
    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith(
      { provider: 'expo', token: TOKEN, platform: 'ios' },
      { headers: { Authorization: 'Bearer synthetic-session' } },
    );
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(JSON.parse((await AsyncStorage.getItem(PUSH_SUBSCRIPTION_RECORD_KEY))!)).toEqual({ token: TOKEN, partyId: '42' });
  });

  it('creates the default Android channel and reports the android platform', async () => {
    setOS('android');
    await expect(syncPushRegistration(session)).resolves.toBe('registered');
    expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledWith('default', expect.objectContaining({ importance: 4 }));
    expect(register.mock.calls[0][0]).toEqual({ provider: 'expo', token: TOKEN, platform: 'android' });
  });

  it('does not prompt or call the API when permission is not granted silently', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true, status: 'undetermined' });
    await expect(syncPushRegistration(session)).resolves.toBe('denied');
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });

  it('makes no API call when the user denies the OS permission dialog', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true, status: 'undetermined' });
    mockNotifications.requestPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false, status: 'denied' });
    await expect(requestPushPermission(session)).resolves.toBe('denied');
    expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(register).not.toHaveBeenCalled();
  });

  it('registers after the user accepts the OS permission dialog', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true, status: 'undetermined' });
    await expect(requestPushPermission(session)).resolves.toBe('registered');
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('skips a duplicate registration for the same token and party', async () => {
    await syncPushRegistration(session);
    await expect(syncPushRegistration(session)).resolves.toBe('unchanged');
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('serializes concurrent syncs into a single registration', async () => {
    const results = await Promise.all([syncPushRegistration(session), syncPushRegistration(session)]);
    expect(results).toEqual(['registered', 'unchanged']);
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('re-registers when the token or the party changes', async () => {
    await syncPushRegistration(session);
    mockNotifications.getExpoPushTokenAsync.mockResolvedValue({ type: 'expo', data: 'ExponentPushToken[rotated]' });
    await expect(syncPushRegistration(session)).resolves.toBe('registered');
    await expect(syncPushRegistration({ ...session, partyId: '43' })).resolves.toBe('registered');
    expect(register).toHaveBeenCalledTimes(3);
  });

  it('does nothing on web or when no token can be issued', async () => {
    setOS('web');
    await expect(syncPushRegistration(session)).resolves.toBe('unsupported');
    setOS('ios');
    mockNotifications.getExpoPushTokenAsync.mockRejectedValue(new Error('simulator'));
    await expect(syncPushRegistration(session)).resolves.toBe('unsupported');
    expect(register).not.toHaveBeenCalled();
  });

  it('keeps no record when the registration fails, so it retries later', async () => {
    register.mockRejectedValueOnce(new Error('offline'));
    await expect(syncPushRegistration(session)).resolves.toBe('failed');
    expect(await AsyncStorage.getItem(PUSH_SUBSCRIPTION_RECORD_KEY)).toBeNull();
    await expect(syncPushRegistration(session)).resolves.toBe('registered');
  });

  it('does not register for a session that is no longer current', async () => {
    jest.mocked(isCurrentAuthToken).mockReturnValue(false);
    await expect(syncPushRegistration(session)).resolves.toBe('stale-session');
    expect(register).not.toHaveBeenCalled();
  });
});

describe('Expo push revocation', () => {
  it('revokes the stored token with the captured credential and forgets it', async () => {
    await syncPushRegistration(session);
    await revokePushRegistration('Bearer synthetic-session');
    expect(revoke).toHaveBeenCalledWith(TOKEN, expect.objectContaining({ headers: { Authorization: 'Bearer synthetic-session' } }));
    expect(await AsyncStorage.getItem(PUSH_SUBSCRIPTION_RECORD_KEY)).toBeNull();
  });

  it('swallows revoke failures and still forgets the token', async () => {
    await syncPushRegistration(session);
    revoke.mockRejectedValueOnce(new Error('offline'));
    await expect(revokePushRegistration('Bearer synthetic-session')).resolves.toBeUndefined();
    expect(await AsyncStorage.getItem(PUSH_SUBSCRIPTION_RECORD_KEY)).toBeNull();
  });

  it('makes no call when nothing was registered on this device', async () => {
    await revokePushRegistration('Bearer synthetic-session');
    expect(revoke).not.toHaveBeenCalled();
  });
});
