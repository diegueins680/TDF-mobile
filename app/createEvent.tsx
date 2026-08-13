import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator,
  FlatList, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Events } from '../src/api/events';
import { Venues } from '../src/api/venues';
import { Artists } from '../src/api/artists';
import type { ID, ArtistProfile, Venue } from '../src/types';
import { normalizeRouteParam } from '../src/lib/routeParams';
import { useUserSettings } from '../src/providers/UserSettingsProvider';

const hasSameId = (left: ID | null | undefined, right: ID | null | undefined): boolean =>
  left != null && right != null && String(left) === String(right);

export default function CreateEventScreen() {
  const { venueId: rawVenueId } = useLocalSearchParams<{ venueId?: string | string[] }>();
  const router = useRouter();
  const qc = useQueryClient();
  const {
    currency,
    catalogSource,
    catalogSyncing,
    getCatalogItems,
    getCatalogDefaults,
    refreshCatalogs,
  } = useUserSettings();
  const routeVenueId = useMemo(() => normalizeRouteParam(rawVenueId), [rawVenueId]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventTypeId, setEventTypeId] = useState('');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date(new Date().getTime() + 2 * 60 * 60 * 1000));
  const [startInput, setStartInput] = useState(startTime.toISOString());
  const [endInput, setEndInput] = useState(endTime.toISOString());
  const [venueId, setVenueId] = useState<ID | null>(null);
  const [artistIds, setArtistIds] = useState<ID[]>([]);
  const [ticketPrice, setTicketPrice] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const [showVenueModal, setShowVenueModal] = useState(false);
  const [showArtistModal, setShowArtistModal] = useState(false);
  const [venueSearch, setVenueSearch] = useState('');
  const [artistSearch, setArtistSearch] = useState('');
  const [selectedVenueSnapshot, setSelectedVenueSnapshot] = useState<Venue | null>(null);
  const [selectedArtistsById, setSelectedArtistsById] = useState<Record<string, ArtistProfile>>({});

  const eventTypeOptions = useMemo(
    () => getCatalogItems('event-types').filter((item) => (
      item.active && item.workflowState === 'published' && !item.deprecatedAt
    )),
    [getCatalogItems],
  );
  const defaultEventTypeId = useMemo(
    () => getCatalogDefaults('event-types').find((entry) => (
      entry.scopeKind === 'social-event'
      && entry.scopeId === 'global'
      && !entry.localeId
      && eventTypeOptions.some((item) => item.id === entry.entityId)
    ))?.entityId ?? '',
    [eventTypeOptions, getCatalogDefaults],
  );
  const eventTypeSelectionValid = eventTypeOptions.some((item) => item.id === eventTypeId);

  const { data: venues, isLoading: venuesLoading } = useQuery({
    queryKey: ['venues', venueSearch],
    queryFn: () => venueSearch ? Venues.search(venueSearch) : Venues.list()
  });

  const { data: artists, isLoading: artistsLoading } = useQuery({
    queryKey: ['artists', artistSearch],
    queryFn: () => artistSearch ? Artists.searchByName(artistSearch) : Artists.list({ limit: 100 })
  });

  const routeVenueQuery = useQuery({
    queryKey: ['venue', routeVenueId],
    queryFn: () => (routeVenueId ? Venues.getById(routeVenueId) : null),
    enabled: Boolean(routeVenueId)
  });

  const createMutation = useMutation({
    mutationFn: (body: Parameters<typeof Events.create>[0]) => Events.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      Alert.alert('Éxito', '¡Evento creado!');
      router.back();
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message || 'No se pudo crear el evento');
    }
  });

  useEffect(() => {
    if (routeVenueId && !venueId) {
      setVenueId(routeVenueId);
    }
  }, [routeVenueId, venueId]);

  useEffect(() => {
    if (!eventTypeId && defaultEventTypeId) setEventTypeId(defaultEventTypeId);
  }, [defaultEventTypeId, eventTypeId]);

  useEffect(() => {
    if (!venueId || !venues?.length) return;
    const matchedVenue = venues.find((venue) => hasSameId(venue.id, venueId));
    if (matchedVenue) {
      setSelectedVenueSnapshot((current) => (
        current && hasSameId(current.id, matchedVenue.id) && current.name === matchedVenue.name
          ? current
          : matchedVenue
      ));
    }
  }, [venueId, venues]);

  useEffect(() => {
    if (!venueId || !routeVenueQuery.data || !hasSameId(routeVenueQuery.data.id, venueId)) return;
    setSelectedVenueSnapshot((current) => (
      current && hasSameId(current.id, routeVenueQuery.data.id) && current.name === routeVenueQuery.data.name
        ? current
        : routeVenueQuery.data
    ));
  }, [routeVenueQuery.data, venueId]);

  useEffect(() => {
    if (!artists?.length || artistIds.length === 0) return;
    setSelectedArtistsById((current) => {
      let changed = false;
      const next = { ...current };
      artists.forEach((artist) => {
        const artistKey = String(artist.id);
        if (!artistIds.some((id) => String(id) === artistKey)) return;
        const previous = next[artistKey];
        if (!previous || previous.name !== artist.name) {
          next[artistKey] = artist;
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [artistIds, artists]);

  const selectedVenue = useMemo(() => {
    if (selectedVenueSnapshot && hasSameId(selectedVenueSnapshot.id, venueId)) return selectedVenueSnapshot;
    if (routeVenueQuery.data && hasSameId(routeVenueQuery.data.id, venueId)) return routeVenueQuery.data;
    return null;
  }, [routeVenueQuery.data, selectedVenueSnapshot, venueId]);

  const artistById = useMemo(() => {
    const map = new Map<string, ArtistProfile>();
    Object.keys(selectedArtistsById).forEach((key) => {
      map.set(key, selectedArtistsById[key]);
    });
    (artists ?? []).forEach((artist) => map.set(String(artist.id), artist));
    return map;
  }, [artists, selectedArtistsById]);
  const selectedArtistNames = useMemo(
    () => artistIds.map((id) => artistById.get(String(id))?.name).filter((name): name is string => Boolean(name)),
    [artistById, artistIds]
  );

  const parseDateInput = useCallback((text: string) => {
    const parsed = new Date(text);
    if (isNaN(parsed.getTime())) {
      Alert.alert('Formato de fecha', 'Usa un formato válido, por ejemplo 2025-12-15T15:00:00Z');
      return null;
    }
    return parsed;
  }, []);

  useEffect(() => {
    setStartInput(startTime.toISOString());
  }, [startTime]);

  useEffect(() => {
    setEndInput(endTime.toISOString());
  }, [endTime]);

  const toggleArtist = useCallback((artistId: ID) => {
    const artistKey = String(artistId);
    const selectedArtist = (artists ?? []).find((artist) => hasSameId(artist.id, artistId));

    setArtistIds((current) => (
      current.some((id) => String(id) === artistKey)
        ? current.filter((id) => String(id) !== artistKey)
        : [...current, artistId]
    ));
    setSelectedArtistsById((current) => {
      const next = { ...current };
      if (next[artistKey]) {
        delete next[artistKey];
        return next;
      }
      if (selectedArtist) {
        next[artistKey] = selectedArtist;
      }
      return next;
    });
  }, [artists]);

  const handleCreateVenue = useCallback(() => {
    setShowVenueModal(false);
    router.push('/createVenue');
  }, [router]);

  const handleCreateArtist = useCallback(() => {
    setShowArtistModal(false);
    router.push('/createArtistProfile');
  }, [router]);

  const handleCreateEvent = useCallback(async () => {
    const parsedStart = parseDateInput(startInput);
    const parsedEnd = parseDateInput(endInput);

    if (!parsedStart || !parsedEnd) return;

    setStartTime(parsedStart);
    setEndTime(parsedEnd);

    if (!title.trim()) {
      Alert.alert('Validación', 'El nombre del evento es obligatorio');
      return;
    }
    if (!eventTypeSelectionValid) {
      Alert.alert(
        'Tipo de evento no disponible',
        catalogSource === 'emergency'
          ? 'Conéctate y sincroniza los catálogos antes de crear el evento.'
          : 'El tipo seleccionado ya no está disponible. Sincroniza y elige otro tipo.',
      );
      return;
    }
    if (!venueId) {
      Alert.alert('Validación', 'Selecciona un lugar');
      return;
    }
    if (artistIds.length === 0) {
      Alert.alert('Validation', 'Please select at least one artist');
      return;
    }
    if (parsedStart >= parsedEnd) {
      Alert.alert('Validation', 'End time must be after start time');
      return;
    }

    const trimmedPrice = ticketPrice.trim();
    const parsedPrice = trimmedPrice ? Number(trimmedPrice) : undefined;
    if (trimmedPrice && !Number.isFinite(parsedPrice)) {
      Alert.alert('Validation', 'Ticket price must be a valid number');
      return;
    }
    if (typeof parsedPrice === 'number' && parsedPrice < 0) {
      Alert.alert('Validación', 'El precio de entrada debe ser cero o mayor');
      return;
    }

    createMutation.mutate({
      eventTypeId,
      title: title.trim(),
      description: description.trim(),
      startTime: parsedStart.toISOString(),
      endTime: parsedEnd.toISOString(),
      venueId,
      artistIds,
      ticketPrice: parsedPrice,
      currency,
      ticketUrl: ticketUrl.trim() || undefined,
      isPublic
    });
  }, [title, description, eventTypeId, eventTypeSelectionValid, venueId, artistIds, startInput, endInput, ticketPrice, ticketUrl, isPublic, currency, catalogSource, createMutation, parseDateInput]);

  const renderVenueItem = useCallback(({ item }: { item: Venue }) => (
    <TouchableOpacity
      style={styles.modalItem}
      accessibilityRole="button"
      accessibilityLabel={`Seleccionar ${item.name}`}
      onPress={() => {
        setVenueId(item.id);
        setSelectedVenueSnapshot(item);
        setShowVenueModal(false);
      }}
    >
      <Text style={styles.modalItemTitle}>{item.name}</Text>
      <Text style={styles.modalItemSubtitle}>{item.city}</Text>
    </TouchableOpacity>
  ), []);

  const renderArtistItem = useCallback(({ item }: { item: ArtistProfile }) => (
    <TouchableOpacity
      style={[styles.modalItem, artistIds.some((id) => hasSameId(id, item.id)) && styles.modalItemSelected]}
      onPress={() => toggleArtist(item.id)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: artistIds.some((id) => hasSameId(id, item.id)) }}
      accessibilityLabel={item.name}
    >
      <Text style={styles.modalItemTitle}>{item.name}</Text>
      {item.genres && <Text style={styles.modalItemSubtitle}>{item.genres.join(', ')}</Text>}
    </TouchableOpacity>
  ), [artistIds, toggleArtist]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Event Details</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            placeholder="Nombre del evento"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            placeholder="¿De qué trata este evento?"
            value={description}
            onChangeText={setDescription}
            style={[styles.input, styles.inputMultiline]}
            multiline
            numberOfLines={3}
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Tipo de evento *</Text>
          {eventTypeOptions.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catalogOptions}
              accessibilityRole="radiogroup"
            >
              {eventTypeOptions.map((item) => {
                const selected = item.id === eventTypeId;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.catalogOption, selected && styles.catalogOptionSelected]}
                    onPress={() => setEventTypeId(item.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`Tipo de evento: ${item.name}`}
                  >
                    <Text style={[styles.catalogOptionText, selected && styles.catalogOptionTextSelected]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.catalogUnavailable} accessibilityRole="alert">
              <Text style={styles.catalogUnavailableText}>
                {catalogSyncing
                  ? 'Sincronizando tipos de evento…'
                  : 'No hay tipos de evento publicados disponibles. Tu borrador se conservará.'}
              </Text>
              {!catalogSyncing && (
                <TouchableOpacity
                  style={styles.refreshCatalogButton}
                  onPress={() => { void refreshCatalogs(); }}
                  accessibilityRole="button"
                  accessibilityLabel="Volver a sincronizar tipos de evento"
                >
                  <Text style={styles.refreshCatalogButtonText}>Sincronizar</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {eventTypeId !== '' && !eventTypeSelectionValid && eventTypeOptions.length > 0 && (
            <Text style={styles.catalogConflict} accessibilityRole="alert">
              El tipo elegido dejó de estar disponible. Selecciona uno vigente para continuar.
            </Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Fecha y hora</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Hora de inicio *</Text>
          <TextInput
            placeholder="YYYY-MM-DDTHH:mm:ssZ"
            value={startInput}
            onChangeText={setStartInput}
            onBlur={() => {
              const parsed = parseDateInput(startInput);
              if (parsed) {
                setStartTime(parsed);
              } else {
                setStartInput(startTime.toISOString());
              }
            }}
            style={styles.input}
            placeholderTextColor="#999"
          />
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.smallButton}
              onPress={() => {
                const now = new Date();
                setStartTime(now);
                setStartInput(now.toISOString());
              }}
            >
              <Text style={styles.smallButtonText}>Ahora</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.smallButton}
              onPress={() => {
                const nextHour = new Date(Date.now() + 60 * 60 * 1000);
                setStartTime(nextHour);
                setStartInput(nextHour.toISOString());
              }}
            >
              <Text style={styles.smallButtonText}>+1h</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Hora de fin *</Text>
          <TextInput
            placeholder="YYYY-MM-DDTHH:mm:ssZ"
            value={endInput}
            onChangeText={setEndInput}
            onBlur={() => {
              const parsed = parseDateInput(endInput);
              if (parsed) {
                setEndTime(parsed);
              } else {
                setEndInput(endTime.toISOString());
              }
            }}
            style={styles.input}
            placeholderTextColor="#999"
          />
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.smallButton}
              onPress={() => {
                const plusTwo = new Date(Date.now() + 2 * 60 * 60 * 1000);
                setEndTime(plusTwo);
                setEndInput(plusTwo.toISOString());
              }}
            >
              <Text style={styles.smallButtonText}>+2h</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.smallButton}
              onPress={() => {
                const plusOne = new Date(endTime.getTime() + 60 * 60 * 1000);
                setEndTime(plusOne);
                setEndInput(plusOne.toISOString());
              }}
            >
              <Text style={styles.smallButtonText}>+1h desde la actual</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Lugar y artistas</Text>

        <TouchableOpacity style={styles.field} onPress={() => setShowVenueModal(true)}>
          <Text style={styles.label}>Lugar *</Text>
          <View style={styles.selectedBox}>
            <Text style={selectedVenue ? styles.selectedText : styles.placeholder}>
              {selectedVenue?.name || (routeVenueQuery.isLoading && venueId ? 'Cargando lugar…' : 'Selecciona un lugar')}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.field} onPress={() => setShowArtistModal(true)}>
          <Text style={styles.label}>Artistas *</Text>
          {artistIds.length > 0 ? (
            <View style={styles.selectedBox}>
              <Text style={styles.selectedText}>
                {artistIds.length} artista{artistIds.length !== 1 ? 's' : ''} seleccionado{artistIds.length !== 1 ? 's' : ''}
              </Text>
              {selectedArtistNames.length > 0 && (
                <Text style={styles.selectedSubtext}>
                  {selectedArtistNames.slice(0, 3).join(', ')}
                  {selectedArtistNames.length > 3 ? ` +${selectedArtistNames.length - 3}` : ''}
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.selectedBox}>
              <Text style={styles.placeholder}>Selecciona artistas</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Entradas</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Precio ({currency})</Text>
          <TextInput
            placeholder="0.00"
            value={ticketPrice}
            onChangeText={setTicketPrice}
            style={styles.input}
            keyboardType="decimal-pad"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>URL de entradas</Text>
          <TextInput
            placeholder="https://..."
            accessibilityLabel="URL de entradas"
            value={ticketUrl}
            onChangeText={setTicketUrl}
            style={styles.input}
            placeholderTextColor="#999"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => setIsPublic(!isPublic)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isPublic }}
            accessibilityLabel="Hacer evento público"
          >
            <View style={[styles.checkboxBox, isPublic && styles.checkboxBoxChecked]} />
            <Text style={styles.checkboxLabel}>Hacer evento público</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.createButton, (!eventTypeSelectionValid || createMutation.isPending) && styles.createButtonDisabled]}
          onPress={handleCreateEvent}
          disabled={!eventTypeSelectionValid || createMutation.isPending}
          accessibilityRole="button"
          accessibilityState={{ disabled: !eventTypeSelectionValid || createMutation.isPending }}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createButtonText}>Crear evento</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Venue Modal */}
      <Modal
        visible={showVenueModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVenueModal(false)}
        accessibilityViewIsModal
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalHeaderAction}
              onPress={() => setShowVenueModal(false)}
              accessibilityRole="button"
              accessibilityLabel="Cerrar selector de lugar"
            >
              <Text style={styles.modalClose}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Seleccionar lugar</Text>
            <TouchableOpacity
              style={styles.modalHeaderAction}
              onPress={handleCreateVenue}
              accessibilityRole="button"
              accessibilityLabel="Crear un lugar nuevo"
            >
              <Text style={styles.modalCreate}>+ Nuevo</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            placeholder="Buscar lugares…"
            accessibilityLabel="Buscar lugares"
            value={venueSearch}
            onChangeText={setVenueSearch}
            style={styles.modalSearchInput}
            autoCapitalize="none"
          />

          {venuesLoading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : (
            <FlatList
              data={venues}
              renderItem={renderVenueItem}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={styles.modalList}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Artist Modal */}
      <Modal
        visible={showArtistModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowArtistModal(false)}
        accessibilityViewIsModal
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalHeaderAction}
              onPress={() => setShowArtistModal(false)}
              accessibilityRole="button"
              accessibilityLabel="Cerrar selector de artistas"
            >
              <Text style={styles.modalClose}>Listo</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Seleccionar artistas</Text>
            <TouchableOpacity
              style={styles.modalHeaderAction}
              onPress={handleCreateArtist}
              accessibilityRole="button"
              accessibilityLabel="Crear un artista nuevo"
            >
              <Text style={styles.modalCreate}>+ Nuevo</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            placeholder="Buscar artistas…"
            accessibilityLabel="Buscar artistas"
            value={artistSearch}
            onChangeText={setArtistSearch}
            style={styles.modalSearchInput}
            autoCapitalize="none"
          />

          {artistsLoading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : (
            <FlatList
              data={artists}
              renderItem={renderArtistItem}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={styles.modalList}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginTop: 16, marginBottom: 12, textTransform: 'uppercase' },
  field: { marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  label: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1a1a1a' },
  inputMultiline: { height: 80, textAlignVertical: 'top', paddingVertical: 10 },
  selectedBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  selectedText: { fontSize: 14, color: '#1a1a1a', fontWeight: '500' },
  selectedSubtext: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  placeholder: { fontSize: 14, color: '#999' },
  catalogOptions: { gap: 8, paddingVertical: 2 },
  catalogOption: { minHeight: 44, justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 22, paddingHorizontal: 16 },
  catalogOptionSelected: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  catalogOptionText: { color: '#374151', fontSize: 14, fontWeight: '600' },
  catalogOptionTextSelected: { color: '#1d4ed8' },
  catalogUnavailable: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fdba74', borderRadius: 8, padding: 12 },
  catalogUnavailableText: { color: '#9a3412', fontSize: 13, lineHeight: 18 },
  catalogConflict: { color: '#b91c1c', fontSize: 13, lineHeight: 18, marginTop: 8 },
  refreshCatalogButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#9a3412' },
  refreshCatalogButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  checkbox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkboxBox: { width: 20, height: 20, borderWidth: 1, borderColor: '#ddd', borderRadius: 4, backgroundColor: '#fff' },
  checkboxBoxChecked: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  checkboxLabel: { fontSize: 14, color: '#1a1a1a' },
  createButton: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  createButtonDisabled: { backgroundColor: '#9ca3af' },
  createButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalHeaderAction: { minWidth: 60, minHeight: 44, justifyContent: 'center' },
  modalClose: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  modalCreate: { fontSize: 14, color: '#16a34a', fontWeight: '600' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  modalSearchInput: { marginHorizontal: 16, marginVertical: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  modalList: { paddingHorizontal: 16, paddingBottom: 24 },
  modalItem: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#f0f0f0' },
  modalItemSelected: { backgroundColor: '#f0f8ff', borderColor: '#2563eb' },
  modalItemTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  modalItemSubtitle: { fontSize: 12, color: '#999', marginTop: 4 },
  modalLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  smallButton: { backgroundColor: '#111827', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  smallButtonText: { color: '#fff', fontWeight: '700' }
});
