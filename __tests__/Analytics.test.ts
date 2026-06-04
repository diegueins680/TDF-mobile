/**
 * Smoke tests for the analytics module.
 *
 * The real PostHog SDK opens native handles we do not want to touch in
 * unit tests; mock it as a thin constructor that records calls.
 */
import { __resetAnalyticsForTests, getAnalyticsClient } from '../src/analytics/posthog';

jest.mock('posthog-react-native', () => {
  const capture = jest.fn();
  const identify = jest.fn();
  const reset = jest.fn();
  const screen = jest.fn();
  const ctor: jest.Mock & { __mocks: typeof __mocks } = jest.fn().mockImplementation(() => ({
    capture,
    identify,
    reset,
    screen,
  })) as any;
  const __mocks = { capture, identify, reset, screen };
  ctor.__mocks = __mocks;
  return { __esModule: true, default: ctor };
});

import PostHogCtor from 'posthog-react-native';
const { capture: captureMock, identify: identifyMock, reset: resetMock, screen: screenMock } = (PostHogCtor as unknown as { __mocks: { capture: jest.Mock; identify: jest.Mock; reset: jest.Mock; screen: jest.Mock } }).__mocks;

describe('analytics/posthog', () => {
  const originalKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;

  beforeEach(() => {
    __resetAnalyticsForTests();
    captureMock.mockClear();
    identifyMock.mockClear();
    resetMock.mockClear();
    screenMock.mockClear();
  });

  afterAll(() => {
    if (originalKey === undefined) {
      delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
    } else {
      process.env.EXPO_PUBLIC_POSTHOG_KEY = originalKey;
    }
    __resetAnalyticsForTests();
  });

  test('returns a no-op client when no key is configured', () => {
    delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
    const client = getAnalyticsClient();
    expect(client.ready).toBe(false);
    expect(client.__raw).toBeNull();

    // Calls must not throw.
    client.capture('rsvp_created', { eventId: '1' });
    client.identify('42');
    client.reset();
    client.screen('Home');

    expect(captureMock).not.toHaveBeenCalled();
    expect(identifyMock).not.toHaveBeenCalled();
    expect(resetMock).not.toHaveBeenCalled();
    expect(screenMock).not.toHaveBeenCalled();
  });

  test('forwards calls to PostHog when a key is configured', () => {
    process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_unit_test';
    const client = getAnalyticsClient();
    expect(client.ready).toBe(true);

    client.capture('rsvp_created', { eventId: '7', artistId: '99' });
    client.identify('42', { username: 'aria' });
    client.screen('Home');
    client.reset();

    expect(captureMock).toHaveBeenCalledWith('rsvp_created', { eventId: '7', artistId: '99' });
    expect(identifyMock).toHaveBeenCalledWith('42', { username: 'aria' });
    expect(screenMock).toHaveBeenCalledWith('Home', undefined);
    expect(resetMock).toHaveBeenCalled();
  });

  test('memoizes the client across calls', () => {
    process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_unit_test';
    const c1 = getAnalyticsClient();
    const c2 = getAnalyticsClient();
    expect(c1).toBe(c2);
  });
});
