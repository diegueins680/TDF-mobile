import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { NewUserOnboardingGate } from '../../src/experiments/NewUserOnboardingGate';
import { TAB_MENU_ITEMS } from '../../src/navigation/menu';

export default function TabsLayout() {
  return (
    <NewUserOnboardingGate>
      <TabsInner />
    </NewUserOnboardingGate>
  );
}

function TabsInner() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: '#2563eb',
      tabBarInactiveTintColor: '#999',
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' }
    }}>
      {TAB_MENU_ITEMS.map((item) => (
        <Tabs.Screen
          key={item.name}
          name={item.name}
          options={{
            title: item.title,
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name={item.icon} size={24} color={color} />
            )
          }}
        />
      ))}
    </Tabs>
  );
}
