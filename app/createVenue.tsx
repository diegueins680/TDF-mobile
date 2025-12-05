import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { Venues } from '../src/api/venues';
import type { VenueCreate } from '../src/types';

export default function CreateVenueScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [capacity, setCapacity] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const createMutation = useMutation({
    mutationFn: (body: VenueCreate) => Venues.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['venues'] });
      Alert.alert('Success', 'Venue created!');
      router.back();
    },
    onError: () => {
      Alert.alert('Error', 'Failed to create venue');
    }
  });

  const handleCreateVenue = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Venue name is required');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Validation', 'Address is required');
      return;
    }
    if (!city.trim()) {
      Alert.alert('Validation', 'City is required');
      return;
    }
    if (!latitude.trim() || !longitude.trim()) {
      Alert.alert('Validation', 'Latitude and longitude are required');
      return;
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert('Validation', 'Latitude and longitude must be valid numbers');
      return;
    }

    const venuData: VenueCreate = {
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      latitude: lat,
      longitude: lng,
    };

    // Add optional fields
    if (state.trim()) venuData.state = state.trim();
    if (zipCode.trim()) venuData.zipCode = zipCode.trim();
    if (capacity) {
      const cap = parseInt(capacity);
      if (!isNaN(cap)) venuData.capacity = cap;
    }
    if (phoneNumber.trim()) venuData.phoneNumber = phoneNumber.trim();

    createMutation.mutate(venuData);
  }, [name, address, city, state, zipCode, latitude, longitude, capacity, phoneNumber, createMutation]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Create Venue</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Venue Name *</Text>
          <TextInput
            placeholder="Club, Bar, Theater, etc."
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Address *</Text>
          <TextInput
            placeholder="Street address"
            value={address}
            onChangeText={setAddress}
            style={styles.input}
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, styles.flex]}>
            <Text style={styles.label}>City *</Text>
            <TextInput
              placeholder="City"
              value={city}
              onChangeText={setCity}
              style={styles.input}
              placeholderTextColor="#999"
            />
          </View>
          <View style={[styles.field, styles.flex]}>
            <Text style={styles.label}>State</Text>
            <TextInput
              placeholder="State"
              value={state}
              onChangeText={setState}
              style={styles.input}
              placeholderTextColor="#999"
              maxLength={2}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Zip Code</Text>
          <TextInput
            placeholder="Postal code"
            value={zipCode}
            onChangeText={setZipCode}
            style={styles.input}
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, styles.flex]}>
            <Text style={styles.label}>Latitude *</Text>
            <TextInput
              placeholder="0.0000"
              value={latitude}
              onChangeText={setLatitude}
              style={styles.input}
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={[styles.field, styles.flex]}>
            <Text style={styles.label}>Longitude *</Text>
            <TextInput
              placeholder="0.0000"
              value={longitude}
              onChangeText={setLongitude}
              style={styles.input}
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Capacity</Text>
          <TextInput
            placeholder="Number of people"
            value={capacity}
            onChangeText={setCapacity}
            style={styles.input}
            placeholderTextColor="#999"
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            placeholder="+1 (555) 000-0000"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            style={styles.input}
            placeholderTextColor="#999"
            keyboardType="phone-pad"
          />
        </View>

        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateVenue}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createButtonText}>Create Venue</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 24 },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 20 },
  field: { marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  label: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1a1a1a' },
  createButton: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  createButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' }
});
