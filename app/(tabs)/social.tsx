import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Parties } from '../../src/api/parties';
import { Social } from '../../src/api/social';
import type { PartyFollow } from '../../src/types';
import type { PartyDTO } from '../../src/api/types';
import { useAuth } from '../../src/providers/AuthProvider';
import { useUserSettings } from '../../src/providers/UserSettingsProvider';

type TabKey = 'friends' | 'following' | 'followers';

export default function SocialScreen() {
  const qc = useQueryClient();
  const { token, setToken } = useAuth();
  const { partyId, displayName } = useUserSettings();

  const [activeTab, setActiveTab] = useState<TabKey>('friends');
  const [addId, setAddId] = useState('');
  const [tokenInput, setTokenInput] = useState(token ?? '');

  useEffect(() => {
    setTokenInput(token ?? '');
  }, [token]);

  const partiesQuery = useQuery({
    queryKey: ['parties'],
    queryFn: Parties.list,
    enabled: Boolean(token)
  });

  const followersQuery = useQuery({
    queryKey: ['social-followers'],
    queryFn: Social.listFollowers,
    enabled: Boolean(token)
  });
  const followingQuery = useQuery({
    queryKey: ['social-following'],
    queryFn: Social.listFollowing,
    enabled: Boolean(token)
  });
  const friendsQuery = useQuery({
    queryKey: ['social-friends'],
    queryFn: Social.listFriends,
    enabled: Boolean(token)
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['social-followers'] });
    qc.invalidateQueries({ queryKey: ['social-following'] });
    qc.invalidateQueries({ queryKey: ['social-friends'] });
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const numeric = Number(addId.trim());
      if (!Number.isFinite(numeric) || numeric <= 0) throw new Error('Ingresa un ID válido.');
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
    mutationFn: (targetId: number) => Social.removeFriend(targetId),
    onSuccess: () => {
      invalidateAll();
      Alert.alert('Listo', 'Actualizamos tus conexiones.');
    },
    onError: () => {
      Alert.alert('Error', 'No pudimos actualizar tus conexiones.');
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

  const handleSaveToken = () => {
    setToken(tokenInput.trim() || null);
    Alert.alert('Listo', 'Actualizamos tu token de acceso.');
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.title}>Red social</Text>
        <Text style={styles.subtitle}>
          Administra seguidores, seguidos y amigos mutuos. Usa IDs para agregar contactos o intercambia vCards.
        </Text>
        <View style={styles.badges}>
          <Text style={styles.badge}>Party ID: {partyId ?? 'No configurado'}</Text>
          {!!displayName && <Text style={styles.badge}>Nombre: {displayName}</Text>}
        </View>
        <View style={styles.tokenRow}>
          <TextInput
            placeholder="Bearer token"
            value={tokenInput}
            onChangeText={setTokenInput}
            style={[styles.input, { flex: 1 }]}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.primaryButton} onPress={handleSaveToken}>
            <Text style={styles.primaryButtonText}>Guardar</Text>
          </TouchableOpacity>
        </View>
        {!token && <Text style={styles.helper}>Ingresa tu token para cargar tu red.</Text>}
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
            style={[styles.primaryButton, addMutation.isPending && styles.buttonDisabled]}
            onPress={() => addMutation.mutate()}
            disabled={addMutation.isPending}
          >
            <Text style={styles.primaryButtonText}>{addMutation.isPending ? 'Agregando…' : 'Agregar'}</Text>
          </TouchableOpacity>
        </View>
        {addMutation.error && (
          <Text style={styles.errorText}>{addMutation.error.message}</Text>
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

        {!token ? (
          <Text style={styles.helper}>Agrega tu token para ver tus conexiones.</Text>
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
              return (
                <View key={`${activeTab}-${row.pfFollowerId}-${row.pfFollowingId}`} style={styles.item}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{label}</Text>
                    <Text style={styles.itemMeta}>ID #{targetId} · Desde {row.pfStartedAt}</Text>
                    {row.pfViaNfc && <Text style={styles.tag}>Intercambio NFC</Text>}
                  </View>
                  {activeTab !== 'followers' && (
                    <TouchableOpacity
                      style={[styles.secondaryButton, removeMutation.isPending && styles.buttonDisabled]}
                      onPress={() => removeMutation.mutate(targetId)}
                      disabled={removeMutation.isPending}
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
  tokenRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10 },
  primaryButton: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
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
  buttonDisabled: { opacity: 0.6 },
  errorText: { color: '#dc2626', fontSize: 12 }
});
