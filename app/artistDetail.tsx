import React, { useCallback, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { Artists } from '../src/api/artists';
import { Events } from '../src/api/events';

export default function ArtistDetailScreen() {
  const { artistId } = useLocalSearchParams<{ artistId: string }>();
  const router = useRouter();

  const artistQuery = useQuery({
    queryKey: ['artist', artistId],
    queryFn: () => (artistId ? Artists.getById(artistId) : null),
    enabled: !!artistId
  });

  const eventsQuery = useQuery({
    queryKey: ['artist-events', artistId],
    queryFn: () => (artistId ? Events.list({ artistId }) : Promise.resolve([])),
    enabled: !!artistId
  });

  const artist = artistQuery.data;
  const socialRows = useMemo(() => {
    if (!artist) return [];
    const links = artist.socialLinks || {};
    const rows = [
      { label: 'Instagram', value: artist.instagramHandle ?? links.instagram },
      { label: 'Spotify', value: artist.spotifyUrl ?? links.spotify },
      { label: 'Twitter', value: links.twitter },
      { label: 'YouTube', value: links.youtube },
      { label: 'SoundCloud', value: links.soundcloud }
    ];
    return rows.filter((row) => row.value && `${row.value}`.trim().length > 0);
  }, [artist]);
  const upcomingEvents = useMemo(() => {
    if (!eventsQuery.data) return [];
    const now = new Date();
    return eventsQuery.data
      .filter(e => new Date(e.startTime) > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [eventsQuery.data]);

  const handleEditProfile = useCallback(() => {
    router.push({ pathname: '/editArtistProfile', params: { artistId } });
  }, [artistId, router]);

  const handleEventPress = useCallback((eventId: string) => {
    router.push({ pathname: '/eventDetail', params: { eventId } });
  }, [router]);

  if (artistQuery.isLoading || !artist) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {artist.imageUrl && (
          <Image source={{ uri: artist.imageUrl }} style={styles.artistImage} />
        )}

        <Text style={styles.artistName}>{artist.name}</Text>

        {artist.bio && (
          <Text style={styles.bio}>{artist.bio}</Text>
        )}

        {artist.genres && artist.genres.length > 0 && (
          <View style={styles.genresContainer}>
            {artist.genres.map((genre, idx) => (
              <View key={idx} style={styles.genreTag}>
                <Text style={styles.genreText}>{genre}</Text>
              </View>
            ))}
          </View>
        )}

        {socialRows.length > 0 && (
          <View style={styles.socialContainer}>
            {socialRows.map((row) => (
              <Text key={row.label} style={styles.socialLink}>{row.label}: {row.value}</Text>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        {upcomingEvents.length > 0 && (
          <View style={styles.eventsSection}>
            <Text style={styles.sectionTitle}>Upcoming Events ({upcomingEvents.length})</Text>
            {upcomingEvents.map(event => (
              <TouchableOpacity
                key={event.id}
                style={styles.eventItem}
                onPress={() => handleEventPress(event.id)}
              >
                <View style={styles.eventHeader}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  {event.ticketPrice && (
                    <Text style={styles.eventPrice}>${(event.ticketPrice / 100).toFixed(2)}</Text>
                  )}
                </View>
                <Text style={styles.eventDateTime}>
                  {new Date(event.startTime).toLocaleDateString()} at{' '}
                  {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {event.venue && (
                  <Text style={styles.eventVenue}>{event.venue.name}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {upcomingEvents.length === 0 && !eventsQuery.isLoading && (
          <Text style={styles.noEventsText}>No upcoming events</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  artistImage: { width: '100%', height: 240, borderRadius: 12, marginBottom: 16 },
  artistName: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  bio: { fontSize: 14, lineHeight: 20, color: '#666', marginBottom: 16 },
  genresContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  genreTag: { backgroundColor: '#e0e7ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  genreText: { fontSize: 12, fontWeight: '600', color: '#2563eb' },
  socialContainer: { marginBottom: 16 },
  socialLink: { fontSize: 13, color: '#666', marginBottom: 6 },
  editButton: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 24 },
  editButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  eventsSection: { marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  eventItem: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#2563eb' },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  eventTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  eventPrice: { fontSize: 13, fontWeight: '700', color: '#2563eb', marginLeft: 8 },
  eventDateTime: { fontSize: 12, color: '#999', marginBottom: 4 },
  eventVenue: { fontSize: 12, color: '#666' },
  noEventsText: { fontSize: 14, color: '#999', textAlign: 'center', marginTop: 16 }
});
