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
 *                             is detected by polling the moments feed for
 *                             a reaction authored by the current actor.
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { Events } from '../api/events';
import { EventMomentCard } from '../components/EventMomentCard';
import { buildMomentActor } from '../lib/eventMoments';
import {
  listMomentFeed,
  toggleMomentFeedReaction,
} from '../lib/eventMomentsRepository';
import { resolvePartyId } from '../lib/identity';
import { useAuth } from '../providers/AuthProvider';
import { useFirstRun } from '../providers/FirstRunProvider';
import { useUserSettings } from '../providers/UserSettingsProvider';
import type {
  EventMoment,
  EventMomentReactionKind,
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

const pickMostRecentEvent = (events: SocialEvent[] | undefined): SocialEvent | null => {
  if (!events?.length) return null;
  // Prefer the next upcoming event (the list is already upcomingOnly, so the
  // earliest start is the most relevant landing target).
  const sorted = [...events].sort(
    (a, b) => Date.parse(String(a.startTime)) - Date.parse(String(b.startTime)),
  );
  return sorted[0] ?? null;
};

export function NewUserOnboardingGate({ children }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isReady: experimentsReady, getVariant } = useExperiments();
  const { cohortReady, isNewUser } = useFirstRun();
  const { token, partyId: authPartyId } = useAuth();
  const { partyId: settingsPartyId, displayName } = useUserSettings();
  const { track } = useExperimentEvent();

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

  // Pull the next upcoming event so we can land the user directly on its
  // moments feed. Only fires when the gate actually engages.
  const eventsQuery = useQuery({
    queryKey: ['exp-single-feature-onboarding', 'events'],
    queryFn: () => Events.list({ upcomingOnly: true, limit: 5 }),
    enabled: gateEngaged,
  });

  const featuredEvent = useMemo(
    () => pickMostRecentEvent(eventsQuery.data),
    [eventsQuery.data],
  );

  const shouldPreferRemoteMoments = Boolean(token?.trim());
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
  });

  // Conversion detection: fire experiment_converted the first time a moment
  // in the feed contains a reaction authored by the current actor.
  const convertedRef = useRef(false);
  useEffect(() => {
    if (!gateEngaged || convertedRef.current) return;
    const moments = momentsQuery.data;
    if (!moments?.length) return;
    const actorKey = currentActor.actorKey;
    const hasOwnReaction = moments.some((moment: EventMoment) =>
      (Object.values(moment.reactions) as string[][]).some((list) =>
        Array.isArray(list) && list.includes(actorKey),
      ),
    );
    if (!hasOwnReaction) return;
    convertedRef.current = true;
    track('experiment_converted', {
      experimentId: EXPERIMENT_ID,
      variant: TREATMENT,
      userId: normalizedPartyId ?? undefined,
      metadata: { value: 1, surface: 'gate_moment_reaction' },
    });
  }, [gateEngaged, momentsQuery.data, currentActor.actorKey, normalizedPartyId, track]);

  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const handleChangeComment = useCallback((momentId: string, value: string) => {
    setCommentDrafts((prev) => ({ ...prev, [momentId]: value }));
  }, []);

  const handleToggleReaction = useCallback(
    async (momentId: string, reaction: EventMomentReactionKind) => {
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
    router.replace('/(tabs)/parties');
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
              commentDisabled
              connectDisabled
            />
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aún no hay momentos publicados</Text>
            <Text style={styles.emptyBody}>
              Cuando alguien suba el primer momento del evento lo verás aquí. Mientras tanto,
              explora la app para descubrir todo lo que puedes hacer.
            </Text>
            <View style={styles.emptyPreview}>
              <Text style={styles.previewLabel}>Vista previa</Text>
              <Text style={styles.previewBody}>
                Un “momento” es una foto o video corto del evento. Reaccionas con 🔥 ❤️ 👏 y
                conectas con quien lo subió.
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
          <Text style={styles.exploreBtnText}>Explore more</Text>
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
