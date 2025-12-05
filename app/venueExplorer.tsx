import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ActivityIndicator, TextInput,
  TouchableOpacity, FlatList, Switch
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';

import { Venues } from '../src/api/venues';
import type { Venue } from '../src/types';

interface VenueWithDistance extends Venue {
  distance?: number;
}

export default function VenueExplorerScreen() {
  const router = useRouter();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState('5');
  const [showMapView, setShowMapView] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Request location permission and get current location
  useEffect(() => {
    const requestLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Location permission denied');
          return;
        }

        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({
          lat: location.coords.latitude,
          lng: location.coords.longitude
        });
      } catch (_err) {
        setLocationError('Failed to get location');
      }
    };

    requestLocation();
  }, []);

  // Query venues near user location
  const { data: nearbyVenues, isLoading, isError } = useQuery({
    queryKey: ['venues-nearby', userLocation, radiusKm],
    queryFn: () => {
      if (!userLocation) return Promise.resolve([]);
      return Venues.list({
        nearCoords: { lat: userLocation.lat, lng: userLocation.lng },
        radiusKm: parseInt(radiusKm) || 5
      });
    },
    enabled: !!userLocation
  });

  // Calculate distance from user
  const venuesWithDistance = useMemo(() => {
    if (!nearbyVenues || !userLocation) return [];
    return nearbyVenues.map(venue => ({
      ...venue,
      distance: calculateDistance(
        userLocation.lat,
        userLocation.lng,
        venue.latitude,
        venue.longitude
      )
    }));
  }, [nearbyVenues, userLocation]);

  // Sort by distance
  const sortedVenues = useMemo(() => {
    return [...venuesWithDistance].sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }, [venuesWithDistance]);

  const handleVenuePress = useCallback((venueId: string) => {
    router.push({ pathname: '/venueDetail', params: { venueId } });
  }, [router]);

  const handleCreateVenue = useCallback(() => {
    router.push('/createVenue');
  }, [router]);

  const renderVenueItem = useCallback(({ item }: { item: VenueWithDistance }) => (
    <TouchableOpacity
      style={styles.venueItem}
      onPress={() => handleVenuePress(item.id)}
    >
      <View style={styles.venueItemHeader}>
        <View style={styles.venueInfo}>
          <Text style={styles.venueName}>{item.name}</Text>
          <Text style={styles.venueCity}>{item.city}</Text>
        </View>
        {item.distance !== undefined && (
          <Text style={styles.distance}>{item.distance.toFixed(1)} km</Text>
        )}
      </View>
      {item.capacity && (
        <Text style={styles.venueCapacity}>Capacity: {item.capacity} people</Text>
      )}
      {item.address && (
        <Text style={styles.venueAddress} numberOfLines={1}>{item.address}</Text>
      )}
    </TouchableOpacity>
  ), [handleVenuePress]);

  if (locationError && !userLocation) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{locationError}</Text>
          <TouchableOpacity style={styles.errorButton} onPress={() => setLocationError(null)}>
            <Text style={styles.errorButtonText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!userLocation) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Venues Near You</Text>
        <TouchableOpacity style={styles.createButton} onPress={handleCreateVenue}>
          <Text style={styles.createButtonText}>+ Add Venue</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        <View style={styles.radiusControl}>
          <Text style={styles.label}>Search Radius:</Text>
          <TextInput
            style={styles.radiusInput}
            value={radiusKm}
            onChangeText={setRadiusKm}
            keyboardType="number-pad"
            maxLength={3}
          />
          <Text style={styles.radiusUnit}>km</Text>
        </View>

        <View style={styles.viewToggle}>
          <Text style={styles.label}>Map View</Text>
          <Switch
            value={showMapView}
            onValueChange={setShowMapView}
            trackColor={{ false: '#ddd', true: '#81c784' }}
            thumbColor={showMapView ? '#2563eb' : '#f4f3f4'}
          />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load venues</Text>
        </View>
      ) : sortedVenues.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No venues found within {radiusKm}km</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={handleCreateVenue}>
            <Text style={styles.emptyButtonText}>Create one!</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sortedVenues}
          renderItem={renderVenueItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

// Haversine formula to calculate distance between two coordinates (in km)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  createButton: { backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  createButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  controls: { paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  radiusControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 12, fontWeight: '600', color: '#666', textTransform: 'uppercase' },
  radiusInput: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13 },
  radiusUnit: { fontSize: 12, fontWeight: '600', color: '#666', minWidth: 25 },
  viewToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  errorText: { fontSize: 14, color: '#dc2626', textAlign: 'center', marginBottom: 12 },
  errorButton: { backgroundColor: '#dc2626', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6 },
  errorButtonText: { color: '#fff', fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  emptyText: { fontSize: 16, color: '#999', marginBottom: 16 },
  emptyButton: { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6 },
  emptyButtonText: { color: '#fff', fontWeight: '600' },
  listContent: { paddingHorizontal: 16, paddingVertical: 8, paddingBottom: 16 },
  venueItem: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#f0f0f0' },
  venueItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  venueInfo: { flex: 1 },
  venueName: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  venueCity: { fontSize: 12, color: '#666' },
  distance: { fontSize: 13, fontWeight: '600', color: '#2563eb' },
  venueCapacity: { fontSize: 12, color: '#999', marginBottom: 4 },
  venueAddress: { fontSize: 12, color: '#666' }
});
