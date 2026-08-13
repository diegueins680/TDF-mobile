import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAppTheme } from '../src/theme/ThemeProvider';

import { Venues } from '../src/api/venues';
import { Events } from '../src/api/events';
import type { ID } from '../src/types';
import { normalizeRouteParam } from '../src/lib/routeParams';

export default function VenueDetailScreen() {
  const { colors } = useAppTheme();
  const { venueId: rawVenueId } = useLocalSearchParams<{ venueId?: string | string[] }>();
  const router = useRouter();
  const venueId = normalizeRouteParam(rawVenueId);
  const [refreshing, setRefreshing] = useState(false);

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

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        venueQuery.refetch(),
        eventsQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleEventPress = useCallback((eventId: ID) => {
    router.push({ pathname: '/eventDetail', params: { eventId: String(eventId) } });
  }, [router]);

  const handleCreateEvent = useCallback(() => {
    router.push({ pathname: '/createEvent', params: { venueId } });
  }, [router, venueId]);

  if (!venueId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.canvas }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.error, { color: colors.danger }]}>Falta el ID del lugar</Text>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.actionPrimary }]} onPress={() => router.back()}>
            <Text style={[styles.backButtonText, { color: colors.actionPrimaryContrast }]}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (venueQuery.isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.canvas }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.actionPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  if (venueQuery.isError || !venue) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.canvas }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.error, { color: colors.danger }]}>No se pudo cargar el lugar</Text>
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
        <View style={styles.header}>
          <Text style={[styles.venueName, { color: colors.textPrimary }]}>{venue.name}</Text>
          <TouchableOpacity style={[styles.createEventButton, { backgroundColor: colors.actionPrimary }]} onPress={handleCreateEvent}>
            <Text style={[styles.createEventButtonText, { color: colors.actionPrimaryContrast }]}>+ Event Here</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.canvas }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Location</Text>
          {venue.address && (
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>{venue.address}</Text>
          )}
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            {venue.city}{venue.state ? `, ${venue.state}` : ''}{venue.zipCode ? ` ${venue.zipCode}` : ''}
          </Text>
          <Text style={[styles.coordinates, { color: colors.textSecondary }]}>
            {venue.latitude.toFixed(6)}, {venue.longitude.toFixed(6)}
          </Text>
        </View>

        {venue.capacity && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.canvas }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Capacity</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>{venue.capacity} people</Text>
          </View>
        )}

        {(venue.phoneNumber || venue.website) && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.canvas }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Contact</Text>
            {venue.phoneNumber && (
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>📞 {venue.phoneNumber}</Text>
            )}
            {venue.website && (
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>🌐 {venue.website}</Text>
            )}
          </View>
        )}

        {venueEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Upcoming Events ({venueEvents.length})</Text>
            {venueEvents.map(event => (
              <TouchableOpacity
                key={event.id}
                style={[styles.eventItem, { backgroundColor: colors.surfaceMuted }]}
                onPress={() => handleEventPress(event.id)}
              >
                <View style={styles.eventHeader}>
                  <Text style={[styles.eventTitle, { color: colors.textPrimary }]}>{event.title}</Text>
                  {typeof event.ticketPrice === 'number' && (
                    <Text style={[styles.eventPrice, { color: colors.actionPrimary }]}>${event.ticketPrice.toFixed(2)}</Text>
                  )}
                </View>
                <Text style={[styles.eventDateTime, { color: colors.textSecondary }]}>
                  {new Date(event.startTime).toLocaleDateString()} at{' '}
                  {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {venueEvents.length === 0 && !eventsQuery.isLoading && (
          <View style={styles.section}>
            <Text style={[styles.noEventsText, { color: colors.textSecondary }]}>No upcoming events at this venue</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  venueName: { fontSize: 24, fontWeight: '700', flex: 1 },
  createEventButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, marginLeft: 12 },
  createEventButtonText: { fontSize: 12, fontWeight: '600' },
  section: { marginBottom: 20, borderRadius: 8, padding: 12, borderWidth: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  infoText: { fontSize: 13, marginBottom: 4 },
  coordinates: { fontSize: 11, marginTop: 4, fontFamily: 'monospace' },
  error: { fontSize: 14, marginBottom: 12 },
  backButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  backButtonText: { fontSize: 14, fontWeight: '700' },
  eventItem: { borderRadius: 6, padding: 10, marginBottom: 8 },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  eventTitle: { fontSize: 13, fontWeight: '600', flex: 1 },
  eventPrice: { fontSize: 12, fontWeight: '700', marginLeft: 8 },
  eventDateTime: { fontSize: 11 },
  noEventsText: { fontSize: 13, textAlign: 'center', paddingVertical: 12 }
});
