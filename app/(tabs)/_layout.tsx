import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';

import { NewUserOnboardingGate } from '../../src/experiments/NewUserOnboardingGate';
import { HIDDEN_INTERNAL_TABS, NEW_USER_VISIBLE_TABS } from '../../src/navigation/mobileSurface';
import { useAuth } from '../../src/providers/AuthProvider';
import { useAppTheme } from '../../src/theme/ThemeProvider';

type MaterialCommunityIconName = keyof typeof MaterialCommunityIcons.glyphMap;

export default function TabsLayout() {
  const { token, loading } = useAuth();
  const { colors } = useAppTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.actionPrimary} accessibilityLabel="Cargando sesión" />
      </View>
    );
  }

  return token?.trim() ? (
    <NewUserOnboardingGate>
      <TabsInner authenticated />
    </NewUserOnboardingGate>
  ) : (
    <TabsInner authenticated={false} />
  );
}

function TabsInner({ authenticated }: { authenticated: boolean }) {
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.actionPrimary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      {NEW_USER_VISIBLE_TABS.filter((tab) => authenticated || tab.name === 'directory').map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons
                name={tab.icon as MaterialCommunityIconName}
                size={24}
                color={color}
              />
            )
          }}
        />
      ))}
      {!authenticated && NEW_USER_VISIBLE_TABS.filter((tab) => tab.name !== 'directory').map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ href: null }} />
      ))}
      {HIDDEN_INTERNAL_TABS.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}
