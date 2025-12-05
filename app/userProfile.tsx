import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity, ActivityIndicator, FlatList
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { Artists } from '../src/api/artists';
import { Events } from '../src/api/events';

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export default function UserProfileScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'artist' | 'attending' | 'saved'>('artist');

  // Mock current user - in real app would come from auth context
  const currentUser: UserProfile = {
    id: 'current-user',
    name: 'John Doe',
    email: 'john@example.com'
  };

  // Query user's artist profile
  const artistQuery = useQuery({
    queryKey: ['user-artist-profile'],
    queryFn: () => Artists.getByParty(currentUser.id)
  });

  // Query events user is attending
  const attendingQuery = useQuery({
    queryKey: ['user-attending-events'],
    queryFn: () => Events.list({ userId: currentUser.id })
  });

  const upcomingEvents = useMemo(() => {
    if (!attendingQuery.data) return [];
    const now = new Date();
    return attendingQuery.data
      .filter(e => new Date(e.startDateTime) > now)
      .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());
  }, [attendingQuery.data]);

  const handleCreateArtistProfile = useCallback(() => {
    router.push('/createArtistProfile');
  }, [router]);

  const handleEditArtistProfile = useCallback(() => {
    if (artistQuery.data) {
      router.push({ pathname: '/editArtistProfile', params: { artistId: artistQuery.data.id } });
    }
  }, [artistQuery.data, router]);

  const handleEventPress = useCallback((eventId: string) => {
    router.push({ pathname: '/eventDetail', params: { eventId } });
  }, [router]);

  const renderEventItem = ({ item }: { item: typeof upcomingEvents[0] }) => (
    <TouchableOpacity
      style={styles.eventItem}
      onPress={() => handleEventPress(item.id)}
    >
      <View style={styles.eventHeader}>
        <Text style={styles.eventTitle}>{item.title}</Text>
        {item.ticketPrice && (
          <Text style={styles.eventPrice}>${(item.ticketPrice / 100).toFixed(2)}</Text>
        )}
      </View>
      <Text style={styles.eventDateTime}>
        {new Date(item.startDateTime).toLocaleDateString()} at{' '}
        {new Date(item.startDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
              {currentUser.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{currentUser.name}</Text>
            <Text style={styles.profileEmail}>{currentUser.email}</Text>
          </View>
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
            style={[styles.tab, activeTab === 'attending' && styles.tabActive]}
            onPress={() => setActiveTab('attending')}
          >
            <Text style={[styles.tabLabel, activeTab === 'attending' && styles.tabLabelActive]}>
              Attending
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
            {artistQuery.isLoading ? (
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

        {activeTab === 'attending' && (
          <View style={styles.section}>
            {attendingQuery.isLoading ? (
              <ActivityIndicator size="large" color="#2563eb" />
            ) : upcomingEvents.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Your Upcoming Events ({upcomingEvents.length})</Text>
                <FlatList
                  data={upcomingEvents}
                  renderItem={renderEventItem}
                  keyExtractor={item => item.id}
                  scrollEnabled={false}
                />
              </>
            ) : (
              <Text style={styles.noDataText}>You&apos;re not attending any events yet</Text>
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
  content: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 24 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: '#fff', padding: 16, borderRadius: 8 },
  avatarPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarInitial: { fontSize: 24, fontWeight: '700', color: '#fff' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  profileEmail: { fontSize: 13, color: '#666' },
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
