import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator,
  SafeAreaView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { usePreventRemove, useNavigation } from '@react-navigation/native';

import { Venues } from '../src/api/venues';
import type { VenueCreate } from '../src/types';
import { useAppTheme } from '../src/theme/ThemeProvider';

export default function CreateVenueScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [capacity, setCapacity] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [website, setWebsite] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const [nameError, setNameError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [cityError, setCityError] = useState('');
  const [countryError, setCountryError] = useState('');
  const [latitudeError, setLatitudeError] = useState('');
  const [longitudeError, setLongitudeError] = useState('');
  const [capacityError, setCapacityError] = useState('');

  const nameRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const stateRef = useRef<TextInput>(null);
  const countryRef = useRef<TextInput>(null);
  const zipCodeRef = useRef<TextInput>(null);
  const latitudeRef = useRef<TextInput>(null);
  const longitudeRef = useRef<TextInput>(null);
  const capacityRef = useRef<TextInput>(null);
  const phoneNumberRef = useRef<TextInput>(null);
  const websiteRef = useRef<TextInput>(null);
  const imageUrlRef = useRef<TextInput>(null);

  const navigation = useNavigation();
  const [isDirty, setIsDirty] = useState(false);

  usePreventRemove(isDirty, ({ data }) => {
    Alert.alert(
      'Cambios sin guardar',
      '¿Quieres descartar los cambios?',
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => {} },
        { text: 'Descartar', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
      ],
    );
  });

  const createMutation = useMutation({
    mutationFn: (body: VenueCreate) => Venues.create(body),
    onSuccess: () => {
      setIsDirty(false);
      qc.invalidateQueries({ queryKey: ['venues'] });
      Alert.alert('Success', 'Venue created!');
      router.back();
    },
    onError: () => {
      Alert.alert('Error', 'Failed to create venue');
    }
  });

  const handleCreateVenue = useCallback(async () => {
    setNameError('');
    setAddressError('');
    setCityError('');
    setCountryError('');
    setLatitudeError('');
    setLongitudeError('');
    setCapacityError('');

    if (!name.trim()) {
      setNameError('El nombre del lugar es obligatorio');
      return;
    }
    if (!address.trim()) {
      setAddressError('La dirección es obligatoria');
      return;
    }
    if (!city.trim()) {
      setCityError('La ciudad es obligatoria');
      return;
    }
    const normalizedCountry = country.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalizedCountry)) {
      setCountryError('Debe ser un código de 2 letras, como EC o US');
      return;
    }
    if (!latitude.trim()) {
      setLatitudeError('La latitud es obligatoria');
      return;
    }
    if (!longitude.trim()) {
      setLongitudeError('La longitud es obligatoria');
      return;
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) {
      if (isNaN(lat)) setLatitudeError('Debe ser un número válido');
      if (isNaN(lng)) setLongitudeError('Debe ser un número válido');
      return;
    }
    if (lat < -90 || lat > 90) {
      setLatitudeError('Debe estar entre -90 y 90');
      return;
    }
    if (lng < -180 || lng > 180) {
      setLongitudeError('Debe estar entre -180 y 180');
      return;
    }

    const venueData: VenueCreate = {
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      country: normalizedCountry,
      latitude: lat,
      longitude: lng,
    };

    // Add optional fields
    if (state.trim()) venueData.state = state.trim();
    if (zipCode.trim()) venueData.zipCode = zipCode.trim();
    if (capacity.trim()) {
      const trimmedCapacity = capacity.trim();
      if (!/^\d+$/.test(trimmedCapacity)) {
        setCapacityError('Debe ser un número entero positivo');
        return;
      }
      const parsedCapacity = Number.parseInt(trimmedCapacity, 10);
      if (!Number.isSafeInteger(parsedCapacity) || parsedCapacity <= 0) {
        setCapacityError('Debe ser mayor que 0');
        return;
      }
      venueData.capacity = parsedCapacity;
    }
    if (phoneNumber.trim()) venueData.phoneNumber = phoneNumber.trim();
    if (website.trim()) venueData.website = website.trim();
    if (imageUrl.trim()) venueData.imageUrl = imageUrl.trim();

    createMutation.mutate(venueData);
  }, [name, address, city, country, state, zipCode, latitude, longitude, capacity, phoneNumber, website, imageUrl, createMutation]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Create Venue</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Venue Name *</Text>
          <TextInput
            ref={nameRef}
            returnKeyType="next"
            onSubmitEditing={() => addressRef.current?.focus()}
            blurOnSubmit={false}
            placeholder="Club, Bar, Theater, etc."
            value={name}
            onChangeText={(text) => { setName(text); setNameError(''); setIsDirty(true); }}
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
          />
          {nameError ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }} accessibilityRole="alert">{nameError}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Address *</Text>
          <TextInput
            ref={addressRef}
            returnKeyType="next"
            onSubmitEditing={() => cityRef.current?.focus()}
            blurOnSubmit={false}
            placeholder="Street address"
            value={address}
            onChangeText={(text) => { setAddress(text); setAddressError(''); setIsDirty(true); }}
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
          />
          {addressError ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }} accessibilityRole="alert">{addressError}</Text> : null}
        </View>

        <View style={styles.row}>
          <View style={[styles.field, styles.flex]}>
            <Text style={styles.label}>City *</Text>
            <TextInput
              ref={cityRef}
              returnKeyType="next"
              onSubmitEditing={() => stateRef.current?.focus()}
              blurOnSubmit={false}
              placeholder="City"
              value={city}
              onChangeText={(text) => { setCity(text); setCityError(''); setIsDirty(true); }}
              style={styles.input}
              placeholderTextColor={colors.textSecondary}
            />
            {cityError ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }} accessibilityRole="alert">{cityError}</Text> : null}
          </View>
          <View style={[styles.field, styles.flex]}>
            <Text style={styles.label}>State</Text>
            <TextInput
              ref={stateRef}
              returnKeyType="next"
              onSubmitEditing={() => countryRef.current?.focus()}
              blurOnSubmit={false}
              placeholder="State"
              value={state}
              onChangeText={(text) => { setState(text); setIsDirty(true); }}
              style={styles.input}
              placeholderTextColor={colors.textSecondary}
              maxLength={2}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Country Code *</Text>
          <TextInput
            ref={countryRef}
            returnKeyType="next"
            onSubmitEditing={() => zipCodeRef.current?.focus()}
            blurOnSubmit={false}
            placeholder="EC"
            value={country}
            onChangeText={(text) => { setCountry(text); setCountryError(''); setIsDirty(true); }}
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
            maxLength={2}
          />
          {countryError ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }} accessibilityRole="alert">{countryError}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Zip Code</Text>
          <TextInput
            ref={zipCodeRef}
            returnKeyType="next"
            onSubmitEditing={() => latitudeRef.current?.focus()}
            blurOnSubmit={false}
            placeholder="Postal code"
            value={zipCode}
            onChangeText={(text) => { setZipCode(text); setIsDirty(true); }}
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, styles.flex]}>
            <Text style={styles.label}>Latitude *</Text>
            <TextInput
              ref={latitudeRef}
              returnKeyType="next"
              onSubmitEditing={() => longitudeRef.current?.focus()}
              blurOnSubmit={false}
              placeholder="0.0000"
              value={latitude}
              onChangeText={(text) => { setLatitude(text); setLatitudeError(''); setIsDirty(true); }}
              style={styles.input}
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
            />
            {latitudeError ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }} accessibilityRole="alert">{latitudeError}</Text> : null}
          </View>
          <View style={[styles.field, styles.flex]}>
            <Text style={styles.label}>Longitude *</Text>
            <TextInput
              ref={longitudeRef}
              returnKeyType="next"
              onSubmitEditing={() => capacityRef.current?.focus()}
              blurOnSubmit={false}
              placeholder="0.0000"
              value={longitude}
              onChangeText={(text) => { setLongitude(text); setLongitudeError(''); setIsDirty(true); }}
              style={styles.input}
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
            />
            {longitudeError ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }} accessibilityRole="alert">{longitudeError}</Text> : null}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Capacity</Text>
          <TextInput
            ref={capacityRef}
            returnKeyType="next"
            onSubmitEditing={() => phoneNumberRef.current?.focus()}
            blurOnSubmit={false}
            placeholder="Number of people"
            value={capacity}
            onChangeText={(text) => { setCapacity(text); setCapacityError(''); setIsDirty(true); }}
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
          />
          {capacityError ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }} accessibilityRole="alert">{capacityError}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            ref={phoneNumberRef}
            returnKeyType="next"
            onSubmitEditing={() => websiteRef.current?.focus()}
            blurOnSubmit={false}
            placeholder="+1 (555) 000-0000"
            value={phoneNumber}
            onChangeText={(text) => { setPhoneNumber(text); setIsDirty(true); }}
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Website</Text>
          <TextInput
            ref={websiteRef}
            returnKeyType="next"
            onSubmitEditing={() => imageUrlRef.current?.focus()}
            blurOnSubmit={false}
            placeholder="https://example.com"
            value={website}
            onChangeText={(text) => { setWebsite(text); setIsDirty(true); }}
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Image URL</Text>
          <TextInput
            ref={imageUrlRef}
            returnKeyType="done"
            placeholder="https://..."
            value={imageUrl}
            onChangeText={(text) => { setImageUrl(text); setIsDirty(true); }}
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>

        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateVenue}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color={colors.actionPrimaryContrast} />
          ) : (
            <Text style={styles.createButtonText}>Create Venue</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof import('../src/theme/ThemeProvider').useAppTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 24 },
    title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 20 },
    field: { marginBottom: 12 },
    row: { flexDirection: 'row', gap: 12 },
    flex: { flex: 1 },
    label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase' },
    input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.textPrimary },
    createButton: { backgroundColor: colors.actionPrimary, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 16 },
    createButtonText: { color: colors.actionPrimaryContrast, fontSize: 14, fontWeight: '700' }
  });
}
