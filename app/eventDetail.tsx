import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Image, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
  Modal, SafeAreaView, Linking, TextInput
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Events } from '../src/api/events';
import type { ID, RSVPStatus, EventInvitationStatus } from '../types';
import { useUserSettings } from '../src/providers/UserSettingsProvider';

export default function EventDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const eventId = params.eventId as string;
  const { partyId, displayName } = useUserSettings();
  const normalizedPartyId = partyId?.trim() || null;

  const [rsvpStatus, setRsvpStatus] = useState<RSVPStatus>('NONE');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteeId, setInviteeId] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');

  const { data: event, isLoading, isError } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => Events.getById(eventId as ID)
  });

  const rsvpQuery = useQuery({
    queryKey: ['event-rsvps', eventId],
    queryFn: () => Events.getRSVPs(eventId as ID),
    enabled: Boolean(eventId)
  });

  const invitationsQuery = useQuery({
    queryKey: ['event-invitations', eventId],
    queryFn: () => Events.getInvitations(eventId as ID),
    enabled: Boolean(eventId)
  });

  useEffect(() => {
    if (!normalizedPartyId || !rsvpQuery.data) return;
    const mine = rsvpQuery.data.find((r) => String(r.userId) === normalizedPartyId);
    setRsvpStatus(mine?.status ?? 'NONE');
  }, [normalizedPartyId, rsvpQuery.data]);

  const rsvpMutation = useMutation({
    mutationFn: (status: RSVPStatus) => {
      if (!normalizedPartyId) throw new Error('Party ID requerido para RSVP');
      return Events.rsvp({ eventId: eventId as ID, userId: normalizedPartyId, status });
    },
    onSuccess: (_data, status) => {
      setRsvpStatus(status);
      qc.invalidateQueries({ queryKey: ['event', eventId] });
      qc.invalidateQueries({ queryKey: ['event-rsvps', eventId] });
      Alert.alert('Listo', `Marcaste tu asistencia como ${status.toLowerCase()}`);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'No pudimos guardar tu RSVP';
      Alert.alert('Error', msg);
    }
  });

  const invitationMutation = useMutation({
    mutationFn: async () => {
      const target = inviteeId.trim();
      if (!target) throw new Error('Ingresa el ID de la persona a invitar');
      return Events.sendInvitation({
        eventId: eventId as ID,
        toUserId: target,
        fromUserId: normalizedPartyId ?? undefined,
        message: inviteMessage.trim() || undefined
      });
    },
    onSuccess: () => {
      setInviteeId('');
      setInviteMessage('');
      qc.invalidateQueries({ queryKey: ['event-invitations', eventId] });
      setShowInviteModal(false);
      Alert.alert('Listo', 'Invitación enviada');
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'No pudimos enviar la invitación';
      Alert.alert('Error', msg);
    }
  });

  const respondInvitationMutation = useMutation({
    mutationFn: ({ invitationId, status }: { invitationId: ID; status: EventInvitationStatus }) =>
      Events.respondToInvitation(eventId as ID, invitationId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-invitations', eventId] });
    },
    onError: () => {
      Alert.alert('Error', 'No pudimos actualizar la invitación.');
    }
  });

  const handleOpenTickets = useCallback(() => {
    if (event?.ticketUrl) {
      Linking.openURL(event.ticketUrl).catch(() => {
        Alert.alert('Error', 'Could not open ticket URL');
      });
    }
  }, [event?.ticketUrl]);

  const handleRsvpPress = useCallback((status: RSVPStatus) => {
    if (!normalizedPartyId) {
      Alert.alert('Configura tu Party ID', 'Ve a tu perfil y guarda tu Party ID para confirmar asistencia.');
      return;
    }
    rsvpMutation.mutate(status);
  }, [normalizedPartyId, rsvpMutation]);

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
  const rsvpCount = rsvpQuery.data?.length ?? event.rsvpCount ?? 0;
  const invitations = invitationsQuery.data ?? [];

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
            <Text style={styles.price}>${event.ticketPrice.toFixed(2)}</Text>
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
          <Text style={styles.label}>Going? ({rsvpCount})</Text>
          {!normalizedPartyId && (
            <Text style={styles.helperText}>Guarda tu Party ID en tu perfil para confirmar asistencia.</Text>
          )}
          {rsvpQuery.isLoading && (
            <Text style={styles.text}>Cargando RSVP...</Text>
          )}
          <View style={styles.rsvpButtons}>
            <TouchableOpacity
              style={[styles.rsvpButton, rsvpStatus === 'GOING' && styles.rsvpButtonActive]}
              onPress={() => handleRsvpPress('GOING')}
              disabled={rsvpMutation.isPending}
            >
              <Text style={[styles.rsvpButtonText, rsvpStatus === 'GOING' && styles.rsvpButtonTextActive]}>
                ✓ Going
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rsvpButton, rsvpStatus === 'INTERESTED' && styles.rsvpButtonActive]}
              onPress={() => handleRsvpPress('INTERESTED')}
              disabled={rsvpMutation.isPending}
            >
              <Text style={[styles.rsvpButtonText, rsvpStatus === 'INTERESTED' && styles.rsvpButtonTextActive]}>
                ♥ Interested
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rsvpButton, rsvpStatus === 'NOT_GOING' && styles.rsvpButtonActive]}
              onPress={() => handleRsvpPress('NOT_GOING')}
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
            <Text style={styles.modalMessage}>
              Usa el Party ID de tus contactos para enviarles la invitación.{'\n'}
              {normalizedPartyId
                ? `Se enviará como ${displayName ?? 'contacto'} #${normalizedPartyId}.`
                : 'Guarda tu Party ID en tu perfil para aparecer como remitente.'}
            </Text>
            <View style={styles.inputGroup}>
              <TextInput
                placeholder="Party ID del invitado"
                value={inviteeId}
                onChangeText={setInviteeId}
                style={styles.input}
                keyboardType="number-pad"
              />
              <TextInput
                placeholder="Mensaje (opcional)"
                value={inviteMessage}
                onChangeText={setInviteMessage}
                style={[styles.input, styles.inputMultiline]}
                multiline
              />
              <TouchableOpacity
                style={[styles.primaryButton, invitationMutation.isPending && styles.buttonDisabled]}
                onPress={() => invitationMutation.mutate()}
                disabled={invitationMutation.isPending}
              >
                <Text style={styles.primaryButtonText}>
                  {invitationMutation.isPending ? 'Enviando…' : 'Enviar invitación'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.invitationList}>
              <Text style={[styles.label, { marginTop: 12 }]}>Invitaciones</Text>
              {invitationsQuery.isLoading ? (
                <ActivityIndicator color="#2563eb" />
              ) : invitations.length === 0 ? (
                <Text style={styles.text}>Aún no has enviado invitaciones.</Text>
              ) : (
                invitations.map((inv) => (
                  <View key={String(inv.id)} style={styles.invitationItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.invitationTitle}>Para #{inv.toUserId}</Text>
                      <Text style={styles.invitationMeta}>
                        Estado: <Text style={styles.invitationStatus}>{inv.status}</Text>
                      </Text>
                      {inv.message && <Text style={styles.invitationMeta}>Mensaje: {inv.message}</Text>}
                    </View>
                    {normalizedPartyId && String(inv.toUserId) === normalizedPartyId && (
                      <View style={styles.invitationActions}>
                        <TouchableOpacity
                          style={[styles.secondaryButton, respondInvitationMutation.isPending && styles.buttonDisabled]}
                          onPress={() => respondInvitationMutation.mutate({ invitationId: inv.id, status: 'ACCEPTED' })}
                          disabled={respondInvitationMutation.isPending}
                        >
                          <Text style={styles.secondaryButtonText}>Aceptar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.secondaryButton, respondInvitationMutation.isPending && styles.buttonDisabled]}
                          onPress={() => respondInvitationMutation.mutate({ invitationId: inv.id, status: 'DECLINED' })}
                          disabled={respondInvitationMutation.isPending}
                        >
                          <Text style={styles.secondaryButtonText}>Rechazar</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
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
  helperText: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
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
  modalContent: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  modalMessage: { fontSize: 14, color: '#555', textAlign: 'left', lineHeight: 20 },
  inputGroup: { gap: 10 },
  input: { borderWidth: 1, borderColor: '#d4d4d4', borderRadius: 10, padding: 10 },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  primaryButton: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },
  invitationList: { gap: 8 },
  invitationItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10 },
  invitationTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  invitationMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  invitationStatus: { fontWeight: '700', color: '#2563eb' },
  invitationActions: { flexDirection: 'row', gap: 6 },
  secondaryButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#eef2ff' },
  secondaryButtonText: { color: '#1e3a8a', fontWeight: '700', fontSize: 12 },
  error: { fontSize: 14, color: '#dc2626' }
});
