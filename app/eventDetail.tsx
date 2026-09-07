import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  AppState,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Events } from '../src/api/events';
import { Artists } from '../src/api/artists';
import { Social } from '../src/api/social';
import { uploadMedia } from '../src/api/upload';
import { EventLiveBroadcastCard } from '../src/components/EventLiveBroadcastCard';
import { EventMomentCard } from '../src/components/EventMomentCard';
import { TicketPurchaseCard } from '../src/components/tickets/TicketPurchaseCard';
import { ExperienceReviews } from '../src/components/reviews/ExperienceReviews';
import { PartySelector, type PartySelectorOption } from '../src/components/PartySelector';
import { formatTicketMoney, isEventTicketPurchaseEligible } from '../src/lib/tickets';
import {
  buildMomentActor,
  countMomentReactions,
  listFeaturedMoments,
} from '../src/lib/eventMoments';
import { countLiveBroadcasts } from '../src/lib/liveBroadcasts';
import {
  MAX_MOMENT_MEDIA_SELECTION,
  prepareMomentMediaForUpload,
  type DraftMomentMedia,
} from '../src/lib/momentMedia';
import {
  endLiveBroadcastSession,
  heartbeatLiveBroadcastSession,
  listLiveBroadcastFeed,
  startLiveBroadcastSession,
} from '../src/lib/liveBroadcastsRepository';
import {
  RTCView,
  startWhipBroadcastPublisher,
  type LiveBroadcastPublisherSession,
} from '../src/lib/liveBroadcastPublishing';
import {
  addMomentFeedComment,
  createMomentFeedItem,
  listMomentFeed,
  toggleMomentFeedReaction,
} from '../src/lib/eventMomentsRepository';
import { normalizeRouteParam } from '../src/lib/routeParams';
import { countGoingRsvps } from '../src/lib/rsvp';
import { useAuth } from '../src/providers/AuthProvider';
import { useUserSettings } from '../src/providers/UserSettingsProvider';
import { listSavedEventIds, toggleSavedEvent } from '../src/lib/savedEvents';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import type {
  EventLiveBroadcast,
  EventLiveBroadcastQuality,
  EventInvitationStatus,
  EventMoment,
  EventMomentMedia,
  EventMomentReactionOption,
  ID,
  RSVPStatus,
} from '../src/types';

type EventDetailTab = 'details' | 'moments' | 'live';
type MomentSubmission = {
  caption: string;
  media: DraftMomentMedia[];
  optimisticIds: string[];
};
type MomentPublishSuccess = {
  index: number;
  status: 'fulfilled';
  moment: EventMoment;
  source: 'remote' | 'local';
  notices: string[];
};
type MomentPublishFailure = {
  index: number;
  status: 'rejected';
  message: string;
};
type MomentPublishOutcome = MomentPublishSuccess | MomentPublishFailure;
type MomentPublishFeedback = {
  tone: 'success' | 'warning';
  text: string;
};
type ActiveLiveBroadcastRecord = {
  eventId: string;
  broadcastId: string;
  broadcasterPartyId?: string | null;
  preferRemote: boolean;
};
type CloseLiveBroadcastOptions = {
  updateState?: boolean;
};
const LIVE_QUALITY_OPTIONS: EventLiveBroadcastQuality[] = ['auto', '720p', '480p'];
const MOMENT_UPLOAD_CONCURRENCY = 2;

