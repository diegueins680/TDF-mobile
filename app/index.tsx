import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { getOnboardingSeen } from '../src/lib/onboarding';
import { MOBILE_LANDING_ROUTE } from '../src/navigation/mobileSurface';
import { useAuth } from '../src/providers/AuthProvider';

export default function Index() {
  const [target, setTarget] = useState<Href | null>(null);
  const { token, loading } = useAuth();

  useEffect(() => {
    let active = true;
    (async () => {
      const seen = await getOnboardingSeen();
      if (!active) return;
      setTarget(seen ? MOBILE_LANDING_ROUTE : '/onboarding');
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!target || loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const hasToken = Boolean(token?.trim());
  if (target === MOBILE_LANDING_ROUTE && !hasToken) {
    return <Redirect href="/auth" />;
  }

  return <Redirect href={target} />;
}
