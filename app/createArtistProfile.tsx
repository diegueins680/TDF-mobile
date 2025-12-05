import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { Artists } from '../src/api/artists';

const GENRES = [
  'Rock', 'Pop', 'Hip-Hop', 'Jazz', 'Electronic', 'Classical', 'Country',
  'R&B', 'Latin', 'Indie', 'Alternative', 'Metal', 'Soul', 'Blues', 'Reggae'
];

export default function CreateArtistProfileScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  const createMutation = useMutation({
    mutationFn: (body: Parameters<typeof Artists.create>[0]) => Artists.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['artists'] });
      Alert.alert('Success', 'Artist profile created!');
      router.back();
    },
    onError: () => {
      Alert.alert('Error', 'Failed to create artist profile');
    }
  });

  const toggleGenre = useCallback((genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  }, []);

  const handleCreateProfile = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Artist name is required');
      return;
    }

    createMutation.mutate({
      partyId: 'current-user', // In real app, use actual user ID
      name: name.trim(),
      bio: bio.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      genres: selectedGenres.length > 0 ? selectedGenres : undefined,
      instagramHandle: instagramHandle.trim() || undefined,
      spotifyUrl: spotifyUrl.trim() || undefined
    });
  }, [name, bio, imageUrl, instagramHandle, spotifyUrl, selectedGenres, createMutation]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Create Artist Profile</Text>

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
            placeholder="Tell us about your music..."
            value={bio}
            onChangeText={setBio}
            style={[styles.input, styles.inputMultiline]}
            multiline
            numberOfLines={4}
            placeholderTextColor="#999"
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
          <View style={styles.genreGrid}>
            {GENRES.map(genre => (
              <TouchableOpacity
                key={genre}
                style={[styles.genreTag, selectedGenres.includes(genre) && styles.genreTagSelected]}
                onPress={() => toggleGenre(genre)}
              >
                <Text style={[styles.genreTagText, selectedGenres.includes(genre) && styles.genreTagTextSelected]}>
                  {genre}
                </Text>
              </TouchableOpacity>
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
            autoCapitalize="none"
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 24 },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 20 },
  field: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1a1a1a' },
  inputMultiline: { height: 100, textAlignVertical: 'top', paddingVertical: 10 },
  genreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  genreTag: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  genreTagSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  genreTagText: { fontSize: 12, color: '#666', fontWeight: '500' },
  genreTagTextSelected: { color: '#fff' },
  createButton: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  createButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' }
});
