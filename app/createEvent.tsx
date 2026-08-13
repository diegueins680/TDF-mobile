import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator,
  FlatList, Modal, SafeAreaView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePreventRemove, useNavigation } from '@react-navigation/native';

import { Events } from '../src/api/events';
import { Venues } from '../src/api/venues';
import { Artists } from '../src/api/artists';
import type { ID, ArtistProfile, Venue } from '../src/types';
import { normalizeRouteParam } from '../src/lib/routeParams';
import { useUserSettings } from '../src/providers/UserSettingsProvider';
import { useAppTheme } from '../src/theme/ThemeProvider';

const hasSameId = (left: ID | null | undefined, right: ID | null | undefined): boolean =>
  left != null && right != null && String(left) === String(right);

export default function CreateEventScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { venueId: rawVenueId } = useLocalSearchParams<{ venueId?: string | string[] }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { currency } = useUserSettings();
  const routeVenueId = useMemo(() => normalizeRouteParam(rawVenueId), [rawVenueId]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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

  const [titleError, setTitleError] = useState('');
  const [venueError, setVenueError] = useState('');
  const [artistError, setArtistError] = useState('');
  const [startTimeError, setStartTimeError] = useState('');
  const [endTimeError, setEndTimeError] = useState('');
  const [ticketPriceError, setTicketPriceError] = useState('');

  const titleRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);
  const startTimeRef = useRef<TextInput>(null);
  const endTimeRef = useRef<TextInput>(null);
  const ticketPriceRef = useRef<TextInput>(null);
  const ticketUrlRef = useRef<TextInput>(null);

  const navigation = useNavigation();
  const [isDirty, setIsDirty] = useState(false);

  usePreventRemove(isDirty, ({ data }) => {
    Alert.alert(
      'Cambios sin guardar',
      '¿Quieres descartar los cambios?',
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => {} },
        { text: 'Descartar', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
      ],
    );
  });

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
      setIsDirty(false);
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
    setIsDirty(true);

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
    setTitleError('');
    setVenueError('');
    setArtistError('');
    setStartTimeError('');
    setEndTimeError('');
    setTicketPriceError('');

    const parsedStart = parseDateInput(startInput);
    const parsedEnd = parseDateInput(endInput);

    if (!parsedStart) {
      setStartTimeError('Usa un formato válido, por ejemplo 2025-12-15T15:00:00Z');
    }
    if (!parsedEnd) {
      setEndTimeError('Usa un formato válido, por ejemplo 2025-12-15T15:00:00Z');
    }
    if (!parsedStart || !parsedEnd) return;

    setStartTime(parsedStart);
    setEndTime(parsedEnd);

    if (!title.trim()) {
      setTitleError('El nombre del evento es obligatorio');
      return;
    }
    if (!venueId) {
      setVenueError('Selecciona un lugar');
      return;
    }
    if (artistIds.length === 0) {
      setArtistError('Selecciona al menos un artista');
      return;
    }
    if (parsedStart >= parsedEnd) {
      setEndTimeError('La hora de fin debe ser posterior a la de inicio');
      return;
    }

    const trimmedPrice = ticketPrice.trim();
    const parsedPrice = trimmedPrice ? Number(trimmedPrice) : undefined;
    if (trimmedPrice && !Number.isFinite(parsedPrice)) {
      setTicketPriceError('El precio debe ser un número válido');
      return;
    }
    if (typeof parsedPrice === 'number' && parsedPrice < 0) {
      setTicketPriceError('El precio de entrada debe ser cero o mayor');
      return;
    }

    createMutation.mutate({
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
  }, [title, description, venueId, artistIds, startInput, endInput, ticketPrice, ticketUrl, isPublic, currency, createMutation, parseDateInput]);

  const renderVenueItem = useCallback(({ item }: { item: Venue }) => (
    <TouchableOpacity
      style={styles.modalItem}
      accessibilityRole="button"
      accessibilityLabel={`Seleccionar ${item.name}`}
      onPress={() => {
        setVenueId(item.id);
        setSelectedVenueSnapshot(item);
        setShowVenueModal(false);
        setVenueError('');
        setIsDirty(true);
      }}
    >
      <Text style={styles.modalItemTitle}>{item.name}</Text>
      <Text style={styles.modalItemSubtitle}>{item.city}</Text>
    </TouchableOpacity>
  ), [styles]);

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
  ), [artistIds, toggleArtist, styles]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Event Details</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            ref={titleRef}
            returnKeyType="next"
            onSubmitEditing={() => descriptionRef.current?.focus()}
            blurOnSubmit={false}
            placeholder="Nombre del evento"
            value={title}
            onChangeText={(text) => { setTitle(text); setTitleError(''); setIsDirty(true); }}
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
          />
          {titleError ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }} accessibilityRole="alert">{titleError}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            ref={descriptionRef}
            returnKeyType="next"
            onSubmitEditing={() => startTimeRef.current?.focus()}
            blurOnSubmit={false}
            placeholder="¿De qué trata este evento?"
            value={description}
            onChangeText={(text) => { setDescription(text); setIsDirty(true); }}
            style={[styles.input, styles.inputMultiline]}
            multiline
            numberOfLines={3}
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <Text style={styles.sectionTitle}>Fecha y hora</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Hora de inicio *</Text>
          <TextInput
            ref={startTimeRef}
            returnKeyType="next"
            onSubmitEditing={() => endTimeRef.current?.focus()}
            blurOnSubmit={false}
            placeholder="YYYY-MM-DDTHH:mm:ssZ"
            value={startInput}
            onChangeText={(text) => { setStartInput(text); setStartTimeError(''); setIsDirty(true); }}
            onBlur={() => {
              const parsed = parseDateInput(startInput);
              if (parsed) {
                setStartTime(parsed);
              } else {
                setStartInput(startTime.toISOString());
                setStartTimeError('Usa un formato válido, por ejemplo 2025-12-15T15:00:00Z');
              }
            }}
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
          />
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.smallButton}
              onPress={() => {
                const now = new Date();
                setStartTime(now);
                setStartInput(now.toISOString());
                setIsDirty(true);
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
                setIsDirty(true);
              }}
            >
              <Text style={styles.smallButtonText}>+1h</Text>
            </TouchableOpacity>
          </View>
          {startTimeError ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }} accessibilityRole="alert">{startTimeError}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Hora de fin *</Text>
          <TextInput
            ref={endTimeRef}
            returnKeyType="next"
            onSubmitEditing={() => ticketPriceRef.current?.focus()}
            blurOnSubmit={false}
            placeholder="YYYY-MM-DDTHH:mm:ssZ"
            value={endInput}
            onChangeText={(text) => { setEndInput(text); setEndTimeError(''); setIsDirty(true); }}
            onBlur={() => {
              const parsed = parseDateInput(endInput);
              if (parsed) {
                setEndTime(parsed);
              } else {
                setEndInput(endTime.toISOString());
                setEndTimeError('Usa un formato válido, por ejemplo 2025-12-15T15:00:00Z');
              }
            }}
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
          />
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.smallButton}
              onPress={() => {
                const plusTwo = new Date(Date.now() + 2 * 60 * 60 * 1000);
                setEndTime(plusTwo);
                setEndInput(plusTwo.toISOString());
                setIsDirty(true);
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
                setIsDirty(true);
              }}
            >
              <Text style={styles.smallButtonText}>+1h desde la actual</Text>
            </TouchableOpacity>
          </View>
          {endTimeError ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }} accessibilityRole="alert">{endTimeError}</Text> : null}
        </View>

        <Text style={styles.sectionTitle}>Lugar y artistas</Text>

        <TouchableOpacity style={styles.field} onPress={() => setShowVenueModal(true)}>
          <Text style={styles.label}>Lugar *</Text>
          <View style={styles.selectedBox}>
            <Text style={selectedVenue ? styles.selectedText : styles.placeholder}>
              {selectedVenue?.name || (routeVenueQuery.isLoading && venueId ? 'Cargando lugar…' : 'Selecciona un lugar')}
            </Text>
          </View>
          {venueError ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }} accessibilityRole="alert">{venueError}</Text> : null}
        </TouchableOpacity>

        <TouchableOpacity style={styles.field} onPress={() => { setShowArtistModal(true); setArtistError(''); }}>
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
          {artistError ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }} accessibilityRole="alert">{artistError}</Text> : null}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Entradas</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Precio ({currency})</Text>
          <TextInput
            ref={ticketPriceRef}
            returnKeyType="next"
            onSubmitEditing={() => ticketUrlRef.current?.focus()}
            blurOnSubmit={false}
            placeholder="0.00"
            value={ticketPrice}
            onChangeText={(text) => { setTicketPrice(text); setTicketPriceError(''); setIsDirty(true); }}
            style={styles.input}
            keyboardType="decimal-pad"
            placeholderTextColor={colors.textSecondary}
          />
          {ticketPriceError ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }} accessibilityRole="alert">{ticketPriceError}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>URL de entradas</Text>
          <TextInput
            ref={ticketUrlRef}
            returnKeyType="done"
            placeholder="https://..."
            accessibilityLabel="URL de entradas"
            value={ticketUrl}
            onChangeText={(text) => { setTicketUrl(text); setIsDirty(true); }}
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => { setIsPublic(!isPublic); setIsDirty(true); }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isPublic }}
            accessibilityLabel="Hacer evento público"
          >
            <View style={[styles.checkboxBox, isPublic && styles.checkboxBoxChecked]} />
            <Text style={styles.checkboxLabel}>Hacer evento público</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateEvent}
          disabled={createMutation.isPending}
          accessibilityRole="button"
          accessibilityState={{ disabled: createMutation.isPending }}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color={colors.actionPrimaryContrast} />
          ) : (
            <Text style={styles.createButtonText}>Crear evento</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>

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
              <ActivityIndicator size="large" color={colors.actionPrimary} />
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
              <ActivityIndicator size="large" color={colors.actionPrimary} />
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

function createStyles(colors: ReturnType<typeof import('../src/theme/ThemeProvider').useAppTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 24 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 16, marginBottom: 12, textTransform: 'uppercase' },
    field: { marginBottom: 12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
    input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.textPrimary },
    inputMultiline: { height: 80, textAlignVertical: 'top', paddingVertical: 10 },
    selectedBox: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
    selectedText: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
    selectedSubtext: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    placeholder: { fontSize: 14, color: colors.textSecondary },
    checkbox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    checkboxBox: { width: 20, height: 20, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 4, backgroundColor: colors.surface },
    checkboxBoxChecked: { backgroundColor: colors.actionPrimary, borderColor: colors.actionPrimary },
    checkboxLabel: { fontSize: 14, color: colors.textPrimary },
    createButton: { backgroundColor: colors.actionPrimary, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 16 },
    createButtonText: { color: colors.actionPrimaryContrast, fontSize: 14, fontWeight: '700' },
    modal: { flex: 1, backgroundColor: colors.surface },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.surfaceMuted },
    modalHeaderAction: { minWidth: 60, minHeight: 44, justifyContent: 'center' },
    modalClose: { fontSize: 14, color: colors.actionPrimary, fontWeight: '600' },
    modalCreate: { fontSize: 14, color: colors.success, fontWeight: '600' },
    modalTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
    modalSearchInput: { marginHorizontal: 16, marginVertical: 12, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface, color: colors.textPrimary },
    modalList: { paddingHorizontal: 16, paddingBottom: 24 },
    modalItem: { backgroundColor: colors.surface, padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: colors.surfaceMuted },
    modalItemSelected: { backgroundColor: colors.infoSurface, borderColor: colors.actionPrimary },
    modalItemTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    modalItemSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
    modalLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    smallButton: { backgroundColor: colors.textPrimary, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
    smallButtonText: { color: colors.surface, fontWeight: '700' }
  });
}
