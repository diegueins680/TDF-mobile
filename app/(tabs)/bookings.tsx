import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createBooking, listBookings } from '../../src/api/bookings';
import type { Booking } from '../../src/types';
import { useAppTheme } from '../../src/theme/ThemeProvider';

export default function Bookings() {
  const qc = useQueryClient();
  const { colors } = useAppTheme();
  const [refreshing, setRefreshing] = useState(false);
  const q = useQuery<Booking[]>({ queryKey: ['bookings'], queryFn: listBookings });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await q.refetch();
    } finally {
      setRefreshing(false);
    }
  };

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
    <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 12, elevation: 2 }} accessibilityRole="summary" accessibilityLabel={`${item.title}, inicio ${item.start}, fin ${item.end}${item.status ? `, estado ${item.status}` : ''}`}>
      <Text style={{ fontWeight: '700' }}>{item.title}</Text>
      <Text style={{ color: colors.textSecondary }}>{item.start}</Text>
      <Text style={{ color: colors.textSecondary }}>{item.end}</Text>
      {item.status ? <Text style={{ color: colors.success, marginTop: 4 }}>{item.status}</Text> : null}
    </View>
  ), [colors]);

  const keyExtractor = useCallback((item: Booking, index: number) => (
    `${item.id}-${item.start}-${index}`
  ), []);

  const renderEmpty = useCallback(() => (
    <View style={{ padding: 20 }}>
      <Text>No bookings</Text>
    </View>
  ), []);

  const Separator = useCallback(() => <View style={{ height: 8 }} />, []);

  if (q.isError) {
    const message = q.error instanceof Error ? q.error.message : 'No se pudieron cargar las reservas.';
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, padding: 20 }}>
        <Text style={{ color: colors.danger }} accessibilityLiveRegion="polite">{message}</Text>
      </SafeAreaView>
    );
  }

  if (q.isLoading) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, padding: 20 }}>
        <Text accessibilityLiveRegion="polite">Cargando reservas…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, padding: 16 }}>
      <TouchableOpacity
        onPress={createQuickSession}
        style={{ backgroundColor: colors.actionPrimary, padding: 12, borderRadius: 8, marginBottom: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Crear sesión rápida de 1 hora"
        accessibilityState={{ busy: m.isPending }}
      >
        <Text style={{ color: colors.actionPrimaryContrast, fontWeight: '700', textAlign: 'center' }}>
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.actionPrimary} colors={[colors.actionPrimary]} />
        }
      />
    </SafeAreaView>
  );
}
