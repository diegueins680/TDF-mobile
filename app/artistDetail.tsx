import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/providers/AuthProvider';
import { useUserSettings } from '../src/providers/UserSettingsProvider';
import { useAppTheme } from '../src/theme/ThemeProvider';

import { Artists, type ArtistFollower } from '../src/api/artists';
import { Events } from '../src/api/events';
import { ArtistDetailSkeleton } from '../src/components/skeletons/ArtistCardSkeleton';
import { resolvePartyId } from '../src/lib/identity';
import { normalizeRouteParam } from '../src/lib/routeParams';

export default function ArtistDetailScreen() {
  const { colors } = useAppTheme();
  const { artistId: rawArtistId } = useLocalSearchParams<{ artistId?: string | string[] }>();
  const router = useRouter();
  const { partyId: authPartyId } = useAuth();
  const { partyId: settingsPartyId } = useUserSettings();
  const qc = useQueryClient();
  const artistId = normalizeRouteParam(rawArtistId);
  const partyId = resolvePartyId(authPartyId, settingsPartyId);
  const [refreshing, setRefreshing] = useState(false);

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

  const followersQuery = useQuery<ArtistFollower[]>({
    queryKey: ['artist-followers', artistId],
    queryFn: () => (artistId ? Artists.listFollowers(artistId) : Promise.resolve([])),
    enabled: !!artistId
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        artistQuery.refetch(),
        eventsQuery.refetch(),
        followersQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const isFollowing = useMemo(() => {
    if (!followersQuery.data || !partyId) return false;
    return followersQuery.data.some((r) => String(r.followerPartyId) === String(partyId));
  }, [followersQuery.data, partyId]);

  const handleToggleFollow = useCallback(async () => {
    if (!artistId || !partyId) return;
    try {
      if (isFollowing) {
        await Artists.unfollow(artistId, partyId);
      } else {
        await Artists.follow(artistId, partyId);
      }
      void qc.invalidateQueries({ queryKey: ['artist-followers', artistId] });
    } catch (err) {
      console.warn('follow action failed', err);
    }
  }, [artistId, partyId, isFollowing, qc]);

  const handleEventPress = useCallback((eventId: string) => {
    router.push({ pathname: '/eventDetail', params: { eventId } });
  }, [router]);

  if (!artistId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.canvas }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.error, { color: colors.danger }]}>Falta el ID del artista</Text>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.actionPrimary }]} onPress={() => router.back()}>
            <Text style={[styles.backButtonText, { color: colors.actionPrimaryContrast }]}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (artistQuery.isLoading && !artist) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.canvas }]}>
        <ArtistDetailSkeleton />
      </SafeAreaView>
    );
  }

  if (artistQuery.isError || !artist) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.canvas }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.error, { color: colors.danger }]}>No se pudo cargar el artista</Text>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.actionPrimary }]} onPress={() => router.back()}>
            <Text style={[styles.backButtonText, { color: colors.actionPrimaryContrast }]}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.canvas }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.actionPrimary} colors={[colors.actionPrimary]} />
        }
      >
        {artist.imageUrl && (
          <Image source={{ uri: artist.imageUrl }} style={styles.artistImage} />
        )}

        <Text style={[styles.artistName, { color: colors.textPrimary }]}>{artist.name}</Text>

        {artist.bio && (
          <Text style={[styles.bio, { color: colors.textSecondary }]}>{artist.bio}</Text>
        )}

        {artist.genres && artist.genres.length > 0 && (
          <View style={styles.genresContainer}>
            {artist.genres.map((genre, idx) => (
              <View key={idx} style={[styles.genreTag, { backgroundColor: colors.infoSurface }]}>
                <Text style={[styles.genreText, { color: colors.actionPrimary }]}>{genre}</Text>
              </View>
            ))}
          </View>
        )}

        {socialRows.length > 0 && (
          <View style={styles.socialContainer}>
            {socialRows.map((row) => (
              <Text key={row.label} style={[styles.socialLink, { color: colors.textSecondary }]}>{row.label}: {row.value}</Text>
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
          <TouchableOpacity style={[styles.editButton, { backgroundColor: colors.actionPrimary }]} onPress={handleEditProfile}>
            <Text style={[styles.editButtonText, { color: colors.actionPrimaryContrast }]}>Editar perfil</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.followButton, isFollowing ? { backgroundColor: colors.infoSurface } : { backgroundColor: colors.actionPrimary }]}
            onPress={handleToggleFollow}
            disabled={!partyId}
          >
            <Text style={[styles.followButtonText, { color: isFollowing ? colors.textPrimary : colors.actionPrimaryContrast }]}>{partyId ? (isFollowing ? 'Siguiendo' : 'Seguir') : 'Inicia sesión para seguir'}</Text>
          </TouchableOpacity>
        </View>

        {upcomingEvents.length > 0 && (
          <View style={styles.eventsSection}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Próximos eventos ({upcomingEvents.length})</Text>
            {upcomingEvents.map(event => (
              <TouchableOpacity
                key={event.id}
                style={[styles.eventItem, { backgroundColor: colors.surface, borderLeftColor: colors.actionPrimary }]}
                onPress={() => handleEventPress(event.id)}
              >
                <View style={styles.eventHeader}>
                  <Text style={[styles.eventTitle, { color: colors.textPrimary }]}>{event.title}</Text>
                  {event.ticketPrice && (
                    <Text style={[styles.eventPrice, { color: colors.actionPrimary }]}>${event.ticketPrice.toFixed(2)}</Text>
                  )}
                </View>
                <Text style={[styles.eventDateTime, { color: colors.textSecondary }]}>
                  {new Date(event.startTime).toLocaleDateString()} a las{' '}
                  {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {event.venue && (
                  <Text style={[styles.eventVenue, { color: colors.textSecondary }]}>{event.venue.name}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {upcomingEvents.length === 0 && !eventsQuery.isLoading && (
          <Text style={[styles.noEventsText, { color: colors.textSecondary }]}>No hay próximos eventos</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  artistImage: { width: '100%', height: 240, borderRadius: 12, marginBottom: 16 },
  artistName: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  bio: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  genresContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  genreTag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  genreText: { fontSize: 12, fontWeight: '600' },
  socialContainer: { marginBottom: 16 },
  socialLink: { fontSize: 13, marginBottom: 6 },
  editButton: { paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 24 },
  editButtonText: { fontSize: 14, fontWeight: '700' },
  eventsSection: { marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  eventItem: { borderRadius: 8, padding: 12, marginBottom: 10, borderLeftWidth: 4 },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  eventTitle: { fontSize: 14, fontWeight: '600', flex: 1 },
  eventPrice: { fontSize: 13, fontWeight: '700', marginLeft: 8 },
  eventDateTime: { fontSize: 12, marginBottom: 4 },
  eventVenue: { fontSize: 12 },
  noEventsText: { fontSize: 14, textAlign: 'center', marginTop: 16 },
  error: { fontSize: 14, marginBottom: 12 },
  backButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  backButtonText: { fontSize: 14, fontWeight: '700' },
  followButton: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  followButtonText: { fontSize: 14, fontWeight: '700' }
});
