import { useMemo, useState } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Parties } from '../../src/api/parties';
import { Social } from '../../src/api/social';
import type { PartyFollow } from '../../src/types';
import type { PartyDTO } from '../../src/api/types';
import { resolvePartyId } from '../../src/lib/identity';
import { useAuth } from '../../src/providers/AuthProvider';
import { useUserSettings } from '../../src/providers/UserSettingsProvider';

type TabKey = 'friends' | 'following' | 'followers';

const parsePositivePartyId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export default function SocialScreen() {
  const qc = useQueryClient();
  const { token, partyId: authPartyId, loading } = useAuth();
  const { partyId: settingsPartyId, displayName } = useUserSettings();

  const [activeTab, setActiveTab] = useState<TabKey>('friends');
  const [addId, setAddId] = useState('');
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
  const friendsQuery = useQuery({
    queryKey: ['social-friends'],
    queryFn: Social.listFriends,
    enabled: canUseSocial
  });
  const suggestionsQuery = useQuery({
    queryKey: ['social-suggestions'],
    queryFn: Social.listSuggestions,
    enabled: canUseSocial
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['social-followers'] });
    qc.invalidateQueries({ queryKey: ['social-following'] });
    qc.invalidateQueries({ queryKey: ['social-friends'] });
    qc.invalidateQueries({ queryKey: ['social-suggestions'] });
  };

  const addMutation = useMutation<void, Error, number | undefined>({
    mutationFn: async (targetId) => {
      if (!canUseSocial) throw new Error('Inicia sesión para actualizar tu red.');
      const numeric = parsePositivePartyId(targetId) ?? parsePositivePartyId(addId);
      if (numeric === null) throw new Error('Ingresa un ID válido.');
      await Social.addFriend(numeric);
    },
    onSuccess: () => {
      setAddId('');
      invalidateAll();
      Alert.alert('Listo', 'Agregaste a esta persona como amigo.');
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'No pudimos agregar a esta persona.';
      Alert.alert('Error', msg);
    }
  });

  const removeMutation = useMutation({
    mutationFn: (targetId: number) => {
      if (!canUseSocial) {
        throw new Error('Inicia sesión para actualizar tu red.');
      }
      return Social.removeFriend(targetId);
    },
    onSuccess: () => {
      invalidateAll();
      Alert.alert('Listo', 'Actualizamos tus conexiones.');
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
    friends: { data: friendsQuery.data, empty: 'Aún no tienes amigos mutuos.' },
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
        <Text style={styles.title}>Red social</Text>
        <Text style={styles.subtitle}>
          Administra seguidores, seguidos y amigos mutuos. Usa IDs para agregar contactos o intercambia vCards.
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
        <Text style={styles.sectionTitle}>Agregar amigo</Text>
        <View style={styles.row}>
          <TextInput
            placeholder="ID de contacto"
            value={addId}
            onChangeText={setAddId}
            style={[styles.input, { flex: 1 }]}
            keyboardType="number-pad"
          />
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!canUseSocial || addMutation.isPending) && styles.buttonDisabled
            ]}
            onPress={() => addMutation.mutate(undefined)}
            disabled={!canUseSocial || addMutation.isPending}
          >
            <Text style={styles.primaryButtonText}>{addMutation.isPending ? 'Agregando…' : 'Agregar'}</Text>
          </TouchableOpacity>
        </View>
        {!canUseSocial && !loading && (
          <Text style={styles.helper}>Inicia sesión para agregar o editar conexiones.</Text>
        )}
        {addMutation.error && (
          <Text style={styles.errorText}>{addMutation.error.message}</Text>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Sugerencias de amigos</Text>
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              (!canUseSocial || suggestionsQuery.isFetching) && styles.buttonDisabled
            ]}
            onPress={() => suggestionsQuery.refetch()}
            disabled={!canUseSocial || suggestionsQuery.isFetching}
          >
            <Text style={styles.secondaryButtonText}>{suggestionsQuery.isFetching ? 'Actualizando…' : 'Actualizar'}</Text>
          </TouchableOpacity>
        </View>
        {!canUseSocial ? (
          loading ? (
            <Text style={styles.helper}>Cargando acceso…</Text>
          ) : (
          <Text style={styles.helper}>Acceso restringido para ver sugerencias.</Text>
          )
        ) : suggestionsQuery.isError ? (
          <Text style={styles.errorText}>No pudimos cargar sugerencias.</Text>
        ) : suggestionsQuery.isLoading ? (
          <Text style={styles.helper}>Buscando conexiones…</Text>
        ) : (suggestionsQuery.data?.length ?? 0) === 0 ? (
          <Text style={styles.helper}>No tenemos sugerencias todavía. Conecta con más personas y vuelve a intentar.</Text>
        ) : (
          <View style={styles.list}>
            {suggestionsQuery.data?.map((suggestion) => {
              const label = formatParty(suggestion.sfPartyId);
              return (
                <View key={`suggestion-${suggestion.sfPartyId}`} style={styles.item}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{label}</Text>
                    <Text style={styles.itemMeta}>ID #{suggestion.sfPartyId}</Text>
                    <Text style={styles.tag}>{`${suggestion.sfMutualCount} conexión${suggestion.sfMutualCount === 1 ? '' : 'es'} en común`}</Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      { paddingHorizontal: 12, paddingVertical: 10 },
                      (!canUseSocial || addMutation.isPending) && styles.buttonDisabled
                    ]}
                    onPress={() => addMutation.mutate(suggestion.sfPartyId)}
                    disabled={!canUseSocial || addMutation.isPending}
                  >
                    <Text style={styles.primaryButtonText}>Conectar</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
            onPress={() => setActiveTab('friends')}
          >
            <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
              Amigos ({friendsQuery.data?.length ?? 0})
            </Text>
          </TouchableOpacity>
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
        ) : (followersQuery.isLoading || followingQuery.isLoading || friendsQuery.isLoading || partiesQuery.isLoading) ? (
          <Text style={styles.helper}>Cargando red social…</Text>
        ) : activeData.length === 0 ? (
          <Text style={styles.helper}>{tabData[activeTab].empty}</Text>
        ) : (
          <View style={styles.list}>
            {activeData.map((row) => {
              const targetId = activeTab === 'followers' ? row.pfFollowerId : row.pfFollowingId;
              const label = formatParty(targetId);
              const isFriend = friendsQuery.data?.some((f) => f.pfFollowingId === targetId) ?? false;
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
                          (!canUseSocial || addMutation.isPending) && styles.buttonDisabled
                        ]}
                        onPress={() => addMutation.mutate(targetId)}
                        disabled={!canUseSocial || addMutation.isPending}
                      >
                        <Text style={styles.primaryButtonText}>Seguir</Text>
                      </TouchableOpacity>
                    )
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.secondaryButton,
                        (!canUseSocial || removeMutation.isPending) && styles.buttonDisabled
                      ]}
                      onPress={() => removeMutation.mutate(targetId)}
                      disabled={!canUseSocial || removeMutation.isPending}
                    >
                      <Text style={styles.secondaryButtonText}>{isFriend ? 'Eliminar amigo' : 'Dejar de seguir'}</Text>
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
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10 },
  primaryButton: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
