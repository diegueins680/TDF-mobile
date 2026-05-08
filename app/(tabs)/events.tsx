import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Calendar } from 'react-native-calendars';

import { Events } from '../../src/api/events';
import { EventCard } from '../../src/components/EventCard';
import { useDebouncedValue } from '../../src/hooks/useDebouncedValue';
import type { SocialEvent } from '../../src/types';
import { listSavedEventIds, toggleSavedEvent } from '../../src/lib/savedEvents';

type ViewMode = 'calendar' | 'list';
type EventScope = 'all' | 'saved';

const toLocalDateKey = (value: string | Date): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value.split('T')[0] ?? '' : '';
  }
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function EventsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [eventScope, setEventScope] = useState<EventScope>('all');
  const [selectedDate, setSelectedDate] = useState<string>(toLocalDateKey(new Date()));
  const [cityFilter, setCityFilter] = useState('');
  const debouncedCity = useDebouncedValue(cityFilter, 300);

  const { data: events, isLoading, isError } = useQuery({
    queryKey: ['events', debouncedCity],
    queryFn: () => Events.list({ city: debouncedCity || undefined, upcomingOnly: true })
  });

  const savedEventIdsQuery = useQuery({
    queryKey: ['saved-event-ids'],
    queryFn: listSavedEventIds
  });

  const savedEventIds = useMemo(() => savedEventIdsQuery.data ?? [], [savedEventIdsQuery.data]);

  const savedEventsQuery = useQuery({
    queryKey: ['saved-events', 'browse', savedEventIds],
    enabled: savedEventIds.length > 0,
    queryFn: async () => {
      const settled = await Promise.allSettled(savedEventIds.map((savedEventId) => Events.getById(savedEventId)));
      const resolved = settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
      const cityNeedle = debouncedCity.trim().toLowerCase();
      if (!cityNeedle) return resolved;
      return resolved.filter((event) => event.venue?.city?.toLowerCase().includes(cityNeedle));
    }
  });

  const saveToggleMutation = useMutation({
    mutationFn: (eventId: string) => toggleSavedEvent(eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-event-ids'] });
      qc.invalidateQueries({ queryKey: ['saved-events'] });
    }
  });

  const effectiveEvents = useMemo(() => {
    if (eventScope === 'saved') return savedEventsQuery.data ?? [];
    return events ?? [];
  }, [eventScope, events, savedEventsQuery.data]);

  const eventsByDate = useMemo(() => {
    if (!effectiveEvents.length) return {};
    
    const grouped: Record<string, SocialEvent[]> = {};
    effectiveEvents.forEach(event => {
      const date = toLocalDateKey(event.startTime);
      if (!date) return;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(event);
    });
    return grouped;
  }, [effectiveEvents]);

  const selectedDateEvents = useMemo(() => {
    return eventsByDate[selectedDate] || [];
  }, [eventsByDate, selectedDate]);

  const markedDates = useMemo(() => {
    interface MarkedDateStyle {
      marked?: boolean;
      dotColor?: string;
      selected?: boolean;
      selectedColor?: string;
    }
    const marked: Record<string, MarkedDateStyle> = {};
    Object.keys(eventsByDate).forEach(date => {
      marked[date] = { marked: true, dotColor: '#2563eb' };
    });
    marked[selectedDate] = { ...marked[selectedDate], selected: true, selectedColor: '#2563eb' };
    return marked;
  }, [eventsByDate, selectedDate]);

  const handleCreateEvent = useCallback(() => {
    router.push('/createEvent');
  }, [router]);

  const handleToggleSaved = useCallback((eventId: string) => {
    saveToggleMutation.mutate(eventId);
  }, [saveToggleMutation]);

  const isCardUpdating = useCallback((eventId: string) => (
    saveToggleMutation.isPending && String(saveToggleMutation.variables) === eventId
  ), [saveToggleMutation.isPending, saveToggleMutation.variables]);

  const renderEventItem = useCallback(({ item }: { item: SocialEvent }) => (
    <EventCard
      event={item}
      saved={savedEventIds.includes(String(item.id))}
      onToggleSaved={() => handleToggleSaved(String(item.id))}
      saveDisabled={isCardUpdating(String(item.id))}
    />
  ), [handleToggleSaved, isCardUpdating, savedEventIds]);

  const keyExtractor = useCallback((item: SocialEvent) => String(item.id), []);

  const listLoading = eventScope === 'saved'
    ? (savedEventIdsQuery.isLoading || (savedEventIds.length > 0 && savedEventsQuery.isLoading))
    : isLoading;

  const listError = eventScope === 'saved' ? savedEventsQuery.isError : isError;

  if (listLoading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  if (listError) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <Text style={styles.error}>No se pudieron cargar los eventos</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Eventos cerca de ti</Text>
        <TouchableOpacity style={styles.createBtn} onPress={handleCreateEvent} accessibilityRole="button" accessibilityLabel="Crear evento">
          <Text style={styles.createBtnText}>+ Crear</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          placeholder="Buscar por ciudad..."
          value={cityFilter}
          onChangeText={setCityFilter}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Buscar eventos por ciudad"
        />
      </View>

      {/* View Mode Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleBtn, eventScope === 'all' && styles.toggleBtnActive]}
          onPress={() => setEventScope('all')}
          accessibilityRole="button"
          accessibilityLabel="Mostrar todos los eventos"
          accessibilityState={{ selected: eventScope === 'all' }}
        >
          <Text style={[styles.toggleBtnText, eventScope === 'all' && styles.toggleBtnTextActive]}>
            Todos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, eventScope === 'saved' && styles.toggleBtnActive]}
          onPress={() => setEventScope('saved')}
          accessibilityRole="button"
          accessibilityLabel="Mostrar eventos guardados"
          accessibilityState={{ selected: eventScope === 'saved' }}
        >
          <Text style={[styles.toggleBtnText, eventScope === 'saved' && styles.toggleBtnTextActive]}>
            Guardados ({savedEventIds.length})
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
          onPress={() => setViewMode('list')}
          accessibilityRole="button"
          accessibilityLabel="Ver en lista"
          accessibilityState={{ selected: viewMode === 'list' }}
        >
          <Text style={[styles.toggleBtnText, viewMode === 'list' && styles.toggleBtnTextActive]}>
            Lista
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'calendar' && styles.toggleBtnActive]}
          onPress={() => setViewMode('calendar')}
          accessibilityRole="button"
          accessibilityLabel="Ver en calendario"
          accessibilityState={{ selected: viewMode === 'calendar' }}
        >
          <Text style={[styles.toggleBtnText, viewMode === 'calendar' && styles.toggleBtnTextActive]}>
            Calendario
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {viewMode === 'calendar' ? (
        <View style={styles.calendarContainer}>
          <Calendar
            current={selectedDate}
            onDayPress={day => setSelectedDate(day.dateString)}
            markedDates={markedDates}
            theme={{
              backgroundColor: '#fff',
              calendarBackground: '#fff',
              textSectionTitleColor: '#666',
              selectedDayBackgroundColor: '#2563eb',
              selectedDayTextColor: '#fff',
              todayTextColor: '#2563eb',
              dotColor: '#2563eb',
              disabledArrowColor: '#ccc',
              monthTextColor: '#1a1a1a',
              textDisabledColor: '#ccc'
            }}
          />

          {selectedDateEvents.length > 0 ? (
            <FlatList
              data={selectedDateEvents}
              renderItem={renderEventItem}
              keyExtractor={keyExtractor}
              scrollEnabled={false}
              contentContainerStyle={styles.listContent}
            />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {eventScope === 'saved' ? 'No hay eventos guardados en esta fecha' : 'No hay eventos en esta fecha'}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <FlatList
          data={effectiveEvents}
          renderItem={renderEventItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {eventScope === 'saved' ? 'No se encontraron eventos guardados' : 'No se encontraron eventos'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa'
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a'
  },
  createBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff'
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1a1a1a'
  },
  toggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#fff'
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center'
  },
  toggleBtnActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb'
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666'
  },
  toggleBtnTextActive: {
    color: '#fff'
  },
  calendarContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40
  },
  emptyText: {
    fontSize: 14,
    color: '#999'
  },
  error: {
    fontSize: 14,
    color: '#dc2626'
  }
});
