import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar } from 'react-native-calendars';

import { Events } from '../../src/api/events';
import { EventCard } from '../../src/components/EventCard';
import { useDebouncedValue } from '../../src/hooks/useDebouncedValue';
import type { EventCityInput, SocialEvent } from '../../src/types';
import { listSavedEventIds, toggleSavedEvent } from '../../src/lib/savedEvents';
import { useUserSettings } from '../../src/providers/UserSettingsProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { useAnalytics } from '../../src/analytics/AnalyticsProvider';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import { EventListSkeleton } from '../../src/components/skeletons/EventListSkeleton';
import { impactLight } from '../../src/utils/haptics';
import { markFirstValueCompleted } from '../../src/lib/onboardingIntent';
import { markNewUserOnboardingCompleted } from '../../src/lib/firstRunFlags';

type ViewMode = 'calendar' | 'list';
type EventScope = 'all' | 'saved';
type DiscoveryScope = 'subscribed' | 'all';

const toLocalDateKey = (value: string | Date, timeZone: string): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value.split('T')[0] ?? '' : '';
  }
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  return `${year}-${month}-${day}`;
};

export default function EventsScreen() {
  const qc = useQueryClient();
  const { colors } = useAppTheme();
  const analytics = useAnalytics();
  const { partyId } = useAuth();
  const { locale, timezone, countryCode } = useUserSettings();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [eventScope, setEventScope] = useState<EventScope>('all');
  const [discoveryScope, setDiscoveryScope] = useState<DiscoveryScope>('subscribed');
  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalDateKey(new Date(), timezone));
  const [searchFilter, setSearchFilter] = useState('');
  const [showCityModal, setShowCityModal] = useState(false);
  const [draftCities, setDraftCities] = useState<EventCityInput[]>([]);
  const [newCityName, setNewCityName] = useState('');
  const [newCountryCode, setNewCountryCode] = useState(countryCode ?? 'US');
  const debouncedSearch = useDebouncedValue(searchFilter, 250);
  const [refreshing, setRefreshing] = useState(false);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (eventScope === 'saved') {
        await savedEventsQuery.refetch();
      } else {
        await refetch();
      }
    } finally {
      setRefreshing(false);
    }
  }, [eventScope, refetch, savedEventsQuery]);

  const saveToggleMutation = useMutation({
    mutationFn: (eventId: string) => toggleSavedEvent(eventId),
    onSuccess: async (_data, eventId) => {
      const wasSaved = savedEventIds.includes(eventId);
      void impactLight();
      analytics.capture('feature_favorite_changed', {
        platform: 'mobile',
        event_id: eventId,
        action: wasSaved ? 'unsaved' : 'saved',
      });
      if (!wasSaved && await markFirstValueCompleted(partyId, 'event_saved')) {
        analytics.capture('first_value_completed', { platform: 'mobile', value: 'event_saved' });
        analytics.capture('onboarding_completed', { platform: 'mobile', reason: 'first_value', value: 'event_saved' });
        if (partyId) await markNewUserOnboardingCompleted(partyId);
      }
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
    const needle = debouncedSearch.trim().toLocaleLowerCase(locale);
    return source
      .filter((event) => {
        if (!event.isPublic || !event.publicListable) return false;
        if (!needle) return true;
        return [
          event.title,
          event.venue?.name,
          event.venue?.city,
          ...(event.artists?.map((artist) => artist.name) ?? []),
        ].some((value) => value?.toLocaleLowerCase(locale).includes(needle));
      })
      .sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime());
  }, [debouncedSearch, eventScope, events, locale, savedEventsQuery.data]);

  const searchQuery = debouncedSearch.trim();
  const hasSearchNoResults = searchQuery.length > 0 && effectiveEvents.length === 0;

  useEffect(() => {
    if (hasSearchNoResults) {
      analytics.capture('feature_search_no_results', {
        platform: 'mobile',
        query: searchQuery,
        scope: eventScope,
        discovery_scope: discoveryScope,
      });
    }
  }, [hasSearchNoResults, searchQuery, eventScope, discoveryScope, analytics]);

  const eventsByDate = useMemo(() => {
    if (!effectiveEvents.length) return {};
    
    const grouped: Record<string, SocialEvent[]> = {};
    effectiveEvents.forEach(event => {
      const date = toLocalDateKey(event.startTime, timezone);
      if (!date) return;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(event);
    });
    return grouped;
  }, [effectiveEvents, timezone]);

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
      marked[date] = { marked: true, dotColor: colors.actionPrimary };
    });
    marked[selectedDate] = { ...marked[selectedDate], selected: true, selectedColor: colors.actionPrimary };
    return marked;
  }, [colors.actionPrimary, eventsByDate, selectedDate]);

  const handleToggleSaved = useCallback((eventId: string) => {
    const isCurrentlySaved = savedEventIds.includes(eventId);
    if (isCurrentlySaved) {
      Alert.alert(
        'Quitar evento guardado',
        '¿Quieres quitar este evento de tus guardados?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Quitar', style: 'destructive', onPress: () => saveToggleMutation.mutate(eventId) },
        ],
      );
    } else {
      saveToggleMutation.mutate(eventId);
    }
  }, [saveToggleMutation, savedEventIds]);

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

  const hasListData = eventScope === 'saved' ? !!savedEventsQuery.data : !!events;
  if (listLoading && !hasListData) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <EventListSkeleton />
      </SafeAreaView>
    );
  }

  if (listError) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <Text style={[styles.error, { color: colors.danger }]} accessibilityLiveRegion="polite">No se pudieron cargar los eventos</Text>
        <Text style={[styles.errorHelper, { color: colors.textSecondary }]} accessibilityLiveRegion="polite">Comprueba tu conexión e inténtalo nuevamente.</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.actionPrimary }]}
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
          <Text style={[styles.retryButtonText, { color: colors.actionPrimaryContrast }]}>Reintentar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.canvas }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.canvas }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]} accessibilityRole="header">Eventos cerca de ti</Text>
        <TouchableOpacity
          style={[
            styles.manageCitiesButton,
            { backgroundColor: colors.selected },
            citySubscriptionsQuery.isLoading && styles.manageCitiesButtonDisabled,
          ]}
          onPress={openCityModal}
          disabled={citySubscriptionsQuery.isLoading}
          accessibilityRole="button"
          accessibilityLabel="Administrar ciudades suscritas"
        >
          <Text style={[styles.manageCitiesButtonText, { color: colors.actionPrimary }]}>Ciudades</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
        <TextInput
          placeholder="Buscar eventos, artistas o ciudades"
          value={searchFilter}
          onChangeText={setSearchFilter}
          style={[styles.searchInput, { borderColor: colors.borderSubtle, color: colors.textPrimary }]}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Buscar eventos, artistas o ciudades"
        />
        {isFetching && !isLoading ? <ActivityIndicator size="small" color={colors.actionPrimary} /> : null}
      </View>

      {/* View Mode Toggle */}
      <View style={[styles.toggleContainer, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[styles.toggleBtn, { borderColor: colors.borderSubtle }, discoveryScope === 'subscribed' && [styles.toggleBtnActive, { backgroundColor: colors.actionPrimary, borderColor: colors.actionPrimary }]]}
          onPress={() => setDiscoveryScope('subscribed')}
          accessibilityRole="tab"
          accessibilityLabel="Ver eventos de mis ciudades"
          accessibilityState={{ selected: discoveryScope === 'subscribed' }}
        >
          <Text style={[styles.toggleBtnText, { color: colors.textSecondary }, discoveryScope === 'subscribed' && [styles.toggleBtnTextActive, { color: colors.actionPrimaryContrast }]]}>
            Mis ciudades
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, { borderColor: colors.borderSubtle }, discoveryScope === 'all' && [styles.toggleBtnActive, { backgroundColor: colors.actionPrimary, borderColor: colors.actionPrimary }]]}
          onPress={() => setDiscoveryScope('all')}
          accessibilityRole="tab"
          accessibilityLabel="Explorar eventos de todas las ciudades"
          accessibilityState={{ selected: discoveryScope === 'all' }}
        >
          <Text style={[styles.toggleBtnText, { color: colors.textSecondary }, discoveryScope === 'all' && [styles.toggleBtnTextActive, { color: colors.actionPrimaryContrast }]]}>
            Explorar
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.toggleContainer, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[styles.toggleBtn, { borderColor: colors.borderSubtle }, eventScope === 'all' && [styles.toggleBtnActive, { backgroundColor: colors.actionPrimary, borderColor: colors.actionPrimary }]]}
          onPress={() => setEventScope('all')}
          accessibilityRole="tab"
          accessibilityLabel="Mostrar todos los eventos"
          accessibilityState={{ selected: eventScope === 'all' }}
        >
          <Text style={[styles.toggleBtnText, { color: colors.textSecondary }, eventScope === 'all' && [styles.toggleBtnTextActive, { color: colors.actionPrimaryContrast }]]}>
            Todos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, { borderColor: colors.borderSubtle }, eventScope === 'saved' && [styles.toggleBtnActive, { backgroundColor: colors.actionPrimary, borderColor: colors.actionPrimary }]]}
          onPress={() => setEventScope('saved')}
          accessibilityRole="tab"
          accessibilityLabel="Mostrar eventos guardados"
          accessibilityState={{ selected: eventScope === 'saved' }}
        >
          <Text style={[styles.toggleBtnText, { color: colors.textSecondary }, eventScope === 'saved' && [styles.toggleBtnTextActive, { color: colors.actionPrimaryContrast }]]}>
            Guardados ({savedEventIds.length})
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.toggleContainer, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[styles.toggleBtn, { borderColor: colors.borderSubtle }, viewMode === 'list' && [styles.toggleBtnActive, { backgroundColor: colors.actionPrimary, borderColor: colors.actionPrimary }]]}
          onPress={() => setViewMode('list')}
          accessibilityRole="tab"
          accessibilityLabel="Ver en lista"
          accessibilityState={{ selected: viewMode === 'list' }}
        >
          <Text style={[styles.toggleBtnText, { color: colors.textSecondary }, viewMode === 'list' && [styles.toggleBtnTextActive, { color: colors.actionPrimaryContrast }]]}>
            Lista
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, { borderColor: colors.borderSubtle }, viewMode === 'calendar' && [styles.toggleBtnActive, { backgroundColor: colors.actionPrimary, borderColor: colors.actionPrimary }]]}
          onPress={() => setViewMode('calendar')}
          accessibilityRole="tab"
          accessibilityLabel="Ver en calendario"
          accessibilityState={{ selected: viewMode === 'calendar' }}
        >
          <Text style={[styles.toggleBtnText, { color: colors.textSecondary }, viewMode === 'calendar' && [styles.toggleBtnTextActive, { color: colors.actionPrimaryContrast }]]}>
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
              backgroundColor: colors.canvas,
              calendarBackground: colors.surface,
              monthTextColor: colors.textPrimary,
              dayTextColor: colors.textPrimary,
              textSectionTitleColor: colors.textSecondary,
              todayTextColor: colors.actionPrimary,
              selectedDayBackgroundColor: colors.actionPrimary,
              selectedDayTextColor: colors.actionPrimaryContrast,
              arrowColor: colors.actionPrimary,
              textDayFontFamily: undefined,
              textMonthFontFamily: undefined,
              textDayHeaderFontFamily: undefined,
            }}
          />

          {selectedDateEvents.length > 0 ? (
            <FlatList
              data={selectedDateEvents}
              renderItem={renderEventItem}
              keyExtractor={keyExtractor}
              style={styles.calendarList}
              contentContainerStyle={styles.calendarListContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.actionPrimary} colors={[colors.actionPrimary]} />
              }
            />
          ) : (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.actionPrimary} colors={[colors.actionPrimary]} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
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
                  style={[styles.emptyCitiesButton, { backgroundColor: colors.selected }]}
                  onPress={openCityModal}
                  disabled={citySubscriptionsQuery.isLoading}
                  accessibilityRole="button"
                  accessibilityLabel="Elegir ciudades para seguir eventos"
                  accessibilityState={{ disabled: citySubscriptionsQuery.isLoading }}
                >
                  <Text style={[styles.emptyCitiesButtonText, { color: colors.actionPrimary }]}>Elegir ciudades</Text>
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
        accessibilityViewIsModal
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.cityModal, { backgroundColor: colors.surface }]}>
            <View style={styles.cityModalHeader}>
              <View style={styles.cityModalTitleGroup}>
                <Text style={[styles.cityModalTitle, { color: colors.textPrimary }]}>Tus ciudades</Text>
                <Text style={[styles.cityModalSubtitle, { color: colors.textSecondary }]}>
                  Importaremos eventos de estas ciudades cada seis horas.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowCityModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Cerrar selector de ciudades"
                hitSlop={8}
              >
                <Text style={[styles.cityModalClose, { color: colors.actionPrimary }]}>Cerrar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.cityList} keyboardShouldPersistTaps="handled">
              {draftCities.map((city) => (
                <View key={`${city.countryCode}:${city.name.toLocaleLowerCase()}`} style={[styles.cityChip, { borderColor: colors.borderSubtle }]}>
                  <View>
                    <Text style={[styles.cityChipName, { color: colors.textPrimary }]}>{city.name}</Text>
                    <Text style={[styles.cityChipCountry, { color: colors.textSecondary }]}>{city.countryCode}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setDraftCities((current) => current.filter(
                      (candidate) =>
                        candidate.name !== city.name || candidate.countryCode !== city.countryCode,
                    ))}
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar ${city.name}`}
                  >
                    <Text style={[styles.cityRemove, { color: colors.danger }]}>Quitar</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {draftCities.length === 0 ? (
                <Text style={[styles.cityEmpty, { color: colors.textSecondary }]}>Todavía no sigues ninguna ciudad.</Text>
              ) : null}
            </ScrollView>

            <View style={styles.cityAddRow}>
              <TextInput
                style={[styles.cityInput, styles.cityNameInput, { borderColor: colors.borderSubtle, color: colors.textPrimary }]}
                placeholder="Ciudad"
                value={newCityName}
                onChangeText={setNewCityName}
                maxLength={120}
                accessibilityLabel="Nombre de ciudad"
              />
              <TextInput
                style={[styles.cityInput, styles.countryInput, { borderColor: colors.borderSubtle, color: colors.textPrimary }]}
                placeholder="EC"
                value={newCountryCode}
                onChangeText={(value) => setNewCountryCode(value.toUpperCase().slice(0, 2))}
                autoCapitalize="characters"
                maxLength={2}
                accessibilityLabel="Código de país"
              />
              <TouchableOpacity style={[styles.cityAddButton, { backgroundColor: colors.selected }]} onPress={addDraftCity} accessibilityRole="button" accessibilityLabel="Añadir ciudad a la lista">
                <Text style={[styles.cityAddButtonText, { color: colors.actionPrimary }]}>Añadir</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.citySaveButton,
                { backgroundColor: colors.actionPrimary },
                citySubscriptionsMutation.isPending && styles.citySaveButtonDisabled,
              ]}
              disabled={citySubscriptionsMutation.isPending}
              onPress={() => citySubscriptionsMutation.mutate(draftCities)}
              accessibilityRole="button"
              accessibilityLabel="Guardar ciudades suscritas"
              accessibilityState={{ busy: citySubscriptionsMutation.isPending, disabled: citySubscriptionsMutation.isPending }}
            >
              {citySubscriptionsMutation.isPending ? (
                <ActivityIndicator color={colors.actionPrimaryContrast} />
              ) : (
                <Text style={[styles.citySaveButtonText, { color: colors.actionPrimaryContrast }]}>Guardar ciudades</Text>
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
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  manageCitiesButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  manageCitiesButtonText: {
    fontSize: 13,
    fontWeight: '700'
  },
  manageCitiesButtonDisabled: {
    opacity: 0.5
  },
  createBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  createBtnText: {
    fontWeight: '600',
    fontSize: 12
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  toggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center'
  },
  toggleBtnActive: {},
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  toggleBtnTextActive: {},
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
    textAlign: 'center'
  },
  emptyCitiesButton: {
    minHeight: 42,
    justifyContent: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  emptyCitiesButtonText: {
    fontWeight: '800'
  },
  error: {
    fontSize: 14,
  },
  errorHelper: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center'
  },
  retryButton: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12
  },
  retryButtonText: {
    fontWeight: '800'
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)'
  },
  cityModal: {
    maxHeight: '82%',
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
    fontSize: 20,
    fontWeight: '800'
  },
  cityModalSubtitle: {
    fontSize: 13,
    marginTop: 4
  },
  cityModalClose: {
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
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 8
  },
  cityChipName: {
    fontSize: 15,
    fontWeight: '700'
  },
  cityChipCountry: {
    fontSize: 12,
    marginTop: 2
  },
  cityRemove: {
    fontSize: 13,
    fontWeight: '700'
  },
  cityEmpty: {
    textAlign: 'center',
    paddingVertical: 24
  },
  cityAddRow: {
    flexDirection: 'row',
    gap: 8
  },
  cityInput: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
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
    paddingHorizontal: 12
  },
  cityAddButtonText: {
    fontWeight: '800'
  },
  citySaveButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  citySaveButtonDisabled: {
    opacity: 0.6
  },
  citySaveButtonText: {
    fontSize: 15,
    fontWeight: '800'
  }
});
