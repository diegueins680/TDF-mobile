import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { getOnboardingSeen } from '../src/lib/onboarding';

export default function Index() {
  const [target, setTarget] = useState<Href | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const seen = await getOnboardingSeen();
      if (!active) return;
      setTarget(seen ? '/(tabs)/parties' : '/onboarding');
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!target) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Redirect href={target} />;
}
