import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Button, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Bookings as BookingsApi, createBooking } from '../../src/api/bookings';
import type { Booking } from '../../src/types';
import { useAuth } from '../../src/providers/AuthProvider';

export default function Bookings() {
  const qc = useQueryClient();
  const router = useRouter();
  const { token, partyId, loading } = useAuth();
  const hasToken = Boolean(token?.trim());
  const canUseBookings = !loading && hasToken;
  const q = useQuery<Booking[]>({
    queryKey: ['bookings', partyId ?? 'all'],
    queryFn: () => (partyId ? BookingsApi.listByParty(partyId) : BookingsApi.list()),
    enabled: canUseBookings,
  });

  const m = useMutation({
    mutationFn: createBooking,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] })
  });

  const items = useMemo(() => q.data ?? [], [q.data]);
  const sorted = useMemo(() => [...items].sort((a, b) => a.start.localeCompare(b.start)), [items]);

  const createQuickSession = useCallback(() => {
    const now = new Date();
    const start = now.toISOString();
    const end = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    m.mutate({ title: 'Session', start, end });
  }, [m]);

  const renderItem = useCallback(({ item }: { item: Booking }) => (
    <View style={{ backgroundColor: 'white', borderRadius: 8, padding: 12, elevation: 2 }}>
      <Text style={{ fontWeight: '700' }}>{item.title}</Text>
      <Text style={{ color: '#475569' }}>{item.start}</Text>
      <Text style={{ color: '#475569' }}>{item.end}</Text>
      {item.status ? <Text style={{ color: '#22c55e', marginTop: 4 }}>{item.status}</Text> : null}
    </View>
  ), []);

  const keyExtractor = useCallback((item: Booking) => String(item.id), []);

  const renderEmpty = useCallback(() => (
    <View style={{ padding: 20 }}>
      <Text>No bookings</Text>
    </View>
  ), []);

  const Separator = useCallback(() => <View style={{ height: 8 }} />, []);

  const errorMessage = q.error instanceof Error ? q.error.message : 'No se pudieron cargar las reservas.';

  return (
    <View style={styles.container}>
      {loading && <Text style={styles.infoText}>Loading session…</Text>}
      {!loading && !hasToken && (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>Acceso restringido para cargar reservas.</Text>
          <Text style={styles.noticeBody}>Inicia sesión para revisar y crear bookings.</Text>
          <View style={styles.noticeActions}>
            <Button title="Abrir login" onPress={() => router.push('/auth')} />
          </View>
        </View>
      )}

      <TouchableOpacity
        onPress={createQuickSession}
        disabled={!canUseBookings || m.isPending}
        style={[styles.primaryButton, (!canUseBookings || m.isPending) && styles.primaryButtonDisabled]}
      >
        <Text style={styles.primaryButtonText}>
          {m.isPending ? 'Creando sesión…' : 'Crear sesión rápida'}
        </Text>
      </TouchableOpacity>

      {canUseBookings && q.isLoading && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>Cargando reservas…</Text>
        </View>
      )}

      {canUseBookings && q.isError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <View style={styles.noticeActions}>
            <Button title={q.isFetching ? 'Reintentando…' : 'Reintentar'} onPress={() => q.refetch()} disabled={q.isFetching} />
          </View>
        </View>
      )}

      <FlatList
        data={sorted}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={Separator}
        renderItem={renderItem}
        ListEmptyComponent={!q.isLoading ? renderEmpty : null}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={8}
        removeClippedSubviews
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  infoBox: { paddingHorizontal: 4 },
  infoText: { color: '#334155' },
  primaryButton: { backgroundColor: '#2563eb', padding: 12, borderRadius: 8, marginBottom: 4 },
  primaryButtonDisabled: { opacity: 0.55 },
  primaryButtonText: { color: 'white', fontWeight: '700', textAlign: 'center' },
  listContent: { paddingBottom: 24 },
  noticeBox: { padding: 12, borderRadius: 8, backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe', gap: 6 },
  noticeTitle: { fontWeight: '700', color: '#0f172a' },
  noticeBody: { color: '#1e293b' },
  noticeActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorBox: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#fecdd3', backgroundColor: '#fff1f2', gap: 8 },
  errorText: { color: '#b91c1c' },
});
