import { useMemo, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Parties } from '../../src/api/parties';
import { Social } from '../../src/api/social';
import type { PartyFollow } from '../../src/types';
import type { PartyDTO } from '../../src/api/types';
import { resolvePartyId } from '../../src/lib/identity';
import { useAuth } from '../../src/providers/AuthProvider';
import { useUserSettings } from '../../src/providers/UserSettingsProvider';

type TabKey = 'following' | 'followers';

const isPositivePartyId = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;

export default function SocialScreen() {
  const qc = useQueryClient();
  const { token, partyId: authPartyId, loading } = useAuth();
  const { partyId: settingsPartyId, displayName } = useUserSettings();

  const [activeTab, setActiveTab] = useState<TabKey>('following');
  const hasToken = Boolean(token?.trim());
  const canUseSocial = !loading && hasToken;
  const effectivePartyId = resolvePartyId(authPartyId, settingsPartyId);

  const partiesQuery = useQuery({
    queryKey: ['parties'],
    queryFn: () => Parties.list(),
    enabled: canUseSocial
  });

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
    onSuccess: () => {
      invalidateAll();
      Alert.alert('Listo', 'Ahora sigues a esta persona.');
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'No pudimos seguir a esta persona.';
      Alert.alert('Error', msg);
    }
  });

  const unfollowMutation = useMutation<void, Error, number>({
    mutationFn: (targetId: number) => {
      if (!canUseSocial) {
        throw new Error('Inicia sesión para actualizar tu red.');
      }
      if (!isPositivePartyId(targetId)) throw new Error('No pudimos reconocer ese perfil.');
      return Social.removeFriend(targetId);
    },
    onSuccess: () => {
      invalidateAll();
      Alert.alert('Listo', 'Dejaste de seguir a esta persona.');
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'No pudimos actualizar tus conexiones.';
      Alert.alert('Error', msg);
    }
  });

  const byId = useMemo(() => {
    const map = new Map<number, PartyDTO>();
    (partiesQuery.data ?? []).forEach((p) => map.set(p.partyId, p));
    return map;
  }, [partiesQuery.data]);

  const tabData: Record<TabKey, { data?: PartyFollow[]; empty: string }> = {
    following: { data: followingQuery.data, empty: 'No sigues a nadie todavía.' },
    followers: { data: followersQuery.data, empty: 'Aún no tienes seguidores.' },
  };

  const activeData = tabData[activeTab].data ?? [];

  const formatParty = (partyId: number) => {
    const party = byId.get(partyId);
    if (!party) return `Party #${partyId}`;
    return party.displayName ?? party.legalName ?? `Party #${partyId}`;
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.title}>Seguir</Text>
        <Text style={styles.subtitle}>
          Consulta a quién sigues y quién te sigue. Para seguir artistas, entra a un evento o perfil de artista y toca Seguir.
        </Text>
        <View style={styles.badges}>
          <Text style={styles.badge}>Party ID: {effectivePartyId ?? 'No configurado'}</Text>
          {!!displayName && <Text style={styles.badge}>Nombre: {displayName}</Text>}
        </View>
        {loading ? (
          <Text style={styles.helper}>Cargando acceso…</Text>
        ) : !hasToken ? (
          <Text style={styles.helper}>Acceso restringido. Solicita permisos para cargar tu red.</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'following' && styles.tabActive]}
            onPress={() => setActiveTab('following')}
          >
            <Text style={[styles.tabText, activeTab === 'following' && styles.tabTextActive]}>
              Siguiendo ({followingQuery.data?.length ?? 0})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'followers' && styles.tabActive]}
            onPress={() => setActiveTab('followers')}
          >
            <Text style={[styles.tabText, activeTab === 'followers' && styles.tabTextActive]}>
              Seguidores ({followersQuery.data?.length ?? 0})
            </Text>
          </TouchableOpacity>
        </View>

        {!canUseSocial ? (
          <Text style={styles.helper}>
            {loading ? 'Cargando acceso…' : 'Acceso restringido para ver tus conexiones.'}
          </Text>
        ) : (followersQuery.isLoading || followingQuery.isLoading || partiesQuery.isLoading) ? (
          <Text style={styles.helper}>Cargando conexiones…</Text>
        ) : activeData.length === 0 ? (
          <Text style={styles.helper}>{tabData[activeTab].empty}</Text>
        ) : (
          <View style={styles.list}>
            {activeData.map((row) => {
              const targetId = activeTab === 'followers' ? row.pfFollowerId : row.pfFollowingId;
              const label = formatParty(targetId);
              const isFollowing = followingQuery.data?.some((f) => f.pfFollowingId === targetId) ?? false;
              return (
                <View key={`${activeTab}-${row.pfFollowerId}-${row.pfFollowingId}`} style={styles.item}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{label}</Text>
                    <Text style={styles.itemMeta}>ID #{targetId} · Desde {row.pfStartedAt}</Text>
                    {row.pfViaNfc && <Text style={styles.tag}>Intercambio NFC</Text>}
                  </View>
                  {activeTab === 'followers' ? (
                    isFollowing ? (
                      <View style={styles.followingBadge}>
                        <Text style={styles.followingBadgeText}>Ya lo sigues</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.primaryButton,
                          { paddingHorizontal: 12, paddingVertical: 10 },
                          (!canUseSocial || followMutation.isPending) && styles.buttonDisabled
                        ]}
                        onPress={() => followMutation.mutate(targetId)}
                        disabled={!canUseSocial || followMutation.isPending}
                      >
                        <Text style={styles.primaryButtonText}>Seguir</Text>
                      </TouchableOpacity>
                    )
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.secondaryButton,
                        (!canUseSocial || unfollowMutation.isPending) && styles.buttonDisabled
                      ]}
                      onPress={() => unfollowMutation.mutate(targetId)}
                      disabled={!canUseSocial || unfollowMutation.isPending}
                    >
                      <Text style={styles.secondaryButtonText}>Dejar de seguir</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e5e7eb', gap: 10 },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  subtitle: { color: '#4b5563', lineHeight: 20 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { backgroundColor: '#eef2ff', color: '#1e3a8a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, fontWeight: '700' },
  helper: { color: '#6b7280', fontSize: 13 },
  primaryButton: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  tabs: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' },
  tab: { flex: 1, paddingVertical: 10, backgroundColor: '#f9fafb' },
  tabActive: { backgroundColor: '#e0f2fe' },
  tabText: { textAlign: 'center', color: '#374151', fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#0ea5e9' },
  list: { gap: 10, marginTop: 10 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', padding: 12, borderRadius: 10 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  itemMeta: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  tag: { color: '#2563eb', fontSize: 12, marginTop: 4, fontWeight: '700' },
  secondaryButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f3f4f6' },
  secondaryButtonText: { color: '#1f2937', fontWeight: '700', fontSize: 12 },
  followingBadge: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: '#dcfce7' },
  followingBadgeText: { color: '#166534', fontWeight: '700', fontSize: 12 },
  buttonDisabled: { opacity: 0.6 },
  errorText: { color: '#dc2626', fontSize: 12 }
});
