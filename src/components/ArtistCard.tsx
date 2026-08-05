import React, { memo } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

import type { ArtistProfile } from '../types';
import { useAppTheme } from '../theme/ThemeProvider';

type Props = {
  artist: ArtistProfile;
  onPress?: () => void;
};

function ArtistCardComponent({ artist, onPress }: Props) {
  const router = useRouter();
  const { colors } = useAppTheme();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push({ pathname: '/artistDetail', params: { artistId: String(artist.id) } });
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface }]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Ver perfil de ${artist.name}`}
      accessibilityHint="Abre el perfil del artista"
    >
      {artist.imageUrl && (
        <Image
          source={{ uri: artist.imageUrl }}
          style={[styles.image, { backgroundColor: colors.canvas }]}
          accessible={false}
        />
      )}
      
      <View style={styles.content}>
        <Text style={[styles.name, { color: colors.textPrimary }]}>{artist.name}</Text>
        
        {artist.bio && (
          <Text style={[styles.bio, { color: colors.textSecondary }]} numberOfLines={2}>{artist.bio}</Text>
        )}

        {artist.genres && artist.genres.length > 0 && (
          <View style={styles.genres}>
            {artist.genres.slice(0, 3).map((genre, idx) => (
              <View key={idx} style={[styles.genreTag, { backgroundColor: colors.selected }]}>
                <Text style={[styles.genreText, { color: colors.textSecondary }]}>{genre}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }
  },
  image: {
    width: '100%',
    height: 180,
    backgroundColor: '#f0f0f0'
  },
  content: {
    padding: 12,
    gap: 8
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a'
  },
  bio: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16
  },
  genres: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  genreTag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  genreText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500'
  }
});

export const ArtistCard = memo(ArtistCardComponent);
