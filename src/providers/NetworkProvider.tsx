import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../theme/ThemeProvider';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useUserSettings } from './UserSettingsProvider';

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

interface NetworkContextValue {
  isConnected: boolean;
  connectionType: string;
}

const NetworkContext = createContext<NetworkContextValue>({
  isConnected: true,
  connectionType: 'unknown',
});

export function useNetwork(): NetworkContextValue {
  return useContext(NetworkContext);
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

const CHECK_INTERVAL_MS = 15_000;
const PING_TIMEOUT_MS = 4_000;

/** Try a lightweight HEAD request; resolve `true` on any response. */
async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    const res = await fetch('https://connectivitycheck.gstatic.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    return res.ok || res.type === 'opaque';
  } catch {
    return false;
  }
}

export function NetworkProvider({ children }: PropsWithChildren) {
  const [isConnected, setIsConnected] = useState(true);
  const [connectionType, setConnectionType] = useState<string>('unknown');

  const ping = useCallback(async () => {
    const online = await checkConnectivity();
    setIsConnected(online);
    setConnectionType(online ? 'internet' : 'none');
  }, []);

  useEffect(() => {
    // Initial check
    void ping();

    const id = setInterval(() => {
      void ping();
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(id);
  }, [ping]);

  const value = useMemo<NetworkContextValue>(
    () => ({ isConnected, connectionType }),
    [isConnected, connectionType],
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

/* ------------------------------------------------------------------ */
/*  Banner                                                             */
/* ------------------------------------------------------------------ */

export function NetworkBanner() {
  const { isConnected } = useNetwork();
  const { colors } = useAppTheme();
  const { locale } = useUserSettings();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(0));
  const label = locale.startsWith('en') ? 'No connection' : 'Sin conexión';

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isConnected ? 0 : 1,
      duration: reduceMotion ? 0 : 250,
      useNativeDriver: true,
    }).start();
  }, [isConnected, opacity, reduceMotion]);

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: colors.dangerAction, opacity, top: insets.top },
      ]}
      pointerEvents="none"
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <Text style={[styles.bannerText, { color: colors.dangerActionContrast }]}>
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
