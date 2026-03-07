import React, { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { Venues } from '../src/api/venues';
import { Events } from '../src/api/events';
import type { ID } from '../src/types';
import { normalizeRouteParam } from '../src/lib/routeParams';

export default function VenueDetailScreen() {
  const { venueId: rawVenueId } = useLocalSearchParams<{ venueId?: string | string[] }>();
  const router = useRouter();
  const venueId = normalizeRouteParam(rawVenueId);

  const venueQuery = useQuery({
    queryKey: ['venue', venueId],
    queryFn: () => (venueId ? Venues.getById(venueId) : null),
    enabled: !!venueId
  });

  const eventsQuery = useQuery({
    queryKey: ['venue-events', venueId],
    queryFn: () => (venueId ? Events.list({ venueId, upcomingOnly: true }) : Promise.resolve([])),
    enabled: !!venueId
  });

  const venue = venueQuery.data;
  const venueEvents = eventsQuery.data || [];

  const handleEventPress = useCallback((eventId: ID) => {
    router.push({ pathname: '/eventDetail', params: { eventId: String(eventId) } });
  }, [router]);

  const handleCreateEvent = useCallback(() => {
    router.push({ pathname: '/createEvent', params: { venueId } });
  }, [router, venueId]);

  if (!venueId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.error}>Missing venue ID</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (venueQuery.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  if (venueQuery.isError || !venue) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.error}>Failed to load venue</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.venueName}>{venue.name}</Text>
          <TouchableOpacity style={styles.createEventButton} onPress={handleCreateEvent}>
            <Text style={styles.createEventButtonText}>+ Event Here</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          {venue.address && (
            <Text style={styles.infoText}>{venue.address}</Text>
          )}
          <Text style={styles.infoText}>
            {venue.city}{venue.state ? `, ${venue.state}` : ''}{venue.zipCode ? ` ${venue.zipCode}` : ''}
          </Text>
          <Text style={styles.coordinates}>
            {venue.latitude.toFixed(6)}, {venue.longitude.toFixed(6)}
          </Text>
        </View>

        {venue.capacity && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Capacity</Text>
            <Text style={styles.infoText}>{venue.capacity} people</Text>
          </View>
        )}

        {(venue.phoneNumber || venue.website) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact</Text>
            {venue.phoneNumber && (
              <Text style={styles.infoText}>📞 {venue.phoneNumber}</Text>
            )}
            {venue.website && (
              <Text style={styles.infoText}>🌐 {venue.website}</Text>
            )}
          </View>
        )}

        {venueEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Events ({venueEvents.length})</Text>
            {venueEvents.map(event => (
              <TouchableOpacity
                key={event.id}
                style={styles.eventItem}
                onPress={() => handleEventPress(event.id)}
              >
                <View style={styles.eventHeader}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  {typeof event.ticketPrice === 'number' && (
                    <Text style={styles.eventPrice}>${event.ticketPrice.toFixed(2)}</Text>
                  )}
                </View>
                <Text style={styles.eventDateTime}>
                  {new Date(event.startTime).toLocaleDateString()} at{' '}
                  {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {venueEvents.length === 0 && !eventsQuery.isLoading && (
          <View style={styles.section}>
            <Text style={styles.noEventsText}>No upcoming events at this venue</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  venueName: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  createEventButton: { backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, marginLeft: 12 },
  createEventButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  section: { marginBottom: 20, backgroundColor: '#fff', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#f0f0f0' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 8, textTransform: 'uppercase' },
  infoText: { fontSize: 13, color: '#666', marginBottom: 4 },
  coordinates: { fontSize: 11, color: '#999', marginTop: 4, fontFamily: 'monospace' },
  error: { fontSize: 14, color: '#dc2626', marginBottom: 12 },
  backButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2563eb' },
  backButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  eventItem: { backgroundColor: '#f9f9f9', borderRadius: 6, padding: 10, marginBottom: 8 },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  eventTitle: { fontSize: 13, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  eventPrice: { fontSize: 12, fontWeight: '700', color: '#2563eb', marginLeft: 8 },
  eventDateTime: { fontSize: 11, color: '#999' },
  noEventsText: { fontSize: 13, color: '#999', textAlign: 'center', paddingVertical: 12 }
});
