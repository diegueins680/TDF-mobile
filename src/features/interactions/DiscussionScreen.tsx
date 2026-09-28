import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, Text, TextInput, View, findNodeHandle } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import * as Clipboard from 'expo-clipboard';
import { Interactions } from '../../api/interactions';
import type { InteractionCommand, InteractionComment, InteractionDestination, InteractionPage, InteractionSort } from '../../api/interactions';
import { useAuth } from '../../providers/AuthProvider';
import { useAppTheme } from '../../theme/ThemeProvider';
import { getAnalyticsClient } from '../../analytics/posthog';
import { DiscussionControls } from './DiscussionControls';
import { CommentBody } from './CommentBody';
import { CommentComposer } from './CommentComposer';
import { InteractionBar } from './InteractionBar';
import { createDiscussionCursorHistory, discussionWindowPages, commandAnalyticsEvents, discussionLink } from './model';

export default function DiscussionScreen() {
  const { destinationKind, destinationId } = useLocalSearchParams<{ destinationKind: string; destinationId: string }>();
  const { partyId, token } = useAuth(); const { colors } = useAppTheme();
  const valid = ['comment', 'target'].includes(destinationKind) && /^[a-f\d-]{36}$/i.test(destinationId ?? '');
  const query = useQuery({ queryKey: ['interactions', token ? `account:${partyId ?? 'pending'}` : 'anonymous', 'destination', destinationKind, destinationId],
    queryFn: ({ signal }) => Interactions.destination(destinationKind as 'comment' | 'target', destinationId, Boolean(token), signal), enabled: valid, retry: false });
  if (!valid || query.isError) return <SafeAreaView style={{ flex: 1, padding: 24, backgroundColor: colors.canvas }}>
    <Text accessibilityRole="alert" style={{ color: colors.textPrimary }}>La conversación no está disponible. Puede haberse retirado o requerir acceso.</Text>
  </SafeAreaView>;
  if (!query.data) return <ActivityIndicator accessibilityLabel="Cargando conversación" />;
  return <Discussion key={`${query.data.targetId}:${token ? `account:${partyId ?? 'pending'}` : 'anonymous'}`} destination={query.data} />;
}

