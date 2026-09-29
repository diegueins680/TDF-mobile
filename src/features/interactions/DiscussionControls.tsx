import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { PartyMultiSelector } from '../../components/PartySelector';
import type { PartySelectorOption } from '../../api/partySelector';
import { Interactions } from '../../api/interactions';
import type { InteractionCommand, InteractionPreferences, InteractionSummary } from '../../api/interactions';
import { useAppTheme } from '../../theme/ThemeProvider';
import { discussionLink } from './model';

const policyLabels = { everyone: 'Todos con acceso', followers: 'Seguidores', mentioned: 'Personas mencionadas', off: 'Comentarios desactivados' };
const preferenceLabels: Record<keyof InteractionPreferences, string> = { reactions: 'Reacciones', comments: 'Comentarios', replies: 'Respuestas', mentions: 'Menciones' };
export function DiscussionControls({ summary, scope, onClose, execute }: {
  summary: InteractionSummary; scope: string; onClose: () => void; execute: (command: InteractionCommand) => Promise<void>;
}) {
  const { colors } = useAppTheme(); const router = useRouter(); const client = useQueryClient();
  const [tab, setTab] = useState<'discussion' | 'moderation' | 'preferences' | 'blocks' | 'reports'>('discussion');
  const [policy, setPolicy] = useState(summary.commentPolicy);
  const [people, setPeople] = useState<PartySelectorOption[]>((summary.mentionedPeople ?? []).map((person) => ({ partyId: person.id,
    displayName: person.displayName, avatarUrl: person.avatarUrl, username: null, secondaryLabel: null, partyType: 'person', accountStatus: 'active' })));
  const [reason, setReason] = useState(''); const [pending, setPending] = useState(false); const [error, setError] = useState('');
  const preferences = useQuery({ queryKey: ['interactions', scope, 'preferences'], queryFn: () => Interactions.preferences(), enabled: tab === 'preferences', retry: false });
  const blocks = useInfiniteQuery({ queryKey: ['interactions', scope, 'blocked-accounts'], initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam, signal }) => Interactions.blockedAccounts(pageParam, signal), getNextPageParam: (page) => page.nextCursor ?? undefined, enabled: tab === 'blocks', retry: false });
  const moderation = useInfiniteQuery({ queryKey: ['interactions', scope, summary.kind, summary.key, tab === 'reports' ? 'reports' : 'moderation'], initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => tab === 'reports' ? Interactions.reports(pageParam, signal) : Interactions.moderation(summary.id, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor ?? undefined, enabled: tab === 'reports' ? summary.canModerate : tab === 'moderation' && (summary.canManage || summary.canModerate), retry: false });
  const perform = async (work: () => Promise<unknown>) => {
    if (pending) return; setPending(true); setError('');
    try { await work(); await client.invalidateQueries({ queryKey: ['interactions'] }); }
    catch { setError('No se pudo guardar. Tus permisos pueden haber cambiado; actualiza e inténtalo de nuevo.'); }
    finally { setPending(false); }
  };
  const action = (label: string, onPress: () => void, disabled = false, selected?: boolean) => <Pressable accessibilityRole="button"
    accessibilityState={{ disabled: disabled || pending, selected }} disabled={disabled || pending} onPress={onPress}
    style={{ minHeight: 48, padding: 12, borderRadius: 10, backgroundColor: selected ? colors.selected : undefined }}><Text style={{ color: colors.actionPrimary }}>{label}</Text></Pressable>;
  const heading = (label: string) => <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '600' }}>{label}</Text>;
  return <Modal visible transparent animationType="slide" onRequestClose={() => { if (!pending) onClose(); }}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}><ScrollView accessibilityViewIsModal keyboardShouldPersistTaps="handled"
      style={{ maxHeight: '90%', backgroundColor: colors.surfaceRaised }} contentContainerStyle={{ padding: 24, gap: 12 }}>
      {heading('Opciones de interacción')}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {action('Conversación', () => setTab('discussion'), false, tab === 'discussion')}
        {action('Notificaciones', () => setTab('preferences'), false, tab === 'preferences')}
        {action('Bloqueos', () => setTab('blocks'), false, tab === 'blocks')}
        {(summary.canManage || summary.canModerate) && action('Moderación', () => setTab('moderation'), false, tab === 'moderation')}
        {summary.canModerate && action('Todos los reportes', () => setTab('reports'), false, tab === 'reports')}
      </View>
      {tab === 'discussion' && <>
        {heading('Notificaciones de esta conversación')}
        {(['all', 'participating', 'muted'] as const).map((mode) => <View key={mode}>{action({ all: 'Toda la conversación', participating: 'Respuestas y menciones', muted: 'Silenciar' }[mode],
          () => { void perform(() => execute({ operation: 'subscription.set', mode })); }, false, summary.subscription === mode)}</View>)}
        {summary.canManage && <>
          {heading('Quién puede comentar')}
          {(Object.keys(policyLabels) as (keyof typeof policyLabels)[]).map((key) => <View key={key}>{action(policyLabels[key], () => setPolicy(key), false, policy === key)}</View>)}
          {policy === 'mentioned' && <PartyMultiSelector label="Personas mencionadas" value={people} onChange={setPeople} context="interaction_mention" scopeId={summary.id} />}
          {action('Guardar permisos', () => { void perform(() => execute({ operation: 'settings.update', commentPolicy: policy,
            expectedVersion: summary.version, mentionedPartyIds: people.map((person) => person.partyId) })); }, policy === 'mentioned' && people.length === 0)}
        </>}
      </>}
      {tab === 'preferences' && <>
        {heading('Notificaciones en todas las conversaciones')}
        {preferences.isPending && <ActivityIndicator accessibilityLabel="Cargando preferencias" />}
        {preferences.isError && action('No se pudieron cargar. Reintentar', () => { void preferences.refetch(); })}
        {preferences.data && (Object.keys(preferenceLabels) as (keyof InteractionPreferences)[]).map((key) => <View key={key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
          <Text style={{ color: colors.textPrimary }}>{preferenceLabels[key]}</Text><Switch accessibilityLabel={preferenceLabels[key]} disabled={pending} value={preferences.data[key]}
            onValueChange={(value) => { void perform(() => Interactions.setPreferences({ ...preferences.data!, [key]: value })); }} />
        </View>)}
      </>}
      {tab === 'blocks' && <>
        {heading('Cuentas bloqueadas')}
        <Text style={{ color: colors.textSecondary }}>Desbloquear permite nuevas interacciones. Las conexiones anteriores no se restauran.</Text>
        {blocks.isPending && <ActivityIndicator accessibilityLabel="Cargando bloqueos" />}
        {blocks.isError && action('No se pudo cargar. Reintentar', () => { void blocks.refetch(); })}
        {blocks.data?.pages.every((page) => page.items.length === 0) && <Text style={{ color: colors.textPrimary }}>No has bloqueado cuentas.</Text>}
        {blocks.data?.pages.flatMap((page) => page.items).map((person) => <View key={person.partyId}>
          <Text style={{ color: colors.textPrimary }}>{person.displayName}</Text>{action('Desbloquear', () => { void perform(() => Interactions.block(person.partyId, false, person.version, randomUUID())); })}
        </View>)}
        {blocks.hasNextPage && action('Ver más cuentas', () => { void blocks.fetchNextPage(); }, blocks.isFetchingNextPage)}
      </>}
      {(tab === 'moderation' || tab === 'reports') && <>
        {heading(tab === 'reports' ? 'Reportes pendientes' : 'Moderación de conversación')}
        {moderation.isPending && <ActivityIndicator accessibilityLabel="Cargando moderación" />}
        {moderation.isError && action('No se pudo cargar. Reintentar', () => { void moderation.refetch(); })}
        {moderation.data?.pages.every((page) => page.items.length === 0) && <Text style={{ color: colors.textPrimary }}>No hay comentarios pendientes.</Text>}
        {tab === 'moderation' && <TextInput accessibilityLabel="Motivo de la decisión" placeholder="Motivo de la decisión" placeholderTextColor={colors.textSecondary} multiline maxLength={1000} value={reason} onChangeText={setReason}
          style={{ padding: 12, minHeight: 80, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }} />}
        {moderation.data?.pages.flatMap((page) => page.items).map((comment) => <View key={comment.id} style={{ gap: 8 }}>
          <Text style={{ color: colors.textPrimary }}>{comment.moderationBody || 'Texto retirado'}</Text>
          {!!comment.reportReasons?.length && <View style={{ gap: 8 }}>
            <Text accessibilityRole="header" style={{ color: colors.textSecondary }}>Motivos recientes ({comment.reportReasons.length} de {comment.openReports ?? 0})</Text>
            {comment.reportReasons.map((text, index) => <Text key={index} style={{ color: colors.textPrimary }}>{text}</Text>)}
          </View>}
          <Text style={{ color: colors.textSecondary }}>{comment.state === 'hidden' ? 'Oculto' : `${comment.openReports ?? 0} reportes`}</Text>
          {tab === 'reports' ? action('Abrir conversación para revisar', () => { onClose(); router.push(discussionLink('comment', comment.id) as never); }) : <>
            {comment.state === 'hidden' && action('Restaurar', () => { void perform(() => execute({ operation: 'comment.restore', commentId: comment.id, expectedVersion: comment.version, reason })); }, !reason.trim())}
            {summary.canModerate && ['visible', 'hidden'].includes(comment.state) && action('Retirar como administrador', () => { void perform(() => execute({ operation: 'comment.remove', commentId: comment.id, expectedVersion: comment.version, reason })); }, !reason.trim())}
            {summary.canModerate && (comment.openReports ?? 0) > 0 && action('Desestimar reportes', () => { void perform(() => execute({ operation: 'comment.report.resolve', commentId: comment.id, expectedVersion: comment.version, reason, decision: 'dismissed' })); }, !reason.trim())}
          </>}
        </View>)}
        {moderation.hasNextPage && action('Ver más comentarios', () => { void moderation.fetchNextPage(); }, moderation.isFetchingNextPage)}
      </>}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
      {action(pending ? 'Guardando…' : 'Cerrar', onClose)}
    </ScrollView></View>
  </Modal>;
}
