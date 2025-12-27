import React, { memo } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from 'expo-router';

import type { SocialEvent } from '../types';

type Props = {
  event: SocialEvent;
  onPress?: () => void;
};

function EventCardComponent({ event, onPress }: Props) {
  const navigation = useNavigation();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      navigation.navigate('eventDetail', { eventId: event.id });
    }
  };

  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);
  const isSameDay = startDate.toDateString() === endDate.toDateString();

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress}>
      {event.imageUrl && (
        <Image source={{ uri: event.imageUrl }} style={styles.image} />
      )}
      
      <View style={styles.content}>
        <Text style={styles.title}>{event.title}</Text>
        
        <View style={styles.meta}>
          <Text style={styles.date}>
            {startDate.toLocaleDateString()} {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {!isSameDay && ` - ${endDate.toLocaleDateString()}`}
          </Text>
          {event.venue && <Text style={styles.venue}>{event.venue.name}</Text>}
        </View>

        {event.artists && event.artists.length > 0 && (
          <View style={styles.artists}>
            <Text style={styles.artistsLabel}>Artists:</Text>
            <Text style={styles.artistsList}>
              {event.artists.map(a => a.name).join(', ')}
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          {typeof event.ticketPrice === 'number' && (
            <Text style={styles.price}>${event.ticketPrice.toFixed(2)}</Text>
          )}
          <View style={styles.stats}>
            <Text style={styles.stat}>{event.rsvpCount} going</Text>
          </View>
        </View>
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
    height: 160,
    backgroundColor: '#f0f0f0'
  },
  content: {
    padding: 12,
    gap: 8
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a'
  },
  meta: {
    gap: 4
  },
  date: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500'
  },
  venue: {
    fontSize: 12,
    color: '#888'
  },
  artists: {
    gap: 4
  },
  artistsLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  artistsList: {
    fontSize: 12,
    color: '#333'
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0'
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb'
  },
  stats: {
    flexDirection: 'row',
    gap: 12
  },
  stat: {
    fontSize: 12,
    color: '#666'
  }
});

export const EventCard = memo(EventCardComponent);
