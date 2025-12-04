import { useMemo, useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { Inventory, normalizeAssets } from '../../src/api/inventory';
import type {
  Asset,
  AssetCheckoutRequest,
  AssetCheckinRequest,
  AssetCreate
} from '../../src/types';

const TARGET_KINDS: AssetCheckoutRequest['coTargetKind'][] = ['party', 'room', 'session'];

function toStringId(value: Asset['assetId']): string {
  return typeof value === 'string' ? value : String(value);
}

export default function InventoryScreen() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<{ name: string; category: string; photoUrl: string }>({
    name: '',
    category: '',
    photoUrl: ''
  });
  const [checkoutAsset, setCheckoutAsset] = useState<Asset | null>(null);
  const [checkinAsset, setCheckinAsset] = useState<Asset | null>(null);
  const [checkoutForm, setCheckoutForm] = useState<AssetCheckoutRequest>({
    coTargetKind: 'party',
    coTargetParty: '',
    coTargetRoom: '',
    coTargetSession: '',
    coDueAt: '',
    coConditionOut: '',
    coNotes: ''
  });
  const [checkinForm, setCheckinForm] = useState<AssetCheckinRequest>({
    ciConditionIn: '',
    ciNotes: ''
  });

  const assetsQuery = useQuery({
    queryKey: ['inventory'],
    queryFn: () => Inventory.list().then(normalizeAssets)
  });

  const createMutation = useMutation({
    mutationFn: (body: AssetCreate) => Inventory.create(body),
    onSuccess: () => {
      setCreateForm({ name: '', category: '', photoUrl: '' });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setFeedback('Equipo agregado al inventario.');
    },
    onError: (err) =>
      setFeedback(err instanceof Error ? err.message : 'No se pudo crear el equipo. Intenta de nuevo.')
  });

  const checkoutMutation = useMutation({
    mutationFn: ({ assetId, payload }: { assetId: string; payload: AssetCheckoutRequest }) =>
      Inventory.checkout(assetId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setCheckoutAsset(null);
      setFeedback('Check-out registrado.');
    },
    onError: (err) =>
      setFeedback(err instanceof Error ? err.message : 'No se pudo registrar el check-out.')
  });

  const checkinMutation = useMutation({
    mutationFn: ({ assetId, payload }: { assetId: string; payload: AssetCheckinRequest }) =>
      Inventory.checkin(assetId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setCheckinAsset(null);
      setFeedback('Check-in registrado.');
    },
    onError: (err) =>
      setFeedback(err instanceof Error ? err.message : 'No se pudo registrar el check-in.')
  });

  const assets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return assets;
    return assets.filter((asset) => {
      const haystack = [
        asset.name,
        asset.category,
        asset.status,
        asset.brand ?? '',
        asset.model ?? '',
        asset.location ?? ''
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [assets, search]);

  const canCreate =
    createForm.name.trim().length > 1 && createForm.category.trim().length > 1 && !createMutation.isPending;

  const openCheckout = useCallback((asset: Asset) => {
    setCheckoutAsset(asset);
    setCheckoutForm({
      coTargetKind: 'party',
      coTargetParty: '',
      coTargetRoom: '',
      coTargetSession: '',
      coDueAt: '',
      coConditionOut: '',
      coNotes: ''
    });
  }, []);

  const openCheckin = useCallback((asset: Asset) => {
    setCheckinAsset(asset);
    setCheckinForm({ ciConditionIn: '', ciNotes: '' });
  }, []);

  const closeCheckout = useCallback(() => setCheckoutAsset(null), []);
  const closeCheckin = useCallback(() => setCheckinAsset(null), []);

  const submitCheckout = useCallback(() => {
    if (!checkoutAsset) return;
    const targetKind = checkoutForm.coTargetKind ?? 'party';
    if (targetKind === 'room' && !checkoutForm.coTargetRoom?.trim()) {
      setFeedback('Agrega la sala destino para el check-out.');
      return;
    }
    if (targetKind === 'session' && !checkoutForm.coTargetSession?.trim()) {
      setFeedback('Agrega la sesión destino para el check-out.');
      return;
    }
    const payload: AssetCheckoutRequest = {
      coTargetKind: targetKind,
      coTargetParty:
        targetKind === 'party' && checkoutForm.coTargetParty?.trim()
          ? checkoutForm.coTargetParty.trim()
          : undefined,
      coTargetRoom:
        targetKind === 'room' && checkoutForm.coTargetRoom?.trim()
          ? checkoutForm.coTargetRoom.trim()
          : undefined,
      coTargetSession:
        targetKind === 'session' && checkoutForm.coTargetSession?.trim()
          ? checkoutForm.coTargetSession.trim()
          : undefined,
      coDueAt: checkoutForm.coDueAt?.trim() || undefined,
      coConditionOut: checkoutForm.coConditionOut?.trim() || undefined,
      coNotes: checkoutForm.coNotes?.trim() || undefined
    };
    checkoutMutation.mutate({ assetId: toStringId(checkoutAsset.assetId), payload });
  }, [checkoutAsset, checkoutForm, checkoutMutation]);

  const submitCheckin = useCallback(() => {
    if (!checkinAsset) return;
    const payload: AssetCheckinRequest = {
      ciConditionIn: checkinForm.ciConditionIn?.trim() || undefined,
      ciNotes: checkinForm.ciNotes?.trim() || undefined
    };
    checkinMutation.mutate({ assetId: toStringId(checkinAsset.assetId), payload });
  }, [checkinAsset, checkinForm, checkinMutation]);

  const renderItem = useCallback(
    ({ item }: { item: Asset }) => {
      const isBooked = item.status?.toLowerCase() === 'booked';
      return (
        <View style={styles.card}>
          <View style={styles.assetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.assetTitle}>{item.name}</Text>
              <Text style={styles.muted}>{item.category}</Text>
            </View>
            <View style={[styles.badge, isBooked ? styles.badgeWarning : styles.badgeOk]}>
              <Text style={styles.badgeText}>{item.status}</Text>
            </View>
          </View>

          {item.photoUrl ? (
            <Image source={{ uri: item.photoUrl }} style={styles.assetImage} resizeMode="cover" />
          ) : null}

          <View style={styles.metaRow}>
            {item.brand ? <Text style={styles.meta}>Marca: {item.brand}</Text> : null}
            {item.model ? <Text style={styles.meta}>Modelo: {item.model}</Text> : null}
            {item.location ? <Text style={styles.meta}>Ubicación: {item.location}</Text> : null}
            {item.condition ? <Text style={styles.meta}>Condición: {item.condition}</Text> : null}
          </View>

          <View style={styles.actionsRow}>
            {!isBooked ? (
              <TouchableOpacity style={styles.primaryBtn} onPress={() => openCheckout(item)}>
                <Text style={styles.primaryBtnText}>Check-out</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryBtn, styles.dangerBtn]}
                onPress={() => openCheckin(item)}
              >
                <Text style={styles.primaryBtnText}>Registrar retorno</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.ghostBtn} onPress={() => setSearch(item.name)}>
              <Text style={styles.ghostBtnText}>Filtrar similares</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [openCheckout, openCheckin, setSearch]
  );

  return (
    <View style={styles.page}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => toStringId(item.assetId)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshing={assetsQuery.isFetching}
        onRefresh={() => assetsQuery.refetch()}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <Text style={styles.header}>Inventario</Text>
            <Text style={styles.subheader}>
              Mantén el inventario al día, asigna equipo con check-out y agrega fotos para identificarlo rápido.
            </Text>

            {feedback ? (
              <View style={styles.feedback}>
                <Text style={styles.feedbackText}>{feedback}</Text>
              </View>
            ) : null}
            {assetsQuery.isError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>No pudimos cargar el inventario.</Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Agregar equipo</Text>
              <TextInput
                placeholder="Nombre del equipo"
                value={createForm.name}
                onChangeText={(text) => setCreateForm((prev) => ({ ...prev, name: text }))}
                style={styles.input}
                autoCapitalize="sentences"
              />
              <TextInput
                placeholder="Categoría (ej. micrófono, interfaz…)"
                value={createForm.category}
                onChangeText={(text) => setCreateForm((prev) => ({ ...prev, category: text }))}
                style={styles.input}
              />
              <TextInput
                placeholder="URL de foto (opcional)"
                value={createForm.photoUrl}
                onChangeText={(text) => setCreateForm((prev) => ({ ...prev, photoUrl: text }))}
                style={styles.input}
                autoCapitalize="none"
              />
              {createForm.photoUrl.trim() ? (
                <View style={styles.previewBox}>
                  <Image
                    source={{ uri: createForm.photoUrl.trim() }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.primaryBtn, !canCreate && styles.primaryBtnDisabled]}
                onPress={() => {
                  const payload: AssetCreate = {
                    cName: createForm.name.trim(),
                    cCategory: createForm.category.trim(),
                    cPhotoUrl: createForm.photoUrl.trim() || undefined
                  };
                  createMutation.mutate(payload);
                }}
                disabled={!canCreate}
              >
                <Text style={styles.primaryBtnText}>
                  {createMutation.isPending ? 'Guardando…' : 'Añadir al inventario'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Equipo</Text>
              <TextInput
                placeholder="Buscar por nombre, categoría o estado…"
                value={search}
                onChangeText={setSearch}
                style={styles.input}
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
              />
              <View style={styles.metaRow}>
                <Text style={styles.muted}>{filtered.length} resultados</Text>
                <TouchableOpacity onPress={() => assetsQuery.refetch()}>
                  <Text style={[styles.muted, { fontWeight: '700' }]}>Actualizar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          assetsQuery.isLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator />
              <Text style={styles.muted}>Cargando inventario…</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.muted}>No hay equipo registrado aún.</Text>
            </View>
          )
        }
      />

      <Modal
        visible={!!checkoutAsset}
        animationType="slide"
        transparent
        onRequestClose={closeCheckout}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Check-out</Text>
            <Text style={styles.subheader}>
              {checkoutAsset ? checkoutAsset.name : ''} · {checkoutAsset?.category}
            </Text>

            <View style={styles.segmentRow}>
              {TARGET_KINDS.map((kind) => {
                const active = checkoutForm.coTargetKind === kind;
                return (
                  <TouchableOpacity
                    key={kind}
                    style={[styles.segment, active && styles.segmentActive]}
                    onPress={() =>
                      setCheckoutForm((prev) => ({
                        ...prev,
                        coTargetKind: kind,
                        coTargetParty: '',
                        coTargetRoom: '',
                        coTargetSession: ''
                      }))
                    }
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {kind === 'party' ? 'Cliente' : kind === 'room' ? 'Sala' : 'Sesión'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {checkoutForm.coTargetKind === 'party' ? (
              <TextInput
                placeholder="Cliente / banda"
                value={checkoutForm.coTargetParty ?? ''}
                onChangeText={(text) =>
                  setCheckoutForm((prev) => ({ ...prev, coTargetParty: text }))
                }
                style={styles.input}
              />
            ) : null}

            {checkoutForm.coTargetKind === 'room' ? (
              <TextInput
                placeholder="ID de sala"
                value={checkoutForm.coTargetRoom ?? ''}
                onChangeText={(text) => setCheckoutForm((prev) => ({ ...prev, coTargetRoom: text }))}
                style={styles.input}
                autoCapitalize="none"
              />
            ) : null}

            {checkoutForm.coTargetKind === 'session' ? (
              <TextInput
                placeholder="ID de sesión"
                value={checkoutForm.coTargetSession ?? ''}
                onChangeText={(text) =>
                  setCheckoutForm((prev) => ({ ...prev, coTargetSession: text }))
                }
                style={styles.input}
                autoCapitalize="none"
              />
            ) : null}

            <TextInput
              placeholder="Fecha límite (ISO opcional)"
              value={checkoutForm.coDueAt ?? ''}
              onChangeText={(text) => setCheckoutForm((prev) => ({ ...prev, coDueAt: text }))}
              style={styles.input}
              autoCapitalize="none"
            />
            <TextInput
              placeholder="Condición de salida"
              value={checkoutForm.coConditionOut ?? ''}
              onChangeText={(text) =>
                setCheckoutForm((prev) => ({ ...prev, coConditionOut: text }))
              }
              style={styles.input}
            />
            <TextInput
              placeholder="Notas"
              value={checkoutForm.coNotes ?? ''}
              onChangeText={(text) => setCheckoutForm((prev) => ({ ...prev, coNotes: text }))}
              style={[styles.input, { height: 80 }]}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.ghostBtn} onPress={closeCheckout}>
                <Text style={styles.ghostBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, styles.primaryBtnCompact]}
                onPress={submitCheckout}
                disabled={checkoutMutation.isPending}
              >
                <Text style={styles.primaryBtnText}>
                  {checkoutMutation.isPending ? 'Guardando…' : 'Confirmar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!checkinAsset}
        animationType="slide"
        transparent
        onRequestClose={closeCheckin}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Check-in</Text>
            <Text style={styles.subheader}>{checkinAsset ? checkinAsset.name : ''}</Text>

            <TextInput
              placeholder="Condición de retorno"
              value={checkinForm.ciConditionIn ?? ''}
              onChangeText={(text) =>
                setCheckinForm((prev) => ({ ...prev, ciConditionIn: text }))
              }
              style={styles.input}
            />
            <TextInput
              placeholder="Notas"
              value={checkinForm.ciNotes ?? ''}
              onChangeText={(text) => setCheckinForm((prev) => ({ ...prev, ciNotes: text }))}
              style={[styles.input, { height: 80 }]}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.ghostBtn} onPress={closeCheckin}>
                <Text style={styles.ghostBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, styles.primaryBtnCompact]}
                onPress={submitCheckin}
                disabled={checkinMutation.isPending}
              >
                <Text style={styles.primaryBtnText}>
                  {checkinMutation.isPending ? 'Guardando…' : 'Registrar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f8fafc' },
  listContent: { padding: 16, gap: 12, paddingBottom: 32 },
  header: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  subheader: { color: '#475569', lineHeight: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  previewBox: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    overflow: 'hidden',
    height: 140
  },
  previewImage: { width: '100%', height: '100%' },
  assetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  assetTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  muted: { color: '#64748b' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  meta: { color: '#475569', fontSize: 13 },
  actionsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  primaryBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1
  },
  primaryBtnCompact: { flex: 0 },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  ghostBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc'
  },
  ghostBtnText: { color: '#0f172a', fontWeight: '600' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  badgeOk: { backgroundColor: '#ecfeff', borderColor: '#a5f3fc' },
  badgeWarning: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  badgeText: { fontWeight: '700', color: '#0f172a' },
  assetImage: { width: '100%', height: 160, borderRadius: 10 },
  empty: { alignItems: 'center', padding: 20, gap: 8 },
  feedback: {
    backgroundColor: '#ecfeff',
    borderColor: '#a5f3fc',
    borderWidth: 1,
    padding: 12,
    borderRadius: 10
  },
  feedbackText: { color: '#0f172a' },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecdd3',
    borderWidth: 1,
    padding: 12,
    borderRadius: 10
  },
  errorText: { color: '#b91c1c', fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 10
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center'
  },
  segmentActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  segmentText: { color: '#0f172a', fontWeight: '600' },
  segmentTextActive: { color: '#fff' },
  dangerBtn: { backgroundColor: '#dc2626' }
});
