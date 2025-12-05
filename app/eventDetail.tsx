import React, { useCallback, useState } from 'react';
import {
  View, Text, Image, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
  Modal, SafeAreaView, Linking
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Events } from '../src/api/events';
import type { ID, EventRSVPStatus } from '../types';

export default function EventDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const eventId = params.eventId as string;

  const [rsvpStatus, setRsvpStatus] = useState<EventRSVPStatus>('NONE');
  const [showInviteModal, setShowInviteModal] = useState(false);

  const { data: event, isLoading, isError } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => Events.getById(eventId as ID)
  });

  const rsvpMutation = useMutation({
    mutationFn: (status: EventRSVPStatus) =>
      Events.rsvp({ eventId: eventId as ID, userId: 'current-user' as ID, status }),
    onSuccess: (_data, status) => {
      setRsvpStatus(status);
      qc.invalidateQueries({ queryKey: ['event', eventId] });
      Alert.alert('Success', `You're ${status.toLowerCase()}`);
    }
  });

  const handleOpenTickets = useCallback(() => {
    if (event?.ticketUrl) {
      Linking.openURL(event.ticketUrl).catch(() => {
        Alert.alert('Error', 'Could not open ticket URL');
      });
    }
  }, [event?.ticketUrl]);

  const _handleInvite = useCallback((userId: ID) => {
    Events.sendInvitation({ eventId: eventId as ID, toUserId: userId })
      .then(() => {
        Alert.alert('Success', 'Invitation sent!');
        setShowInviteModal(false);
      })
      .catch(() => {
        Alert.alert('Error', 'Failed to send invitation');
      });
  }, [eventId]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (isError || !event) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Failed to load event</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        {/* Image */}
        {event.imageUrl && (
          <Image source={{ uri: event.imageUrl }} style={styles.image} />
        )}

        {/* Title */}
        <Text style={styles.title}>{event.title}</Text>

        {/* DateTime */}
        <View style={styles.section}>
          <Text style={styles.label}>When</Text>
          <Text style={styles.text}>
            {startDate.toLocaleDateString()} at {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Text style={styles.text}>
            to {endDate.toLocaleDateString()} at {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {/* Venue */}
        {event.venue && (
          <View style={styles.section}>
            <Text style={styles.label}>Where</Text>
            <Text style={styles.text}>{event.venue.name}</Text>
            <Text style={styles.text}>{event.venue.address}, {event.venue.city}</Text>
          </View>
        )}

        {/* Artists */}
        {event.artists && event.artists.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.label}>Artists</Text>
            {event.artists.map(artist => (
              <View key={artist.id} style={styles.artistItem}>
                <Text style={styles.artistName}>{artist.name}</Text>
                {artist.genres && <Text style={styles.artistGenres}>{artist.genres.join(', ')}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Description */}
        {event.description && (
          <View style={styles.section}>
            <Text style={styles.label}>About</Text>
            <Text style={styles.text}>{event.description}</Text>
          </View>
        )}

        {/* Tickets */}
        <View style={styles.section}>
          <Text style={styles.label}>Tickets</Text>
          {event.ticketPrice ? (
            <Text style={styles.price}>${event.ticketPrice}</Text>
          ) : (
            <Text style={styles.text}>Free</Text>
          )}
          {event.ticketUrl && (
            <TouchableOpacity style={styles.ticketButton} onPress={handleOpenTickets}>
              <Text style={styles.ticketButtonText}>Buy Tickets</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* RSVP */}
        <View style={styles.section}>
          <Text style={styles.label}>Going? ({event.rsvpCount})</Text>
          <View style={styles.rsvpButtons}>
            <TouchableOpacity
              style={[styles.rsvpButton, rsvpStatus === 'GOING' && styles.rsvpButtonActive]}
              onPress={() => rsvpMutation.mutate('GOING')}
              disabled={rsvpMutation.isPending}
            >
              <Text style={[styles.rsvpButtonText, rsvpStatus === 'GOING' && styles.rsvpButtonTextActive]}>
                ✓ Going
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rsvpButton, rsvpStatus === 'INTERESTED' && styles.rsvpButtonActive]}
              onPress={() => rsvpMutation.mutate('INTERESTED')}
              disabled={rsvpMutation.isPending}
            >
              <Text style={[styles.rsvpButtonText, rsvpStatus === 'INTERESTED' && styles.rsvpButtonTextActive]}>
                ♥ Interested
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rsvpButton, rsvpStatus === 'NOT_GOING' && styles.rsvpButtonActive]}
              onPress={() => rsvpMutation.mutate('NOT_GOING')}
              disabled={rsvpMutation.isPending}
            >
              <Text style={[styles.rsvpButtonText, rsvpStatus === 'NOT_GOING' && styles.rsvpButtonTextActive]}>
                ✕ Not Going
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Actions */}
        <TouchableOpacity style={styles.inviteButton} onPress={() => setShowInviteModal(true)}>
          <Text style={styles.inviteButtonText}>Invite Friends</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Invite Modal */}
      <Modal visible={showInviteModal} transparent animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowInviteModal(false)}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Invite Friends</Text>
            <View style={{ width: 60 }} />
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.modalMessage}>Feature to invite friends coming soon!</Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingBottom: 24 },
  backButton: { paddingHorizontal: 16, paddingVertical: 12 },
  backButtonText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  image: { width: '100%', height: 240, backgroundColor: '#f0f0f0' },
  title: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', paddingHorizontal: 16, paddingTop: 16, marginBottom: 12 },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#666', textTransform: 'uppercase', marginBottom: 6 },
  text: { fontSize: 14, color: '#1a1a1a', lineHeight: 20 },
  price: { fontSize: 18, fontWeight: '700', color: '#2563eb', marginBottom: 8 },
  ticketButton: { backgroundColor: '#2563eb', paddingVertical: 10, borderRadius: 6, alignItems: 'center', marginTop: 8 },
  ticketButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  artistItem: { marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  artistName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  artistGenres: { fontSize: 12, color: '#999', marginTop: 2 },
  rsvpButtons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  rsvpButton: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, alignItems: 'center' },
  rsvpButtonActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  rsvpButtonText: { fontSize: 12, fontWeight: '600', color: '#666' },
  rsvpButtonTextActive: { color: '#fff' },
  inviteButton: { marginHorizontal: 16, backgroundColor: '#f0f0f0', paddingVertical: 12, borderRadius: 6, alignItems: 'center' },
  inviteButtonText: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalClose: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  modalContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  modalMessage: { fontSize: 14, color: '#999', textAlign: 'center' },
  error: { fontSize: 14, color: '#dc2626' }
});
