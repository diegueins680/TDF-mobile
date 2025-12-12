import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator,
  FlatList, Modal, SafeAreaView
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { Events } from '../src/api/events';
import { Venues } from '../src/api/venues';
import { Artists } from '../src/api/artists';
import type { ID, ArtistProfile, Venue } from '../types';

export default function CreateEventScreen() {
  const router = useRouter();
  const qc = useQueryClient();

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

  const { data: venues, isLoading: venuesLoading } = useQuery({
    queryKey: ['venues', venueSearch],
    queryFn: () => venueSearch ? Venues.search(venueSearch) : Venues.list()
  });

  const { data: artists, isLoading: artistsLoading } = useQuery({
    queryKey: ['artists', artistSearch],
    queryFn: () => artistSearch ? Artists.searchByName(artistSearch) : Promise.resolve([])
  });

  const createMutation = useMutation({
    mutationFn: (body: Parameters<typeof Events.create>[0]) => Events.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      Alert.alert('Success', 'Event created!');
      router.back();
    },
    onError: () => {
      Alert.alert('Error', 'Failed to create event');
    }
  });

  const selectedVenue = useMemo(() => venues?.find(v => v.id === venueId), [venues, venueId]);
  const selectedArtists = useMemo(() => artists?.filter(a => artistIds.includes(a.id)) || [], [artists, artistIds]);

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
    setArtistIds(prev =>
      prev.includes(artistId) ? prev.filter(id => id !== artistId) : [...prev, artistId]
    );
  }, []);

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
      Alert.alert('Validation', 'Event title is required');
      return;
    }
    if (!venueId) {
      Alert.alert('Validation', 'Please select a venue');
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

    // Convert price from dollars to cents for backend
    const priceCents = ticketPrice ? Math.round(parseFloat(ticketPrice) * 100) : 0;

    createMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      startTime: parsedStart.toISOString(),
      endTime: parsedEnd.toISOString(),
      venueId,
      artistIds,
      ticketPrice: priceCents,  // Backend expects cents as integer
      ticketUrl: ticketUrl.trim() || undefined,
      isPublic
    });
  }, [title, description, venueId, artistIds, startInput, endInput, ticketPrice, ticketUrl, isPublic, createMutation, parseDateInput]);

  const renderVenueItem = useCallback(({ item }: { item: Venue }) => (
    <TouchableOpacity
      style={styles.modalItem}
      onPress={() => {
        setVenueId(item.id);
        setShowVenueModal(false);
      }}
    >
      <Text style={styles.modalItemTitle}>{item.name}</Text>
      <Text style={styles.modalItemSubtitle}>{item.city}</Text>
    </TouchableOpacity>
  ), []);

  const renderArtistItem = useCallback(({ item }: { item: ArtistProfile }) => (
    <TouchableOpacity
      style={[styles.modalItem, artistIds.includes(item.id) && styles.modalItemSelected]}
      onPress={() => toggleArtist(item.id)}
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
            placeholder="Event name"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            placeholder="What's this event about?"
            value={description}
            onChangeText={setDescription}
            style={[styles.input, styles.inputMultiline]}
            multiline
            numberOfLines={3}
            placeholderTextColor="#999"
          />
        </View>

        <Text style={styles.sectionTitle}>Date & Time</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Start Time *</Text>
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
              <Text style={styles.smallButtonText}>Now</Text>
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
          <Text style={styles.label}>End Time *</Text>
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
              <Text style={styles.smallButtonText}>+1h from current</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Location & Artists</Text>

        <TouchableOpacity style={styles.field} onPress={() => setShowVenueModal(true)}>
          <Text style={styles.label}>Venue *</Text>
          <View style={styles.selectedBox}>
            <Text style={selectedVenue ? styles.selectedText : styles.placeholder}>
              {selectedVenue?.name || 'Select a venue'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.field} onPress={() => setShowArtistModal(true)}>
          <Text style={styles.label}>Artists *</Text>
          {artistIds.length > 0 ? (
            <View style={styles.selectedBox}>
              <Text style={styles.selectedText}>
                {selectedArtists.length} artist{selectedArtists.length !== 1 ? 's' : ''} selected
              </Text>
            </View>
          ) : (
            <View style={styles.selectedBox}>
              <Text style={styles.placeholder}>Select artists</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Tickets</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Price (USD)</Text>
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
          <Text style={styles.label}>Ticket URL</Text>
          <TextInput
            placeholder="https://..."
            value={ticketUrl}
            onChangeText={setTicketUrl}
            style={styles.input}
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.field}>
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => setIsPublic(!isPublic)}
          >
            <View style={[styles.checkboxBox, isPublic && styles.checkboxBoxChecked]} />
            <Text style={styles.checkboxLabel}>Make event public</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateEvent}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createButtonText}>Create Event</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Venue Modal */}
      <Modal visible={showVenueModal} transparent animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowVenueModal(false)}>
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Venue</Text>
            <TouchableOpacity onPress={handleCreateVenue}>
              <Text style={styles.modalCreate}>+ New</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            placeholder="Search venues..."
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
      <Modal visible={showArtistModal} transparent animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowArtistModal(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Artists</Text>
            <TouchableOpacity onPress={handleCreateArtist}>
              <Text style={styles.modalCreate}>+ New</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            placeholder="Search artists..."
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
  placeholder: { fontSize: 14, color: '#999' },
  checkbox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkboxBox: { width: 20, height: 20, borderWidth: 1, borderColor: '#ddd', borderRadius: 4, backgroundColor: '#fff' },
  checkboxBoxChecked: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  checkboxLabel: { fontSize: 14, color: '#1a1a1a' },
  createButton: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  createButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
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
