import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';

import { Bookings as BookingsApi } from '../../src/api/bookings';
import type { Booking } from '../../src/api/bookings';

export default function Bookings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['bookings'], queryFn: BookingsApi.list });

  const m = useMutation({
    mutationFn: BookingsApi.create,
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
      <Text style={{ color: '#22c55e', marginTop: 4 }}>{item.status}</Text>
    </View>
  ), []);

  const keyExtractor = useCallback((item: Booking) => String(item.id), []);

  const renderEmpty = useCallback(() => (
    <View style={{ padding: 20 }}>
      <Text>No bookings</Text>
    </View>
  ), []);

  const Separator = useCallback(() => <View style={{ height: 8 }} />, []);

  if (q.isError) {
    const message = q.error instanceof Error ? q.error.message : 'No se pudieron cargar las reservas.';
    return (
      <View style={{ padding: 20 }}>
        <Text style={{ color: 'red' }}>{message}</Text>
      </View>
    );
  }

  if (q.isLoading) {
    return (
      <View style={{ padding: 20 }}>
        <Text>Cargando reservas…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <TouchableOpacity
        onPress={createQuickSession}
        style={{ backgroundColor: '#2563eb', padding: 12, borderRadius: 8, marginBottom: 12 }}
      >
        <Text style={{ color: 'white', fontWeight: '700', textAlign: 'center' }}>
          Crear sesión rápida
        </Text>
      </TouchableOpacity>

      <FlatList
        data={sorted}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={Separator}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={8}
        removeClippedSubviews
      />
    </View>
  );
}
