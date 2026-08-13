import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Catalogs, type CatalogDraft, type CatalogRevision } from '../src/api/catalogs';
import {
  buildCatalogAdminDraft,
  catalogAdminFormIsValid,
  catalogEditorKind,
  emptyCatalogAdminForm,
  formFromCatalogItem,
  type CatalogAdminForm,
} from '../src/lib/catalogAdmin';
import { useUserSettings } from '../src/providers/UserSettingsProvider';
import { useAppTheme } from '../src/theme/ThemeProvider';

const PAGE_SIZE = 50;

const firstParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] ?? '' : value ?? '';

export default function CatalogEditorScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ catalogCode?: string | string[] }>();
  const catalogCode = firstParam(params.catalogCode).trim();
  const { locale } = useUserSettings();
  const { colors } = useAppTheme();
  const english = locale.toLocaleLowerCase().startsWith('en');
  const t = (es: string, en: string) => english ? en : es;
  const [search, setSearch] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [form, setForm] = useState<CatalogAdminForm | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const definitionsQuery = useQuery({
    queryKey: ['catalog-admin', 'definitions', locale],
    queryFn: () => Catalogs.listDefinitions(locale),
    enabled: Boolean(catalogCode),
  });
  const definition = definitionsQuery.data?.find((candidate) => candidate.code === catalogCode);
  const editorKind = catalogEditorKind(definition?.entityKind ?? '');
  const itemsQuery = useQuery({
    queryKey: ['catalog-admin', catalogCode, 'items', locale, search, pageNumber],
    queryFn: () => Catalogs.listItems(catalogCode, {
      locale,
      q: search.trim() || undefined,
      page: pageNumber,
      pageSize: PAGE_SIZE,
      includeInactive: true,
    }),
    enabled: Boolean(catalogCode && definition),
  });
  const revisionsQuery = useQuery<CatalogRevision[]>({
    queryKey: ['catalog-admin', catalogCode, 'revisions'],
    queryFn: () => Catalogs.listRevisions(catalogCode, 1, 100),
    enabled: Boolean(catalogCode && definition),
  });
  const radioPolicyQuery = useQuery({
    queryKey: ['catalog-admin', catalogCode, 'radio-policy', locale],
    queryFn: () => Catalogs.listRadioAutoStopOptions(locale),
    enabled: editorKind === 'radio-auto-stop',
  });

  const itemById = useMemo(
    () => new Map((itemsQuery.data?.items ?? []).map((item) => [item.id, item])),
    [itemsQuery.data?.items],
  );
  const defaultScopeKind = (() => {
    switch (editorKind) {
      case 'appearance-mode': return 'appearance-mode';
      case 'radio-auto-stop': return 'radio-broadcast';
      case 'feedback-category': return 'feedback-category';
      case 'feedback-severity': return 'feedback-severity';
      default: return '';
    }
  })();
  const defaultId = itemsQuery.data?.defaults.find(
    (entry) => entry.scopeKind === defaultScopeKind && entry.scopeId === 'global' && !entry.localeId,
  )?.entityId;
  const radioOptionById = useMemo(
    () => new Map((radioPolicyQuery.data?.options ?? []).map((option) => [option.id, option])),
    [radioPolicyQuery.data?.options],
  );

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['catalog-admin', catalogCode] }),
      queryClient.invalidateQueries({ queryKey: ['catalog-admin', 'definitions'] }),
    ]);
  };
  const mutationError = (error: Error) => Alert.alert(t('No se pudo completar', 'Could not complete'), error.message);
  const createRevision = useMutation({
    mutationFn: (draft: CatalogDraft) => Catalogs.createRevision(catalogCode, draft),
    onSuccess: async () => {
      setForm(null);
      await refresh();
      Alert.alert(t('Borrador creado', 'Draft created'), t('El cambio aún no está publicado.', 'The change is not published yet.'));
    },
    onError: mutationError,
  });
  const submitRevision = useMutation({
    mutationFn: Catalogs.submitRevision,
    onSuccess: refresh,
    onError: mutationError,
  });
  const approveRevision = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => Catalogs.approveRevision(id, {
      notes: notes.trim(),
      emergencyOverride: false,
    }),
    onSuccess: refresh,
    onError: mutationError,
  });
  const rejectRevision = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => Catalogs.rejectRevision(id, {
      notes: notes.trim(),
      emergencyOverride: false,
    }),
    onSuccess: refresh,
    onError: mutationError,
  });

  const openItem = (itemId: string) => {
    const item = itemById.get(itemId);
    if (!item) return;
    setForm(formFromCatalogItem(
      item,
      item.id === defaultId,
      radioOptionById.get(item.id)?.durationMinutes,
    ));
  };
  const openCreate = () => {
    const next = emptyCatalogAdminForm();
    next.sortOrder = String((itemsQuery.data?.total ?? 0) * 10);
    setForm(next);
  };
  const saveDraft = () => {
    if (!form || !catalogAdminFormIsValid(editorKind, form)) return;
    createRevision.mutate(buildCatalogAdminDraft(editorKind, form));
  };

  const queryError = definitionsQuery.error ?? itemsQuery.error ?? revisionsQuery.error ?? radioPolicyQuery.error;
  const queryFailed = Boolean(queryError);
  const hasNextPage = Boolean(itemsQuery.data && pageNumber * PAGE_SIZE < itemsQuery.data.total);
  const editingPublishedDefault = Boolean(form?.entityId && form.entityId === defaultId);
  const actionsPending = createRevision.isPending
    || submitRevision.isPending
    || approveRevision.isPending
    || rejectRevision.isPending;

  const workflowLabel = (state: string) => {
    switch (state) {
      case 'draft': return t('Borrador', 'Draft');
      case 'review': return t('En revisión', 'In review');
      case 'approved': return t('Aprobada', 'Approved');
      case 'published': return t('Publicada', 'Published');
      case 'rejected': return t('Rechazada', 'Rejected');
      default: return state;
    }
  };

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: colors.canvas }]}>
      <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('Volver', 'Go back')}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary }]}>
            {definition?.name ?? t('Catálogo', 'Catalog')}
          </Text>
          <Text numberOfLines={1} style={[styles.subtitle, { color: colors.textSecondary }]}>{catalogCode}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {definitionsQuery.isLoading ? (
          <ActivityIndicator size="large" color={colors.actionPrimary} />
        ) : !catalogCode || (!definition && !definitionsQuery.isError) ? (
          <Notice text={t('El catálogo solicitado no existe o no está activo.', 'The requested catalog does not exist or is inactive.')} danger />
        ) : queryFailed ? (
          <Notice
            text={queryError instanceof Error ? queryError.message : t('No se pudo cargar el catálogo.', 'The catalog could not be loaded.')}
            danger
          />
        ) : (
          <>
            {editorKind === 'read-only' ? (
              <Notice text={t(
                'Este tipo se muestra en modo consulta hasta disponer de un editor móvil con esquema especializado.',
                'This type remains read-only until a specialized mobile editor is available.',
              )} />
            ) : (
              <Notice text={t(
                'Los cambios se guardan como borrador y requieren revisión; el servidor vuelve a validar permisos y reglas.',
                'Changes are saved as drafts and require review; the server revalidates permissions and rules.',
              )} />
            )}

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t('Elementos', 'Items')} · {itemsQuery.data?.total ?? 0}
              </Text>
              {editorKind !== 'read-only' && editorKind !== 'appearance-mode' ? (
                <ActionButton label={t('Crear borrador', 'Create draft')} onPress={openCreate} />
              ) : null}
            </View>
            <TextInput
              value={search}
              onChangeText={(value) => {
                setSearch(value);
                setPageNumber(1);
              }}
              placeholder={t('Buscar en el servidor', 'Search on server')}
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel={t('Buscar elementos del catálogo', 'Search catalog items')}
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceRaised }]}
            />

            {itemsQuery.isLoading ? <ActivityIndicator color={colors.actionPrimary} /> : null}
            {(itemsQuery.data?.items ?? []).map((item) => {
              const radioOption = radioOptionById.get(item.id);
              return (
                <View key={item.id} style={[styles.card, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderSubtle }]}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.name}</Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>{item.code} · {item.id}</Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>
                    {workflowLabel(item.workflowState)} · {item.active ? t('Activo', 'Active') : t('Inactivo', 'Inactive')}
                    {radioOption ? ` · ${radioOption.durationMinutes} min` : ''}
                    {item.id === defaultId ? ` · ${t('Predeterminado', 'Default')}` : ''}
                  </Text>
                  {editorKind !== 'read-only' ? (
                    <ActionButton label={t('Crear revisión', 'Create revision')} onPress={() => openItem(item.id)} secondary />
                  ) : null}
                </View>
              );
            })}
            <View style={styles.pagination}>
              <ActionButton
                label={t('Anterior', 'Previous')}
                onPress={() => setPageNumber((current) => Math.max(1, current - 1))}
                disabled={pageNumber === 1}
                secondary
              />
              <Text style={{ color: colors.textSecondary }}>{t('Página', 'Page')} {pageNumber}</Text>
              <ActionButton
                label={t('Siguiente', 'Next')}
                onPress={() => setPageNumber((current) => current + 1)}
                disabled={!hasNextPage}
                secondary
              />
            </View>

            {form ? (
              <View style={[styles.form, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderSubtle }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  {form.entityId ? t('Nueva revisión', 'New revision') : t('Nuevo elemento', 'New item')}
                </Text>
                <Field label={t('Código interno', 'Internal code')} value={form.code} onChangeText={(code) => setForm({ ...form, code })} disabled={editorKind === 'appearance-mode'} />
                {editorKind === 'radio-auto-stop' ? (
                  <Field label={t('Duración en minutos', 'Duration in minutes')} value={form.durationMinutes} onChangeText={(durationMinutes) => setForm({ ...form, durationMinutes })} keyboardType="number-pad" />
                ) : null}
                <Field label={t('Orden manual', 'Manual order')} value={form.sortOrder} onChangeText={(sortOrder) => setForm({ ...form, sortOrder })} keyboardType="number-pad" />
                <Field label={t('Nombre en español', 'Spanish name')} value={form.nameEs} onChangeText={(nameEs) => setForm({ ...form, nameEs })} />
                <Field label={t('Nombre en inglés', 'English name')} value={form.nameEn} onChangeText={(nameEn) => setForm({ ...form, nameEn })} />
                <Field label={t('Descripción en español', 'Spanish description')} value={form.descriptionEs} onChangeText={(descriptionEs) => setForm({ ...form, descriptionEs })} multiline />
                <Field label={t('Descripción en inglés', 'English description')} value={form.descriptionEn} onChangeText={(descriptionEn) => setForm({ ...form, descriptionEn })} multiline />
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: colors.textPrimary }]}>
                    {t('Predeterminado global', 'Global default')}
                  </Text>
                  <Switch
                    value={form.defaultForScope}
                    disabled={editingPublishedDefault}
                    onValueChange={(defaultForScope) => setForm({ ...form, defaultForScope })}
                    accessibilityLabel={t('Usar como predeterminado global', 'Use as global default')}
                  />
                </View>
                {editingPublishedDefault ? (
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>
                    {t('Elige otra opción para sustituir el predeterminado actual.', 'Choose another option to replace the current default.')}
                  </Text>
                ) : null}
                <Field label={t('Motivo del cambio', 'Reason for change')} value={form.reason} onChangeText={(reason) => setForm({ ...form, reason })} multiline />
                <View style={styles.actionRow}>
                  <ActionButton label={t('Cancelar', 'Cancel')} onPress={() => setForm(null)} secondary />
                  <ActionButton
                    label={t('Guardar borrador', 'Save draft')}
                    onPress={saveDraft}
                    disabled={!catalogAdminFormIsValid(editorKind, form) || createRevision.isPending}
                  />
                </View>
              </View>
            ) : null}

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('Revisiones', 'Revisions')}</Text>
            {revisionsQuery.isLoading ? <ActivityIndicator color={colors.actionPrimary} /> : null}
            {(revisionsQuery.data ?? []).length === 0 ? (
              <Text style={[styles.empty, { color: colors.textSecondary }]}>{t('No hay revisiones.', 'No revisions.')}</Text>
            ) : (revisionsQuery.data ?? []).map((revision) => {
              const notes = reviewNotes[revision.id] ?? '';
              return (
                <View key={revision.id} style={[styles.card, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderSubtle }]}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{revision.draft.nameEs}</Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>
                    {revision.draft.code} · {workflowLabel(revision.workflowState)}
                  </Text>
                  {revision.workflowState === 'review' ? (
                    <Field
                      label={t('Nota o motivo de revisión', 'Review note or reason')}
                      value={notes}
                      onChangeText={(value) => setReviewNotes((current) => ({ ...current, [revision.id]: value }))}
                      multiline
                    />
                  ) : null}
                  <View style={styles.actionRow}>
                    {revision.workflowState === 'draft' || revision.workflowState === 'rejected' ? (
                      <ActionButton label={t('Enviar a revisión', 'Submit for review')} onPress={() => submitRevision.mutate(revision.id)} disabled={actionsPending} />
                    ) : null}
                    {revision.workflowState === 'review' ? (
                      <>
                        <ActionButton label={t('Aprobar', 'Approve')} onPress={() => approveRevision.mutate({ id: revision.id, notes })} disabled={actionsPending || !notes.trim()} />
                        <ActionButton label={t('Rechazar', 'Reject')} onPress={() => rejectRevision.mutate({ id: revision.id, notes })} disabled={actionsPending || !notes.trim()} danger />
                      </>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Notice({ text, danger = false }: { text: string; danger?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View style={[
      styles.notice,
      { backgroundColor: danger ? colors.dangerSurface : colors.infoSurface, borderColor: danger ? colors.dangerBorder : colors.infoBorder },
    ]}>
      <Text style={{ color: colors.textPrimary }}>{text}</Text>
    </View>
  );
}

function Field({ label, disabled = false, multiline = false, ...props }: {
  label: string;
  disabled?: boolean;
  multiline?: boolean;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'number-pad';
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{label}</Text>
      <TextInput
        {...props}
        editable={!disabled}
        multiline={multiline}
        accessibilityLabel={label}
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          multiline && styles.multiline,
          { color: colors.textPrimary, borderColor: colors.border, backgroundColor: disabled ? colors.surfaceMuted : colors.surface },
        ]}
      />
    </View>
  );
}

function ActionButton({ label, onPress, disabled = false, secondary = false, danger = false }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
}) {
  const { colors } = useAppTheme();
  const backgroundColor = danger
    ? colors.dangerAction
    : secondary
      ? colors.surface
      : colors.actionPrimary;
  const textColor = danger
    ? colors.dangerActionContrast
    : secondary
      ? colors.textPrimary
      : colors.actionPrimaryContrast;
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor, borderColor: secondary ? colors.border : backgroundColor }, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderBottomWidth: 1 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  notice: { borderWidth: 1, borderRadius: 10, padding: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginTop: 4 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 7 },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  meta: { fontSize: 12, lineHeight: 17 },
  form: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 12 },
  field: { gap: 5 },
  fieldLabel: { fontSize: 13, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  switchRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  switchLabel: { flex: 1, fontSize: 14, fontWeight: '700' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  button: { minHeight: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  pagination: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  empty: { textAlign: 'center', paddingVertical: 16 },
});
