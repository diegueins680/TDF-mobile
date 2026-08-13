import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ActivityIndicator, TextInput,
  TouchableOpacity, FlatList, Switch
} from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useAppTheme } from '../src/theme/ThemeProvider';

import { Venues } from '../src/api/venues';
import type { ID, Venue } from '../src/types';

interface VenueWithDistance extends Venue {
  distance?: number;
}

interface MapProjection {
  user: { x: number; y: number } | null;
  venues: Array<VenueWithDistance & { x: number; y: number }>;
}

type Styles = {
  container: ViewStyle;
  header: ViewStyle;
  title: TextStyle;
  createButton: ViewStyle;
  createButtonText: TextStyle;
  controls: ViewStyle;
  locationNotice: ViewStyle;
  locationNoticeText: TextStyle;
  locationNoticeButton: ViewStyle;
  locationNoticeButtonText: TextStyle;
  radiusControl: ViewStyle;
  label: TextStyle;
  radiusInput: TextStyle;
  radiusUnit: TextStyle;
  viewToggle: ViewStyle;
  loadingContainer: ViewStyle;
  loadingText: TextStyle;
  errorContainer: ViewStyle;
  errorText: TextStyle;
  emptyContainer: ViewStyle;
  emptyText: TextStyle;
  emptyButton: ViewStyle;
  emptyButtonText: TextStyle;
  mapViewContainer: ViewStyle;
  mapSurface: ViewStyle;
  mapGridHorizontal: ViewStyle;
  mapGridVertical: ViewStyle;
  venueMarker: ViewStyle;
  userMarker: ViewStyle;
  venueMarkerDot: ViewStyle;
  userMarkerDot: ViewStyle;
  markerLabel: TextStyle;
  mapLegend: ViewStyle;
  legendItem: ViewStyle;
  legendDot: ViewStyle;
  legendText: TextStyle;
  mapHint: TextStyle;
  listContent: ViewStyle;
  venueItem: ViewStyle;
  venueItemHeader: ViewStyle;
  venueInfo: ViewStyle;
  venueName: TextStyle;
  venueCity: TextStyle;
  distance: TextStyle;
  venueCapacity: TextStyle;
  venueAddress: TextStyle;
};

