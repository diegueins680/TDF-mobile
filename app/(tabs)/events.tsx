import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Calendar } from 'react-native-calendars';

import { Events } from '../../src/api/events';
import { EventCard } from '../../src/components/EventCard';
import { useDebouncedValue } from '../../src/hooks/useDebouncedValue';
import type { SocialEvent } from '../../src/types';

type ViewMode = 'calendar' | 'list';

export default function EventsScreen() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [cityFilter, setCityFilter] = useState('');
  const debouncedCity = useDebouncedValue(cityFilter, 300);

  const { data: events, isLoading, isError } = useQuery({
    queryKey: ['events', debouncedCity],
    queryFn: () => Events.list({ city: debouncedCity || undefined, upcomingOnly: true })
  });

  const eventsByDate = useMemo(() => {
    if (!events) return {};
    
    const grouped: Record<string, typeof events> = {};
    events.forEach(event => {
      const date = event.startTime.split('T')[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(event);
    });
    return grouped;
  }, [events]);

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

  const renderEventItem = useCallback(({ item }: { item: SocialEvent }) => (
    <EventCard event={item} />
  ), []);

  const keyExtractor = useCallback((item: SocialEvent) => String(item.id), []);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Failed to load events</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Events Near You</Text>
        <TouchableOpacity style={styles.createBtn} onPress={handleCreateEvent}>
          <Text style={styles.createBtnText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          placeholder="Search by city..."
          value={cityFilter}
          onChangeText={setCityFilter}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* View Mode Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
          onPress={() => setViewMode('list')}
        >
          <Text style={[styles.toggleBtnText, viewMode === 'list' && styles.toggleBtnTextActive]}>
            List
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'calendar' && styles.toggleBtnActive]}
          onPress={() => setViewMode('calendar')}
        >
          <Text style={[styles.toggleBtnText, viewMode === 'calendar' && styles.toggleBtnTextActive]}>
            Calendar
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
              <Text style={styles.emptyText}>No events on this date</Text>
            </View>
          )}
        </View>
      ) : (
        <FlatList
          data={events || []}
          renderItem={renderEventItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No events found</Text>
            </View>
          }
        />
      )}
    </View>
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
