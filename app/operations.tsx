import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addOperationsNote,
  assignOperationsWorkItem,
  getOperationsWorkItem,
  listOperationsWorkItems,
  markOperationsWorkItemSeen,
  transitionOperationsWorkItem,
  type OperationsPriority,
  type OperationsStatus,
  type OperationsWorkItem,
} from '../src/api/operations';
import { useAuth } from '../src/providers/AuthProvider';
import { useUserSettings } from '../src/providers/UserSettingsProvider';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { registerOperationsPush } from '../src/operations/pushRegistration';

const statuses: OperationsStatus[] = ['new', 'seen', 'assigned', 'in_progress', 'waiting', 'resolved'];
const priorities: OperationsPriority[] = ['urgent', 'high', 'normal', 'low'];

const copy = {
  es: {
    title: 'Centro de operaciones', queue: 'Cola de trabajo', search: 'Buscar trabajo real…',
    all: 'Todos', mine: 'Asignados a mí', unassigned: 'Sin asignar', empty: 'No hay trabajo para estos filtros.',
    retry: 'Reintentar', details: 'Detalle', assignMe: 'Asignarme', note: 'Nota interna', addNote: 'Guardar nota',
    source: 'Abrir registro completo', thread: 'Historial', push: 'Activar avisos',
    pushDone: 'Avisos activados en este dispositivo.', pushDenied: 'Permiso de avisos no concedido.',
    waitingReason: 'Indica la dependencia externa antes de poner en espera.',
    confirm: 'Confirmar cambio', cancel: 'Cancelar', loadMore: 'Cargar más',
  },
  en: {
    title: 'Operations center', queue: 'Work queue', search: 'Search persisted work…',
    all: 'All', mine: 'Assigned to me', unassigned: 'Unassigned', empty: 'No work matches these filters.',
    retry: 'Retry', details: 'Details', assignMe: 'Assign to me', note: 'Internal note', addNote: 'Save note',
    source: 'Open complete record', thread: 'History', push: 'Enable alerts',
    pushDone: 'Alerts enabled on this device.', pushDenied: 'Notification permission was not granted.',
    waitingReason: 'Record the external dependency before waiting.',
    confirm: 'Confirm change', cancel: 'Cancel', loadMore: 'Load more',
  },
} as const;

const statusLabel: Record<'es' | 'en', Record<OperationsStatus, string>> = {
  es: { new: 'Nuevo', seen: 'Visto', assigned: 'Asignado', in_progress: 'En curso', waiting: 'En espera', resolved: 'Resuelto', archived: 'Archivado' },
  en: { new: 'New', seen: 'Seen', assigned: 'Assigned', in_progress: 'In progress', waiting: 'Waiting', resolved: 'Resolved', archived: 'Archived' },
};

const priorityColor: Record<OperationsPriority, string> = {
  urgent: '#b91c1c', high: '#c2410c', normal: '#2563eb', low: '#475569',
};

