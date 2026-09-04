import { useState } from 'react';
import { ActivityIndicator, FlatList, View, Text, TouchableOpacity, StyleSheet, Alert, RefreshControl } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { Social } from '../../src/api/social';
import { Artists } from '../../src/api/artists';
import type { ArtistProfile, PartyFollow } from '../../src/types';
import { resolvePartyId } from '../../src/lib/identity';
import { useAuth } from '../../src/providers/AuthProvider';
import { useAnalytics } from '../../src/analytics/AnalyticsProvider';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import { useUserSettings } from '../../src/providers/UserSettingsProvider';
import { impactMedium } from '../../src/utils/haptics';
import { markFirstValueCompleted } from '../../src/lib/onboardingIntent';
import { markNewUserOnboardingCompleted } from '../../src/lib/firstRunFlags';

type TabKey = 'following' | 'followers';

const isPositivePartyId = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;

export default function SocialScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { colors } = useAppTheme();
  const analytics = useAnalytics();
  const { token, partyId: authPartyId, loading } = useAuth();
  const { partyId: settingsPartyId, displayName, locale } = useUserSettings();
  const english = locale.startsWith('en');

  const [activeTab, setActiveTab] = useState<TabKey>('following');
  const [refreshing, setRefreshing] = useState(false);
  const hasToken = Boolean(token?.trim());
  const canUseSocial = !loading && hasToken;
  const effectivePartyId = resolvePartyId(authPartyId, settingsPartyId);

  const followersQuery = useQuery({
    queryKey: ['social-followers'],
    queryFn: Social.listFollowers,
    enabled: canUseSocial
  });
  const followingQuery = useQuery({
    queryKey: ['social-following'],
    queryFn: Social.listFollowing,
    enabled: canUseSocial
  });
  const artistCandidatesQuery = useQuery({
    queryKey: ['onboarding', 'artist-candidates'],
    queryFn: () => Artists.list({ limit: 3 }),
    enabled: canUseSocial,
    retry: 1,
  });
  const [followedArtistIds, setFollowedArtistIds] = useState<Set<string>>(new Set());

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        followersQuery.refetch(),
        followingQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['social-followers'] });
    qc.invalidateQueries({ queryKey: ['social-following'] });
  };

  const followMutation = useMutation<void, Error, number>({
    mutationFn: async (targetId) => {
      if (!canUseSocial) throw new Error('Inicia sesión para actualizar tu red.');
      if (!isPositivePartyId(targetId)) throw new Error('No pudimos reconocer ese perfil.');
      await Social.addFriend(targetId);
    },
    onSuccess: async (_data, targetId) => {
      invalidateAll();
      void impactMedium();
      analytics.capture('artist_followed', { platform: 'mobile', target_party_id: targetId });
      if (await markFirstValueCompleted(effectivePartyId, 'artist_followed')) {
        analytics.capture('first_value_completed', { platform: 'mobile', value: 'artist_followed' });
        analytics.capture('onboarding_completed', { platform: 'mobile', reason: 'first_value', value: 'artist_followed' });
        if (effectivePartyId) await markNewUserOnboardingCompleted(effectivePartyId);
      }
      Alert.alert('Listo', 'Ahora sigues a esta persona.');
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'No pudimos seguir a esta persona.';
      Alert.alert('Error', msg);
    }
  });

  const artistFollowMutation = useMutation<void, Error, ArtistProfile>({
    mutationFn: async (artist) => {
      if (!effectivePartyId) throw new Error(english ? 'Sign in to follow an artist.' : 'Inicia sesión para seguir a un artista.');
      await Artists.follow(artist.id, effectivePartyId);
    },
    onSuccess: async (_data, artist) => {
      setFollowedArtistIds((current) => new Set(current).add(String(artist.id)));
      void impactMedium();
      analytics.capture('artist_followed', { platform: 'mobile', artist_id: String(artist.id) });
      if (await markFirstValueCompleted(effectivePartyId, 'artist_followed')) {
        analytics.capture('first_value_completed', { platform: 'mobile', value: 'artist_followed' });
        analytics.capture('onboarding_completed', { platform: 'mobile', reason: 'first_value', value: 'artist_followed' });
        if (effectivePartyId) await markNewUserOnboardingCompleted(effectivePartyId);
      }
    },
    onError: (error) => Alert.alert(
      english ? 'Could not follow artist' : 'No pudimos seguir al artista',
      error instanceof Error ? error.message : (english ? 'Try again.' : 'Intenta de nuevo.'),
    ),
  });

  const unfollowMutation = useMutation<void, Error, number>({
    mutationFn: (targetId: number) => {
      if (!canUseSocial) {
        throw new Error('Inicia sesión para actualizar tu red.');
      }
      if (!isPositivePartyId(targetId)) throw new Error('No pudimos reconocer ese perfil.');
      return Social.removeFriend(targetId);
    },
    onSuccess: (_data, targetId) => {
      invalidateAll();
      void impactMedium();
      analytics.capture('artist_unfollowed', { platform: 'mobile', target_party_id: targetId });
      Alert.alert('Listo', 'Dejaste de seguir a esta persona.');
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'No pudimos actualizar tus conexiones.';
      Alert.alert('Error', msg);
    }
  });

  const tabData: Record<TabKey, { data?: PartyFollow[]; empty: string }> = {
    following: { data: followingQuery.data, empty: 'No sigues a nadie todavía.' },
    followers: { data: followersQuery.data, empty: 'Aún no tienes seguidores.' },
  };

  const activeData = tabData[activeTab].data ?? [];

  const renderItem = ({ item }: { item: PartyFollow }) => {
    const targetId = activeTab === 'followers' ? item.pfFollowerId : item.pfFollowingId;
    const label = (activeTab === 'followers' ? item.pfFollowerName : item.pfFollowingName)
      ?? 'Perfil no disponible';
    const isFollowing = followingQuery.data?.some((f) => f.pfFollowingId === targetId) ?? false;
    return (
      <View style={[styles.item, { borderColor: colors.borderSubtle }]} accessibilityRole="summary" accessibilityLabel={label}>
        <View style={{ flex: 1 }}>
          <Text maxFontSizeMultiplier={1.5} style={[styles.itemTitle, { color: colors.textPrimary }]}>{label}</Text>
          <Text maxFontSizeMultiplier={1.5} style={[styles.itemMeta, { color: colors.textSecondary }]}>Desde {item.pfStartedAt}</Text>
          {item.pfViaNfc && <Text maxFontSizeMultiplier={1.5} style={[styles.tag, { color: colors.actionPrimary }]}>Intercambio NFC</Text>}
        </View>
        {activeTab === 'followers' ? (
          isFollowing ? (
            <View style={[styles.followingBadge, { backgroundColor: colors.success }]} accessibilityRole="text" accessibilityLabel="Ya lo sigues">
              <Text maxFontSizeMultiplier={1.5} style={[styles.followingBadgeText, { color: colors.success }]}>{'Ya lo sigues'}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: colors.actionPrimary, paddingHorizontal: 12, paddingVertical: 10 },
                (!canUseSocial || followMutation.isPending) && styles.buttonDisabled
              ]}
              onPress={() => followMutation.mutate(targetId)}
              disabled={!canUseSocial || followMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel={`Seguir a ${label}`}
              accessibilityState={{ busy: followMutation.isPending, disabled: !canUseSocial || followMutation.isPending }}
            >
              {followMutation.isPending ? (
                <ActivityIndicator color={colors.actionPrimaryContrast} />
              ) : (
                <Text maxFontSizeMultiplier={1.5} style={[styles.primaryButtonText, { color: colors.actionPrimaryContrast }]}>Seguir</Text>
              )}
            </TouchableOpacity>
          )
        ) : (
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              { backgroundColor: colors.surfaceMuted },
              (!canUseSocial || unfollowMutation.isPending) && styles.buttonDisabled
            ]}
            onPress={() => {
              Alert.alert(
                'Dejar de seguir',
                `¿Dejar de seguir a ${label}?`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Dejar de seguir', style: 'destructive', onPress: () => unfollowMutation.mutate(targetId) },
                ],
              );
            }}
            disabled={!canUseSocial || unfollowMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel={`Dejar de seguir a ${label}`}
            accessibilityState={{ busy: unfollowMutation.isPending, disabled: !canUseSocial || unfollowMutation.isPending }}
          >
            {unfollowMutation.isPending ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text maxFontSizeMultiplier={1.5} style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>Dejar de seguir</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const showList = canUseSocial && !followersQuery.isLoading && !followingQuery.isLoading && activeData.length > 0;

  return (
    <FlatList
      data={showList ? activeData : []}
      keyExtractor={(item) => `${activeTab}-${item.pfFollowerId}-${item.pfFollowingId}`}
      renderItem={renderItem}
      contentContainerStyle={styles.wrap}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.actionPrimary} colors={[colors.actionPrimary]} />
      }
      ListHeaderComponent={
        <>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <Text maxFontSizeMultiplier={1.5} style={[styles.title, { color: colors.textPrimary }]} accessibilityRole="header">Seguir</Text>
            <Text maxFontSizeMultiplier={1.5} style={[styles.subtitle, { color: colors.textSecondary }]}>
              Consulta a quién sigues y quién te sigue. Para seguir artistas, entra a un evento o perfil de artista y toca Seguir.
            </Text>
            <View style={styles.badges}>
              <Text maxFontSizeMultiplier={1.5} style={[styles.badge, { backgroundColor: colors.surfaceMuted, color: colors.actionPrimary }]}>{effectivePartyId ? 'Cuenta vinculada' : 'Inicia sesión'}</Text>
              {!!displayName && <Text maxFontSizeMultiplier={1.5} style={[styles.badge, { backgroundColor: colors.surfaceMuted, color: colors.actionPrimary }]}>Nombre: {displayName}</Text>}
            </View>
            {loading ? (
              <Text maxFontSizeMultiplier={1.5} style={[styles.helper, { color: colors.textSecondary }]} accessibilityLiveRegion="polite">Cargando acceso…</Text>
            ) : !hasToken ? (
              <Text maxFontSizeMultiplier={1.5} style={[styles.helper, { color: colors.textSecondary }]} accessibilityLiveRegion="polite">Acceso restringido. Solicita permisos para cargar tu red.</Text>
            ) : null}
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <Text maxFontSizeMultiplier={1.5} style={[styles.sectionTitle, { color: colors.textPrimary }]} accessibilityRole="header">
              {english ? 'Start by following an artist' : 'Empieza siguiendo a un artista'}
            </Text>
            <Text maxFontSizeMultiplier={1.5} style={[styles.subtitle, { color: colors.textSecondary }]}>
              {english ? 'Choose one now, or save an upcoming event instead.' : 'Elige uno ahora o guarda un próximo evento.'}
            </Text>
            {artistCandidatesQuery.isLoading ? (
              <Text style={[styles.helper, { color: colors.textSecondary }]} accessibilityLiveRegion="polite">
                {english ? 'Loading artists…' : 'Cargando artistas…'}
              </Text>
            ) : (artistCandidatesQuery.isError || (artistCandidatesQuery.data?.length ?? 0) === 0) ? (
              <Text style={[styles.helper, { color: colors.textSecondary }]} accessibilityRole="alert">
                {english ? 'Artists are unavailable right now. You can still save an event.' : 'Los artistas no están disponibles ahora. Aún puedes guardar un evento.'}
              </Text>
            ) : (
              artistCandidatesQuery.data?.map((artist) => {
                const followed = followedArtistIds.has(String(artist.id));
                return (
                  <View key={String(artist.id)} style={[styles.discoveryRow, { borderColor: colors.borderSubtle }]}>
                    <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{artist.name}</Text>
                    <TouchableOpacity
                      style={[styles.primaryButton, { backgroundColor: colors.actionPrimary }, followed && styles.buttonDisabled]}
                      onPress={() => artistFollowMutation.mutate(artist)}
                      disabled={followed || artistFollowMutation.isPending}
                      accessibilityRole="button"
                      accessibilityLabel={`${english ? 'Follow' : 'Seguir a'} ${artist.name}`}
                      accessibilityState={{ disabled: followed || artistFollowMutation.isPending, busy: artistFollowMutation.isPending }}
                    >
                      <Text style={[styles.primaryButtonText, { color: colors.actionPrimaryContrast }]}>
                        {followed ? (english ? 'Following' : 'Siguiendo') : (english ? 'Follow' : 'Seguir')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
            <TouchableOpacity
              style={[styles.secondaryButton, styles.eventFallbackButton, { backgroundColor: colors.surfaceMuted }]}
              onPress={() => router.push('/(tabs)/events')}
              accessibilityRole="button"
            >
              <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
                {english ? 'View upcoming events' : 'Ver próximos eventos'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <View style={[styles.tabs, { borderColor: colors.borderSubtle }]}>
              <TouchableOpacity
                style={[styles.tab, { backgroundColor: colors.canvas }, activeTab === 'following' && [styles.tabActive, { backgroundColor: colors.selected }]]}
                onPress={() => setActiveTab('following')}
                accessibilityRole="tab"
                accessibilityLabel={`Siguiendo, ${followingQuery.data?.length ?? 0} conexiones`}
                accessibilityState={{ selected: activeTab === 'following' }}
              >
                <Text maxFontSizeMultiplier={1.5} style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'following' && [styles.tabTextActive, { color: colors.actionPrimary }]]}>
                  Siguiendo ({followingQuery.data?.length ?? 0})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, { backgroundColor: colors.canvas }, activeTab === 'followers' && [styles.tabActive, { backgroundColor: colors.selected }]]}
                onPress={() => setActiveTab('followers')}
                accessibilityRole="tab"
                accessibilityLabel={`Seguidores, ${followersQuery.data?.length ?? 0} conexiones`}
                accessibilityState={{ selected: activeTab === 'followers' }}
              >
                <Text maxFontSizeMultiplier={1.5} style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'followers' && [styles.tabTextActive, { color: colors.actionPrimary }]]}>
                  Seguidores ({followersQuery.data?.length ?? 0})
                </Text>
              </TouchableOpacity>
            </View>

            {!showList ? (
              !canUseSocial ? (
                <Text maxFontSizeMultiplier={1.5} style={[styles.helper, { color: colors.textSecondary }]} accessibilityLiveRegion="polite">
                  {loading ? 'Cargando acceso…' : 'Acceso restringido para ver tus conexiones.'}
                </Text>
              ) : (followersQuery.isLoading || followingQuery.isLoading) ? (
                <Text maxFontSizeMultiplier={1.5} style={[styles.helper, { color: colors.textSecondary }]} accessibilityLiveRegion="polite">Cargando conexiones…</Text>
              ) : activeData.length === 0 ? (
                <Text maxFontSizeMultiplier={1.5} style={[styles.helper, { color: colors.textSecondary }]} accessibilityLiveRegion="polite">{tabData[activeTab].empty}</Text>
              ) : null
            ) : null}
          </View>
        </>
      }
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  title: { fontSize: 20, fontWeight: '800' },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  subtitle: { lineHeight: 20 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, fontWeight: '700' },
  helper: { fontSize: 13 },
  primaryButton: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontWeight: '700' },
  tabs: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 1 },
  tab: { flex: 1, paddingVertical: 10 },
  tabActive: {},
  tabText: { textAlign: 'center', fontWeight: '700', fontSize: 13 },
  tabTextActive: {},
  list: { gap: 10, marginTop: 10 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, padding: 12, borderRadius: 10 },
  itemTitle: { fontSize: 15, fontWeight: '700' },
  itemMeta: { fontSize: 12, marginTop: 2 },
  tag: { fontSize: 12, marginTop: 4, fontWeight: '700' },
  secondaryButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  eventFallbackButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  discoveryRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 1, borderRadius: 10, padding: 10 },
  secondaryButtonText: { fontWeight: '700', fontSize: 12 },
  followingBadge: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  followingBadgeText: { fontWeight: '700', fontSize: 12 },
  buttonDisabled: { opacity: 0.6 },
  errorText: { fontSize: 12 }
});
