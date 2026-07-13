import React, { useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { Events } from '../src/api/events';
import { TicketOrderCard } from '../src/components/tickets/TicketOrderCard';
import { useAnalytics } from '../src/analytics/AnalyticsProvider';
import { useAuth } from '../src/providers/AuthProvider';
import type { SocialEvent } from '../src/types';

export default function MyTicketsScreen() {
  const router = useRouter();
  const analytics = useAnalytics();
  const { token, loading: authLoading } = useAuth();
  const pendingPollStartedAt = useRef<number | null>(null);

  const ordersQuery = useQuery({
    queryKey: ['my-ticket-orders'],
    queryFn: () => Events.listMyTicketOrders(),
    enabled: Boolean(token?.trim()),
    refetchInterval: (query) => {
      const orders = query.state.data;
      if (!orders?.some((order) => order.status.toLowerCase() === 'pending')) {
        pendingPollStartedAt.current = null;
        return false;
      }
      const startedAt = pendingPollStartedAt.current ?? Date.now();
      pendingPollStartedAt.current = startedAt;
      const elapsed = Date.now() - startedAt;
      if (elapsed >= 2 * 60 * 1000) return false;
      if (elapsed >= 60 * 1000) return 15000;
      if (elapsed >= 15 * 1000) return 5000;
      return 2000;
    },
  });

  const eventsQuery = useQuery({
    queryKey: ['my-ticket-events'],
    enabled: (ordersQuery.data?.length ?? 0) > 0,
    queryFn: () => Events.list({ limit: 500 }),
  });

  const eventById = useMemo(
    () => new Map<string, SocialEvent>((eventsQuery.data ?? []).map((event) => [String(event.id), event])),
    [eventsQuery.data],
  );
  const orders = ordersQuery.data ?? [];

  React.useEffect(() => {
    analytics.screen('My tickets');
  }, [analytics]);

  React.useEffect(() => {
    if (!authLoading && !token?.trim()) {
      router.replace({ pathname: '/auth', params: { returnTo: '/tickets' } });
    }
  }, [authLoading, router, token]);

  if (authLoading || !token?.trim()) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color="#7c3aed" accessibilityLabel="Abriendo inicio de sesión" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={8}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis entradas</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentColumn}>
          <View style={styles.intro}>
            <View style={styles.introIcon}>
              <MaterialCommunityIcons name="ticket-confirmation" size={30} color="#7c3aed" />
            </View>
            <View style={styles.introCopy}>
              <Text style={styles.introTitle}>Tus entradas, siempre a mano</Text>
              <Text style={styles.introText}>Presenta el código QR al llegar al evento.</Text>
            </View>
          </View>

          {ordersQuery.isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator size="large" color="#7c3aed" accessibilityLabel="Cargando mis entradas" />
              <Text style={styles.stateText}>Cargando tus entradas…</Text>
            </View>
          ) : ordersQuery.isError ? (
            <View style={styles.stateBox} accessibilityRole="alert">
              <MaterialCommunityIcons name="alert-circle-outline" size={34} color="#b91c1c" />
              <Text style={styles.stateTitle}>No pudimos cargar tus entradas</Text>
              <Text style={styles.stateText}>Comprueba tu conexión y vuelve a intentarlo.</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => void ordersQuery.refetch()}
                accessibilityRole="button"
              >
                <Text style={styles.retryButtonText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : orders.length === 0 ? (
            <View style={styles.stateBox}>
              <MaterialCommunityIcons name="ticket-outline" size={42} color="#9ca3af" />
              <Text style={styles.stateTitle}>Aún no tienes entradas</Text>
              <Text style={styles.stateText}>Explora los próximos eventos y encuentra tu siguiente plan.</Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.replace('/(tabs)/events')}
                accessibilityRole="button"
              >
                <Text style={styles.primaryButtonText}>Explorar eventos</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.orderList}>
              {orders.map((order) => {
                const event = eventById.get(String(order.eventId));
                return (
                  <View key={order.id} style={styles.orderGroup}>
                    <TicketOrderCard order={order} eventTitle={event?.title ?? 'Evento TDF'} />
                    {event ? (
                      <TouchableOpacity
                        style={styles.eventButton}
                        onPress={() => router.push({ pathname: '/eventDetail', params: { eventId: String(event.id) } })}
                        accessibilityRole="button"
                        accessibilityLabel={`Ver detalles de ${event.title}`}
                      >
                        <Text style={styles.eventButtonText}>Ver evento</Text>
                        <MaterialCommunityIcons name="arrow-right" size={18} color="#6d28d9" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f7f5' },
  header: {
    minHeight: 58,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#111827', fontSize: 17, fontWeight: '900' },
  scrollContent: { padding: 16, paddingBottom: 32 },
  contentColumn: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: 16 },
  intro: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#faf5ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  introIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introCopy: { flex: 1, gap: 3 },
  introTitle: { color: '#2e1065', fontSize: 18, fontWeight: '900' },
  introText: { color: '#6b7280', fontSize: 12, lineHeight: 18 },
  stateBox: {
    minHeight: 300,
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stateTitle: { color: '#111827', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  stateText: { color: '#6b7280', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  orderList: { gap: 16 },
  orderGroup: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff' },
  eventButton: {
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  eventButtonText: { color: '#6d28d9', fontSize: 13, fontWeight: '900' },
  retryButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#c4b5fd',
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  retryButtonText: { color: '#6d28d9', fontWeight: '900' },
  primaryButton: {
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },
  primaryButtonText: { color: '#fff', fontWeight: '900' },
});
