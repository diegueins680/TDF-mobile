import { Tabs } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../src/lib/queryClient';

export default function TabsLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Tabs screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="parties" options={{ title: 'Parties' }} />
        <Tabs.Screen name="bookings" options={{ title: 'Bookings' }} />
        <Tabs.Screen name="pipelines" options={{ title: 'Pipelines' }} />
        <Tabs.Screen name="about" options={{ title: 'About' }} />
      </Tabs>
    </QueryClientProvider>
  );
}