const createOptimisticMomentId = (): string =>
  `pending-moment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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
  const { token, partyId: normalizedPartyId, session } = useAuth();
  const { locale, timezone, currency, getCatalogItems } = useUserSettings();
  const displayName = session?.displayName ?? null;
  const reactionOptions = useMemo<EventMomentReactionOption[]>(
    () => getCatalogItems('reaction-types').flatMap((item) => {
      const emoji = item.displaySymbol?.trim();
      return emoji ? [{
        id: item.id,
        code: item.code,
        label: item.name,
        nameEs: item.nameEs,
        nameEn: item.nameEn,
        emoji,
      }] : [];
    }),
    [getCatalogItems],
  );
  const displayCurrency = currency || process.env.EXPO_PUBLIC_DEFAULT_CURRENCY || 'USD';
  const currentActor = useMemo(
    () => buildMomentActor({ partyId: normalizedPartyId, displayName }),
    [displayName, normalizedPartyId],
  );
  const shouldPreferRemoteMoments = Boolean(token?.trim());
  const shouldPreferRemoteBroadcasts = Boolean(token?.trim());
  const publisherSessionRef = useRef<LiveBroadcastPublisherSession | null>(null);
  const activeLiveBroadcastRef = useRef<ActiveLiveBroadcastRecord | null>(null);

  const [activeTab, setActiveTab] = useState<EventDetailTab>('details');
  const [rsvpStatus, setRsvpStatus] = useState<RSVPStatus>('NONE');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [invitee, setInvitee] = useState<PartySelectorOption | null>(null);
  const [inviteMessage, setInviteMessage] = useState('');
  const [showMomentComposer, setShowMomentComposer] = useState(false);
  const [momentCaption, setMomentCaption] = useState('');
  const [momentMedia, setMomentMedia] = useState<DraftMomentMedia[]>([]);
  const [pendingMoments, setPendingMoments] = useState<EventMoment[]>([]);
  const [previewMedia, setPreviewMedia] = useState<EventMomentMedia | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [momentPublishFeedback, setMomentPublishFeedback] = useState<MomentPublishFeedback | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [selectedLiveArtistId, setSelectedLiveArtistId] = useState<string | null>(null);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastDescription, setBroadcastDescription] = useState('');
  const [broadcastQuality, setBroadcastQuality] = useState<EventLiveBroadcastQuality>('auto');
  const [activeBroadcastId, setActiveBroadcastId] = useState<string | null>(null);
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null);

  const { data: event, isLoading, isError, refetch: refetchEvent } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => Events.getById(eventId as ID),
    enabled: Boolean(eventId),
  });

  const rsvpQuery = useQuery({
    queryKey: ['event-rsvps', eventId],
    queryFn: () => Events.getRSVPs(eventId as ID),
    enabled: Boolean(eventId && activeTab === 'details'),
  });

  const invitationsQuery = useQuery({
    queryKey: ['event-invitations', eventId],
    queryFn: () => Events.getInvitations(eventId as ID),
    enabled: Boolean(eventId && showInviteModal),
  });

  const savedEventIdsQuery = useQuery({
    queryKey: ['saved-event-ids'],
    queryFn: listSavedEventIds,
  });

  const ticketTiersQuery = useQuery({
    queryKey: ['event-ticket-tiers', eventId],
    queryFn: () => Events.listTicketTiers(eventId as ID),
    enabled: Boolean(eventId),
  });

  const momentsQueryKey = useMemo(
    () => ['event-moments', eventId, shouldPreferRemoteMoments ? 'remote' : 'local'] as const,
    [eventId, shouldPreferRemoteMoments],
  );

  const momentsQuery = useQuery({
    queryKey: momentsQueryKey,
    queryFn: () => listMomentFeed(eventId as ID, { preferRemote: shouldPreferRemoteMoments }),
    enabled: Boolean(eventId && activeTab === 'moments'),
  });

  const liveBroadcastsQuery = useQuery({
    queryKey: ['event-live-broadcasts', eventId, shouldPreferRemoteBroadcasts ? 'remote' : 'local'],
    queryFn: () => listLiveBroadcastFeed(eventId as ID, { preferRemote: shouldPreferRemoteBroadcasts }),
    enabled: Boolean(eventId && activeTab === 'live'),
  });

  const followedLiveArtistIdsQuery = useQuery({
    queryKey: [
      'event-live-followed-artists',
      eventId,
      currentActor.partyId,
      event?.artists?.map((artist) => String(artist.id)).join(',') ?? '',
    ],
    queryFn: async () => {
      const partyId = currentActor.partyId;
      const artists = event?.artists ?? [];
      if (!partyId || artists.length === 0) return [];

      const settled = await Promise.allSettled(
        artists.map(async (artist) => {
          const followers = await Artists.listFollowers(artist.id);
          const isFollower = followers.some(
            (follower) => follower.followerPartyId.trim() === partyId,
          );
          return isFollower ? String(artist.id) : null;
        }),
      );

      return settled
        .map((result) => (result.status === 'fulfilled' ? result.value : null))
        .filter((artistId): artistId is string => Boolean(artistId));
    },
    enabled: Boolean(activeTab === 'live' && eventId && currentActor.partyId && event?.artists?.length),
  });

  const featuredMoments = useMemo(
    () => listFeaturedMoments(momentsQuery.data ?? [], 3),
    [momentsQuery.data],
  );
  const displayedMoments = useMemo(() => {
    const pendingIds = new Set(pendingMoments.map((moment) => moment.id));
    return [
      ...pendingMoments,
      ...(momentsQuery.data ?? []).filter((moment) => !pendingIds.has(moment.id)),
    ];
  }, [momentsQuery.data, pendingMoments]);
  const pendingMomentIds = useMemo(
    () => new Set(pendingMoments.map((moment) => moment.id)),
    [pendingMoments],
  );
  const featuredMomentIds = useMemo(
    () => new Set(featuredMoments.map((moment) => moment.id)),
    [featuredMoments],
  );
  const eventArtists = useMemo(() => event?.artists ?? [], [event?.artists]);
  const followedLiveArtistIds = useMemo(
    () => new Set(followedLiveArtistIdsQuery.data ?? []),
    [followedLiveArtistIdsQuery.data],
  );
  const followedLiveArtists = useMemo(
    () => eventArtists.filter((artist) => followedLiveArtistIds.has(String(artist.id))),
    [eventArtists, followedLiveArtistIds],
  );
  const selectedLiveArtist = useMemo(
    () =>
      followedLiveArtists.find((artist) => String(artist.id) === selectedLiveArtistId) ??
      followedLiveArtists[0] ??
      null,
    [followedLiveArtists, selectedLiveArtistId],
  );
  const externalTicketSources = useMemo(
    () =>
      (event?.sources ?? []).filter(
        (source) =>
          Boolean(source.url)
          && !['cancelled', 'canceled', 'completed', 'missing', 'removed'].includes(
            source.status.trim().toLowerCase(),
          ),
      ),
    [event?.sources],
  );

  useEffect(() => {
    if (!normalizedPartyId || !rsvpQuery.data) return;
    const mine = rsvpQuery.data.find((r) => String(r.userId) === normalizedPartyId);
    setRsvpStatus(mine?.status ?? 'NONE');
  }, [normalizedPartyId, rsvpQuery.data]);

  useEffect(() => {
    const thumbnailUrls = (momentsQuery.data ?? [])
      .filter((moment) => moment.media.kind === 'image' && /^https?:\/\//i.test(moment.media.uri))
      .slice(0, 6)
      .map((moment) => moment.media.uri);
    if (thumbnailUrls.length === 0) return;
    void ExpoImage.prefetch(thumbnailUrls, { cachePolicy: 'memory-disk' }).catch(() => undefined);
  }, [momentsQuery.data]);

  useEffect(() => {
    if (!momentPublishFeedback) return undefined;
    const timer = setTimeout(() => setMomentPublishFeedback(null), 7000);
    return () => clearTimeout(timer);
  }, [momentPublishFeedback]);

  useEffect(() => {
    if (followedLiveArtists.length === 0) {
      setSelectedLiveArtistId(null);
      return;
    }
    if (selectedLiveArtistId && followedLiveArtists.some((artist) => String(artist.id) === selectedLiveArtistId)) {
      return;
    }
    setSelectedLiveArtistId(String(followedLiveArtists[0].id));
  }, [followedLiveArtists, selectedLiveArtistId]);

  useEffect(() => {
    if (!eventId || !activeBroadcastId) return undefined;
    const interval = setInterval(() => {
      void heartbeatLiveBroadcastSession(
        { eventId, broadcastId: activeBroadcastId, viewerDelta: 0 },
        { preferRemote: shouldPreferRemoteBroadcasts },
      ).then(() => {
        qc.invalidateQueries({ queryKey: ['event-live-broadcasts', eventId] });
      }).catch(() => undefined);
    }, 15000);

    return () => clearInterval(interval);
  }, [activeBroadcastId, eventId, qc, shouldPreferRemoteBroadcasts]);

  const rsvpMutation = useMutation({
    mutationFn: (status: RSVPStatus) => {
      if (!eventId) throw new Error('Event not found');
      if (!normalizedPartyId) throw new Error('Inicia sesión con una cuenta vinculada para confirmar asistencia.');
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
      const target = invitee?.partyId;
      if (!target) throw new Error('Selecciona la persona a invitar');
      return Events.sendInvitation({
        eventId,
        toUserId: String(target),
        fromUserId: normalizedPartyId ?? undefined,
        message: inviteMessage.trim() || undefined,
      });
    },
    onSuccess: () => {
      setInvitee(null);
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
    mutationFn: async (submission: MomentSubmission): Promise<MomentPublishOutcome[]> => {
      if (!eventId) throw new Error('Event not found');
      if (submission.media.length === 0) {
        throw new Error('Selecciona una imagen o video antes de publicar.');
      }

      const outcomes = new Array<MomentPublishOutcome>(submission.media.length);
      let nextIndex = 0;

      const publishNext = async (): Promise<void> => {
        while (nextIndex < submission.media.length) {
          const index = nextIndex;
          nextIndex += 1;
          const originalMedia = submission.media[index];

          try {
            let mediaForMoment = originalMedia;
            let preferRemote = shouldPreferRemoteMoments;
            const notices: string[] = [];

            if (token?.trim()) {
              const preparedMedia = await prepareMomentMediaForUpload(originalMedia);
              try {
                const mediaUri = await uploadMedia({
                  uri: preparedMedia.uri,
                  mimeType: preparedMedia.mimeType,
                  fileName: preparedMedia.fileName ?? undefined,
                  uploadLabel: preparedMedia.kind === 'video' ? 'video' : 'imagen',
                });
                mediaForMoment = { ...preparedMedia, uri: mediaUri };
              } catch (error) {
                preferRemote = false;
                notices.push(
                  error instanceof Error
                    ? `${error.message} Guardamos ese momento solo en este dispositivo.`
                    : 'Guardamos ese momento solo en este dispositivo.',
                );
              }
            }

            const result = await createMomentFeedItem({
              eventId,
              authorName: currentActor.displayName,
              authorPartyId: currentActor.partyId,
              caption: submission.caption,
              media: mediaForMoment,
            }, { preferRemote });

            if (result.source === 'local' && shouldPreferRemoteMoments && result.fallbackReason) {
              notices.push(result.fallbackReason);
            }

            outcomes[index] = {
              index,
              status: 'fulfilled',
              moment: result.moment,
              source: result.source,
              notices,
            };
          } catch (error) {
            outcomes[index] = {
              index,
              status: 'rejected',
              message: error instanceof Error ? error.message : 'No pudimos publicar este momento.',
            };
          }
        }
      };

      await Promise.all(
        Array.from(
          { length: Math.min(MOMENT_UPLOAD_CONCURRENCY, submission.media.length) },
          () => publishNext(),
        ),
      );
      return outcomes;
    },
    onSuccess: (outcomes, submission) => {
      const fulfilled = outcomes.filter((outcome): outcome is MomentPublishSuccess => outcome.status === 'fulfilled');
      const rejected = outcomes.filter((outcome): outcome is MomentPublishFailure => outcome.status === 'rejected');
      const submittedIds = new Set(submission.optimisticIds);

      setPendingMoments((current) => current.filter((moment) => !submittedIds.has(moment.id)));

      if (fulfilled.length > 0) {
        qc.setQueryData<EventMoment[]>(momentsQueryKey, (current = []) => {
          const publishedIds = new Set(fulfilled.map((outcome) => outcome.moment.id));
          return [
            ...fulfilled.map((outcome) => outcome.moment),
            ...current.filter((moment) => !publishedIds.has(moment.id)),
          ].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
        });
        qc.invalidateQueries({ queryKey: ['event-moments', eventId] });
      }

      if (rejected.length > 0) {
        setMomentMedia(rejected.map((outcome) => submission.media[outcome.index]));
        setMomentCaption(submission.caption);
        setShowMomentComposer(true);
      }

      const localCount = fulfilled.filter((outcome) => outcome.source === 'local').length;
      const notices = [...new Set(fulfilled.flatMap((outcome) => outcome.notices))];
      const rejectedMessages = [...new Set(rejected.map((outcome) => outcome.message))];
      const summary = [
        fulfilled.length > 0
          ? `${fulfilled.length} ${fulfilled.length === 1 ? 'momento publicado' : 'momentos publicados'}.`
          : null,
        localCount > 0
          ? `${localCount} ${localCount === 1 ? 'quedó guardado' : 'quedaron guardados'} solo en este dispositivo.`
          : null,
        rejected.length > 0
          ? `${rejected.length} ${rejected.length === 1 ? 'archivo volvió' : 'archivos volvieron'} al editor para reintentar.`
          : null,
        ...notices,
        ...rejectedMessages,
      ].filter((value): value is string => Boolean(value));

      setMomentPublishFeedback({
        tone: rejected.length > 0 ? 'warning' : 'success',
        text: summary.join(' '),
      });
    },
    onError: (error, submission) => {
      const submittedIds = new Set(submission.optimisticIds);
      setPendingMoments((current) => current.filter((moment) => !submittedIds.has(moment.id)));
      setMomentMedia(submission.media);
      setMomentCaption(submission.caption);
      setShowMomentComposer(true);
      const message = error instanceof Error ? error.message : 'No pudimos publicar tu momento.';
      setMomentPublishFeedback({ tone: 'warning', text: message });
    },
  });

  const reactionMutation = useMutation({
    mutationFn: ({ momentId, reaction }: { momentId: string; reaction: EventMomentReactionOption }) => {
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
      if (numericPartyId === null) throw new Error('Este perfil ya no está disponible para conectar.');
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

  const stopActivePublisher = useCallback(async (options?: CloseLiveBroadcastOptions) => {
    const session = publisherSessionRef.current;
    publisherSessionRef.current = null;
    if (options?.updateState !== false) {
      setLivePreviewUrl(null);
    }
    if (session) {
      await session.stop();
    }
  }, []);

  const closeTrackedLiveBroadcast = useCallback(async (options?: CloseLiveBroadcastOptions) => {
    const active = activeLiveBroadcastRef.current;
    activeLiveBroadcastRef.current = null;
    if (options?.updateState !== false) {
      setActiveBroadcastId((current) => (active && current === active.broadcastId ? null : current));
    }
    await stopActivePublisher(options);
    if (!active) return;
    await endLiveBroadcastSession(
      {
        eventId: active.eventId,
        broadcastId: active.broadcastId,
        broadcasterPartyId: active.broadcasterPartyId,
      },
      { preferRemote: active.preferRemote },
    );
  }, [stopActivePublisher]);

  useEffect(() => () => {
    void closeTrackedLiveBroadcast({ updateState: false }).catch(() => undefined);
  }, [closeTrackedLiveBroadcast]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        void closeTrackedLiveBroadcast()
          .then(() => {
            if (eventId) {
              qc.invalidateQueries({ queryKey: ['event-live-broadcasts', eventId] });
            }
          })
          .catch(() => undefined);
      }
    });

    return () => subscription.remove();
  }, [closeTrackedLiveBroadcast, eventId, qc]);

  const startLiveBroadcastMutation = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error('Event not found');
      if (!token?.trim()) throw new Error('Inicia sesión para transmitir al fanclub.');
      if (!currentActor.partyId) throw new Error('Tu sesión no tiene una identidad vinculada para transmitir como fan.');
      if (!selectedLiveArtist) throw new Error('Sigue a un artista del lineup para transmitir a su fanclub.');

      let created:
        | Awaited<ReturnType<typeof startLiveBroadcastSession>>
        | null = null;

      try {
        created = await startLiveBroadcastSession(
          {
            eventId,
            artistId: selectedLiveArtist.id,
            artistName: selectedLiveArtist.name,
            broadcasterName: currentActor.displayName,
            broadcasterPartyId: currentActor.partyId,
            title: broadcastTitle,
            description: broadcastDescription,
            quality: broadcastQuality,
          },
          { preferRemote: shouldPreferRemoteBroadcasts },
        );

        if (!created.broadcast.whipUrl) {
          if (created.broadcast.ingestUrl) {
            throw new Error('El servidor devolvió RTMP, pero la app móvil publica video en vivo por WHIP.');
          }
          throw new Error('El servidor no devolvió un endpoint de publicación para esta transmisión.');
        }

        const publisher = await startWhipBroadcastPublisher({
          whipUrl: created.broadcast.whipUrl,
          streamKey: created.broadcast.streamKey,
          quality: broadcastQuality,
        });

        return { ...created, publisher };
      } catch (error) {
        if (created) {
          await endLiveBroadcastSession(
            {
              eventId,
              broadcastId: created.broadcast.id,
              broadcasterPartyId: currentActor.partyId,
            },
            { preferRemote: shouldPreferRemoteBroadcasts },
          ).catch(() => undefined);
        }
        throw error;
      }
    },
    onSuccess: ({ broadcast, source, fallbackReason, publisher }) => {
      publisherSessionRef.current = publisher;
      activeLiveBroadcastRef.current = {
        eventId: broadcast.eventId,
        broadcastId: broadcast.id,
        broadcasterPartyId: currentActor.partyId,
        preferRemote: shouldPreferRemoteBroadcasts,
      };
      setLivePreviewUrl(publisher.previewUrl);
      setActiveBroadcastId(broadcast.id);
      setBroadcastTitle('');
      setBroadcastDescription('');
      qc.invalidateQueries({ queryKey: ['event-live-broadcasts', eventId] });
      const notices = [
        source === 'local' && shouldPreferRemoteBroadcasts
          ? fallbackReason ?? 'No pudimos sincronizar con el backend.'
          : null,
      ].filter((value): value is string => Boolean(value));
      Alert.alert('En vivo', notices.join('\n\n') || `Transmitiendo para el fanclub de ${broadcast.artistName}.`);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No pudimos iniciar la transmisión.';
      Alert.alert('Error', message);
    },
  });

  const endLiveBroadcastMutation = useMutation({
    mutationFn: async (broadcast: EventLiveBroadcast) => {
      if (activeLiveBroadcastRef.current?.broadcastId === broadcast.id) {
        activeLiveBroadcastRef.current = null;
      }
      await stopActivePublisher();
      await endLiveBroadcastSession(
        {
          eventId: broadcast.eventId,
          broadcastId: broadcast.id,
          broadcasterPartyId: currentActor.partyId,
        },
        { preferRemote: shouldPreferRemoteBroadcasts },
      );
    },
    onSuccess: () => {
      setActiveBroadcastId(null);
      qc.invalidateQueries({ queryKey: ['event-live-broadcasts', eventId] });
      Alert.alert('Listo', 'Transmisión finalizada.');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No pudimos finalizar la transmisión.';
      Alert.alert('Error', message);
    },
  });

  const handleOpenTicketUrl = useCallback((ticketUrl?: string | null) => {
    if (ticketUrl) {
      Linking.openURL(ticketUrl).catch(() => {
        Alert.alert('No pudimos abrir la venta', 'Comprueba tu conexión e inténtalo otra vez.');
      });
    }
  }, []);

  const handleOpenMomentMedia = useCallback((media: EventMomentMedia) => {
    if (media.kind === 'image') {
      setPreviewFailed(false);
      setPreviewLoading(true);
      setPreviewMedia(media);
      return;
    }

    Linking.openURL(media.uri).catch(() => {
      Alert.alert('Error', 'No pudimos abrir este archivo.');
    });
  }, []);

  const handleWatchBroadcast = useCallback((broadcast: EventLiveBroadcast) => {
    if (!broadcast.playbackUrl || !/^https?:\/\//i.test(broadcast.playbackUrl.trim())) {
      Alert.alert('En vivo', 'Esta transmisión todavía no tiene una URL pública de reproducción.');
      return;
    }

    if (eventId) {
      void heartbeatLiveBroadcastSession(
        { eventId, broadcastId: broadcast.id, viewerDelta: 1 },
        { preferRemote: shouldPreferRemoteBroadcasts },
      ).then(() => {
        qc.invalidateQueries({ queryKey: ['event-live-broadcasts', eventId] });
      }).catch(() => undefined);
    }

    Linking.openURL(broadcast.playbackUrl).catch(() => {
      Alert.alert('Error', 'No pudimos abrir la transmisión.');
    });
  }, [eventId, qc, shouldPreferRemoteBroadcasts]);

  const handleEndBroadcast = useCallback((broadcast: EventLiveBroadcast) => {
    endLiveBroadcastMutation.mutate(broadcast);
  }, [endLiveBroadcastMutation]);

  const handleRsvpPress = useCallback((status: RSVPStatus) => {
    if (!normalizedPartyId) {
      Alert.alert('Inicia sesión', 'Necesitas una cuenta vinculada para confirmar asistencia.');
      return;
    }
    rsvpMutation.mutate(status);
  }, [normalizedPartyId, rsvpMutation]);

  const handleToggleSaved = useCallback(() => {
    saveEventMutation.mutate();
  }, [saveEventMutation]);

  const selectMomentMedia = useCallback(async (
    mode: 'camera' | 'photos' | 'video',
    selectionLimit = 1,
  ): Promise<DraftMomentMedia[]> => {
    if (mode === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Activa el acceso a la cámara para tomar fotos del evento.');
        return [];
      }
    }

    const result =
      mode === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
          })
        : mode === 'photos'
          ? await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsMultipleSelection: true,
              orderedSelection: true,
              selectionLimit,
              quality: 0.8,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['videos'],
              allowsMultipleSelection: false,
              quality: 0.8,
              videoMaxDuration: 20,
            });

    if (result.canceled) return [];
    return result.assets.map((asset) => {
      const kind = asset.type === 'video' ? 'video' : 'image';
      return {
        kind,
        uri: asset.uri,
        mimeType: asset.mimeType ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
        width: asset.width > 0 ? asset.width : null,
        height: asset.height > 0 ? asset.height : null,
        durationMs: asset.duration ?? null,
        fileName: asset.fileName,
      };
    });
  }, []);

  const pickMomentMedia = useCallback(async (mode: 'camera' | 'photos' | 'video') => {
    const remaining = MAX_MOMENT_MEDIA_SELECTION - momentMedia.length;
    if (remaining <= 0) {
      Alert.alert('Galería completa', `Puedes publicar hasta ${MAX_MOMENT_MEDIA_SELECTION} archivos a la vez.`);
      return;
    }

    const selected = await selectMomentMedia(mode, mode === 'photos' ? remaining : 1);
    if (selected.length === 0) return;

    setMomentMedia((current) => {
      const knownUris = new Set(current.map((media) => media.uri));
      const additions = selected.filter((media) => !knownUris.has(media.uri));
      return [...current, ...additions].slice(0, MAX_MOMENT_MEDIA_SELECTION);
    });
  }, [momentMedia.length, selectMomentMedia]);

  const removeMomentMedia = useCallback((uri: string) => {
    setMomentMedia((current) => current.filter((media) => media.uri !== uri));
  }, []);

  const handlePublishMoments = useCallback(() => {
    if (!eventId || momentMedia.length === 0 || createMomentMutation.isPending) return;

    const optimisticIds = momentMedia.map(() => createOptimisticMomentId());
    const now = Date.now();
    const optimisticMoments = momentMedia.map<EventMoment>((media, index) => ({
      id: optimisticIds[index],
      eventId,
      authorName: currentActor.displayName,
      authorPartyId: currentActor.partyId,
      caption: momentCaption.trim() || null,
      media,
      createdAt: new Date(now + index).toISOString(),
      reactions: {},
      comments: [],
    })).reverse();
    const submission: MomentSubmission = {
      caption: momentCaption,
      media: [...momentMedia],
      optimisticIds,
    };

    setPendingMoments((current) => [...optimisticMoments, ...current]);
    setMomentCaption('');
    setMomentMedia([]);
    setShowMomentComposer(false);
    createMomentMutation.mutate(submission);
  }, [createMomentMutation, currentActor, eventId, momentCaption, momentMedia]);

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
          <Text style={styles.error}>No encontramos este evento</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Volver</Text>
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
        <Text style={styles.error}>No pudimos cargar el evento</Text>
        <Text style={styles.text}>Comprueba tu conexión e inténtalo nuevamente.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => void refetchEvent()} accessibilityRole="button">
          <Text style={styles.backButtonText}>Reintentar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backButtonText}>Volver a eventos</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const startDate = new Date(event.startTime);
  const endDate = event.endTime ? new Date(event.endTime) : null;
  const rsvpCount = rsvpQuery.data ? countGoingRsvps(rsvpQuery.data) : (event.rsvpCount ?? 0);
  const invitations = invitationsQuery.data ?? [];
  const isSaved = savedEventIdsQuery.data?.includes(String(event.id)) ?? false;
  const momentCount = displayedMoments.length;
  const liveBroadcasts = liveBroadcastsQuery.data ?? [];
  const liveBroadcastCount = countLiveBroadcasts(liveBroadcasts);
  const activeBroadcast = activeBroadcastId
    ? liveBroadcasts.find((broadcast) => broadcast.id === activeBroadcastId) ?? null
    : null;
  const hasLivePublisher = Boolean(activeBroadcast && livePreviewUrl);
  const canStartLiveBroadcast =
    Boolean(token?.trim()) &&
    Boolean(currentActor.partyId) &&
    Boolean(selectedLiveArtist) &&
    !hasLivePublisher &&
    !startLiveBroadcastMutation.isPending;
  return (
    <ScreenErrorBoundary>
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>

        {event.imageUrl ? (
          <Image
            source={{ uri: event.imageUrl }}
            style={styles.image}
            accessibilityLabel={`Imagen de ${event.title}`}
          />
        ) : (
          <View style={styles.imageFallback}>
            <MaterialCommunityIcons name="calendar-star" size={42} color="#2563eb" />
            <Text style={styles.imageFallbackText}>Evento destacado</Text>
          </View>
        )}

        <Text style={styles.title}>{event.title}</Text>
        <TicketPurchaseCard
          tiers={ticketTiersQuery.data ?? []}
          fallbackPrice={event.ticketPrice}
          fallbackCurrency={event.currency ?? displayCurrency}
          externalTicketUrl={event.ticketUrl}
          canBuyInternally={isEventTicketPurchaseEligible(event)}
          isLoading={ticketTiersQuery.isLoading}
          isError={ticketTiersQuery.isError}
          onBuy={() => router.push({ pathname: '/ticketCheckout', params: { eventId: String(event.id) } })}
          onOpenExternal={() => handleOpenTicketUrl(event.ticketUrl)}
          onRetry={() => void ticketTiersQuery.refetch()}
        />
        {externalTicketSources.length > 1 ? (
          <View style={styles.ticketSourcesCard}>
            <Text style={styles.ticketSourcesTitle}>Opciones de compra</Text>
            <Text style={styles.ticketSourcesSubtitle}>
              Este evento está disponible en varias plataformas.
            </Text>
            {externalTicketSources.map((source) => (
              <TouchableOpacity
                key={`${source.provider}:${source.url}`}
                style={styles.ticketSourceButton}
                onPress={() => handleOpenTicketUrl(source.url)}
                accessibilityRole="link"
                accessibilityLabel={`Comprar en ${source.label}`}
              >
                <Text style={styles.ticketSourceLabel}>{source.label}</Text>
                <Text style={styles.ticketSourcePrice}>
                  {typeof source.priceCents === 'number'
                    ? formatTicketMoney(source.priceCents, source.currency ?? event.currency ?? displayCurrency, locale)
                    : 'Ver entradas'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
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
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'live' && styles.tabButtonActive]}
            onPress={() => setActiveTab('live')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'live' && styles.tabButtonTextActive]}>
              En Vivo ({liveBroadcastCount})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'details' ? (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>Fecha y hora</Text>
              <Text style={styles.text}>
                {startDate.toLocaleDateString(locale, { timeZone: timezone })} {' '}
                {startDate.toLocaleTimeString(locale, { timeZone: timezone, hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text style={styles.text}>
                {endDate
                  ? `Hasta el ${endDate.toLocaleDateString(locale, { timeZone: timezone })} ${endDate.toLocaleTimeString(locale, { timeZone: timezone, hour: '2-digit', minute: '2-digit' })}`
                  : 'Fin por confirmar'}
              </Text>
            </View>

            {event.venue ? (
              <View style={styles.section}>
                <Text style={styles.label}>Lugar</Text>
                <Text style={styles.text}>{event.venue.name}</Text>
                <Text style={styles.text}>{event.venue.address}, {event.venue.city}</Text>
              </View>
            ) : null}

            {event.artists && event.artists.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.label}>Artistas</Text>
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
                <Text style={styles.label}>Acerca del evento</Text>
                <Text style={styles.text}>{event.description}</Text>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.label}>¿Asistirás? ({rsvpCount})</Text>
              {!normalizedPartyId ? (
                <Text style={styles.helperText}>Inicia sesión con una cuenta vinculada para confirmar asistencia.</Text>
              ) : null}
              {rsvpQuery.isLoading ? <Text style={styles.text}>Cargando RSVP...</Text> : null}
              <View style={styles.rsvpButtons}>
                <TouchableOpacity
                  style={[styles.rsvpButton, rsvpStatus === 'GOING' && styles.rsvpButtonActive]}
                  onPress={() => handleRsvpPress('GOING')}
                  disabled={rsvpMutation.isPending}
                >
                  <Text style={[styles.rsvpButtonText, rsvpStatus === 'GOING' && styles.rsvpButtonTextActive]}>
                    ✓ Voy
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rsvpButton, rsvpStatus === 'INTERESTED' && styles.rsvpButtonActive]}
                  onPress={() => handleRsvpPress('INTERESTED')}
                  disabled={rsvpMutation.isPending}
                >
                  <Text style={[styles.rsvpButtonText, rsvpStatus === 'INTERESTED' && styles.rsvpButtonTextActive]}>
                    ♥ Me interesa
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rsvpButton, rsvpStatus === 'NOT_GOING' && styles.rsvpButtonActive]}
                  onPress={() => handleRsvpPress('NOT_GOING')}
                  disabled={rsvpMutation.isPending}
                >
                  <Text style={[styles.rsvpButtonText, rsvpStatus === 'NOT_GOING' && styles.rsvpButtonTextActive]}>
                    ✕ No iré
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
                  {saveEventMutation.isPending ? 'Guardando…' : isSaved ? 'Guardado' : 'Guardar evento'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.inviteButton} onPress={() => setShowInviteModal(true)}>
                <Text style={styles.inviteButtonText}>Invitar amistades</Text>
              </TouchableOpacity>
            </View>

            <ExperienceReviews
              targetKind="event"
              targetId={String(event.id)}
              title="Reseñas del evento"
            />
          </>
        ) : activeTab === 'moments' ? (
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
              {momentPublishFeedback ? (
                <View
                  style={[
                    styles.momentFeedback,
                    momentPublishFeedback.tone === 'warning' && styles.momentFeedbackWarning,
                  ]}
                  accessibilityLiveRegion="polite"
                >
                  <MaterialCommunityIcons
                    name={momentPublishFeedback.tone === 'warning' ? 'alert-circle-outline' : 'check-circle-outline'}
                    size={18}
                    color={momentPublishFeedback.tone === 'warning' ? '#9a3412' : '#166534'}
                  />
                  <Text
                    style={[
                      styles.momentFeedbackText,
                      momentPublishFeedback.tone === 'warning' && styles.momentFeedbackTextWarning,
                    ]}
                  >
                    {momentPublishFeedback.text}
                  </Text>
                </View>
              ) : null}
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
              {momentsQuery.isLoading && pendingMoments.length === 0 ? (
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
                  {displayedMoments.map((moment, index) => (
                    <EventMomentCard
                      key={moment.id}
                      moment={moment}
                      currentActorKey={currentActor.actorKey}
                      currentPartyId={currentActor.partyId}
                      featured={featuredMomentIds.has(moment.id)}
                      pending={pendingMomentIds.has(moment.id)}
                      imagePriority={index < 2 ? 'high' : 'normal'}
                      reactionDisabled={reactionMutation.isPending}
                      reactionOptions={reactionOptions}
                      reactionUnavailableLabel={
                        locale === 'en'
                          ? 'No synchronized reactions. Refresh catalogs to react.'
                          : 'Sin reacciones sincronizadas. Actualiza los catálogos para reaccionar.'
                      }
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
        ) : (
          <>
            <View style={styles.section}>
              <View style={styles.liveHero}>
                <View style={styles.liveHeroHeader}>
                  <View style={styles.liveHeroTitleRow}>
                    <MaterialCommunityIcons name="broadcast" size={20} color="#dc2626" />
                    <Text style={styles.liveHeroTitle}>Fanclub en vivo</Text>
                  </View>
                  {hasLivePublisher ? (
                    <View style={styles.liveNowBadge}>
                      <Text style={styles.liveNowBadgeText}>Transmitiendo</Text>
                    </View>
                  ) : null}
                </View>

                {livePreviewUrl ? (
                  <RTCView
                    streamURL={livePreviewUrl}
                    objectFit="cover"
                    mirror={false}
                    style={styles.livePreview}
                  />
                ) : (
                  <View style={styles.livePreviewPlaceholder}>
                    <MaterialCommunityIcons name="video-wireless-outline" size={34} color="#fecaca" />
                    <Text style={styles.livePreviewText}>Vista previa al iniciar</Text>
                  </View>
                )}

                <Text style={styles.liveHeroMeta}>
                  Transmites como {currentActor.displayName}
                  {selectedLiveArtist ? ` para ${selectedLiveArtist.name}` : ''}
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Fanclub</Text>
              {!token?.trim() ? (
                <Text style={styles.helperText}>Inicia sesión para transmitir al fanclub.</Text>
              ) : null}
              {!currentActor.partyId ? (
                <Text style={styles.helperText}>Tu sesión necesita una identidad vinculada para transmitir.</Text>
              ) : null}
              {eventArtists.length === 0 ? (
                <Text style={styles.text}>Este evento todavía no tiene artistas asociados.</Text>
              ) : followedLiveArtistIdsQuery.isLoading ? (
                <ActivityIndicator color="#2563eb" />
              ) : followedLiveArtists.length === 0 ? (
                <Text style={styles.text}>Sigue a un artista del lineup para transmitir a su fanclub.</Text>
              ) : (
                <View style={styles.liveArtistChips}>
                  {followedLiveArtists.map((artist) => {
                    const active = String(artist.id) === String(selectedLiveArtist?.id);
                    return (
                      <TouchableOpacity
                        key={String(artist.id)}
                        style={[styles.liveArtistChip, active && styles.liveArtistChipActive]}
                        onPress={() => setSelectedLiveArtistId(String(artist.id))}
                        disabled={hasLivePublisher || startLiveBroadcastMutation.isPending}
                      >
                        <Text style={[styles.liveArtistChipText, active && styles.liveArtistChipTextActive]}>
                          {artist.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Estudio</Text>
              <View style={styles.inputGroup}>
                <TextInput
                  placeholder="Título"
                  value={broadcastTitle}
                  onChangeText={setBroadcastTitle}
                  style={styles.input}
                  maxLength={80}
                  editable={!hasLivePublisher && !startLiveBroadcastMutation.isPending}
                />
                <TextInput
                  placeholder="Descripción opcional"
                  value={broadcastDescription}
                  onChangeText={setBroadcastDescription}
                  style={[styles.input, styles.inputMultiline]}
                  multiline
                  maxLength={280}
                  editable={!hasLivePublisher && !startLiveBroadcastMutation.isPending}
                />
                <View style={styles.liveQualityRow}>
                  {LIVE_QUALITY_OPTIONS.map((quality) => {
                    const active = broadcastQuality === quality;
                    return (
                      <TouchableOpacity
                        key={quality}
                        style={[styles.liveQualityButton, active && styles.liveQualityButtonActive]}
                        onPress={() => setBroadcastQuality(quality)}
                        disabled={hasLivePublisher || startLiveBroadcastMutation.isPending}
                      >
                        <Text style={[styles.liveQualityText, active && styles.liveQualityTextActive]}>
                          {quality}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {hasLivePublisher && activeBroadcast ? (
                  <TouchableOpacity
                    style={[styles.liveEndButton, endLiveBroadcastMutation.isPending && styles.buttonDisabled]}
                    onPress={() => handleEndBroadcast(activeBroadcast)}
                    disabled={endLiveBroadcastMutation.isPending}
                  >
                    <MaterialCommunityIcons name="stop-circle-outline" size={18} color="#fff" />
                    <Text style={styles.liveEndButtonText}>
                      {endLiveBroadcastMutation.isPending ? 'Cerrando...' : 'Terminar transmisión'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.liveStartButton,
                      !canStartLiveBroadcast && styles.buttonDisabled,
                    ]}
                    onPress={() => startLiveBroadcastMutation.mutate()}
                    disabled={!canStartLiveBroadcast}
                  >
                    <MaterialCommunityIcons name="broadcast" size={18} color="#fff" />
                    <Text style={styles.liveStartButtonText}>
                      {startLiveBroadcastMutation.isPending ? 'Iniciando...' : 'Iniciar en vivo'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Transmisiones</Text>
              {liveBroadcastsQuery.isLoading ? (
                <ActivityIndicator color="#2563eb" />
              ) : liveBroadcasts.length === 0 ? (
                <View style={styles.emptyMomentsCard}>
                  <MaterialCommunityIcons name="broadcast-off" size={32} color="#94a3b8" />
                  <Text style={styles.emptyMomentsTitle}>No hay transmisiones</Text>
                  <Text style={styles.emptyMomentsText}>
                    Cuando un fan salga en vivo desde este evento, aparecerá aquí.
                  </Text>
                </View>
              ) : (
                <View style={styles.momentList}>
                  {liveBroadcasts.map((broadcast) => (
                    <EventLiveBroadcastCard
                      key={broadcast.id}
                      broadcast={broadcast}
                      currentPartyId={currentActor.partyId}
                      ending={endLiveBroadcastMutation.isPending}
                      onWatch={handleWatchBroadcast}
                      onEnd={handleEndBroadcast}
                    />
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={Boolean(previewMedia)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewMedia(null)}
        accessibilityViewIsModal
      >
        <SafeAreaView style={styles.previewModal}>
          <View style={styles.previewHeader}>
            <TouchableOpacity
              style={styles.previewCloseButton}
              onPress={() => setPreviewMedia(null)}
              accessibilityRole="button"
              accessibilityLabel="Cerrar vista previa"
            >
              <MaterialCommunityIcons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.previewBody}>
            {previewLoading && !previewFailed ? (
              <ActivityIndicator style={styles.previewLoader} size="large" color="#fff" />
            ) : null}
            {previewFailed ? (
              <View style={styles.previewError}>
                <MaterialCommunityIcons name="image-off-outline" size={42} color="#cbd5e1" />
                <Text style={styles.previewErrorText}>No pudimos cargar esta foto.</Text>
              </View>
            ) : previewMedia ? (
              <ExpoImage
                source={{
                  uri: previewMedia.uri,
                  width: previewMedia.width,
                  height: previewMedia.height,
                }}
                style={styles.previewImage}
                contentFit="contain"
                cachePolicy="memory-disk"
                priority="high"
                transition={100}
                onDisplay={() => setPreviewLoading(false)}
                onError={() => {
                  setPreviewLoading(false);
                  setPreviewFailed(true);
                }}
                accessibilityRole="image"
                accessibilityLabel="Vista previa de la foto"
              />
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showMomentComposer}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMomentComposer(false)}
        accessibilityViewIsModal
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalHeaderAction}
              onPress={() => setShowMomentComposer(false)}
              accessibilityRole="button"
              accessibilityLabel="Cerrar compositor de momento"
            >
              <Text style={styles.modalClose}>Cerrar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Compartir momento</Text>
            <View style={{ width: 60 }} />
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.modalMessage}>
              Elige hasta {MAX_MOMENT_MEDIA_SELECTION} fotos o agrega un video corto. Verás cada archivo en el feed de
              inmediato mientras se optimiza y publica en segundo plano.
            </Text>

            <View style={styles.momentMediaActions}>
              <TouchableOpacity style={styles.secondaryActionButton} onPress={() => void pickMomentMedia('camera')}>
                <Text style={styles.secondaryActionButtonText}>Tomar foto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryActionButton} onPress={() => void pickMomentMedia('photos')}>
                <Text style={styles.secondaryActionButtonText}>Elegir fotos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryActionButton} onPress={() => void pickMomentMedia('video')}>
                <Text style={styles.secondaryActionButtonText}>Agregar video</Text>
              </TouchableOpacity>
            </View>

            {momentMedia.length > 0 ? (
              <View style={styles.selectedMomentCard}>
                <Text style={styles.selectedMomentSummary} accessibilityLiveRegion="polite">
                  {momentMedia.length} {momentMedia.length === 1 ? 'archivo listo' : 'archivos listos'}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.selectedMomentList}
                >
                  {momentMedia.map((media, index) => (
                    <View key={media.uri} style={styles.selectedMomentTile}>
                      {media.kind === 'image' ? (
                        <ExpoImage
                          source={{ uri: media.uri, width: media.width, height: media.height }}
                          style={styles.selectedMomentThumbnail}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          transition={80}
                          accessibilityRole="image"
                          accessibilityLabel={`Foto seleccionada ${index + 1}`}
                        />
                      ) : (
                        <View style={styles.selectedVideoThumbnail}>
                          <MaterialCommunityIcons name="play-circle-outline" size={30} color="#f8fafc" />
                          <Text style={styles.selectedVideoText}>Video</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.removeMediaButton}
                        onPress={() => removeMomentMedia(media.uri)}
                        accessibilityRole="button"
                        accessibilityLabel={`Quitar archivo ${index + 1}`}
                      >
                        <MaterialCommunityIcons name="close-circle" size={24} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <TextInput
                placeholder="Agrega contexto, lineup o una vibra rápida"
                accessibilityLabel="Descripción del momento"
                value={momentCaption}
                onChangeText={setMomentCaption}
                style={[styles.input, styles.inputMultiline]}
                multiline
                maxLength={280}
              />
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (momentMedia.length === 0 || createMomentMutation.isPending) && styles.buttonDisabled,
                ]}
                onPress={handlePublishMoments}
                disabled={momentMedia.length === 0 || createMomentMutation.isPending}
                accessibilityRole="button"
                accessibilityState={{ disabled: momentMedia.length === 0 || createMomentMutation.isPending }}
              >
                <Text style={styles.primaryButtonText}>
                  {createMomentMutation.isPending
                    ? 'Publicando…'
                    : momentMedia.length > 1
                      ? `Publicar ${momentMedia.length} momentos`
                      : 'Publicar momento'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showInviteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInviteModal(false)}
        accessibilityViewIsModal
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalHeaderAction}
              onPress={() => setShowInviteModal(false)}
              accessibilityRole="button"
              accessibilityLabel="Cerrar invitaciones"
            >
              <Text style={styles.modalClose}>Cerrar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Invitar amigos</Text>
            <View style={{ width: 60 }} />
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.modalMessage}>Busca a la persona por nombre o @username para enviarle la invitación.</Text>
            <View style={styles.inputGroup}>
              <PartySelector value={invitee} onChange={setInvitee} excludedPartyIds={normalizedPartyId ? [Number(normalizedPartyId)] : []} label="Persona a invitar" context="event_invitation" />
              <TextInput
                placeholder="Mensaje (opcional)"
                accessibilityLabel="Mensaje opcional"
                value={inviteMessage}
                onChangeText={setInviteMessage}
                style={[styles.input, styles.inputMultiline]}
                multiline
              />
              <TouchableOpacity
                style={[styles.primaryButton, (invitationMutation.isPending || !invitee) && styles.buttonDisabled]}
                onPress={() => invitationMutation.mutate()}
                disabled={invitationMutation.isPending || !invitee}
                accessibilityRole="button"
                accessibilityState={{ disabled: invitationMutation.isPending || !invitee }}
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
                      <Text style={styles.invitationTitle}>Invitación a una cuenta TDF</Text>
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
    </ScreenErrorBoundary>
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
  ticketSourcesCard: {
    gap: 8,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#faf5ff',
  },
  ticketSourcesTitle: {
    color: '#3b0764',
    fontSize: 16,
    fontWeight: '800',
  },
  ticketSourcesSubtitle: {
    color: '#6b7280',
    fontSize: 13,
    marginBottom: 2,
  },
  ticketSourceButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  ticketSourceLabel: {
    flex: 1,
    color: '#4c1d95',
    fontWeight: '800',
  },
  ticketSourcePrice: {
    color: '#6d28d9',
    fontSize: 12,
    fontWeight: '700',
  },
  ticketTierList: {
    gap: 10,
  },
  ticketTierCard: {
    borderWidth: 1,
    borderColor: '#dbe1ea',
    borderRadius: 8,
    padding: 12,
    gap: 6,
    backgroundColor: '#fff',
  },
  ticketTierCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  ticketTierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  ticketTierName: {
    flex: 1,
    color: '#0f172a',
    fontWeight: '800',
  },
  ticketTierPrice: {
    color: '#1d4ed8',
    fontWeight: '800',
  },
  ticketTierDescription: {
    color: '#475569',
    lineHeight: 18,
  },
  ticketTierMeta: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  ticketForm: {
    gap: 10,
  },
  ticketFormRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ticketQuantityField: {
    width: 110,
    gap: 6,
  },
  ticketTotalBox: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    justifyContent: 'center',
  },
  ticketFieldLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  ticketTotalText: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  ticketOrdersBox: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 12,
  },
  ticketOrdersTitle: {
    color: '#0f172a',
    fontWeight: '800',
  },
  ticketOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
  },
  ticketOrderTitle: {
    color: '#0f172a',
    fontWeight: '700',
  },
  ticketOrderMeta: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  ticketOrderAmount: {
    color: '#1d4ed8',
    fontWeight: '800',
  },
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
  liveHero: {
    borderRadius: 14,
    backgroundColor: '#111827',
    padding: 14,
    gap: 12,
  },
  liveHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  liveHeroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  liveHeroTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  liveNowBadge: {
    borderRadius: 999,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  liveNowBadgeText: {
    color: '#b91c1c',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  livePreview: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#020617',
    overflow: 'hidden',
  },
  livePreviewPlaceholder: {
    height: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  livePreviewText: {
    color: '#fecaca',
    fontWeight: '800',
  },
  liveHeroMeta: {
    color: '#e5e7eb',
    lineHeight: 19,
    fontWeight: '600',
  },
  liveArtistChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  liveArtistChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  liveArtistChipActive: {
    borderColor: '#dc2626',
    backgroundColor: '#fee2e2',
  },
  liveArtistChipText: {
    color: '#334155',
    fontWeight: '800',
    fontSize: 12,
  },
  liveArtistChipTextActive: {
    color: '#b91c1c',
  },
  liveQualityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  liveQualityButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  liveQualityButtonActive: {
    borderColor: '#dc2626',
    backgroundColor: '#fee2e2',
  },
  liveQualityText: {
    color: '#334155',
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  liveQualityTextActive: {
    color: '#b91c1c',
  },
  liveStartButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    paddingVertical: 12,
  },
  liveStartButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  liveEndButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    backgroundColor: '#991b1b',
    paddingVertical: 12,
  },
  liveEndButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  momentHintRow: {
    marginTop: 2,
  },
  momentFeedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  momentFeedbackWarning: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  momentFeedbackText: {
    flex: 1,
    color: '#166534',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  momentFeedbackTextWarning: {
    color: '#9a3412',
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
  previewModal: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.98)',
  },
  previewHeader: {
    minHeight: 56,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  previewCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  previewBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewLoader: {
    ...StyleSheet.absoluteFillObject,
  },
  previewError: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  previewErrorText: {
    color: '#e2e8f0',
    fontWeight: '600',
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
  modalHeaderAction: { minWidth: 60, minHeight: 44, justifyContent: 'center' },
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
  selectedMomentSummary: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  selectedMomentList: {
    gap: 10,
    paddingRight: 4,
  },
  selectedMomentTile: {
    width: 104,
    height: 104,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  selectedMomentThumbnail: {
    width: '100%',
    height: '100%',
  },
  selectedVideoThumbnail: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  selectedVideoText: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  removeMediaButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
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
