/**
 * NewUserOnboardingGate.tsx
 *
 * Wraps the post-auth landing surface. For brand-new users assigned to the
 * `treatment_singlefeature` arm of `single-feature-onboarding-v1`, renders
 * a focused Event Moments experience instead of the full tab UI. Everyone
 * else gets `children` unchanged.
 *
 * Analytics:
 *   - `experiment_viewed`     fires once when the gate first engages.
 *   - `experiment_converted`  fires once when the user posts their first
 *                             reaction on a moment (value=1). Conversion
 *                             is detected via a direct callback from the
 *                             moment card after a successful reaction toggle.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { Events } from '../api/events';
import { EventMomentCard } from '../components/EventMomentCard';
import { buildMomentActor } from '../lib/eventMoments';
import {
  listMomentFeed,
  toggleMomentFeedReaction,
} from '../lib/eventMomentsRepository';
import { resolvePartyId } from '../lib/identity';
import { MOBILE_LANDING_ROUTE } from '../navigation/mobileSurface';
import { useAuth } from '../providers/AuthProvider';
import { useFirstRun } from '../providers/FirstRunProvider';
import { useUserSettings } from '../providers/UserSettingsProvider';
import type {
  EventMomentReactionOption,
  ID,
  SocialEvent,
} from '../types';
import { useExperiments } from './ExperimentProvider';
import { useExperimentEvent } from './useExperimentEvent';

const EXPERIMENT_ID = 'single-feature-onboarding-v1';
const TREATMENT = 'treatment_singlefeature';

type Props = {
  children: React.ReactNode;
};

const pickAnchorEvent = (events: SocialEvent[] | undefined): SocialEvent | null => {
  if (!events?.length) return null;
  // Anchor on the most recent PAST event so the landing feed has a real
  // chance of containing already-published moments. The caller is
  // responsible for filtering to events with non-empty moment feeds.
  const now = Date.now();
  const past = events.filter((event) => {
    const ts = Date.parse(String(event.startTime));
    return Number.isFinite(ts) && ts <= now;
  });
  if (!past.length) return null;
  past.sort(
    (a, b) => Date.parse(String(b.startTime)) - Date.parse(String(a.startTime)),
  );
  return past[0] ?? null;
};

export function NewUserOnboardingGate({ children }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isReady: experimentsReady, getVariant } = useExperiments();
  const { cohortReady, isNewUser } = useFirstRun();
  const { token, partyId: authPartyId } = useAuth();
  const { partyId: settingsPartyId, displayName, locale, getCatalogItems } = useUserSettings();
  const { track } = useExperimentEvent();
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

  const normalizedPartyId = resolvePartyId(authPartyId, settingsPartyId);
  const currentActor = useMemo(
    () => buildMomentActor({ partyId: normalizedPartyId, displayName }),
    [displayName, normalizedPartyId],
  );

  // Local override — once the user explicitly leaves the treatment landing
  // (e.g. taps "Explore more"), don't trap them again for the rest of the
  // session.
  const [treatmentExited, setTreatmentExited] = useState(false);

  const variant = experimentsReady ? getVariant(EXPERIMENT_ID) : null;
  const gateEngaged =
    experimentsReady &&
    cohortReady &&
    isNewUser &&
    variant === TREATMENT &&
    !treatmentExited;

  // Fire experiment_viewed exactly once when the gate first engages.
  const viewedRef = useRef(false);
  useEffect(() => {
    if (!gateEngaged || viewedRef.current) return;
    viewedRef.current = true;
    track('experiment_viewed', {
      experimentId: EXPERIMENT_ID,
      variant: TREATMENT,
      userId: normalizedPartyId ?? undefined,
    });
  }, [gateEngaged, normalizedPartyId, track]);

  // Pull a small window of recent events and anchor on the most recent past
  // one whose moments feed is non-empty. We fetch a slightly larger page
  // (without `upcomingOnly`) so the search has something to chew on.
  const eventsQuery = useQuery({
    queryKey: ['exp-single-feature-onboarding', 'events'],
    queryFn: () => Events.list({ limit: 20 }),
    enabled: gateEngaged,
  });

  const shouldPreferRemoteMoments = Boolean(token?.trim());

  // Walk past events from most recent to oldest and pick the first one whose
  // moments feed has at least one entry. The probe queries are cached per
  // event id so we don't refetch on every render.
  const candidateEvents = useMemo(() => {
    if (!eventsQuery.data?.length) return [] as SocialEvent[];
    const now = Date.now();
    return eventsQuery.data
      .filter((event) => {
        const ts = Date.parse(String(event.startTime));
        return Number.isFinite(ts) && ts <= now;
      })
      .sort(
        (a, b) =>
          Date.parse(String(b.startTime)) - Date.parse(String(a.startTime)),
      )
      .slice(0, 5);
  }, [eventsQuery.data]);

  const candidateProbes = useQueries({
    queries: candidateEvents.map((event) => ({
      queryKey: [
        'exp-single-feature-onboarding',
        'probe',
        event.id,
        shouldPreferRemoteMoments ? 'remote' : 'local',
      ] as const,
      queryFn: () =>
        listMomentFeed(event.id as ID, {
          preferRemote: shouldPreferRemoteMoments,
        }),
      enabled: gateEngaged,
    })),
  });

  const featuredEvent = useMemo(() => {
    for (let i = 0; i < candidateEvents.length; i += 1) {
      const probe = candidateProbes[i];
      if (probe?.data && probe.data.length > 0) {
        return candidateEvents[i] ?? null;
      }
    }
    // Fall back to the most recent past event (empty-state branch keeps the
    // existing CTA) so the header still has a sensible title.
    return pickAnchorEvent(eventsQuery.data);
  }, [candidateEvents, candidateProbes, eventsQuery.data]);

  const featuredProbeIndex = featuredEvent
    ? candidateEvents.findIndex((event) => event.id === featuredEvent.id)
    : -1;
  const featuredProbe =
    featuredProbeIndex >= 0 ? candidateProbes[featuredProbeIndex] : undefined;

  const momentsQuery = useQuery({
    queryKey: [
      'exp-single-feature-onboarding',
      'moments',
      featuredEvent?.id ?? null,
      shouldPreferRemoteMoments ? 'remote' : 'local',
    ],
    queryFn: () =>
      listMomentFeed(featuredEvent!.id as ID, {
        preferRemote: shouldPreferRemoteMoments,
      }),
    enabled: gateEngaged && Boolean(featuredEvent?.id),
    initialData: featuredProbe?.data,
  });

  // Conversion detection: fire experiment_converted the first time the user
  // successfully posts a reaction via the moment card.
  const convertedRef = useRef(false);
  const handleConversion = useCallback(() => {
    if (convertedRef.current) return;
    convertedRef.current = true;
    track('experiment_converted', {
      experimentId: EXPERIMENT_ID,
      variant: TREATMENT,
      userId: normalizedPartyId ?? undefined,
      metadata: { value: 1, surface: 'gate_moment_reaction' },
    });
  }, [normalizedPartyId, track]);

  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const handleChangeComment = useCallback((momentId: string, value: string) => {
    setCommentDrafts((prev) => ({ ...prev, [momentId]: value }));
  }, []);

  const handleToggleReaction = useCallback(
    async (momentId: string, reaction: EventMomentReactionOption) => {
      if (!featuredEvent?.id) return;
      try {
        await toggleMomentFeedReaction(
          {
            eventId: featuredEvent.id as ID,
            momentId,
            actorKey: currentActor.actorKey,
            reaction,
          },
          { preferRemote: shouldPreferRemoteMoments },
        );
      } finally {
        queryClient.invalidateQueries({
          queryKey: [
            'exp-single-feature-onboarding',
            'moments',
            featuredEvent.id,
            shouldPreferRemoteMoments ? 'remote' : 'local',
          ],
        });
      }
    },
    [currentActor, featuredEvent?.id, queryClient, shouldPreferRemoteMoments],
  );

  const handleExplore = useCallback(() => {
    setTreatmentExited(true);
    router.replace(MOBILE_LANDING_ROUTE);
  }, [router]);

  if (!gateEngaged) {
    return <>{children}</>;
  }

  const loadingFeed = eventsQuery.isLoading || momentsQuery.isLoading;
  const moments = momentsQuery.data ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Bienvenido a TDF</Text>
        <Text style={styles.title}>
          {featuredEvent
            ? `Vive ${featuredEvent.title ?? 'el próximo evento'}`
            : 'Vive el primer momento'}
        </Text>
        <Text style={styles.subtitle}>
          Reacciona a un momento para empezar. Es la forma más rápida de sentir la vibra.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {loadingFeed ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        ) : moments.length > 0 ? (
          moments.slice(0, 3).map((moment, idx) => (
            <EventMomentCard
              key={moment.id}
              moment={moment}
              currentActorKey={currentActor.actorKey}
              currentPartyId={normalizedPartyId ?? null}
              featured={idx === 0}
              reactionOptions={reactionOptions}
              reactionUnavailableLabel={
                locale === 'en'
                  ? 'No synchronized reactions. Refresh catalogs to react.'
                  : 'Sin reacciones sincronizadas. Actualiza los catálogos para reaccionar.'
              }
              commentDraft={commentDrafts[moment.id] ?? ''}
              onChangeComment={handleChangeComment}
              onSubmitComment={() => {
                // Comments aren't the conversion surface here — keep the
                // gate minimal and route comment submissions to the full
                // event detail screen.
                if (featuredEvent?.id) {
                  router.push({
                    pathname: '/eventDetail',
                    params: { eventId: String(featuredEvent.id) },
                  });
                }
              }}
              onToggleReaction={handleToggleReaction}
              onReactionPosted={handleConversion}
              commentDisabled
              connectDisabled
            />
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aún no hay momentos publicados</Text>
            <Text style={styles.emptyBody}>
              Cuando alguien suba el primer momento del evento lo verás aquí. Mientras tanto,
              explora eventos, tickets, transmisiones y clubes de fans.
            </Text>
            <View style={styles.emptyPreview}>
              <Text style={styles.previewLabel}>Vista previa</Text>
              <Text style={styles.previewBody}>
                Un “momento” es una foto o video corto del evento. Reaccionas con las opciones
                publicadas y conectas con quien lo subió.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Explorar más"
          style={styles.exploreBtn}
          onPress={handleExplore}
        >
          <Text style={styles.exploreBtnText}>Ver eventos</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#2563eb',
    textTransform: 'uppercase',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginTop: 6 },
  subtitle: { fontSize: 14, color: '#475569', marginTop: 6, lineHeight: 20 },
  scroll: { padding: 16, paddingBottom: 96 },
  center: { paddingVertical: 48, alignItems: 'center' },
  emptyCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  emptyBody: { fontSize: 14, color: '#475569', marginTop: 8, lineHeight: 20 },
  emptyPreview: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  previewBody: { marginTop: 6, fontSize: 14, color: '#0f172a', lineHeight: 20 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  exploreBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  exploreBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
