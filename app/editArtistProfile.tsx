import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Artists } from '../src/api/artists';

const GENRE_OPTIONS = [
  'Rock', 'Pop', 'Hip-Hop', 'Jazz', 'Blues', 'Classical',
  'Electronic', 'Reggae', 'Country', 'Folk', 'Latin', 'R&B',
  'Soul', 'Metal', 'Punk', 'Indie', 'Alternative', 'Ambient'
];

export default function EditArtistProfileScreen() {
  const { artistId } = useLocalSearchParams<{ artistId: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [instagramHandle, setInstagramHandle] = useState('');
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [showGenreSelect, setShowGenreSelect] = useState(false);

  const artistQuery = useQuery({
    queryKey: ['artist', artistId],
    queryFn: () => (artistId ? Artists.getById(artistId) : null),
    enabled: !!artistId
  });

  const updateMutation = useMutation({
    mutationFn: (body: Parameters<typeof Artists.update>[1]) => (artistId ? Artists.update(artistId, body) : Promise.reject()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['artist', artistId] });
      Alert.alert('Success', 'Profile updated!');
      router.back();
    },
    onError: () => {
      Alert.alert('Error', 'Failed to update profile');
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
  }, []);

  const handleUpdateProfile = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Artist name is required');
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

  if (artistQuery.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Edit Artist Profile</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Artist Name *</Text>
          <TextInput
            placeholder="Your artist name"
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            placeholder="Tell us about yourself..."
            value={bio}
            onChangeText={setBio}
            style={[styles.input, styles.bioInput]}
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Image URL</Text>
          <TextInput
            placeholder="https://..."
            value={imageUrl}
            onChangeText={setImageUrl}
            style={styles.input}
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Genres</Text>
          <TouchableOpacity
            style={styles.genreSelectButton}
            onPress={() => setShowGenreSelect(!showGenreSelect)}
          >
            <Text style={styles.genreSelectButtonText}>
              {selectedGenres.length > 0 ? `${selectedGenres.length} selected` : 'Select genres...'}
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
          <Text style={styles.label}>Instagram Handle</Text>
          <TextInput
            placeholder="@username"
            value={instagramHandle}
            onChangeText={setInstagramHandle}
            style={styles.input}
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Spotify URL</Text>
          <TextInput
            placeholder="https://open.spotify.com/artist/..."
            value={spotifyUrl}
            onChangeText={setSpotifyUrl}
            style={styles.input}
            placeholderTextColor="#999"
          />
        </View>

        <TouchableOpacity
          style={styles.updateButton}
          onPress={handleUpdateProfile}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.updateButtonText}>Update Profile</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 20 },
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
