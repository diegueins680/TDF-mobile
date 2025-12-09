import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity, ActivityIndicator, FlatList, TextInput, Alert
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { Artists } from '../src/api/artists';
import { Events } from '../src/api/events';
import { useUserSettings } from '../src/providers/UserSettingsProvider';

export default function UserProfileScreen() {
  const router = useRouter();
  const { partyId, displayName, setIdentity, clearIdentity, loading } = useUserSettings();
  const [activeTab, setActiveTab] = useState<'artist' | 'events' | 'saved'>('artist');
  const [draftPartyId, setDraftPartyId] = useState(partyId ?? '');
  const [draftName, setDraftName] = useState(displayName ?? '');

  useEffect(() => {
    setDraftPartyId(partyId ?? '');
    setDraftName(displayName ?? '');
  }, [partyId, displayName]);

  // Query user's artist profile
  const artistQuery = useQuery({
    queryKey: ['user-artist-profile', partyId],
    queryFn: () => Artists.getByParty(partyId as string),
    enabled: Boolean(partyId)
  });

  const eventsQuery = useQuery({
    queryKey: ['upcoming-events'],
    queryFn: () => Events.list({ upcomingOnly: true })
  });

  const upcomingEvents = useMemo(() => {
    if (!eventsQuery.data) return [];
    const now = new Date();
    return eventsQuery.data
      .filter(e => new Date(e.startTime) > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [eventsQuery.data]);

  const handleCreateArtistProfile = useCallback(() => {
    if (!partyId) {
      Alert.alert('Party ID requerido', 'Guarda tu Party ID antes de crear tu perfil de artista.');
      return;
    }
    router.push('/createArtistProfile');
  }, [partyId, router]);

  const handleEditArtistProfile = useCallback(() => {
    if (!partyId) {
      Alert.alert('Party ID requerido', 'Guarda tu Party ID antes de editar tu perfil de artista.');
      return;
    }
    if (artistQuery.data) {
      router.push({ pathname: '/editArtistProfile', params: { artistId: artistQuery.data.id } });
    }
  }, [artistQuery.data, partyId, router]);

  const handleEventPress = useCallback((eventId: string) => {
    router.push({ pathname: '/eventDetail', params: { eventId } });
  }, [router]);

  const handleSaveIdentity = useCallback(() => {
    if (!draftPartyId.trim()) {
      Alert.alert('Party ID requerido', 'Ingresa tu Party ID para conectar RSVP e invitaciones.');
      return;
    }
    setIdentity(draftPartyId.trim(), draftName.trim());
    Alert.alert('Guardado', 'Actualizamos tu Party ID.');
  }, [draftPartyId, draftName, setIdentity]);

  const handleClearIdentity = useCallback(() => {
    clearIdentity();
    setDraftPartyId('');
    setDraftName('');
  }, [clearIdentity]);

  const headerName = draftName || displayName || 'Tu perfil';
  const headerSubtitle = partyId ? `Party ID: ${partyId}` : 'Agrega tu Party ID para RSVP e invitaciones';

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  const renderEventItem = ({ item }: { item: typeof upcomingEvents[0] }) => (
    <TouchableOpacity
      style={styles.eventItem}
      onPress={() => handleEventPress(item.id)}
    >
      <View style={styles.eventHeader}>
        <Text style={styles.eventTitle}>{item.title}</Text>
        {item.ticketPrice && (
          <Text style={styles.eventPrice}>${item.ticketPrice.toFixed(2)}</Text>
        )}
      </View>
      <Text style={styles.eventDateTime}>
        {new Date(item.startTime).toLocaleDateString()} at{' '}
        {new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
      {item.venue && (
        <Text style={styles.eventVenue}>{item.venue.name}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {headerName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{headerName}</Text>
            <Text style={styles.profileEmail}>{headerSubtitle}</Text>
          </View>
        </View>

        <View style={styles.identityCard}>
          <Text style={styles.sectionTitle}>Identidad social</Text>
          <TextInput
            placeholder="Party ID"
            value={draftPartyId}
            onChangeText={setDraftPartyId}
            style={styles.input}
            keyboardType="number-pad"
          />
          <TextInput
            placeholder="Nombre para mostrar (opcional)"
            value={draftName}
            onChangeText={setDraftName}
            style={styles.input}
          />
          <View style={styles.identityActions}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveIdentity}>
              <Text style={styles.saveButtonText}>Guardar</Text>
            </TouchableOpacity>
            {partyId && (
              <TouchableOpacity style={styles.clearButton} onPress={handleClearIdentity}>
                <Text style={styles.clearButtonText}>Limpiar</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.helperText}>Usaremos estos datos en RSVP, invitaciones y vCard.</Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'artist' && styles.tabActive]}
            onPress={() => setActiveTab('artist')}
          >
            <Text style={[styles.tabLabel, activeTab === 'artist' && styles.tabLabelActive]}>
              Artist Profile
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'events' && styles.tabActive]}
            onPress={() => setActiveTab('events')}
          >
            <Text style={[styles.tabLabel, activeTab === 'events' && styles.tabLabelActive]}>
              Eventos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'saved' && styles.tabActive]}
            onPress={() => setActiveTab('saved')}
          >
            <Text style={[styles.tabLabel, activeTab === 'saved' && styles.tabLabelActive]}>
              Saved
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'artist' && (
          <View style={styles.section}>
            {!partyId ? (
              <Text style={styles.noDataText}>Guarda tu Party ID para enlazar tu perfil de artista.</Text>
            ) : artistQuery.isLoading ? (
              <ActivityIndicator size="large" color="#2563eb" />
            ) : artistQuery.data ? (
              <>
                <Text style={styles.sectionTitle}>{artistQuery.data.name}</Text>
                {artistQuery.data.bio && (
                  <Text style={styles.sectionContent}>{artistQuery.data.bio}</Text>
                )}
                {artistQuery.data.genres && artistQuery.data.genres.length > 0 && (
                  <View style={styles.genresContainer}>
                    {artistQuery.data.genres.map((genre, idx) => (
                      <View key={idx} style={styles.genreTag}>
                        <Text style={styles.genreText}>{genre}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <TouchableOpacity style={styles.actionButton} onPress={handleEditArtistProfile}>
                  <Text style={styles.actionButtonText}>Edit Profile</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.noDataText}>You haven&apos;t created an artist profile yet</Text>
                <TouchableOpacity style={styles.actionButton} onPress={handleCreateArtistProfile}>
                  <Text style={styles.actionButtonText}>Create Artist Profile</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {activeTab === 'events' && (
          <View style={styles.section}>
            {eventsQuery.isLoading ? (
              <ActivityIndicator size="large" color="#2563eb" />
            ) : upcomingEvents.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Próximos eventos ({upcomingEvents.length})</Text>
                <FlatList
                  data={upcomingEvents}
                  renderItem={renderEventItem}
                  keyExtractor={item => item.id}
                  scrollEnabled={false}
                />
              </>
            ) : (
              <Text style={styles.noDataText}>
                Aún no hay eventos disponibles. Guarda tu Party ID para usar RSVP e invitaciones.
              </Text>
            )}
          </View>
        )}

        {activeTab === 'saved' && (
          <View style={styles.section}>
            <Text style={styles.noDataText}>Saved events feature coming soon</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 24 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: '#fff', padding: 16, borderRadius: 8 },
  avatarPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarInitial: { fontSize: 24, fontWeight: '700', color: '#fff' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  profileEmail: { fontSize: 13, color: '#666' },
  identityCard: { backgroundColor: '#fff', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 16, gap: 10 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10 },
  identityActions: { flexDirection: 'row', gap: 8 },
  saveButton: { backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  clearButton: { backgroundColor: '#f3f4f6', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  clearButtonText: { color: '#111827', fontWeight: '700' },
  helperText: { fontSize: 12, color: '#6b7280' },
  tabContainer: { flexDirection: 'row', gap: 8, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tab: { flex: 1, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#2563eb' },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#999', textAlign: 'center' },
  tabLabelActive: { color: '#2563eb' },
  section: { backgroundColor: '#fff', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#f0f0f0' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  sectionContent: { fontSize: 13, lineHeight: 20, color: '#666', marginBottom: 12 },
  genresContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  genreTag: { backgroundColor: '#e0e7ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  genreText: { fontSize: 12, fontWeight: '600', color: '#2563eb' },
  actionButton: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  actionButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  noDataText: { fontSize: 13, color: '#999', textAlign: 'center', paddingVertical: 24 },
  eventItem: { backgroundColor: '#f9f9f9', borderRadius: 6, padding: 12, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#2563eb' },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  eventTitle: { fontSize: 13, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  eventPrice: { fontSize: 12, fontWeight: '700', color: '#2563eb', marginLeft: 8 },
  eventDateTime: { fontSize: 12, color: '#999', marginBottom: 4 },
  eventVenue: { fontSize: 12, color: '#666' }
});
