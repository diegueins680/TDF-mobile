import { useMemo, useState, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AccessibilityInfo,
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  findNodeHandle,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Inventory, normalizeAssets } from '../../src/api/inventory';
import type {
  Asset,
  AssetCheckoutRequest,
  AssetCheckinRequest,
  AssetCreate,
  AssetUpdate
} from '../../src/types';
import { useAuth } from '../../src/providers/AuthProvider';
import { uploadImage } from '../../src/api/upload';
import { useAppTheme } from '../../src/theme/ThemeProvider';

const TARGET_KINDS: AssetCheckoutRequest['coTargetKind'][] = ['party', 'room', 'session'];
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'Active', label: 'Disponible' },
  { value: 'Booked', label: 'En uso' },
  { value: 'OutForMaintenance', label: 'En mantenimiento' },
  { value: 'Retired', label: 'Retirado' }
];

function toStringId(value: Asset['assetId']): string {
  return typeof value === 'string' ? value : String(value);
}

export default function InventoryScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const themedInputProps = useMemo(
    () => ({
      placeholderTextColor: colors.textSecondary,
      selectionColor: colors.actionPrimary,
    }),
    [colors],
  );
  const qc = useQueryClient();
  const { token, loading } = useAuth();
  const [localImage, setLocalImage] = useState<{ uri: string; mime?: string; name?: string } | null>(
    null
  );
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<{ name: string; category: string; photoUrl: string }>({
    name: '',
    category: '',
    photoUrl: ''
  });
  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    category: string;
    status: string;
    location: string;
    photoUrl: string;
  }>({
    name: '',
    category: '',
    status: 'Active',
    location: '',
    photoUrl: ''
  });
  const [editLocalImage, setEditLocalImage] = useState<{
    uri: string;
    mime?: string;
    name?: string;
  } | null>(null);
  const [editUploading, setEditUploading] = useState(false);
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
  const editHeadingRef = useRef<Text>(null);
  const checkoutHeadingRef = useRef<Text>(null);
  const checkinHeadingRef = useRef<Text>(null);
  const hasToken = Boolean(token?.trim());
  const canUseInventory = !loading && hasToken;

  const focusModalHeading = useCallback((heading: Text | null) => {
    const handle = findNodeHandle(heading);
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
  }, []);

  const assetsQuery = useQuery({
    queryKey: ['inventory'],
    queryFn: () => Inventory.list().then(normalizeAssets),
    enabled: canUseInventory
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

  const updateMutation = useMutation({
    mutationFn: ({ assetId, payload }: { assetId: string; payload: AssetUpdate }) =>
      Inventory.update(assetId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setEditAsset(null);
      setEditLocalImage(null);
      setFeedback('Equipo actualizado.');
    },
    onError: (err) =>
      setFeedback(err instanceof Error ? err.message : 'No se pudo actualizar el equipo.')
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
    canUseInventory &&
    createForm.name.trim().length > 1 &&
    createForm.category.trim().length > 1 &&
    !createMutation.isPending &&
    !uploading;

  const openCheckout = useCallback((asset: Asset) => {
    if (!canUseInventory) {
      setFeedback('Inicia sesión para administrar el inventario.');
      return;
    }
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
  }, [canUseInventory]);

  const openCheckin = useCallback((asset: Asset) => {
    if (!canUseInventory) {
      setFeedback('Inicia sesión para administrar el inventario.');
      return;
    }
    setCheckinAsset(asset);
    setCheckinForm({ ciConditionIn: '', ciNotes: '' });
  }, [canUseInventory]);

  const openEdit = useCallback((asset: Asset) => {
    if (!canUseInventory) {
      setFeedback('Inicia sesión para administrar el inventario.');
      return;
    }
    setEditAsset(asset);
    setEditLocalImage(null);
    setEditForm({
      name: asset.name,
      category: asset.category,
      status: asset.status || 'Active',
      location: asset.location ?? '',
      photoUrl: asset.photoUrl ?? ''
    });
  }, [canUseInventory]);

  const closeCheckout = useCallback(() => setCheckoutAsset(null), []);
  const closeCheckin = useCallback(() => setCheckinAsset(null), []);
  const closeEdit = useCallback(() => {
    setEditAsset(null);
    setEditLocalImage(null);
    setEditForm({ name: '', category: '', status: 'Active', location: '', photoUrl: '' });
  }, []);

  const submitCheckout = useCallback(() => {
    if (!canUseInventory) {
      setFeedback('Inicia sesión para registrar check-outs.');
      return;
    }
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
    Alert.alert(
      'Registrar salida',
      '¿Confirmar la salida de este equipo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: () => checkoutMutation.mutate({ assetId: toStringId(checkoutAsset.assetId), payload }),
        },
      ],
    );
  }, [canUseInventory, checkoutAsset, checkoutForm, checkoutMutation]);

  const submitCheckin = useCallback(() => {
    if (!canUseInventory) {
      setFeedback('Inicia sesión para registrar check-ins.');
      return;
    }
    if (!checkinAsset) return;
    const payload: AssetCheckinRequest = {
      ciConditionIn: checkinForm.ciConditionIn?.trim() || undefined,
      ciNotes: checkinForm.ciNotes?.trim() || undefined
    };
    checkinMutation.mutate({ assetId: toStringId(checkinAsset.assetId), payload });
  }, [canUseInventory, checkinAsset, checkinForm, checkinMutation]);

  const submitEdit = useCallback(async () => {
    if (!canUseInventory) {
      setFeedback('Inicia sesión para actualizar el inventario.');
      return;
    }
    if (!editAsset || updateMutation.isPending || editUploading) return;
    let photoUrl: string | undefined = editForm.photoUrl.trim() || undefined;

    if (editLocalImage) {
      try {
        setEditUploading(true);
        const uploaded = await uploadImage({
          uri: editLocalImage.uri,
          mimeType: editLocalImage.mime,
          fileName: editLocalImage.name
        });
        photoUrl = uploaded;
        setEditForm((prev) => ({ ...prev, photoUrl: uploaded }));
      } catch (err) {
        setFeedback(err instanceof Error ? err.message : 'No se pudo subir la foto.');
        return;
      } finally {
        setEditUploading(false);
      }
    }

    const trimmedName = editForm.name.trim();
    const trimmedCategory = editForm.category.trim();
    const trimmedStatus = editForm.status?.trim() || undefined;
    const trimmedLocation = editForm.location.trim();

    const payload: AssetUpdate = {
      uName: trimmedName && trimmedName !== editAsset.name ? trimmedName : undefined,
      uCategory:
        trimmedCategory && trimmedCategory !== editAsset.category ? trimmedCategory : undefined,
      uStatus: trimmedStatus && trimmedStatus !== editAsset.status ? trimmedStatus : undefined,
      uLocationId:
        trimmedLocation && trimmedLocation !== (editAsset.location ?? '')
          ? trimmedLocation
          : undefined,
      uPhotoUrl:
        photoUrl && photoUrl !== (editAsset.photoUrl ?? undefined) ? photoUrl : undefined
    };
    const hasUpdates = Object.values(payload).some((value) => value !== undefined);
    if (!hasUpdates) {
      setFeedback('Actualiza un campo antes de guardar.');
      return;
    }
    updateMutation.mutate({ assetId: toStringId(editAsset.assetId), payload });
  }, [canUseInventory, editAsset, editForm, editLocalImage, editUploading, updateMutation]);

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
            <Image
              source={{ uri: item.photoUrl }}
              style={styles.assetImage}
              resizeMode="cover"
              accessibilityLabel={`Foto de ${item.name}`}
            />
          ) : null}

          <View style={styles.metaRow}>
            {item.brand ? <Text style={styles.meta}>Marca: {item.brand}</Text> : null}
            {item.model ? <Text style={styles.meta}>Modelo: {item.model}</Text> : null}
            {item.location ? <Text style={styles.meta}>Ubicación: {item.location}</Text> : null}
            {item.condition ? <Text style={styles.meta}>Condición: {item.condition}</Text> : null}
          </View>

          <View style={styles.actionsRow}>
            {!isBooked ? (
              <TouchableOpacity
                style={[styles.primaryBtn, !canUseInventory && styles.primaryBtnDisabled]}
                onPress={() => openCheckout(item)}
                disabled={!canUseInventory}
                accessibilityRole="button"
                accessibilityLabel={`Registrar check-out de ${item.name}`}
                accessibilityState={{ disabled: !canUseInventory }}
              >
                <Text style={styles.primaryBtnText}>Check-out</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryBtn, styles.dangerBtn, !canUseInventory && styles.primaryBtnDisabled]}
                onPress={() => openCheckin(item)}
                disabled={!canUseInventory}
                accessibilityRole="button"
                accessibilityLabel={`Registrar retorno de ${item.name}`}
                accessibilityState={{ disabled: !canUseInventory }}
              >
                <Text style={[styles.primaryBtnText, styles.dangerBtnText]}>Registrar retorno</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={[styles.actionsRow, styles.secondaryActions]}>
            <TouchableOpacity
              style={[styles.ghostBtn, styles.secondaryActionBtn]}
              onPress={() => setSearch(item.name)}
              accessibilityRole="button"
              accessibilityLabel={`Filtrar equipo similar a ${item.name}`}
            >
              <Text style={styles.ghostBtnText}>Filtrar similares</Text>
            </TouchableOpacity>
            {canUseInventory ? (
              <TouchableOpacity
                style={[styles.ghostBtn, styles.secondaryActionBtn]}
                onPress={() => openEdit(item)}
                accessibilityRole="button"
                accessibilityLabel={`Editar ${item.name}`}
              >
                <Text style={styles.ghostBtnText}>Editar</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      );
    },
    [canUseInventory, openCheckout, openCheckin, openEdit, setSearch, styles]
  );

  const selectImage = useCallback(async (mode: 'camera' | 'library') => {
    if (mode === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Activa el permiso de cámara para tomar fotos.');
        return null;
      }
    }
    const result =
      mode === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8
          });
    if (result.canceled) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, mime: asset.mimeType ?? 'image/jpeg', name: asset.fileName };
  }, []);

  const pickCreateImage = useCallback(
    async (mode: 'camera' | 'library') => {
      const selected = await selectImage(mode);
      if (!selected) return;
      setLocalImage(selected);
      setCreateForm((prev) => ({ ...prev, photoUrl: '' }));
    },
    [selectImage]
  );

  const pickEditImage = useCallback(
    async (mode: 'camera' | 'library') => {
      const selected = await selectImage(mode);
      if (!selected) return;
      setEditLocalImage(selected);
      setEditForm((prev) => ({ ...prev, photoUrl: '' }));
    },
    [selectImage]
  );

  const submitCreate = useCallback(async () => {
    if (!canUseInventory) {
      setFeedback('Inicia sesión para agregar equipo.');
      return;
    }
    let photoUrl: string | undefined = createForm.photoUrl.trim() || undefined;
    if (localImage) {
      try {
        setUploading(true);
        const uploaded = await uploadImage({
          uri: localImage.uri,
          mimeType: localImage.mime,
          fileName: localImage.name
        });
        photoUrl = uploaded;
        setCreateForm((prev) => ({ ...prev, photoUrl: uploaded }));
      } catch (err) {
        setFeedback(err instanceof Error ? err.message : 'No se pudo subir la foto.');
        setUploading(false);
        return;
      } finally {
        setUploading(false);
      }
    }
    const payload: AssetCreate = {
      cName: createForm.name.trim(),
      cCategory: createForm.category.trim(),
      cPhotoUrl: photoUrl
    };
    createMutation.mutate(payload);
  }, [canUseInventory, createForm, createMutation, localImage]);

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => toStringId(item.assetId)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshing={canUseInventory && assetsQuery.isFetching}
        onRefresh={() => {
          if (canUseInventory) {
            void assetsQuery.refetch();
          }
        }}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <Text style={styles.header}>Inventario</Text>
            <Text style={styles.subheader}>
              Mantén el inventario al día, asigna equipo con check-out y agrega fotos para identificarlo rápido.
            </Text>
            {loading ? (
              <View style={styles.authHint}>
                <Text style={styles.authHintText}>Cargando acceso…</Text>
              </View>
            ) : !hasToken ? (
              <View style={styles.authHint}>
                <Text style={styles.authHintText}>Acceso restringido para cargar inventario.</Text>
              </View>
            ) : null}

            {feedback ? (
              <View style={styles.feedback}>
                <Text style={styles.feedbackText} accessibilityLiveRegion="polite">
                  {feedback}
                </Text>
              </View>
            ) : null}
            {assetsQuery.isError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText} accessibilityRole="alert">
                  {canUseInventory ? 'No pudimos cargar el inventario.' : 'Acceso restringido para cargar inventario.'}
                </Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Agregar equipo</Text>
              {!canUseInventory && !loading ? (
                <Text style={styles.helperText}>Inicia sesión antes de crear o editar equipos.</Text>
              ) : null}
              <TextInput
                {...themedInputProps}
                placeholder="Nombre del equipo"
                accessibilityLabel="Nombre del equipo"
                value={createForm.name}
                onChangeText={(text) => setCreateForm((prev) => ({ ...prev, name: text }))}
                style={styles.input}
                autoCapitalize="sentences"
              />
              <TextInput
                {...themedInputProps}
                placeholder="Categoría (ej. micrófono, interfaz…)"
                accessibilityLabel="Categoría del equipo"
                value={createForm.category}
                onChangeText={(text) => setCreateForm((prev) => ({ ...prev, category: text }))}
                style={styles.input}
              />
              <TextInput
                {...themedInputProps}
                placeholder="URL de foto (opcional)"
                accessibilityLabel="URL de la foto"
                accessibilityHint="Campo opcional."
                value={createForm.photoUrl}
                onChangeText={(text) => setCreateForm((prev) => ({ ...prev, photoUrl: text }))}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              {createForm.photoUrl.trim() || localImage ? (
                <View style={styles.previewBox}>
                  <Image
                    source={{ uri: localImage?.uri ?? createForm.photoUrl.trim() }}
                    style={styles.previewImage}
                    resizeMode="cover"
                    accessibilityLabel="Vista previa de la foto del equipo"
                  />
                  <View style={styles.previewActions}>
                    {localImage ? (
                      <TouchableOpacity
                        style={styles.ghostBtn}
                        onPress={() => {
                          setLocalImage(null);
                          setCreateForm((prev) => ({ ...prev, photoUrl: '' }));
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Quitar foto seleccionada"
                      >
                        <Text style={styles.ghostBtnText}>Quitar foto</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ) : null}
              <View style={styles.metaRow}>
                <TouchableOpacity
                  style={[styles.ghostBtn, !canUseInventory && styles.primaryBtnDisabled]}
                  onPress={() => pickCreateImage('camera')}
                  disabled={!canUseInventory}
                  accessibilityRole="button"
                  accessibilityLabel="Tomar foto del equipo"
                  accessibilityState={{ disabled: !canUseInventory }}
                >
                  <Text style={styles.ghostBtnText}>Tomar foto</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.ghostBtn, !canUseInventory && styles.primaryBtnDisabled]}
                  onPress={() => pickCreateImage('library')}
                  disabled={!canUseInventory}
                  accessibilityRole="button"
                  accessibilityLabel="Elegir foto del equipo desde la galería"
                  accessibilityState={{ disabled: !canUseInventory }}
                >
                  <Text style={styles.ghostBtnText}>Desde galería</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.primaryBtn, !canCreate && styles.primaryBtnDisabled]}
                onPress={() => {
                  void submitCreate();
                }}
                disabled={!canCreate}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: !canCreate,
                  busy: createMutation.isPending || uploading,
                }}
              >
                <Text style={styles.primaryBtnText}>
                  {createMutation.isPending ? 'Guardando…' : 'Añadir al inventario'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Equipo</Text>
              <TextInput
                {...themedInputProps}
                placeholder="Buscar por nombre, categoría o estado…"
                accessibilityLabel="Buscar en el inventario"
                value={search}
                onChangeText={setSearch}
                style={styles.input}
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
              />
              <View style={styles.metaRow}>
                <Text style={styles.muted}>{filtered.length} resultados</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (canUseInventory) {
                      void assetsQuery.refetch();
                    }
                  }}
                  disabled={!canUseInventory}
                  accessibilityRole="button"
                  accessibilityLabel="Actualizar inventario"
                  accessibilityState={{ disabled: !canUseInventory }}
                >
                  <Text style={[styles.muted, { fontWeight: '700' }]}>Actualizar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.actionPrimary} />
              <Text style={styles.muted}>Cargando acceso…</Text>
            </View>
          ) : assetsQuery.isLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.actionPrimary} />
              <Text style={styles.muted}>Cargando inventario…</Text>
            </View>
          ) : !canUseInventory ? (
            <View style={styles.empty}>
              <Text style={styles.muted}>Inicia sesión para consultar y administrar inventario.</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.muted}>No hay equipo registrado aún.</Text>
            </View>
          )
        }
      />

      <Modal
        visible={!!editAsset}
        animationType="slide"
        transparent
        onRequestClose={closeEdit}
        onShow={() => focusModalHeading(editHeadingRef.current)}
        accessibilityViewIsModal
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalCard}
            keyboardShouldPersistTaps="handled"
          >
            <Text ref={editHeadingRef} style={styles.sectionTitle} accessibilityRole="header">
              Editar equipo
            </Text>
            <Text style={styles.subheader}>
              {editAsset ? editAsset.name : ''} · {editAsset?.category}
            </Text>
            <Text style={styles.helperText}>
              Solo los usuarios con permisos de inventario pueden guardar cambios.
            </Text>

            <TextInput
                {...themedInputProps}
              placeholder="Nombre"
              accessibilityLabel="Nombre del equipo"
              value={editForm.name}
              onChangeText={(text) => setEditForm((prev) => ({ ...prev, name: text }))}
              style={styles.input}
              autoCapitalize="sentences"
            />
            <TextInput
                {...themedInputProps}
              placeholder="Categoría"
              accessibilityLabel="Categoría del equipo"
              value={editForm.category}
              onChangeText={(text) => setEditForm((prev) => ({ ...prev, category: text }))}
              style={styles.input}
            />
            <Text style={styles.label}>Estado</Text>
            <View
              style={[styles.segmentRow, styles.segmentWrap]}
              accessibilityRole="radiogroup"
              accessibilityLabel="Estado del equipo"
            >
              {STATUS_OPTIONS.map((opt) => {
                const active = editForm.status === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.segment, styles.segmentTight, active && styles.segmentActive]}
                    onPress={() => setEditForm((prev) => ({ ...prev, status: opt.value }))}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
                {...themedInputProps}
              placeholder="Ubicación (ID de sala opcional)"
              accessibilityLabel="Ubicación"
              accessibilityHint="ID de sala opcional."
              value={editForm.location}
              onChangeText={(text) => setEditForm((prev) => ({ ...prev, location: text }))}
              style={styles.input}
              autoCapitalize="none"
            />
            <TextInput
                {...themedInputProps}
              placeholder="URL de foto (opcional)"
              accessibilityLabel="URL de la foto"
              accessibilityHint="Campo opcional."
              value={editForm.photoUrl}
              onChangeText={(text) => setEditForm((prev) => ({ ...prev, photoUrl: text }))}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            {editForm.photoUrl.trim() || editLocalImage ? (
              <View style={styles.previewBox}>
                <Image
                  source={{ uri: editLocalImage?.uri ?? editForm.photoUrl.trim() }}
                  style={styles.previewImage}
                  resizeMode="cover"
                  accessibilityLabel="Vista previa de la foto actualizada del equipo"
                />
                <View style={styles.previewActions}>
                  {editLocalImage ? (
                    <TouchableOpacity
                      style={styles.ghostBtn}
                      onPress={() => setEditLocalImage(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Quitar foto seleccionada"
                    >
                      <Text style={styles.ghostBtnText}>Quitar foto</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View style={styles.metaRow}>
              <TouchableOpacity
                style={styles.ghostBtn}
                onPress={() => pickEditImage('camera')}
                accessibilityRole="button"
                accessibilityLabel="Tomar foto del equipo"
              >
                <Text style={styles.ghostBtnText}>Tomar foto</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ghostBtn}
                onPress={() => pickEditImage('library')}
                accessibilityRole="button"
                accessibilityLabel="Elegir foto del equipo desde la galería"
              >
                <Text style={styles.ghostBtnText}>Desde galería</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.ghostBtn}
                onPress={closeEdit}
                accessibilityRole="button"
                accessibilityLabel="Cancelar edición"
              >
                <Text style={styles.ghostBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, styles.primaryBtnCompact]}
                onPress={() => {
                  void submitEdit();
                }}
                disabled={updateMutation.isPending || editUploading}
                accessibilityRole="button"
                accessibilityLabel="Actualizar equipo"
                accessibilityState={{
                  disabled: updateMutation.isPending || editUploading,
                  busy: updateMutation.isPending || editUploading,
                }}
              >
                <Text style={styles.primaryBtnText}>
                  {updateMutation.isPending || editUploading ? 'Guardando…' : 'Actualizar'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={!!checkoutAsset}
        animationType="slide"
        transparent
        onRequestClose={closeCheckout}
        onShow={() => focusModalHeading(checkoutHeadingRef.current)}
        accessibilityViewIsModal
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalCard}
            keyboardShouldPersistTaps="handled"
          >
            <Text ref={checkoutHeadingRef} style={styles.sectionTitle} accessibilityRole="header">
              Check-out
            </Text>
            <Text style={styles.subheader}>
              {checkoutAsset ? checkoutAsset.name : ''} · {checkoutAsset?.category}
            </Text>

            <View
              style={styles.segmentRow}
              accessibilityRole="radiogroup"
              accessibilityLabel="Destino del préstamo"
            >
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
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
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
                {...themedInputProps}
                placeholder="Cliente / banda"
                accessibilityLabel="Cliente o banda"
                value={checkoutForm.coTargetParty ?? ''}
                onChangeText={(text) =>
                  setCheckoutForm((prev) => ({ ...prev, coTargetParty: text }))
                }
                style={styles.input}
              />
            ) : null}

            {checkoutForm.coTargetKind === 'room' ? (
              <TextInput
                {...themedInputProps}
                placeholder="ID de sala"
                accessibilityLabel="ID de sala"
                value={checkoutForm.coTargetRoom ?? ''}
                onChangeText={(text) => setCheckoutForm((prev) => ({ ...prev, coTargetRoom: text }))}
                style={styles.input}
                autoCapitalize="none"
              />
            ) : null}

            {checkoutForm.coTargetKind === 'session' ? (
              <TextInput
                {...themedInputProps}
                placeholder="ID de sesión"
                accessibilityLabel="ID de sesión"
                value={checkoutForm.coTargetSession ?? ''}
                onChangeText={(text) =>
                  setCheckoutForm((prev) => ({ ...prev, coTargetSession: text }))
                }
                style={styles.input}
                autoCapitalize="none"
              />
            ) : null}

            <TextInput
                {...themedInputProps}
              placeholder="Fecha límite (ISO opcional)"
              accessibilityLabel="Fecha límite"
              accessibilityHint="Campo opcional en formato ISO."
              value={checkoutForm.coDueAt ?? ''}
              onChangeText={(text) => setCheckoutForm((prev) => ({ ...prev, coDueAt: text }))}
              style={styles.input}
              autoCapitalize="none"
            />
            <TextInput
                {...themedInputProps}
              placeholder="Condición de salida"
              accessibilityLabel="Condición de salida"
              value={checkoutForm.coConditionOut ?? ''}
              onChangeText={(text) =>
                setCheckoutForm((prev) => ({ ...prev, coConditionOut: text }))
              }
              style={styles.input}
            />
            <TextInput
                {...themedInputProps}
              placeholder="Notas"
              accessibilityLabel="Notas del préstamo"
              value={checkoutForm.coNotes ?? ''}
              onChangeText={(text) => setCheckoutForm((prev) => ({ ...prev, coNotes: text }))}
              style={[styles.input, { height: 80 }]}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.ghostBtn}
                onPress={closeCheckout}
                accessibilityRole="button"
                accessibilityLabel="Cancelar check-out"
              >
                <Text style={styles.ghostBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, styles.primaryBtnCompact]}
                onPress={submitCheckout}
                disabled={checkoutMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel="Confirmar check-out"
                accessibilityState={{
                  disabled: checkoutMutation.isPending,
                  busy: checkoutMutation.isPending,
                }}
              >
                <Text style={styles.primaryBtnText}>
                  {checkoutMutation.isPending ? 'Guardando…' : 'Confirmar'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={!!checkinAsset}
        animationType="slide"
        transparent
        onRequestClose={closeCheckin}
        onShow={() => focusModalHeading(checkinHeadingRef.current)}
        accessibilityViewIsModal
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalCard}
            keyboardShouldPersistTaps="handled"
          >
            <Text ref={checkinHeadingRef} style={styles.sectionTitle} accessibilityRole="header">
              Check-in
            </Text>
            <Text style={styles.subheader}>{checkinAsset ? checkinAsset.name : ''}</Text>

            <TextInput
                {...themedInputProps}
              placeholder="Condición de retorno"
              accessibilityLabel="Condición de retorno"
              value={checkinForm.ciConditionIn ?? ''}
              onChangeText={(text) =>
                setCheckinForm((prev) => ({ ...prev, ciConditionIn: text }))
              }
              style={styles.input}
            />
            <TextInput
                {...themedInputProps}
              placeholder="Notas"
              accessibilityLabel="Notas del retorno"
              value={checkinForm.ciNotes ?? ''}
              onChangeText={(text) => setCheckinForm((prev) => ({ ...prev, ciNotes: text }))}
              style={[styles.input, { height: 80 }]}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.ghostBtn}
                onPress={closeCheckin}
                accessibilityRole="button"
                accessibilityLabel="Cancelar check-in"
              >
                <Text style={styles.ghostBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, styles.primaryBtnCompact]}
                onPress={submitCheckin}
                disabled={checkinMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel="Registrar check-in"
                accessibilityState={{
                  disabled: checkinMutation.isPending,
                  busy: checkinMutation.isPending,
                }}
              >
                <Text style={styles.primaryBtnText}>
                  {checkinMutation.isPending ? 'Guardando…' : 'Registrar'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 32,
    gap: 12,
  },
  header: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
  subheader: { color: colors.textSecondary, lineHeight: 20 },
  helperText: { color: colors.textSecondary, lineHeight: 18 },
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 10
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  label: { color: colors.textPrimary, fontWeight: '700' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surfaceRaised,
    color: colors.textPrimary,
  },
  previewBox: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 10,
    overflow: 'hidden',
    height: 140
  },
  previewImage: { width: '100%', height: '100%' },
  assetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  assetTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  muted: { color: colors.textSecondary },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  meta: { color: colors.textSecondary, fontSize: 13 },
  actionsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  secondaryActions: { justifyContent: 'flex-start' },
  secondaryActionBtn: { flex: 1 },
  primaryBtn: {
    minHeight: 44,
    backgroundColor: colors.actionPrimary,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1
  },
  primaryBtnCompact: { flex: 0 },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: colors.actionPrimaryContrast, fontWeight: '700' },
  ghostBtn: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  ghostBtnText: { color: colors.textPrimary, fontWeight: '600' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  badgeOk: { backgroundColor: colors.infoSurface, borderColor: colors.infoBorder },
  badgeWarning: { backgroundColor: colors.warningSurface, borderColor: colors.warningBorder },
  badgeText: { fontWeight: '700', color: colors.textPrimary },
  assetImage: { width: '100%', height: 160, borderRadius: 10 },
  previewActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
  empty: { alignItems: 'center', padding: 20, gap: 8 },
  feedback: {
    backgroundColor: colors.infoSurface,
    borderColor: colors.infoBorder,
    borderWidth: 1,
    padding: 12,
    borderRadius: 10
  },
  feedbackText: { color: colors.textPrimary },
  errorBox: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    padding: 12,
    borderRadius: 10
  },
  errorText: { color: colors.danger, fontWeight: '600' },
  authHint: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.infoSurface,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10
  },
  authHintText: { color: colors.textPrimary, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end'
  },
  modalCard: {
    backgroundColor: colors.surfaceRaised,
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 10
  },
  modalScroll: {
    maxHeight: '92%',
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentWrap: { flexWrap: 'wrap' },
  segmentTight: { minWidth: '45%' },
  segmentActive: { backgroundColor: colors.actionPrimary, borderColor: colors.actionPrimary },
  segmentText: { color: colors.textPrimary, fontWeight: '600' },
  segmentTextActive: { color: colors.actionPrimaryContrast },
  dangerBtn: { backgroundColor: colors.dangerAction },
  dangerBtnText: { color: colors.dangerActionContrast },
});
