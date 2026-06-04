import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { NewUserOnboardingGate } from '../../src/experiments/NewUserOnboardingGate';

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
      <Tabs.Screen
        name="parties"
        options={{
          title: 'Clientes',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="account-multiple" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Reservas',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="calendar-check" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="pipelines"
        options={{
          title: 'Pipelines',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="pipe" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Eventos',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="calendar-star" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Social',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="account-heart" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="vcard"
        options={{
          title: 'vCard',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="card-account-details" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: 'Acerca de',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="information" size={24} color={color} />
        }}
      />
    </Tabs>
  );
}