function Discussion({ destination }: { destination: InteractionDestination }) {
  const { partyId, token } = useAuth(); const { colors } = useAppTheme(); const router = useRouter(); const client = useQueryClient();
  const identity = { kind: destination.kind, entityKey: destination.key };
  const [thread, setThread] = useState<string | undefined>(destination.context?.root.id);
  const [sort, setSort] = useState<InteractionSort>('newest'); const [reply, setReply] = useState<InteractionComment | null>(null);
  const [editing, setEditing] = useState<InteractionComment | null>(null); const [menu, setMenu] = useState<InteractionComment | null>(null);
  const [action, setAction] = useState<'delete' | 'hide' | 'remove' | 'report' | 'block' | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [reason, setReason] = useState(''); const [error, setError] = useState(''); const [announcement, setAnnouncement] = useState('');
  const [highlight, setHighlight] = useState(destination.commentId); const [controls, setControls] = useState(false);
  const attemptedCommands = useRef(new Map<string, InteractionCommand>());
  const pendingKey = useRef<string | null>(null); const list = useRef<FlatList<InteractionComment>>(null); const focused = useRef(false);
  const targetHeading = useRef<Text | null>(null);
  const heading = useRef<Text>(null); const composer = useRef<Text>(null);
  const summary = useQuery({ queryKey: ['interactions', token ? `account:${partyId ?? 'pending'}` : 'anonymous', destination.kind, destination.key, 'summary'],
    queryFn: ({ signal }) => Interactions.summary(identity, Boolean(token), signal), retry: false, refetchInterval: 30000 });
  const commentCursors = useMemo(createDiscussionCursorHistory, [partyId, destination.kind, destination.key, thread, sort]);
  const comments = useInfiniteQuery({ queryKey: ['interactions', token ? `account:${partyId ?? 'pending'}` : 'anonymous', destination.kind, destination.key, 'comments', thread, sort],
    initialPageParam: '', maxPages: discussionWindowPages,
    getPreviousPageParam: (_page, _pages, cursor) => commentCursors.previous(cursor),
    queryFn: async ({ pageParam, signal }) => { const page = await Interactions.comments(identity, Boolean(token), thread ? 'oldest' : sort, thread, pageParam || undefined, signal); commentCursors.remember(pageParam, page.nextCursor); return page; },
    getNextPageParam: (page: InteractionPage) => page.nextCursor ?? undefined, retry: false, refetchInterval: 30000 });
  const context = useQuery({ queryKey: ['interactions', token ? `account:${partyId ?? 'pending'}` : 'anonymous', destination.kind, destination.key, 'context', thread],
    queryFn: ({ signal }) => Interactions.context(identity, Boolean(token), destination.context?.root.id === thread ? destination.commentId! : thread!, signal),
    enabled: Boolean(thread), retry: false });
  const mutation = useMutation({ mutationFn: ({ command, key }: { command: InteractionCommand; key: string }) => Interactions.command(destination.targetId, command, key),
    onSuccess: (_value, { command }) => commandAnalyticsEvents(command).forEach((event) => getAnalyticsClient().capture(event, { platform: 'mobile', entity_kind: destination.kind })),
    onSettled: async () => { await client.invalidateQueries({ queryKey: ['interactions'] }); },
  });
  const execute = async (command: InteractionCommand, key = randomUUID()) => {
    const attempted = attemptedCommands.current;
    if (!attempted.has(key)) attempted.set(key, command);
    if (attempted.size > 16) attempted.delete(attempted.keys().next().value!);
    await mutation.mutateAsync({ command: attempted.get(key)!, key }); attempted.delete(key);
  };
  const data = summary.data;
  const seed = context.data;
  const nodes = [...(thread && seed ? [seed.root, seed.parent, seed.comment, ...seed.surrounding].filter((comment): comment is InteractionComment => !!comment) : []),
    ...(comments.data?.pages.flatMap((page) => page.items) ?? [])];
  const items = [...new Map(nodes.map((comment) => [comment.id, comment])).values()];
  if (thread) items.sort((a, b) => a.id === thread ? -1 : b.id === thread ? 1 : a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const targetIndex = items.findIndex((comment) => comment.id === destination.commentId);
  useEffect(() => {
    if (!destination.commentId || focused.current || targetIndex < 0) return;
    focused.current = true;
    const timer = setTimeout(() => {
      list.current?.scrollToIndex({ index: targetIndex, animated: false, viewPosition: 0.3 });
      const targetHandle = targetHeading.current && findNodeHandle(targetHeading.current);
      if (targetHandle) AccessibilityInfo.setAccessibilityFocus(targetHandle);
      AccessibilityInfo.announceForAccessibility('Comentario enlazado');
      getAnalyticsClient().capture('comment_deep_link_opened', { platform: 'mobile', entity_kind: destination.kind });
    }, 250);
    const highlightTimer = setTimeout(() => setHighlight(null), 5000);
    return () => { clearTimeout(timer); clearTimeout(highlightTimer); };
  }, [targetIndex, destination.commentId, destination.kind]);
  const focus = (element: Text | null) => { const handle = element && findNodeHandle(element); if (handle) AccessibilityInfo.setAccessibilityFocus(handle); };
  const closeMenu = () => { if (actionPending) return; setMenu(null); setAction(null); setReason(''); setError(''); focus(heading.current); };
  const buttonStyle = { minHeight: 48, padding: 12, justifyContent: 'center' as const };
  const button = (label: string, onPress: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={buttonStyle}><Text style={{ color: disabled ? colors.textSecondary : colors.actionPrimary }}>{label}</Text></Pressable>;
  if (summary.isError) return <SafeAreaView style={{ flex: 1, padding: 24, backgroundColor: colors.canvas }}><Text accessibilityRole="alert" style={{ color: colors.textPrimary }}>Tus permisos cambiaron o la conversación no está disponible.</Text></SafeAreaView>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList ref={list} data={comments.isError || context.isError ? [] : items} keyExtractor={(comment) => comment.id} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 8 }} onScrollToIndexFailed={({ index, averageItemLength }) => list.current?.scrollToOffset({ offset: averageItemLength * index, animated: false })}
        ListHeaderComponent={<View style={{ gap: 8 }}>
          <Text ref={heading} accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '700' }}>{destination.title}</Text>
          <InteractionBar {...identity} />
          {comments.hasPreviousPage && button('Ver comentarios anteriores', () => { void comments.fetchPreviousPage(); }, comments.isFetchingPreviousPage)}
          {thread ? button('Ocultar respuestas · Ver todos los comentarios', () => { setThread(undefined); setReply(null); getAnalyticsClient().capture('thread_collapsed', { platform: 'mobile', entity_kind: destination.kind }); })
            : <View style={{ flexDirection: 'row' }}>{button(sort === 'newest' ? 'Más recientes ✓' : 'Más recientes', () => setSort('newest'))}{button(sort === 'oldest' ? 'Más antiguos ✓' : 'Más antiguos', () => setSort('oldest'))}</View>}
          {token ? button('Opciones de conversación', () => setControls(true)) : button('Iniciar sesión para participar', () => router.push({ pathname: '/auth', params: { returnTo: discussionLink(destination.commentId ? 'comment' : 'target', destination.commentId ?? destination.targetId) } }))}
          {data?.commentPolicy === 'off' && <Text style={{ color: colors.textSecondary }}>Los comentarios están desactivados.</Text>}
          {data && !data.canComment && data.commentPolicy !== 'off' && token && <Text style={{ color: colors.textSecondary }}>No tienes permiso para comentar en esta publicación.</Text>}
          {data?.canComment && <View><Text ref={composer} style={{ color: colors.textPrimary }}>{editing ? 'Editar comentario' : reply ? `Responder a ${reply.author?.displayName ?? 'este comentario'}` : 'Participar'}</Text>
            <CommentComposer focusOnMount={Boolean(editing || reply)} key={editing?.id ?? reply?.id ?? 'new'} targetId={data.id} initialBody={editing?.body} initialMentions={editing?.mentions}
              onCancel={editing || reply ? () => { setEditing(null); setReply(null); focus(heading.current); } : undefined}
              onSave={async (body, mentions, key) => {
                await execute(editing ? { operation: 'comment.edit', commentId: editing.id, expectedVersion: editing.version, body, mentions }
                  : { operation: 'comment.create', parentId: reply?.id ?? thread ?? null, body, mentions }, key);
                setEditing(null); setReply(null); setAnnouncement('Comentario guardado');
              }} /></View>}
          <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>{announcement}</Text>
          {comments.isPending && <ActivityIndicator accessibilityLabel="Cargando comentarios" />}
          {(comments.isError || context.isError) && <View><Text accessibilityRole="alert" style={{ color: colors.danger }}>No se pudo cargar la conversación.</Text>{button('Reintentar', () => { void comments.refetch(); void context.refetch(); })}</View>}
        </View>}
        renderItem={({ item }) => <View style={{ gap: 8, padding: 12, marginLeft: thread && item.id !== thread ? 12 : 0, borderRadius: 12, backgroundColor: highlight === item.id ? colors.selected : colors.surface }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text ref={(element) => { if (destination.commentId === item.id) targetHeading.current = element; }} accessibilityRole="header" style={{ color: colors.textPrimary, fontWeight: '600', flex: 1 }}>{item.author?.displayName ?? 'Comentario'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Opciones del comentario" onPress={() => { setMenu(item); pendingKey.current = null; }} style={buttonStyle}><Text style={{ color: colors.actionPrimary }}>•••</Text></Pressable>
          </View>
          <Text style={{ color: colors.textSecondary }}>{new Date(item.createdAt).toLocaleString()}{item.editedAt ? ' · editado' : ''}</Text>
          {item.parentId && <Text style={{ color: colors.textSecondary }}>En respuesta a {items.find((parent) => parent.id === item.parentId)?.author?.displayName ?? 'un comentario del hilo'}</Text>}
          <CommentBody comment={item} onError={() => setAnnouncement('No se pudo abrir el enlace.')} />
          {data?.canComment && ['visible', 'deleted'].includes(item.state) && button('Responder', () => { setEditing(null); setReply(item); list.current?.scrollToOffset({ offset: 0, animated: true }); focus(composer.current); })}
          {!thread && (item.replyCount ?? 0) > 0 && <Pressable accessibilityRole="button" accessibilityState={{ expanded: false }} style={buttonStyle} onPress={() => {
            setThread(item.id); getAnalyticsClient().capture('thread_expanded', { platform: 'mobile', entity_kind: destination.kind }); list.current?.scrollToOffset({ offset: 0, animated: false });
          }}><Text style={{ color: colors.actionPrimary }}>Ver {item.replyCount} respuestas</Text></Pressable>}
        </View>}
        ListEmptyComponent={!comments.isPending && !comments.isError ? <Text style={{ color: colors.textSecondary }}>Todavía no hay comentarios.</Text> : null}
        ListFooterComponent={comments.hasNextPage ? button('Ver más comentarios', () => { void comments.fetchNextPage(); }, comments.isFetchingNextPage) : null}
      />
    </KeyboardAvoidingView>
    <Modal visible={Boolean(menu)} transparent animationType="slide" onRequestClose={closeMenu}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}><ScrollView accessibilityViewIsModal contentContainerStyle={{ padding: 24, gap: 8, backgroundColor: colors.surfaceRaised }}>
        <Text accessibilityRole="header" style={{ fontSize: 22, color: colors.textPrimary }}>Opciones del comentario</Text>
        {menu && !action && <>
          {button('Copiar enlace', () => { void Clipboard.setStringAsync(`https://www.tdfrecords.net${discussionLink('comment', menu.id)}`).then(() => { setAnnouncement('Enlace copiado'); closeMenu(); }); })}
          {menu.canEdit && button('Editar', () => { setEditing(menu); setReply(null); closeMenu(); list.current?.scrollToOffset({ offset: 0, animated: true }); })}
          {menu.canDelete && button('Eliminar mi comentario', () => setAction('delete'))}
          {token && menu.state === 'visible' && button('Reportar', () => setAction('report'))}
          {data?.canManage && menu.state === 'visible' && button('Ocultar en mi contenido', () => setAction('hide'))}
          {data?.canModerate && menu.state === 'visible' && button('Retirar como administrador', () => setAction('remove'))}
          {token && menu.author && String(menu.author.id) !== partyId && button('Bloquear usuario', () => setAction('block'))}
        </>}
        {action && menu && <>
          <Text style={{ color: colors.textPrimary }}>{action === 'delete' ? 'Se eliminará el texto y se conservarán las respuestas.' : action === 'block' ? 'Se bloqueará la interacción entre ambas cuentas. Las conexiones anteriores no se restauran al desbloquear.' : 'Explica el motivo.'}</Text>
          {!['delete', 'block'].includes(action) && <TextInput multiline accessibilityLabel="Motivo" value={reason} onChangeText={(value) => { setReason(value); pendingKey.current = null; }} maxLength={1000} style={{ padding: 12, minHeight: 80, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }} />}
          {button('Confirmar', () => {
            if (actionPending) return; setActionPending(true); pendingKey.current ??= randomUUID(); setError('');
            const work = action === 'block' && menu.author ? Interactions.blockState(menu.author.id).then((state) => state.blocked ? state : Interactions.block(state.partyId, true, state.version, pendingKey.current!))
              : execute(action === 'report' ? { operation: 'comment.report', commentId: menu.id, reason } : action === 'delete'
                ? { operation: 'comment.delete', commentId: menu.id, expectedVersion: menu.version }
                : { operation: action === 'hide' ? 'comment.hide' : 'comment.remove', commentId: menu.id, expectedVersion: menu.version, reason }, pendingKey.current);
            void work.then(async () => { await client.invalidateQueries({ queryKey: ['interactions'] }); setMenu(null); setAction(null); setReason(''); focus(heading.current); }).catch(() => setError('No se pudo completar la acción. Actualiza e inténtalo de nuevo.')).finally(() => setActionPending(false));
          }, actionPending || mutation.isPending || (!['delete', 'block'].includes(action) && !reason.trim()))}
        </>}
        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
        {button('Cerrar', closeMenu, mutation.isPending)}
      </ScrollView></View>
    </Modal>
    {controls && data && <DiscussionControls summary={data} scope={token ? `account:${partyId ?? 'pending'}` : 'anonymous'} execute={execute}
      onClose={() => { setControls(false); focus(heading.current); }} />}

  </SafeAreaView>;
}
