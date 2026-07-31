import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar } from 'react-native-calendars';

import { Events } from '../../src/api/events';
import { EventCard } from '../../src/components/EventCard';
import { useDebouncedValue } from '../../src/hooks/useDebouncedValue';
import type { EventCityInput, SocialEvent } from '../../src/types';
import { listSavedEventIds, toggleSavedEvent } from '../../src/lib/savedEvents';

type ViewMode = 'calendar' | 'list';
type EventScope = 'all' | 'saved';
type DiscoveryScope = 'subscribed' | 'all';

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
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [eventScope, setEventScope] = useState<EventScope>('all');
  const [discoveryScope, setDiscoveryScope] = useState<DiscoveryScope>('subscribed');
  const [selectedDate, setSelectedDate] = useState<string>(toLocalDateKey(new Date()));
  const [searchFilter, setSearchFilter] = useState('');
  const [showCityModal, setShowCityModal] = useState(false);
  const [draftCities, setDraftCities] = useState<EventCityInput[]>([]);
  const [newCityName, setNewCityName] = useState('');
  const [newCountryCode, setNewCountryCode] = useState('EC');
  const debouncedSearch = useDebouncedValue(searchFilter, 250);

  const { data: events, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['events', 'buyer-upcoming', discoveryScope],
    queryFn: () => Events.list({ upcomingOnly: true, scope: discoveryScope })
  });

  const citySubscriptionsQuery = useQuery({
    queryKey: ['event-city-subscriptions'],
    queryFn: Events.getCitySubscriptions,
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
      return resolved;
    }
  });

  const saveToggleMutation = useMutation({
    mutationFn: (eventId: string) => toggleSavedEvent(eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-event-ids'] });
      qc.invalidateQueries({ queryKey: ['saved-events'] });
    }
  });

  const citySubscriptionsMutation = useMutation({
    mutationFn: Events.replaceCitySubscriptions,
    onSuccess: (cities) => {
      setDraftCities(cities.map((city) => ({
        name: city.name,
        countryCode: city.countryCode,
        timeZone: city.timeZone,
      })));
      setShowCityModal(false);
      qc.invalidateQueries({ queryKey: ['event-city-subscriptions'] });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (error) => {
      Alert.alert(
        'No pudimos guardar tus ciudades',
        error instanceof Error ? error.message : 'Inténtalo nuevamente.',
      );
    },
  });

  const openCityModal = useCallback(() => {
    if (citySubscriptionsQuery.isError) {
      Alert.alert(
        'No pudimos cargar tus ciudades',
        'Comprueba tu conexión e inténtalo nuevamente.',
      );
      return;
    }
    if (citySubscriptionsQuery.isLoading) return;
    setDraftCities((citySubscriptionsQuery.data ?? []).map((city) => ({
      name: city.name,
      countryCode: city.countryCode,
      timeZone: city.timeZone,
    })));
    setShowCityModal(true);
  }, [
    citySubscriptionsQuery.data,
    citySubscriptionsQuery.isError,
    citySubscriptionsQuery.isLoading,
  ]);

  const addDraftCity = useCallback(() => {
    const name = newCityName.trim();
    const countryCode = newCountryCode.trim().toUpperCase();
    if (!name) {
      Alert.alert('Falta la ciudad', 'Escribe el nombre de la ciudad.');
      return;
    }
    if (!/^[A-Z]{2}$/.test(countryCode)) {
      Alert.alert('País inválido', 'Usa el código ISO de dos letras, por ejemplo EC, CO o MX.');
      return;
    }
    const alreadyAdded = draftCities.some(
      (city) =>
        city.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase()
        && city.countryCode.toUpperCase() === countryCode,
    );
    if (!alreadyAdded) {
      setDraftCities((current) => [...current, { name, countryCode }]);
    }
    setNewCityName('');
  }, [draftCities, newCityName, newCountryCode]);

  const effectiveEvents = useMemo(() => {
    const source = eventScope === 'saved' ? savedEventsQuery.data ?? [] : events ?? [];
    const needle = debouncedSearch.trim().toLocaleLowerCase('es-EC');
    return source
      .filter((event) => {
        if (!event.isPublic) return false;
        const status = event.status?.toLowerCase();
        if (status === 'cancelled' || status === 'completed') return false;
        if (!needle) return true;
        return [
          event.title,
          event.venue?.name,
          event.venue?.city,
          ...(event.artists?.map((artist) => artist.name) ?? []),
        ].some((value) => value?.toLocaleLowerCase('es-EC').includes(needle));
      })
      .sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime());
  }, [debouncedSearch, eventScope, events, savedEventsQuery.data]);

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
        <Text style={styles.errorHelper}>Comprueba tu conexión e inténtalo nuevamente.</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            if (eventScope === 'saved') {
              void savedEventsQuery.refetch();
            } else {
              void refetch();
            }
          }}
          accessibilityRole="button"
          accessibilityLabel="Reintentar cargar eventos"
        >
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Eventos cerca de ti</Text>
        <TouchableOpacity
          style={[
            styles.manageCitiesButton,
            citySubscriptionsQuery.isLoading && styles.manageCitiesButtonDisabled,
          ]}
          onPress={openCityModal}
          disabled={citySubscriptionsQuery.isLoading}
          accessibilityRole="button"
          accessibilityLabel="Administrar ciudades suscritas"
        >
          <Text style={styles.manageCitiesButtonText}>Ciudades</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          placeholder="Buscar eventos, artistas o ciudades"
          value={searchFilter}
          onChangeText={setSearchFilter}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Buscar eventos, artistas o ciudades"
        />
        {isFetching && !isLoading ? <ActivityIndicator size="small" color="#7c3aed" /> : null}
      </View>

      {/* View Mode Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleBtn, discoveryScope === 'subscribed' && styles.toggleBtnActive]}
          onPress={() => setDiscoveryScope('subscribed')}
          accessibilityRole="button"
          accessibilityLabel="Ver eventos de mis ciudades"
          accessibilityState={{ selected: discoveryScope === 'subscribed' }}
        >
          <Text style={[styles.toggleBtnText, discoveryScope === 'subscribed' && styles.toggleBtnTextActive]}>
            Mis ciudades
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, discoveryScope === 'all' && styles.toggleBtnActive]}
          onPress={() => setDiscoveryScope('all')}
          accessibilityRole="button"
          accessibilityLabel="Explorar eventos de todas las ciudades"
          accessibilityState={{ selected: discoveryScope === 'all' }}
        >
          <Text style={[styles.toggleBtnText, discoveryScope === 'all' && styles.toggleBtnTextActive]}>
            Explorar
          </Text>
        </TouchableOpacity>
      </View>

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
              style={styles.calendarList}
              contentContainerStyle={styles.calendarListContent}
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
                {debouncedSearch
                  ? 'No encontramos eventos que coincidan con tu búsqueda'
                  : eventScope === 'saved'
                    ? 'No se encontraron eventos guardados'
                    : discoveryScope === 'subscribed'
                      ? 'Añade ciudades para ver los eventos que ocurren cerca de ti'
                    : 'No hay próximos eventos publicados'}
              </Text>
              {!debouncedSearch && eventScope === 'all' && discoveryScope === 'subscribed' ? (
                <TouchableOpacity
                  style={styles.emptyCitiesButton}
                  onPress={openCityModal}
                  disabled={citySubscriptionsQuery.isLoading}
                >
                  <Text style={styles.emptyCitiesButtonText}>Elegir ciudades</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}

      <Modal
        visible={showCityModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCityModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.cityModal}>
            <View style={styles.cityModalHeader}>
              <View style={styles.cityModalTitleGroup}>
                <Text style={styles.cityModalTitle}>Tus ciudades</Text>
                <Text style={styles.cityModalSubtitle}>
                  Importaremos eventos de estas ciudades cada seis horas.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowCityModal(false)} accessibilityRole="button">
                <Text style={styles.cityModalClose}>Cerrar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.cityList} keyboardShouldPersistTaps="handled">
              {draftCities.map((city) => (
                <View key={`${city.countryCode}:${city.name.toLocaleLowerCase()}`} style={styles.cityChip}>
                  <View>
                    <Text style={styles.cityChipName}>{city.name}</Text>
                    <Text style={styles.cityChipCountry}>{city.countryCode}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setDraftCities((current) => current.filter(
                      (candidate) =>
                        candidate.name !== city.name || candidate.countryCode !== city.countryCode,
                    ))}
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar ${city.name}`}
                  >
                    <Text style={styles.cityRemove}>Quitar</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {draftCities.length === 0 ? (
                <Text style={styles.cityEmpty}>Todavía no sigues ninguna ciudad.</Text>
              ) : null}
            </ScrollView>

            <View style={styles.cityAddRow}>
              <TextInput
                style={[styles.cityInput, styles.cityNameInput]}
                placeholder="Ciudad"
                value={newCityName}
                onChangeText={setNewCityName}
                maxLength={120}
                accessibilityLabel="Nombre de ciudad"
              />
              <TextInput
                style={[styles.cityInput, styles.countryInput]}
                placeholder="EC"
                value={newCountryCode}
                onChangeText={(value) => setNewCountryCode(value.toUpperCase().slice(0, 2))}
                autoCapitalize="characters"
                maxLength={2}
                accessibilityLabel="Código de país"
              />
              <TouchableOpacity style={styles.cityAddButton} onPress={addDraftCity}>
                <Text style={styles.cityAddButtonText}>Añadir</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.citySaveButton,
                citySubscriptionsMutation.isPending && styles.citySaveButtonDisabled,
              ]}
              disabled={citySubscriptionsMutation.isPending}
              onPress={() => citySubscriptionsMutation.mutate(draftCities)}
              accessibilityRole="button"
            >
              {citySubscriptionsMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.citySaveButtonText}>Guardar ciudades</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  manageCitiesButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#ede9fe'
  },
  manageCitiesButtonText: {
    color: '#6d28d9',
    fontSize: 13,
    fontWeight: '700'
  },
  manageCitiesButtonDisabled: {
    opacity: 0.5
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
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  searchInput: {
    flex: 1,
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
  calendarList: {
    flex: 1
  },
  calendarListContent: {
    paddingTop: 12,
    paddingBottom: 24
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
    color: '#6b7280',
    textAlign: 'center'
  },
  emptyCitiesButton: {
    minHeight: 42,
    justifyContent: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#ede9fe'
  },
  emptyCitiesButtonText: {
    color: '#6d28d9',
    fontWeight: '800'
  },
  error: {
    fontSize: 14,
    color: '#dc2626'
  },
  errorHelper: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
    textAlign: 'center'
  },
  retryButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '800'
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)'
  },
  cityModal: {
    maxHeight: '82%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 16
  },
  cityModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12
  },
  cityModalTitleGroup: {
    flex: 1
  },
  cityModalTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '800'
  },
  cityModalSubtitle: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 4
  },
  cityModalClose: {
    color: '#6d28d9',
    fontWeight: '700',
    paddingVertical: 4
  },
  cityList: {
    maxHeight: 280
  },
  cityChip: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 8
  },
  cityChipName: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700'
  },
  cityChipCountry: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2
  },
  cityRemove: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '700'
  },
  cityEmpty: {
    textAlign: 'center',
    color: '#6b7280',
    paddingVertical: 24
  },
  cityAddRow: {
    flexDirection: 'row',
    gap: 8
  },
  cityInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#111827'
  },
  cityNameInput: {
    flex: 1
  },
  countryInput: {
    width: 58,
    textAlign: 'center'
  },
  cityAddButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#ede9fe',
    paddingHorizontal: 12
  },
  cityAddButtonText: {
    color: '#6d28d9',
    fontWeight: '800'
  },
  citySaveButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#7c3aed'
  },
  citySaveButtonDisabled: {
    opacity: 0.6
  },
  citySaveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800'
  }
});