export default function OperationsScreen() {
  const { colors } = useAppTheme();
  const { locale, timezone } = useUserSettings();
  const language: 'es' | 'en' = locale.startsWith('en') ? 'en' : 'es';
  const t = copy[language];
  const { partyId } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useLocalSearchParams<{ workItemId?: string }>();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OperationsStatus | undefined>();
  const [priority, setPriority] = useState<OperationsPriority | undefined>();
  const [scope, setScope] = useState<'all' | 'mine' | 'unassigned'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(params.workItemId ?? null);
  const [note, setNote] = useState('');
  const [waitingReason, setWaitingReason] = useState('');

  const filters = useMemo(() => ({
    search: search.trim() || undefined,
    status,
    priority,
    assigneePartyId: scope === 'mine' && partyId ? Number(partyId) : undefined,
  }), [partyId, priority, scope, search, status]);

  const queue = useInfiniteQuery({
    queryKey: ['operations', 'mobile-queue', filters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listOperationsWorkItems({ ...filters, cursor: pageParam }),
    getNextPageParam: (page) => page.hasMore ? page.nextCursor ?? undefined : undefined,
    refetchInterval: 15_000,
  });
  const rawItems = queue.data?.pages.flatMap((page) => page.items) ?? [];
  const items = scope === 'unassigned' ? rawItems.filter((item) => item.assigneePartyId == null) : rawItems;

  const detail = useQuery({
    queryKey: ['operations', 'work-item', selectedId],
    queryFn: () => getOperationsWorkItem(selectedId!),
    enabled: Boolean(selectedId),
  });

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['operations'] });
  }, [queryClient]);

  const seen = useMutation({
    mutationFn: (item: OperationsWorkItem) => markOperationsWorkItemSeen(item.id, item.version),
    onSuccess: invalidate,
  });
  const assign = useMutation({
    mutationFn: (item: OperationsWorkItem) => assignOperationsWorkItem(item.id, {
      expectedVersion: item.version,
      assigneePartyId: partyId ? Number(partyId) : null,
      responsibleTeam: item.responsibleTeam,
      reason: 'Self-assigned from the mobile operations queue',
    }),
    onSuccess: invalidate,
  });
  const transition = useMutation({
    mutationFn: ({ item, targetStatus }: { item: OperationsWorkItem; targetStatus: OperationsStatus }) =>
      transitionOperationsWorkItem(item.id, {
        expectedVersion: item.version,
        targetStatus,
        reason: targetStatus === 'waiting' ? waitingReason.trim() : `Confirmed in tdf-mobile: ${targetStatus}`,
        waitingExternalDependency: targetStatus === 'waiting' ? true : undefined,
      }),
    onSuccess: async () => { setWaitingReason(''); await invalidate(); },
  });
  const saveNote = useMutation({
    mutationFn: () => addOperationsNote(selectedId!, note.trim()),
    onSuccess: async () => { setNote(''); await invalidate(); },
  });
  const markSeen = seen.mutate;
  const markingSeen = seen.isPending;

  useEffect(() => {
    const item = detail.data?.workItem;
    if (item && !item.seen && !markingSeen) markSeen(item);
  }, [detail.data?.workItem, markSeen, markingSeen]); // shared seen state; mutation refreshes the version

  const openItem = useCallback((item: OperationsWorkItem) => {
    setSelectedId(item.id);
    router.setParams({ workItemId: item.id });
  }, [router]);

  const confirmTransition = useCallback((item: OperationsWorkItem, targetStatus: OperationsStatus) => {
    if (targetStatus === 'waiting' && !waitingReason.trim()) {
      Alert.alert(t.title, t.waitingReason);
      return;
    }
    Alert.alert(t.confirm, statusLabel[language][targetStatus], [
      { text: t.cancel, style: 'cancel' },
      { text: t.confirm, onPress: () => transition.mutate({ item, targetStatus }) },
    ]);
  }, [language, t, transition, waitingReason]);

  const formatDate = useCallback((value: string) => new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium', timeStyle: 'short', timeZone: timezone,
  }).format(new Date(value)), [locale, timezone]);

  const openSourceRecord = useCallback((url: string) => {
    if (url.startsWith('/')) {
      router.push(url as Href);
      return;
    }
    void Linking.openURL(url);
  }, [router]);

  const renderItem = useCallback(({ item }: { item: OperationsWorkItem }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${language === 'en' ? item.titleEn : item.titleEs}. ${statusLabel[language][item.status]}`}
      onPress={() => openItem(item)}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.surfaceRaised, borderColor: item.slaState === 'breached' ? colors.dangerBorder : colors.borderSubtle, opacity: pressed ? 0.75 : 1 }]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.priorityDot, { backgroundColor: priorityColor[item.priority] }]} />
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>{language === 'en' ? item.titleEn : item.titleEs}</Text>
        {!item.seen ? <View accessibilityLabel={language === 'en' ? 'Unseen' : 'No visto'} style={[styles.unseen, { backgroundColor: colors.actionPrimary }]} /> : null}
      </View>
      <Text style={{ color: colors.textSecondary }}>{item.entityType} · {item.sourceChannel}</Text>
      <View style={styles.metaRow}>
        <Text style={[styles.pill, { color: colors.textPrimary, borderColor: colors.border }]}>{statusLabel[language][item.status]}</Text>
        <Text style={[styles.pill, { color: item.slaState === 'breached' ? colors.danger : colors.textSecondary, borderColor: colors.border }]}>{item.slaState}</Text>
        <Text style={{ color: colors.textSecondary }}>{formatDate(item.createdAt)}</Text>
      </View>
    </Pressable>
  ), [colors, formatDate, language, openItem]);

  const selected = detail.data?.workItem;
  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: colors.canvas }]}>
      <View style={styles.header}>
        <View>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{t.title}</Text>
          <Text style={{ color: colors.textSecondary }}>{t.queue}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.push}
          onPress={() => {
            const organizationId = items[0]?.organizationId;
            if (!organizationId) return;
            void registerOperationsPush(organizationId)
              .then((result) => Alert.alert(t.title, result.state === 'registered' ? t.pushDone : t.pushDenied))
              .catch((error) => Alert.alert(t.title, error instanceof Error ? error.message : t.retry));
          }}
          style={[styles.iconButton, { borderColor: colors.border }]}
        >
          <MaterialCommunityIcons name="bell-outline" size={22} color={colors.actionPrimary} />
        </Pressable>
      </View>

      <TextInput
        accessibilityLabel={t.search}
        value={search}
        onChangeText={setSearch}
        placeholder={t.search}
        placeholderTextColor={colors.textSecondary}
        style={[styles.search, { color: colors.textPrimary, backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {(['all', 'mine', 'unassigned'] as const).map((value) => (
          <FilterChip key={value} active={scope === value} label={value === 'all' ? t.all : value === 'mine' ? t.mine : t.unassigned} onPress={() => setScope(value)} />
        ))}
        {statuses.slice(0, 5).map((value) => <FilterChip key={value} active={status === value} label={statusLabel[language][value]} onPress={() => setStatus(status === value ? undefined : value)} />)}
        {priorities.map((value) => <FilterChip key={value} active={priority === value} label={value} onPress={() => setPriority(priority === value ? undefined : value)} />)}
      </ScrollView>

      {queue.isLoading ? <ActivityIndicator style={styles.center} size="large" color={colors.actionPrimary} /> : null}
      {queue.isError ? (
        <View style={styles.center}><Text style={{ color: colors.danger }}>{queue.error.message}</Text><Pressable onPress={() => queue.refetch()}><Text style={{ color: colors.actionPrimary }}>{t.retry}</Text></Pressable></View>
      ) : null}
      {!queue.isLoading && !queue.isError ? (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={items.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={<Text style={{ color: colors.textSecondary, textAlign: 'center' }}>{t.empty}</Text>}
          refreshControl={<RefreshControl refreshing={queue.isRefetching} onRefresh={() => queue.refetch()} tintColor={colors.actionPrimary} />}
          onEndReached={() => { if (queue.hasNextPage && !queue.isFetchingNextPage) void queue.fetchNextPage(); }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={queue.isFetchingNextPage ? <ActivityIndicator color={colors.actionPrimary} /> : null}
        />
      ) : null}

      <Modal visible={Boolean(selectedId)} animationType="slide" onRequestClose={() => setSelectedId(null)}>
        <SafeAreaView style={[styles.modal, { backgroundColor: colors.canvas }]}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[styles.modalTitle, { color: colors.textPrimary }]}>{t.details}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t.cancel} onPress={() => { setSelectedId(null); router.setParams({ workItemId: undefined }); }}>
              <MaterialCommunityIcons name="close" size={28} color={colors.textPrimary} />
            </Pressable>
          </View>
          {detail.isLoading ? <ActivityIndicator style={styles.center} color={colors.actionPrimary} /> : null}
          {detail.isError ? <Text style={{ color: colors.danger }}>{detail.error.message}</Text> : null}
          {selected && detail.data ? (
            <ScrollView contentContainerStyle={styles.detailBody}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>{language === 'en' ? selected.titleEn : selected.titleEs}</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>{language === 'en' ? selected.descriptionEn : selected.descriptionEs}</Text>
              <View style={styles.actionRow}>
                {partyId && selected.assigneePartyId !== Number(partyId) ? <ActionButton label={t.assignMe} onPress={() => assign.mutate(selected)} /> : null}
                {detail.data.sourceRecordUrl ? <ActionButton label={t.source} onPress={() => openSourceRecord(detail.data.sourceRecordUrl!)} /> : null}
              </View>
              <TextInput
                accessibilityLabel={t.waitingReason}
                value={waitingReason}
                onChangeText={setWaitingReason}
                placeholder={t.waitingReason}
                placeholderTextColor={colors.textSecondary}
                style={[styles.search, { color: colors.textPrimary, backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
              />
              <View style={styles.actionRow}>
                {detail.data.allowedTransitions.filter((value) => value !== 'archived').map((value) => (
                  <ActionButton key={value} label={statusLabel[language][value]} onPress={() => confirmTransition(selected, value)} />
                ))}
              </View>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.note}</Text>
              <TextInput
                accessibilityLabel={t.note}
                multiline value={note} onChangeText={setNote}
                style={[styles.noteInput, { color: colors.textPrimary, backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
              />
              <ActionButton disabled={!note.trim() || saveNote.isPending} label={t.addNote} onPress={() => saveNote.mutate()} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.thread}</Text>
              {detail.data.events.map((event) => (
                <View key={event.id} style={[styles.timeline, { borderLeftColor: colors.border }]}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{event.eventType}</Text>
                  <Text style={{ color: colors.textSecondary }}>{language === 'en' ? event.bodyEn : event.bodyEs}</Text>
                  <Text style={{ color: colors.textSecondary }}>{formatDate(event.occurredAt)}</Text>
                </View>
              ))}
              {detail.data.notes.map((entry) => (
                <View key={entry.id} style={[styles.timeline, { borderLeftColor: colors.actionPrimary }]}>
                  <Text style={{ color: colors.textPrimary }}>{entry.body}</Text>
                  <Text style={{ color: colors.textSecondary }}>{formatDate(entry.createdAt)}</Text>
                </View>
              ))}
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function FilterChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.filterChip, { backgroundColor: active ? colors.selected : colors.surfaceRaised, borderColor: active ? colors.actionPrimary : colors.border }]}><Text style={{ color: colors.textPrimary }}>{label}</Text></Pressable>;
}

function ActionButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.actionPrimary, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}><Text style={{ color: colors.actionPrimaryContrast, fontWeight: '700' }}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, header: { paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 25, fontWeight: '800' }, modalTitle: { fontSize: 21, fontWeight: '800' },
  iconButton: { padding: 10, borderWidth: 1, borderRadius: 12 }, search: { marginHorizontal: 16, borderWidth: 1, borderRadius: 12, minHeight: 46, paddingHorizontal: 14 },
  filters: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 }, filterChip: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  list: { padding: 16, paddingBottom: 40, gap: 10 }, emptyList: { flexGrow: 1, justifyContent: 'center', padding: 28 }, center: { flex: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 12 },
  card: { padding: 14, borderWidth: 1, borderRadius: 14, gap: 8 }, cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 }, cardTitle: { flex: 1, fontSize: 16, fontWeight: '800' },
  priorityDot: { width: 10, height: 10, borderRadius: 5 }, unseen: { width: 8, height: 8, borderRadius: 4 }, metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  pill: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, fontSize: 12 }, modal: { flex: 1 }, detailBody: { padding: 18, gap: 14, paddingBottom: 60 },
  description: { fontSize: 15, lineHeight: 22 }, actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, actionButton: { paddingHorizontal: 13, paddingVertical: 11, borderRadius: 10 },
  sectionTitle: { marginTop: 8, fontSize: 18, fontWeight: '800' }, noteInput: { minHeight: 90, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top' },
  timeline: { borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 7, gap: 3 },
});
