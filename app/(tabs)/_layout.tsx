import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabsLayout() {
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
          title: 'Parties',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="account-multiple" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
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
          title: 'Events',
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
          title: 'About',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="information" size={24} color={color} />
        }}
      />
    </Tabs>
  );
}
