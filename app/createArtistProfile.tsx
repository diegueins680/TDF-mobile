import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator,
  SafeAreaView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { usePreventRemove, useNavigation } from '@react-navigation/native';

import { Artists } from '../src/api/artists';
import { useAuth } from '../src/providers/AuthProvider';
import { useAnalytics } from '../src/analytics/AnalyticsProvider';
import { useUserSettings } from '../src/providers/UserSettingsProvider';

export default function CreateArtistProfileScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { partyId: effectivePartyId } = useAuth();
  const analytics = useAnalytics();
  const { getCatalogItems, catalogSyncing } = useUserSettings();
  const genreOptions = getCatalogItems('genres');

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const nameRef = useRef<TextInput>(null);
  const bioRef = useRef<TextInput>(null);
  const imageUrlRef = useRef<TextInput>(null);
  const instagramRef = useRef<TextInput>(null);
  const spotifyRef = useRef<TextInput>(null);

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
    mutationFn: (body: Parameters<typeof Artists.create>[0]) => Artists.create(body),
    onSuccess: () => {
      setIsDirty(false);
      qc.invalidateQueries({ queryKey: ['artists'] });
      if (effectivePartyId) {
        qc.invalidateQueries({ queryKey: ['user-artist-profile', effectivePartyId] });
      }
      analytics.capture('artist_profile_saved', { platform: 'mobile', action: 'create' });
      Alert.alert('Success', 'Artist profile created!');
      router.back();
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message || 'Failed to create artist profile');
    }
  });

  const toggleGenre = useCallback((genreId: string) => {
    setSelectedGenreIds(prev =>
      prev.includes(genreId) ? prev.filter(id => id !== genreId) : [...prev, genreId]
    );
    setIsDirty(true);
  }, []);

  const handleCreateProfile = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Artist name is required');
      return;
    }
    if (!effectivePartyId) {
      Alert.alert('Validation', 'Sign in before creating an artist profile.');
      return;
    }

    createMutation.mutate({
      partyId: effectivePartyId,
      name: name.trim(),
      bio: bio.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      genreIds: selectedGenreIds.length > 0 ? selectedGenreIds : undefined,
      instagramHandle: instagramHandle.trim() || undefined,
      spotifyUrl: spotifyUrl.trim() || undefined
    });
  }, [name, bio, imageUrl, instagramHandle, spotifyUrl, selectedGenreIds, createMutation, effectivePartyId]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Create Artist Profile</Text>
        <Text style={styles.identityText}>
          {effectivePartyId ? 'Connected identity' : 'Sign in to connect your identity'}
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Artist Name *</Text>
          <TextInput
            ref={nameRef}
            placeholder="Your artist name"
            value={name}
            onChangeText={(text) => { setName(text); setIsDirty(true); }}
            style={styles.input}
            placeholderTextColor="#999"
            returnKeyType="next"
            onSubmitEditing={() => bioRef.current?.focus()}
            blurOnSubmit={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            ref={bioRef}
            placeholder="Tell us about your music..."
            value={bio}
            onChangeText={(text) => { setBio(text); setIsDirty(true); }}
            style={[styles.input, styles.inputMultiline]}
            multiline
            numberOfLines={4}
            placeholderTextColor="#999"
            returnKeyType="next"
            onSubmitEditing={() => imageUrlRef.current?.focus()}
            blurOnSubmit={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Image URL</Text>
          <TextInput
            ref={imageUrlRef}
            placeholder="https://..."
            value={imageUrl}
            onChangeText={(text) => { setImageUrl(text); setIsDirty(true); }}
            style={styles.input}
            placeholderTextColor="#999"
            returnKeyType="next"
            onSubmitEditing={() => instagramRef.current?.focus()}
            blurOnSubmit={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Genres</Text>
          <View style={styles.genreGrid}>
            {genreOptions.map(genre => (
              <TouchableOpacity
                key={genre.id}
                style={[styles.genreTag, selectedGenreIds.includes(genre.id) && styles.genreTagSelected]}
                onPress={() => toggleGenre(genre.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selectedGenreIds.includes(genre.id) }}
                accessibilityLabel={genre.name}
              >
                <Text style={[styles.genreTagText, selectedGenreIds.includes(genre.id) && styles.genreTagTextSelected]}>
                  {genre.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {genreOptions.length === 0 && (
            <Text style={styles.catalogStatus}>
              {catalogSyncing ? 'Sincronizando géneros…' : 'No hay un catálogo de géneros disponible.'}
            </Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Instagram Handle</Text>
          <TextInput
            ref={instagramRef}
            placeholder="@username"
            value={instagramHandle}
            onChangeText={(text) => { setInstagramHandle(text); setIsDirty(true); }}
            style={styles.input}
            placeholderTextColor="#999"
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={() => spotifyRef.current?.focus()}
            blurOnSubmit={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Spotify URL</Text>
          <TextInput
            ref={spotifyRef}
            placeholder="https://open.spotify.com/artist/..."
            value={spotifyUrl}
            onChangeText={(text) => { setSpotifyUrl(text); setIsDirty(true); }}
            style={styles.input}
            placeholderTextColor="#999"
            returnKeyType="done"
          />
        </View>

        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateProfile}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createButtonText}>Create Profile</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 24 },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 20 },
  identityText: { color: '#4b5563', marginBottom: 12 },
  field: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1a1a1a' },
  inputMultiline: { height: 100, textAlignVertical: 'top', paddingVertical: 10 },
  genreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  genreTag: { minHeight: 44, justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 22, paddingHorizontal: 12, paddingVertical: 8 },
  genreTagSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  genreTagText: { fontSize: 12, color: '#666', fontWeight: '500' },
  genreTagTextSelected: { color: '#fff' },
  catalogStatus: { marginTop: 8, color: '#6b7280', fontSize: 13 },
  createButton: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  createButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' }
});
