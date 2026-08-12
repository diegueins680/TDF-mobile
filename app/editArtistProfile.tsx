import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator,
  SafeAreaView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePreventRemove, useNavigation } from '@react-navigation/native';

import { Artists } from '../src/api/artists';
import { normalizeRouteParam } from '../src/lib/routeParams';
import { useAnalytics } from '../src/analytics/AnalyticsProvider';

const GENRE_OPTIONS = [
  'Rock', 'Pop', 'Hip-Hop', 'Jazz', 'Blues', 'Classical',
  'Electronic', 'Reggae', 'Country', 'Folk', 'Latin', 'R&B',
  'Soul', 'Metal', 'Punk', 'Indie', 'Alternative', 'Ambient'
];

export default function EditArtistProfileScreen() {
  const { artistId: rawArtistId } = useLocalSearchParams<{ artistId?: string | string[] }>();
  const router = useRouter();
  const qc = useQueryClient();
  const analytics = useAnalytics();
  const artistId = normalizeRouteParam(rawArtistId);

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [instagramHandle, setInstagramHandle] = useState('');
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [showGenreSelect, setShowGenreSelect] = useState(false);

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

  const artistQuery = useQuery({
    queryKey: ['artist', artistId],
    queryFn: () => (artistId ? Artists.getById(artistId) : null),
    enabled: !!artistId
  });

  const updateMutation = useMutation({
    mutationFn: (body: Parameters<typeof Artists.update>[1]) => {
      if (!artistId) throw new Error('Artista no encontrado');
      return Artists.update(artistId, body);
    },
    onSuccess: () => {
      setIsDirty(false);
      qc.invalidateQueries({ queryKey: ['artist', artistId] });
      analytics.capture('artist_profile_saved', { platform: 'mobile', action: 'update' });
      Alert.alert('Listo', 'Perfil actualizado');
      router.back();
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo actualizar el perfil');
    }
  });

  useEffect(() => {
    if (artistQuery.data) {
      setName(artistQuery.data.name || '');
      setBio(artistQuery.data.bio || '');
      setImageUrl(artistQuery.data.imageUrl || '');
      setSelectedGenres(artistQuery.data.genres || []);
      setInstagramHandle(artistQuery.data.instagramHandle || '');
      setSpotifyUrl(artistQuery.data.spotifyUrl || '');
    }
  }, [artistQuery.data]);

  const handleToggleGenre = useCallback((genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre)
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
    setIsDirty(true);
  }, []);

  const handleUpdateProfile = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Validación', 'El nombre artístico es obligatorio');
      return;
    }

    updateMutation.mutate({
      name: name.trim(),
      bio: bio.trim() || null,
      imageUrl: imageUrl.trim() || null,
      genres: selectedGenres,
      instagramHandle: instagramHandle.trim() || null,
      spotifyUrl: spotifyUrl.trim() || null
    });
  }, [name, bio, imageUrl, selectedGenres, instagramHandle, spotifyUrl, updateMutation]);

  if (!artistId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.error}>Falta el ID del artista</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (artistQuery.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" accessibilityLabel="Cargando artista" />
        </View>
      </SafeAreaView>
    );
  }

  if (artistQuery.isError || !artistQuery.data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.error}>No se pudo cargar el artista</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>Editar perfil de artista</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Nombre artístico *</Text>
          <TextInput
            ref={nameRef}
            placeholder="Tu nombre artístico"
            accessibilityLabel="Nombre artístico, obligatorio"
            value={name}
            onChangeText={(text) => { setName(text); setIsDirty(true); }}
            style={styles.input}
            placeholderTextColor="#999"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => bioRef.current?.focus()}
            blurOnSubmit={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Biografía</Text>
          <TextInput
            ref={bioRef}
            placeholder="Cuéntanos sobre ti..."
            accessibilityLabel="Biografía"
            value={bio}
            onChangeText={(text) => { setBio(text); setIsDirty(true); }}
            style={[styles.input, styles.bioInput]}
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
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
            accessibilityLabel="URL de imagen"
            value={imageUrl}
            onChangeText={(text) => { setImageUrl(text); setIsDirty(true); }}
            style={styles.input}
            placeholderTextColor="#999"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => instagramRef.current?.focus()}
            blurOnSubmit={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Géneros</Text>
          <TouchableOpacity
            style={styles.genreSelectButton}
            onPress={() => setShowGenreSelect(!showGenreSelect)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showGenreSelect }}
            accessibilityLabel="Seleccionar géneros"
          >
            <Text style={styles.genreSelectButtonText}>
              {selectedGenres.length > 0 ? `${selectedGenres.length} seleccionados` : 'Seleccionar géneros...'}
            </Text>
          </TouchableOpacity>

          {showGenreSelect && (
            <View style={styles.genreGrid}>
              {GENRE_OPTIONS.map((genre, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.genreOption,
                    selectedGenres.includes(genre) && styles.genreOptionSelected
                  ]}
                  onPress={() => handleToggleGenre(genre)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selectedGenres.includes(genre) }}
                  accessibilityLabel={genre}
                >
                  <Text
                    style={[
                      styles.genreOptionText,
                      selectedGenres.includes(genre) && styles.genreOptionTextSelected
                    ]}
                  >
                    {genre}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.selectedGenresContainer}>
            {selectedGenres.map((genre, idx) => (
              <View key={idx} style={styles.selectedGenreTag}>
                <Text style={styles.selectedGenreText}>{genre}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Usuario de Instagram</Text>
          <TextInput
            ref={instagramRef}
            placeholder="@username"
            accessibilityLabel="Usuario de Instagram"
            value={instagramHandle}
            onChangeText={(text) => { setInstagramHandle(text); setIsDirty(true); }}
            style={styles.input}
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
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
            accessibilityLabel="URL de Spotify"
            value={spotifyUrl}
            onChangeText={(text) => { setSpotifyUrl(text); setIsDirty(true); }}
            style={styles.input}
            placeholderTextColor="#999"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />
        </View>

        <TouchableOpacity
          style={styles.updateButton}
          onPress={handleUpdateProfile}
          disabled={updateMutation.isPending}
          accessibilityRole="button"
          accessibilityState={{ disabled: updateMutation.isPending }}
        >
          {updateMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.updateButtonText}>Actualizar perfil</Text>
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 20 },
  error: { fontSize: 14, color: '#dc2626', marginBottom: 12 },
  backButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2563eb' },
  backButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  field: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1a1a1a' },
  bioInput: { textAlignVertical: 'top' },
  genreSelectButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  genreSelectButtonText: { fontSize: 14, color: '#1a1a1a' },
  genreGrid: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  genreOption: { flex: 0.5, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  genreOptionSelected: { backgroundColor: '#e0e7ff', borderColor: '#2563eb' },
  genreOptionText: { fontSize: 12, fontWeight: '500', color: '#666' },
  genreOptionTextSelected: { color: '#2563eb', fontWeight: '600' },
  selectedGenresContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  selectedGenreTag: { backgroundColor: '#e0e7ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  selectedGenreText: { fontSize: 12, fontWeight: '600', color: '#2563eb' },
  updateButton: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  updateButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' }
});
