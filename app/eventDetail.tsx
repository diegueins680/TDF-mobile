import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
  TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Events } from '../src/api/events';
import { Social } from '../src/api/social';
import { uploadMedia } from '../src/api/upload';
import { EventMomentCard } from '../src/components/EventMomentCard';
import {
  buildMomentActor,
  countMomentReactions,
  listFeaturedMoments,
} from '../src/lib/eventMoments';
import {
  addMomentFeedComment,
  createMomentFeedItem,
  listMomentFeed,
  toggleMomentFeedReaction,
} from '../src/lib/eventMomentsRepository';
import { resolvePartyId } from '../src/lib/identity';
import { normalizeRouteParam } from '../src/lib/routeParams';
import { countGoingRsvps } from '../src/lib/rsvp';
import { useAuth } from '../src/providers/AuthProvider';
import { useUserSettings } from '../src/providers/UserSettingsProvider';
import { listSavedEventIds, toggleSavedEvent } from '../src/lib/savedEvents';
import type {
  EventInvitationStatus,
  EventMoment,
  EventMomentReactionKind,
  ID,
  RSVPStatus,
} from '../src/types';

type EventDetailTab = 'details' | 'moments';
type DraftMomentMedia = EventMoment['media'] & { fileName?: string | null };

const parsePositivePartyId = (value: string | null | undefined): number | null => {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export default function EventDetailScreen() {
  const { eventId: rawEventId } = useLocalSearchParams<{ eventId?: string | string[] }>();
  const router = useRouter();
  const qc = useQueryClient();
  const eventId = normalizeRouteParam(rawEventId);
  const { token, partyId: authPartyId } = useAuth();
  const { partyId: settingsPartyId, displayName } = useUserSettings();
  const normalizedPartyId = resolvePartyId(authPartyId, settingsPartyId);
  const currentActor = useMemo(
    () => buildMomentActor({ partyId: normalizedPartyId, displayName }),
    [displayName, normalizedPartyId],
  );
  const shouldPreferRemoteMoments = Boolean(token?.trim());

  const [activeTab, setActiveTab] = useState<EventDetailTab>('details');
  const [rsvpStatus, setRsvpStatus] = useState<RSVPStatus>('NONE');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteeId, setInviteeId] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [showMomentComposer, setShowMomentComposer] = useState(false);
  const [momentCaption, setMomentCaption] = useState('');
  const [momentMedia, setMomentMedia] = useState<DraftMomentMedia | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const { data: event, isLoading, isError } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => Events.getById(eventId as ID),
    enabled: Boolean(eventId),
  });

  const rsvpQuery = useQuery({
    queryKey: ['event-rsvps', eventId],
    queryFn: () => Events.getRSVPs(eventId as ID),
    enabled: Boolean(eventId),
  });

  const invitationsQuery = useQuery({
    queryKey: ['event-invitations', eventId],
    queryFn: () => Events.getInvitations(eventId as ID),
    enabled: Boolean(eventId),
  });

  const savedEventIdsQuery = useQuery({
    queryKey: ['saved-event-ids'],
    queryFn: listSavedEventIds,
  });

  const momentsQuery = useQuery({
    queryKey: ['event-moments', eventId, shouldPreferRemoteMoments ? 'remote' : 'local'],
    queryFn: () => listMomentFeed(eventId as ID, { preferRemote: shouldPreferRemoteMoments }),
    enabled: Boolean(eventId),
  });

  useEffect(() => {
    if (!normalizedPartyId || !rsvpQuery.data) return;
    const mine = rsvpQuery.data.find((r) => String(r.userId) === normalizedPartyId);
    setRsvpStatus(mine?.status ?? 'NONE');
  }, [normalizedPartyId, rsvpQuery.data]);

  const featuredMoments = useMemo(
    () => listFeaturedMoments(momentsQuery.data ?? [], 3),
    [momentsQuery.data],
  );
  const featuredMomentIds = useMemo(
    () => new Set(featuredMoments.map((moment) => moment.id)),
    [featuredMoments],
  );

  const rsvpMutation = useMutation({
    mutationFn: (status: RSVPStatus) => {
      if (!eventId) throw new Error('Event not found');
      if (!normalizedPartyId) throw new Error('Party ID requerido para RSVP');
      return Events.rsvp({ eventId, userId: normalizedPartyId, status });
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
    },
  });

  const invitationMutation = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error('Event not found');
      const target = inviteeId.trim();
      if (!target) throw new Error('Ingresa el ID de la persona a invitar');
      return Events.sendInvitation({
        eventId,
        toUserId: target,
        fromUserId: normalizedPartyId ?? undefined,
        message: inviteMessage.trim() || undefined,
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
    },
  });

  const respondInvitationMutation = useMutation({
    mutationFn: ({ invitationId, status }: { invitationId: ID; status: EventInvitationStatus }) =>
      eventId
        ? Events.respondToInvitation(eventId, invitationId, status)
        : Promise.reject(new Error('Event not found')),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-invitations', eventId] });
    },
    onError: () => {
      Alert.alert('Error', 'No pudimos actualizar la invitación.');
    },
  });

  const saveEventMutation = useMutation({
    mutationFn: () => {
      if (!eventId) throw new Error('Event not found');
      return toggleSavedEvent(eventId);
    },
    onSuccess: ({ saved }) => {
      qc.invalidateQueries({ queryKey: ['saved-event-ids'] });
      Alert.alert('Listo', saved ? 'Evento guardado en tu perfil.' : 'Evento removido de guardados.');
    },
    onError: () => {
      Alert.alert('Error', 'No pudimos actualizar tus eventos guardados.');
    },
  });

  const createMomentMutation = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error('Event not found');
      if (!momentMedia) throw new Error('Selecciona una imagen o video antes de publicar.');

      let mediaUri = momentMedia.uri;
      let uploadNotice: string | null = null;

      if (token?.trim()) {
        try {
          mediaUri = await uploadMedia({
            uri: momentMedia.uri,
            mimeType: momentMedia.mimeType,
            fileName: momentMedia.fileName ?? undefined,
            uploadLabel: momentMedia.kind === 'video' ? 'video' : 'imagen',
          });
        } catch (error) {
          uploadNotice =
            error instanceof Error
              ? `${error.message} Guardamos el momento solo en este dispositivo.`
              : 'Guardamos el momento solo en este dispositivo.';
        }
      }

      const result = await createMomentFeedItem({
        eventId,
        authorName: currentActor.displayName,
        authorPartyId: currentActor.partyId,
        caption: momentCaption,
        media: { ...momentMedia, uri: mediaUri },
      }, { preferRemote: shouldPreferRemoteMoments });

      return { uploadNotice, source: result.source, fallbackReason: result.fallbackReason };
    },
    onSuccess: ({ uploadNotice, source, fallbackReason }) => {
      setMomentCaption('');
      setMomentMedia(null);
      setShowMomentComposer(false);
      qc.invalidateQueries({ queryKey: ['event-moments', eventId] });
      const notices = [
        uploadNotice,
        source === 'local' && shouldPreferRemoteMoments
          ? fallbackReason ?? 'No pudimos sincronizarlo con el backend. Lo guardamos solo en este dispositivo.'
          : null,
      ].filter((value): value is string => Boolean(value));
      Alert.alert(
        'Publicado',
        notices.join('\n\n') || 'Tu momento ya aparece en el feed del evento.',
      );
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No pudimos publicar tu momento.';
      Alert.alert('Error', message);
    },
  });

  const reactionMutation = useMutation({
    mutationFn: ({ momentId, reaction }: { momentId: string; reaction: EventMomentReactionKind }) => {
      if (!eventId) throw new Error('Event not found');
      return toggleMomentFeedReaction({
        eventId,
        momentId,
        actorKey: currentActor.actorKey,
        reaction,
      }, { preferRemote: shouldPreferRemoteMoments });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-moments', eventId] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No pudimos registrar tu reacción.';
      Alert.alert('Error', message);
    },
  });

  const commentMutation = useMutation({
    mutationFn: ({ momentId, body }: { momentId: string; body: string }) => {
      if (!eventId) throw new Error('Event not found');
      return addMomentFeedComment({
        eventId,
        momentId,
        authorName: currentActor.displayName,
        authorPartyId: currentActor.partyId,
        body,
      }, { preferRemote: shouldPreferRemoteMoments });
    },
    onSuccess: (_data, variables) => {
      setCommentDrafts((current) => ({ ...current, [variables.momentId]: '' }));
      qc.invalidateQueries({ queryKey: ['event-moments', eventId] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No pudimos enviar tu comentario.';
      Alert.alert('Error', message);
    },
  });

  const connectMomentAuthorMutation = useMutation({
    mutationFn: async (partyId: string) => {
      const numericPartyId = parsePositivePartyId(partyId);
      if (numericPartyId === null) throw new Error('No hay un Party ID válido para conectar.');
      return Social.addFriend(numericPartyId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social-friends'] });
      qc.invalidateQueries({ queryKey: ['social-suggestions'] });
      Alert.alert('Listo', 'Agregaste este contacto a tu red.');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No pudimos crear la conexión.';
      Alert.alert('Error', message);
    },
  });

  const handleOpenTickets = useCallback(() => {
    if (event?.ticketUrl) {
      Linking.openURL(event.ticketUrl).catch(() => {
        Alert.alert('Error', 'Could not open ticket URL');
      });
    }
  }, [event?.ticketUrl]);

  const handleOpenMomentMedia = useCallback((uri: string) => {
    Linking.openURL(uri).catch(() => {
      Alert.alert('Error', 'No pudimos abrir este archivo.');
    });
  }, []);

  const handleRsvpPress = useCallback((status: RSVPStatus) => {
    if (!normalizedPartyId) {
      Alert.alert('Configura tu Party ID', 'Ve a tu perfil y guarda tu Party ID para confirmar asistencia.');
      return;
    }
    rsvpMutation.mutate(status);
  }, [normalizedPartyId, rsvpMutation]);

  const handleToggleSaved = useCallback(() => {
    saveEventMutation.mutate();
  }, [saveEventMutation]);

  const selectMomentMedia = useCallback(async (mode: 'camera' | 'library'): Promise<DraftMomentMedia | null> => {
    if (mode === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Activa el acceso a la cámara para tomar fotos del evento.');
        return null;
      }
    }

    const result =
      mode === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsEditing: false,
            quality: 0.8,
            videoMaxDuration: 20,
          });

    if (result.canceled) return null;
    const asset = result.assets[0];
    const kind = asset.type === 'video' ? 'video' : 'image';
    return {
      kind,
      uri: asset.uri,
      mimeType: asset.mimeType ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
      width: asset.width ?? null,
      height: asset.height ?? null,
      durationMs: asset.duration ?? null,
      fileName: asset.fileName,
    };
  }, []);

  const pickMomentMedia = useCallback(async (mode: 'camera' | 'library') => {
    const media = await selectMomentMedia(mode);
    if (!media) return;
    setMomentMedia(media);
  }, [selectMomentMedia]);

  const handleCommentChange = useCallback((momentId: string, value: string) => {
    setCommentDrafts((current) => ({ ...current, [momentId]: value }));
  }, []);

  const handleCommentSubmit = useCallback((momentId: string) => {
    const draft = commentDrafts[momentId] ?? '';
    commentMutation.mutate({ momentId, body: draft });
  }, [commentDrafts, commentMutation]);

  const handleConnectAuthor = useCallback((partyId: string) => {
    connectMomentAuthorMutation.mutate(partyId);
  }, [connectMomentAuthorMutation]);

  if (!eventId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.error}>Missing event ID</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
  const rsvpCount = rsvpQuery.data ? countGoingRsvps(rsvpQuery.data) : (event.rsvpCount ?? 0);
  const invitations = invitationsQuery.data ?? [];
  const isSaved = savedEventIdsQuery.data?.includes(String(event.id)) ?? false;
  const momentCount = momentsQuery.data?.length ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        {event.imageUrl ? (
          <Image source={{ uri: event.imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.imageFallback}>
            <MaterialCommunityIcons name="calendar-star" size={42} color="#2563eb" />
            <Text style={styles.imageFallbackText}>Event spotlight</Text>
          </View>
        )}

        <Text style={styles.title}>{event.title}</Text>
        <View style={styles.tabSwitch}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'details' && styles.tabButtonActive]}
            onPress={() => setActiveTab('details')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'details' && styles.tabButtonTextActive]}>
              Detalles
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'moments' && styles.tabButtonActive]}
            onPress={() => setActiveTab('moments')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'moments' && styles.tabButtonTextActive]}>
              Momentos ({momentCount})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'details' ? (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>When</Text>
              <Text style={styles.text}>
                {startDate.toLocaleDateString()} at{' '}
                {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text style={styles.text}>
                to {endDate.toLocaleDateString()} at{' '}
                {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>

            {event.venue ? (
              <View style={styles.section}>
                <Text style={styles.label}>Where</Text>
                <Text style={styles.text}>{event.venue.name}</Text>
                <Text style={styles.text}>{event.venue.address}, {event.venue.city}</Text>
              </View>
            ) : null}

            {event.artists && event.artists.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.label}>Artists</Text>
                {event.artists.map((artist) => (
                  <View key={artist.id} style={styles.artistItem}>
                    <Text style={styles.artistName}>{artist.name}</Text>
                    {artist.genres ? <Text style={styles.artistGenres}>{artist.genres.join(', ')}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}

            {event.description ? (
              <View style={styles.section}>
                <Text style={styles.label}>About</Text>
                <Text style={styles.text}>{event.description}</Text>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.label}>Tickets</Text>
              {event.ticketPrice ? (
                <Text style={styles.price}>${event.ticketPrice.toFixed(2)}</Text>
              ) : (
                <Text style={styles.text}>Free</Text>
              )}
              {event.ticketUrl ? (
                <TouchableOpacity style={styles.ticketButton} onPress={handleOpenTickets}>
                  <Text style={styles.ticketButtonText}>Buy Tickets</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Going? ({rsvpCount})</Text>
              {!normalizedPartyId ? (
                <Text style={styles.helperText}>Guarda tu Party ID en tu perfil para confirmar asistencia.</Text>
              ) : null}
              {rsvpQuery.isLoading ? <Text style={styles.text}>Cargando RSVP...</Text> : null}
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

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.saveEventButton,
                  isSaved && styles.saveEventButtonActive,
                  saveEventMutation.isPending && styles.buttonDisabled,
                ]}
                onPress={handleToggleSaved}
                disabled={saveEventMutation.isPending}
              >
                <Text style={[styles.saveEventButtonText, isSaved && styles.saveEventButtonTextActive]}>
                  {saveEventMutation.isPending ? 'Guardando…' : isSaved ? 'Saved' : 'Save Event'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.inviteButton} onPress={() => setShowInviteModal(true)}>
                <Text style={styles.inviteButtonText}>Invite Friends</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.section}>
              <View style={styles.momentHero}>
                <View style={styles.momentHeroCopy}>
                  <Text style={styles.momentHeroTitle}>Momentos del evento</Text>
                  <Text style={styles.momentHeroText}>
                    Comparte fotos o videos cortos, reacciona y conecta con quienes estuvieron aquí.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.primaryPillButton, createMomentMutation.isPending && styles.buttonDisabled]}
                  onPress={() => setShowMomentComposer(true)}
                  disabled={createMomentMutation.isPending}
                >
                  <Text style={styles.primaryPillButtonText}>
                    {createMomentMutation.isPending ? 'Publicando…' : 'Compartir'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.momentHintRow}>
                <Text style={styles.helperText}>
                  Publicas como {currentActor.displayName}
                  {token?.trim() ? '' : ' · sin token el momento queda guardado localmente'}
                </Text>
              </View>
            </View>

            {featuredMoments.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.label}>Top Momentos</Text>
                <View style={styles.highlightList}>
                  {featuredMoments.map((moment) => (
                    <View key={`highlight-${moment.id}`} style={styles.highlightCard}>
                      <Text style={styles.highlightAuthor}>{moment.authorName}</Text>
                      <Text style={styles.highlightCaption} numberOfLines={2}>
                        {moment.caption ?? (moment.media.kind === 'video' ? 'Video destacado del evento' : 'Foto destacada del evento')}
                      </Text>
                      <Text style={styles.highlightMeta}>
                        {countMomentReactions(moment)} reacciones · {moment.comments.length} comentarios
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.label}>Feed</Text>
              {momentsQuery.isLoading ? (
                <ActivityIndicator color="#2563eb" />
              ) : momentCount === 0 ? (
                <View style={styles.emptyMomentsCard}>
                  <MaterialCommunityIcons name="image-multiple-outline" size={32} color="#94a3b8" />
                  <Text style={styles.emptyMomentsTitle}>Todavía no hay momentos</Text>
                  <Text style={styles.emptyMomentsText}>
                    Sube la primera foto o video corto para activar el lado social de este evento.
                  </Text>
                </View>
              ) : (
                <View style={styles.momentList}>
                  {(momentsQuery.data ?? []).map((moment) => (
                    <EventMomentCard
                      key={moment.id}
                      moment={moment}
                      currentActorKey={currentActor.actorKey}
                      currentPartyId={currentActor.partyId}
                      featured={featuredMomentIds.has(moment.id)}
                      reactionDisabled={reactionMutation.isPending}
                      commentDisabled={commentMutation.isPending}
                      connectDisabled={connectMomentAuthorMutation.isPending}
                      commentDraft={commentDrafts[moment.id] ?? ''}
                      onChangeComment={handleCommentChange}
                      onSubmitComment={handleCommentSubmit}
                      onToggleReaction={(momentId, reaction) => reactionMutation.mutate({ momentId, reaction })}
                      onConnectAuthor={handleConnectAuthor}
                      onOpenMedia={handleOpenMomentMedia}
                    />
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={showMomentComposer} transparent animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowMomentComposer(false)}>
              <Text style={styles.modalClose}>Cerrar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Compartir momento</Text>
            <View style={{ width: 60 }} />
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.modalMessage}>
              Elige una foto o video corto y publícalo desde este evento. Si el upload falla, guardaremos el momento en
              este dispositivo para no perderlo.
            </Text>

            <View style={styles.momentMediaActions}>
              <TouchableOpacity style={styles.secondaryActionButton} onPress={() => void pickMomentMedia('camera')}>
                <Text style={styles.secondaryActionButtonText}>Tomar foto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryActionButton} onPress={() => void pickMomentMedia('library')}>
                <Text style={styles.secondaryActionButtonText}>Elegir foto o video</Text>
              </TouchableOpacity>
            </View>

            {momentMedia ? (
              <View style={styles.selectedMomentCard}>
                {momentMedia.kind === 'image' ? (
                  <Image source={{ uri: momentMedia.uri }} style={styles.selectedMomentImage} />
                ) : (
                  <View style={styles.selectedVideoBox}>
                    <MaterialCommunityIcons name="play-circle-outline" size={34} color="#f8fafc" />
                    <Text style={styles.selectedVideoText}>Video listo para publicar</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.clearMediaButton} onPress={() => setMomentMedia(null)}>
                  <Text style={styles.clearMediaButtonText}>Quitar archivo</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <TextInput
                placeholder="Agrega contexto, lineup o una vibra rápida"
                value={momentCaption}
                onChangeText={setMomentCaption}
                style={[styles.input, styles.inputMultiline]}
                multiline
                maxLength={280}
              />
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (!momentMedia || createMomentMutation.isPending) && styles.buttonDisabled,
                ]}
                onPress={() => createMomentMutation.mutate()}
                disabled={!momentMedia || createMomentMutation.isPending}
              >
                <Text style={styles.primaryButtonText}>
                  {createMomentMutation.isPending ? 'Publicando…' : 'Publicar momento'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

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
                      {inv.message ? <Text style={styles.invitationMeta}>Mensaje: {inv.message}</Text> : null}
                    </View>
                    {normalizedPartyId && String(inv.toUserId) === normalizedPartyId ? (
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
                    ) : null}
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
  imageFallback: {
    width: '100%',
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
  },
  imageFallbackText: { color: '#1d4ed8', fontWeight: '700' },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 12,
  },
  tabSwitch: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  tabButtonActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  tabButtonText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: '#1d4ed8',
  },
  section: { paddingHorizontal: 16, marginBottom: 16, gap: 10 },
  label: { fontSize: 12, fontWeight: '700', color: '#666', textTransform: 'uppercase', marginBottom: 6 },
  text: { fontSize: 14, color: '#1a1a1a', lineHeight: 20 },
  helperText: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  price: { fontSize: 18, fontWeight: '700', color: '#2563eb', marginBottom: 8 },
  ticketButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  ticketButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  artistItem: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  artistName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  artistGenres: { fontSize: 12, color: '#999', marginTop: 2 },
  rsvpButtons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  rsvpButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    alignItems: 'center',
  },
  rsvpButtonActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  rsvpButtonText: { fontSize: 12, fontWeight: '600', color: '#666' },
  rsvpButtonTextActive: { color: '#fff' },
  actionRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 8 },
  saveEventButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  saveEventButtonActive: { backgroundColor: '#e0e7ff', borderColor: '#2563eb' },
  saveEventButtonText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  saveEventButtonTextActive: { color: '#1d4ed8' },
  inviteButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  inviteButtonText: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  momentHero: {
    borderRadius: 18,
    backgroundColor: '#0f172a',
    padding: 16,
    gap: 12,
  },
  momentHeroCopy: {
    gap: 6,
  },
  momentHeroTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
  },
  momentHeroText: {
    color: '#cbd5e1',
    lineHeight: 20,
  },
  momentHintRow: {
    marginTop: 2,
  },
  primaryPillButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryPillButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  highlightList: {
    gap: 10,
  },
  highlightCard: {
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 12,
    gap: 6,
  },
  highlightAuthor: {
    color: '#0f172a',
    fontWeight: '800',
  },
  highlightCaption: {
    color: '#334155',
    lineHeight: 18,
  },
  highlightMeta: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyMomentsCard: {
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 18,
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  emptyMomentsTitle: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 16,
  },
  emptyMomentsText: {
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  momentList: {
    gap: 12,
  },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
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
  momentMediaActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  secondaryActionButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secondaryActionButtonText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 12,
  },
  selectedMomentCard: {
    gap: 10,
  },
  selectedMomentImage: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
  },
  selectedVideoBox: {
    height: 180,
    borderRadius: 14,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  selectedVideoText: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  clearMediaButton: {
    alignSelf: 'flex-start',
  },
  clearMediaButtonText: {
    color: '#2563eb',
    fontWeight: '700',
  },
  invitationList: { gap: 8 },
  invitationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
  },
  invitationTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  invitationMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  invitationStatus: { fontWeight: '700', color: '#2563eb' },
  invitationActions: { flexDirection: 'row', gap: 6 },
  secondaryButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#eef2ff' },
  secondaryButtonText: { color: '#1e3a8a', fontWeight: '700', fontSize: 12 },
  error: { fontSize: 14, color: '#dc2626' },
});
