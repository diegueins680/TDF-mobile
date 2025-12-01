import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bookings as BookingsApi } from '../../src/api/bookings';
import { useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';

export default function Bookings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['bookings'], queryFn: BookingsApi.list });

  const m = useMutation({
    mutationFn: BookingsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] })
  });

  const items = useMemo(() => q.data ?? [], [q.data]);

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

  const sorted = [...items].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <TouchableOpacity
        onPress={() => {
          const now = new Date();
          const start = now.toISOString();
          const end = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
          m.mutate({ title: 'Session', start, end });
        }}
        style={{ backgroundColor: '#2563eb', padding: 12, borderRadius: 8, marginBottom: 12 }}
      >
        <Text style={{ color: 'white', fontWeight: '700', textAlign: 'center' }}>
          Crear sesión rápida
        </Text>
      </TouchableOpacity>

      <FlatList
        data={sorted}
        keyExtractor={(item) => String(item.id)}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <View style={{ backgroundColor: 'white', borderRadius: 8, padding: 12, elevation: 2 }}>
            <Text style={{ fontWeight: '700' }}>{item.title}</Text>
            <Text style={{ color: '#475569' }}>{item.start}</Text>
            <Text style={{ color: '#475569' }}>{item.end}</Text>
            <Text style={{ color: '#22c55e', marginTop: 4 }}>{item.status}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ padding: 20 }}>
            <Text>No bookings</Text>
          </View>
        }
      />
    </View>
  );
}
