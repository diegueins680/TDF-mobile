import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { NewUserOnboardingGate } from '../../src/experiments/NewUserOnboardingGate';
import { HIDDEN_INTERNAL_TABS, NEW_USER_VISIBLE_TABS } from '../../src/navigation/mobileSurface';

type MaterialCommunityIconName = keyof typeof MaterialCommunityIcons.glyphMap;

export default function TabsLayout() {
  return (
    <NewUserOnboardingGate>
      <TabsInner />
    </NewUserOnboardingGate>
  );
}

function TabsInner() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#999',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' }
      }}
    >
      {NEW_USER_VISIBLE_TABS.map((tab) => (
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
      {HIDDEN_INTERNAL_TABS.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}
