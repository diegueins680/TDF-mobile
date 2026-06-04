/**
 * posthog.ts
 *
 * PostHog client singleton for tdf-mobile.
 *
 * - Reads config from EXPO_PUBLIC_POSTHOG_KEY / EXPO_PUBLIC_POSTHOG_HOST.
 *   Defaults to EU cloud (https://eu.i.posthog.com).
 * - If no key is configured, exposes a no-op client so the rest of the
 *   app never crashes on missing env (dev builds, preview builds, etc).
 * - Session recording is disabled by default (privacy-first). Turn on
 *   per-screen via opts to startSessionRecording() if ever needed.
 *
 * See: docs/analytics.md
 */
import PostHog from 'posthog-react-native';

function readConfig() {
  return {
    key: process.env.EXPO_PUBLIC_POSTHOG_KEY,
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
  };
}

export interface AnalyticsClient {
  ready: boolean;
  capture: (event: string, properties?: Record<string, unknown>) => void;
  identify: (distinctId: string, properties?: Record<string, unknown>) => void;
  reset: () => void;
  screen: (name: string, properties?: Record<string, unknown>) => void;
  /** Real PostHog instance, or null in no-op mode. Avoid using directly. */
  __raw: PostHog | null;
}

let cachedClient: AnalyticsClient | null = null;

function buildNoopClient(reason: string): AnalyticsClient {
  // eslint-disable-next-line no-console
  console.info(`[analytics] PostHog disabled: ${reason}. Events will not be sent.`);
  return {
    ready: false,
    capture: () => undefined,
    identify: () => undefined,
    reset: () => undefined,
    screen: () => undefined,
    __raw: null,
  };
}

export function getAnalyticsClient(): AnalyticsClient {
  if (cachedClient) return cachedClient;

  const { key, host } = readConfig();
  if (!key) {
    cachedClient = buildNoopClient('EXPO_PUBLIC_POSTHOG_KEY is unset');
    return cachedClient;
  }

  const posthog = new PostHog(key, {
    host,
    // Privacy-first defaults. Turn on per-context if needed.
    enableSessionReplay: false,
    captureAppLifecycleEvents: true,
  });

  cachedClient = {
    ready: true,
    capture: (event, properties) => {
      try {
        // PostHogEventProperties is structurally JsonType-only; our caller-facing
        // type intentionally accepts `unknown` so call sites stay ergonomic.
        // The SDK serializes through JSON.stringify internally so any non-JSON
        // value would be lost regardless.
        posthog.capture(event, properties as Parameters<typeof posthog.capture>[1]);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[analytics] capture failed', err);
      }
    },
    identify: (distinctId, properties) => {
      try {
        posthog.identify(distinctId, properties as Parameters<typeof posthog.identify>[1]);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[analytics] identify failed', err);
      }
    },
    reset: () => {
      try {
        posthog.reset();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[analytics] reset failed', err);
      }
    },
    screen: (name, properties) => {
      try {
        posthog.screen(name, properties as Parameters<typeof posthog.screen>[1]);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[analytics] screen failed', err);
      }
    },
    __raw: posthog,
  };

  return cachedClient;
}

/**
 * Reset the cached client. Test-only.
 */
export function __resetAnalyticsForTests(): void {
  cachedClient = null;
}