export default function VenueExplorerScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isResolvingLocation, setIsResolvingLocation] = useState(true);
  const [radiusKm, setRadiusKm] = useState('5');
  const [showMapView, setShowMapView] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const normalizedRadiusKm = useMemo(() => {
    const parsed = Number.parseInt(radiusKm, 10);
    if (Number.isNaN(parsed)) return 5;
    return Math.min(999, Math.max(1, parsed));
  }, [radiusKm]);

  const requestLocation = useCallback(async () => {
    setIsResolvingLocation(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setUserLocation(null);
        setLocationError('Location permission denied. Showing all venues.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude
      });
    } catch (_err) {
      setUserLocation(null);
      setLocationError('Failed to get location. Showing all venues.');
    } finally {
      setIsResolvingLocation(false);
    }
  }, []);

  // Request location permission and get current location
  useEffect(() => {
    void requestLocation();
  }, [requestLocation]);

  // Query venues near user location
  const { data: nearbyVenues, isLoading, isError } = useQuery({
    queryKey: ['venues-nearby', userLocation, normalizedRadiusKm],
    queryFn: () => {
      if (!userLocation) return Venues.list();
      return Venues.list({
        near: {
          lat: userLocation.lat,
          lng: userLocation.lng,
          radiusKm: normalizedRadiusKm
        }
      });
    },
    enabled: !isResolvingLocation
  });

  // Calculate distance from user
  const venuesWithDistance = useMemo(() => {
    if (!nearbyVenues) return [];
    if (!userLocation) return nearbyVenues.map((venue) => ({ ...venue, distance: undefined }));
    return nearbyVenues.map(venue => ({
      ...venue,
      distance: calculateDistance(
        userLocation.lat,
        userLocation.lng,
        venue.latitude,
        venue.longitude
      )
    }))
      .filter((venue) => venue.distance !== undefined && venue.distance <= normalizedRadiusKm);
  }, [nearbyVenues, normalizedRadiusKm, userLocation]);

  // Sort by distance
  const sortedVenues = useMemo(() => {
    return [...venuesWithDistance].sort((a, b) => {
      const left = typeof a.distance === 'number' ? a.distance : Number.POSITIVE_INFINITY;
      const right = typeof b.distance === 'number' ? b.distance : Number.POSITIVE_INFINITY;
      if (left === right) return a.name.localeCompare(b.name);
      return left - right;
    });
  }, [venuesWithDistance]);

  const mapProjection = useMemo<MapProjection>(() => {
    if (sortedVenues.length === 0) return { user: userLocation ? { x: 50, y: 50 } : null, venues: [] };

    const latitudes = sortedVenues.map((venue) => venue.latitude);
    const longitudes = sortedVenues.map((venue) => venue.longitude);
    if (userLocation) {
      latitudes.push(userLocation.lat);
      longitudes.push(userLocation.lng);
    }
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    const latRange = Math.max(maxLat - minLat, 0.0001);
    const lngRange = Math.max(maxLng - minLng, 0.0001);
    const paddingPct = 8;
    const usablePct = 100 - (paddingPct * 2);

    const toMapX = (lng: number) => (((lng - minLng) / lngRange) * usablePct) + paddingPct;
    const toMapY = (lat: number) => (((maxLat - lat) / latRange) * usablePct) + paddingPct;

    return {
      user: userLocation ? { x: toMapX(userLocation.lng), y: toMapY(userLocation.lat) } : null,
      venues: sortedVenues.map((venue) => ({
        ...venue,
        x: toMapX(venue.longitude),
        y: toMapY(venue.latitude)
      }))
    };
  }, [sortedVenues, userLocation]);

  const handleVenuePress = useCallback((venueId: ID) => {
    router.push({ pathname: '/venueDetail', params: { venueId: String(venueId) } });
  }, [router]);

  const handleCreateVenue = useCallback(() => {
    router.push('/createVenue');
  }, [router]);

  const renderVenueItem = useCallback(({ item }: { item: VenueWithDistance }) => (
    <TouchableOpacity
      style={[styles.venueItem, { backgroundColor: colors.surface, borderColor: colors.canvas }]}
      onPress={() => handleVenuePress(item.id)}
    >
      <View style={styles.venueItemHeader}>
        <View style={styles.venueInfo}>
          <Text style={[styles.venueName, { color: colors.textPrimary }]}>{item.name}</Text>
          <Text style={[styles.venueCity, { color: colors.textSecondary }]}>{item.city}</Text>
        </View>
        {item.distance !== undefined && (
          <Text style={[styles.distance, { color: colors.actionPrimary }]}>{item.distance.toFixed(1)} km</Text>
        )}
      </View>
      {item.capacity && (
        <Text style={[styles.venueCapacity, { color: colors.textSecondary }]}>Capacity: {item.capacity} people</Text>
      )}
      {item.address && (
        <Text style={[styles.venueAddress, { color: colors.textSecondary }]} numberOfLines={1}>{item.address}</Text>
      )}
    </TouchableOpacity>
  ), [handleVenuePress, colors]);

  if (isResolvingLocation) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.canvas }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.actionPrimary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Getting your location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.canvas }]}>
      <View style={[styles.header, { borderBottomColor: colors.canvas }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Venues Near You</Text>
        <TouchableOpacity style={[styles.createButton, { backgroundColor: colors.actionPrimary }]} onPress={handleCreateVenue}>
          <Text style={[styles.createButtonText, { color: colors.actionPrimaryContrast }]}>+ Add Venue</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.controls, { borderBottomColor: colors.canvas }]}>
        <View style={styles.radiusControl}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Search Radius:</Text>
          <TextInput
            style={[styles.radiusInput, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, color: colors.textPrimary }]}
            value={radiusKm}
            onChangeText={setRadiusKm}
            keyboardType="number-pad"
            maxLength={3}
          />
          <Text style={[styles.radiusUnit, { color: colors.textSecondary }]}>km</Text>
        </View>

        <View style={styles.viewToggle}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Map View</Text>
          <Switch
            value={showMapView}
            onValueChange={setShowMapView}
            trackColor={{ false: colors.borderSubtle, true: colors.success }}
            thumbColor={showMapView ? colors.actionPrimary : colors.surfaceMuted}
          />
        </View>
      </View>
      {locationError && (
        <View style={[styles.locationNotice, { borderColor: colors.infoBorder, backgroundColor: colors.infoSurface }]}>
          <Text style={[styles.locationNoticeText, { color: colors.textPrimary }]}>{locationError}</Text>
          <TouchableOpacity style={[styles.locationNoticeButton, { backgroundColor: colors.actionPrimary }]} onPress={() => void requestLocation()}>
            <Text style={[styles.locationNoticeButtonText, { color: colors.actionPrimaryContrast }]}>Retry location</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.actionPrimary} />
        </View>
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.danger }]}>Failed to load venues</Text>
        </View>
      ) : sortedVenues.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {userLocation ? `No venues found within ${normalizedRadiusKm}km` : 'No venues found'}
          </Text>
          <TouchableOpacity style={[styles.emptyButton, { backgroundColor: colors.actionPrimary }]} onPress={handleCreateVenue}>
            <Text style={[styles.emptyButtonText, { color: colors.actionPrimaryContrast }]}>Create one!</Text>
          </TouchableOpacity>
        </View>
      ) : showMapView ? (
        <View style={styles.mapViewContainer}>
          <View style={[styles.mapSurface, { backgroundColor: colors.infoSurface, borderColor: colors.infoBorder }]}>
            <View style={[styles.mapGridHorizontal, { backgroundColor: colors.borderSubtle }]} />
            <View style={[styles.mapGridVertical, { backgroundColor: colors.borderSubtle }]} />
            {mapProjection.venues.map((venue) => (
              <TouchableOpacity
                key={String(venue.id)}
                style={[styles.venueMarker, { left: `${venue.x}%`, top: `${venue.y}%` }]}
                onPress={() => handleVenuePress(venue.id)}
              >
                <View style={[styles.venueMarkerDot, { backgroundColor: colors.actionPrimary, borderColor: colors.surface }]} />
                <Text style={[styles.markerLabel, { color: colors.textPrimary }]} numberOfLines={1}>{venue.name}</Text>
              </TouchableOpacity>
            ))}
            {mapProjection.user && (
              <View style={[styles.userMarker, { left: `${mapProjection.user.x}%`, top: `${mapProjection.user.y}%` }]}>
                <View style={[styles.userMarkerDot, { backgroundColor: colors.success, borderColor: colors.surface }]} />
              </View>
            )}
          </View>
          <View style={styles.mapLegend}>
            {mapProjection.user && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.userMarkerDot, { backgroundColor: colors.success, borderColor: colors.surface }]} />
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>You</Text>
              </View>
            )}
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.venueMarkerDot, { backgroundColor: colors.actionPrimary, borderColor: colors.surface }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Venues</Text>
            </View>
          </View>
          <Text style={[styles.mapHint, { color: colors.textSecondary }]}>
            {mapProjection.user
              ? 'Tap a venue marker to open its details.'
              : 'Tap a venue marker to open its details. Location unavailable.'}
          </Text>
          <FlatList
            data={sortedVenues}
            renderItem={renderVenueItem}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={styles.listContent}
          />
        </View>
      ) : (
        <FlatList
          data={sortedVenues}
          renderItem={renderVenueItem}
          keyExtractor={item => String(item.id)}
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

const styles = StyleSheet.create<Styles>({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  title: { fontSize: 20, fontWeight: '700' },
  createButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  createButtonText: { fontSize: 13, fontWeight: '600' },
  controls: { paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 1 },
  locationNotice: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10
  },
  locationNoticeText: { flex: 1, fontSize: 12 },
  locationNoticeButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  locationNoticeButtonText: { fontSize: 11, fontWeight: '700' },
  radiusControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  radiusInput: { flex: 1, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13 },
  radiusUnit: { fontSize: 12, fontWeight: '600', minWidth: 25 },
  viewToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  errorText: { fontSize: 14, textAlign: 'center', marginBottom: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  emptyText: { fontSize: 16, marginBottom: 16 },
  emptyButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6 },
  emptyButtonText: { fontWeight: '600' },
  mapViewContainer: { flex: 1 },
  mapSurface: {
    height: 260,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative'
  },
  mapGridHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1
  },
  mapGridVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1
  },
  venueMarker: {
    position: 'absolute',
    transform: [{ translateX: -7 }, { translateY: -7 }],
    alignItems: 'center',
    zIndex: 4
  },
  userMarker: {
    position: 'absolute',
    transform: [{ translateX: -7 }, { translateY: -7 }],
    alignItems: 'center',
    zIndex: 5
  },
  venueMarkerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2
  },
  userMarkerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2
  },
  markerLabel: {
    marginTop: 4,
    maxWidth: 92,
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1
  },
  mapLegend: {
    marginTop: 8,
    marginHorizontal: 16,
    flexDirection: 'row',
    gap: 16
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  legendText: { fontSize: 12, fontWeight: '600' },
  mapHint: { marginTop: 8, marginHorizontal: 16, fontSize: 12 },
  listContent: { paddingHorizontal: 16, paddingVertical: 8, paddingBottom: 16 },
  venueItem: { borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1 },
  venueItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  venueInfo: { flex: 1 },
  venueName: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  venueCity: { fontSize: 12 },
  distance: { fontSize: 13, fontWeight: '600' },
  venueCapacity: { fontSize: 12, marginBottom: 4 },
  venueAddress: { fontSize: 12 }
});
