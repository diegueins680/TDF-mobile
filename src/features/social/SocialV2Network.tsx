import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  SocialV2,
  createSocialRequestKey,
  socialModeQueryKey,
  socialV2ErrorMessage,
  socialV2QueryRoot,
  type SocialV2Me,
  type SocialV2Operation,
  type SocialV2Relationship,
} from '../../api/socialV2';
import { useAppTheme } from '../../theme/ThemeProvider';

// Mirrors tdf-hq-ui SocialWorkspace (web, VITE_SOCIAL_V2_ENABLED): same
// operations, same Spanish copy, consent-based connections instead of the
// retired one-sided "friend" edges.

type Tab = 'following' | 'discover' | 'connections';

export const relationshipStatusLabel = (state: SocialV2Relationship): string =>
  state.blocked ? 'Bloqueado'
    : state.connected ? 'Conexión aceptada'
      : state.incoming ? 'Solicitud recibida'
        : state.requested ? 'Solicitud enviada'
          : state.following ? 'Siguiendo' : '';

export function SocialV2RelationshipActions({ partyId, displayName, initial, ownerPartyId, onChanged }: {
  partyId: number;
  displayName: string;
  initial: SocialV2Relationship;
  ownerPartyId: string | null;
  onChanged?: (state: SocialV2Relationship) => void;
}) {
  const { colors } = useAppTheme();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: socialModeQueryKey(ownerPartyId) });
    void qc.invalidateQueries({ queryKey: socialV2QueryRoot(ownerPartyId) });
  };
  const mutation = useMutation<SocialV2Relationship, Error, SocialV2Operation>({
    mutationFn: (operation) => SocialV2.command(partyId, operation, initial.revision, createSocialRequestKey()),
    onSuccess: (state) => {
      setError(null);
      onChanged?.(state);
      // A block or mute can revoke cached eligibility: drop cached v2 results.
      void qc.resetQueries({ queryKey: socialV2QueryRoot(ownerPartyId) });
      void qc.invalidateQueries({ queryKey: socialModeQueryKey(ownerPartyId) });
    },
    onError: (err) => {
      setError(socialV2ErrorMessage(err));
      refresh();
    },
  });
  const action = (label: string, operation: SocialV2Operation, options?: { confirm?: string; primary?: boolean }) => (
    <Pressable
      key={operation}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${displayName}`}
      accessibilityState={{ disabled: mutation.isPending, busy: mutation.isPending }}
      disabled={mutation.isPending}
      onPress={() => {
        if (!options?.confirm) {
          mutation.mutate(operation);
          return;
        }
        Alert.alert(label, options.confirm, [
          { text: 'Cancelar', style: 'cancel' },
          { text: label, style: 'destructive', onPress: () => mutation.mutate(operation) },
        ]);
      }}
      style={[
        styles.action,
        { backgroundColor: options?.primary ? colors.actionPrimary : colors.surfaceMuted },
        mutation.isPending && styles.disabled,
      ]}
    >
      <Text maxFontSizeMultiplier={1.5} style={[styles.actionText, { color: options?.primary ? colors.actionPrimaryContrast : colors.textPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );
  const data = initial;
  return (
    <View style={styles.actionsWrap}>
      {error ? (
        <View accessibilityRole="alert" style={styles.errorRow}>
          <Text maxFontSizeMultiplier={1.5} style={[styles.helper, { color: colors.danger }]}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => { setError(null); refresh(); }} style={styles.inlineButton}>
            <Text style={[styles.actionText, { color: colors.actionPrimary }]}>Actualizar</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.actions}>
        {mutation.isPending ? <ActivityIndicator color={colors.actionPrimary} /> : null}
        {data.blocked ? action('Desbloquear', 'unblock') : (
          <>
            {action(data.following ? 'Dejar de seguir' : 'Seguir', data.following ? 'unfollow' : 'follow', { primary: !data.following })}
            {data.connected ? action('Desconectar', 'disconnect', { confirm: `¿Desconectarte de ${displayName}?` })
              : data.incoming ? action('Aceptar conexión', 'accept', { primary: true })
                : data.requested ? action('Cancelar solicitud', 'disconnect')
                  : action('Conectar', 'request')}
            {action(data.muted ? 'Dejar de silenciar' : 'Silenciar', data.muted ? 'unmute' : 'mute')}
            {action('Bloquear', 'block', { confirm: `¿Bloquear a ${displayName}? Dejarán de seguirse y de estar conectados.` })}
            {action(data.dismissed ? 'Volver a recomendar' : 'No me interesa', data.dismissed ? 'undismiss' : 'dismiss')}
          </>
        )}
      </View>
    </View>
  );
}

export function SocialV2Network({ me, ownerPartyId }: { me: SocialV2Me; ownerPartyId: string | null }) {
  const { colors } = useAppTheme();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('connections');
  const root = socialV2QueryRoot(ownerPartyId);
  const feed = useInfiniteQuery({
    queryKey: [...root, 'following'],
    queryFn: ({ pageParam }) => SocialV2.following(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: tab === 'following',
  });
  const discover = useQuery({ queryKey: [...root, 'discover'], queryFn: SocialV2.discover, enabled: tab === 'discover' });
  const preferences = useMutation({
    mutationFn: (value: { discoverable: boolean; personalized: boolean }) => SocialV2.preferences(value, me.revision),
    onError: () => Alert.alert('Error', 'No pudimos guardar tu configuración. Actualiza e inténtalo de nuevo.'),
    onSettled: () => { void qc.invalidateQueries({ queryKey: socialModeQueryKey(ownerPartyId) }); },
  });
  const posts = feed.isError ? [] : feed.data?.pages.flatMap((page) => page.items) ?? [];
  const tabButton = (key: Tab, label: string) => (
    <Pressable
      key={key}
      accessibilityRole="tab"
      accessibilityState={{ selected: tab === key }}
      onPress={() => setTab(key)}
      style={[styles.tab, { backgroundColor: tab === key ? colors.selected : colors.canvas }]}
    >
      <Text maxFontSizeMultiplier={1.5} style={[styles.tabText, { color: tab === key ? colors.actionPrimary : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
  const card = [styles.item, { borderColor: colors.borderSubtle }];
  return (
    <View style={styles.wrap}>
      <Text maxFontSizeMultiplier={1.5} style={[styles.sectionTitle, { color: colors.textPrimary }]} accessibilityRole="header">Tu comunidad musical</Text>
      <Text maxFontSizeMultiplier={1.5} style={[styles.helper, { color: colors.textSecondary }]}>
        Encuentra personas con quienes crear, colaborar y compartir música. Cada persona debe aceptar para conectarse.
      </Text>
      <View style={styles.switchRow}>
        <Text maxFontSizeMultiplier={1.5} style={[styles.switchLabel, { color: colors.textPrimary }]}>Mostrar mi perfil en Descubrir</Text>
        <Switch
          accessibilityLabel="Mostrar mi perfil en Descubrir"
          value={me.discoverable}
          disabled={preferences.isPending}
          onValueChange={(discoverable) => preferences.mutate({ discoverable, personalized: me.personalized })}
        />
      </View>
      <View style={styles.switchRow}>
        <Text maxFontSizeMultiplier={1.5} style={[styles.switchLabel, { color: colors.textPrimary }]}>Personalizar con mis intereses musicales</Text>
        <Switch
          accessibilityLabel="Personalizar con mis intereses musicales"
          value={me.personalized}
          disabled={preferences.isPending}
          onValueChange={(personalized) => preferences.mutate({ personalized, discoverable: me.discoverable })}
        />
      </View>
      <View accessibilityRole="tablist" style={[styles.tabs, { borderColor: colors.borderSubtle }]}>
        {tabButton('connections', `Conexiones (${me.relationships.length})`)}
        {tabButton('following', 'Siguiendo')}
        {tabButton('discover', 'Descubrir')}
      </View>

      {tab === 'connections' ? (
        me.relationships.length === 0 ? (
          <Text style={[styles.helper, { color: colors.textSecondary }]}>Aún no hay conexiones. Cada persona debe aceptar para conectarse.</Text>
        ) : me.relationships.map((person) => (
          <View key={person.partyId} style={card} accessibilityLabel={person.displayName}>
            <Text maxFontSizeMultiplier={1.5} style={[styles.itemTitle, { color: colors.textPrimary }]}>{person.displayName}</Text>
            {relationshipStatusLabel(person) ? (
              <Text maxFontSizeMultiplier={1.5} style={[styles.helper, { color: colors.textSecondary }]}>{relationshipStatusLabel(person)}</Text>
            ) : null}
            <SocialV2RelationshipActions partyId={person.partyId} displayName={person.displayName} initial={person} ownerPartyId={ownerPartyId} />
          </View>
        ))
      ) : null}

      {tab === 'following' ? (
        <>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>Publicaciones de los clubes y personas que sigues, de más recientes a más antiguas.</Text>
          {feed.isPending ? <Text accessibilityLiveRegion="polite" style={[styles.helper, { color: colors.textSecondary }]}>Cargando publicaciones…</Text> : null}
          {feed.isError ? (
            <Pressable accessibilityRole="button" onPress={() => { void feed.refetch(); }}>
              <Text style={[styles.helper, { color: colors.danger }]}>No pudimos cargar las publicaciones. Toca para reintentar.</Text>
            </Pressable>
          ) : null}
          {!feed.isPending && !feed.isError && posts.length === 0 ? (
            <Text style={[styles.helper, { color: colors.textSecondary }]}>Sigue artistas o descubre personas para empezar.</Text>
          ) : null}
          {posts.map((post) => (
            <View key={post.postId} style={card}>
              <Text maxFontSizeMultiplier={1.5} style={[styles.itemTitle, { color: colors.textPrimary }]}>{post.title ?? post.authorName}</Text>
              <Text maxFontSizeMultiplier={1.5} style={[styles.meta, { color: colors.textSecondary }]}>
                {post.authorName} · {new Date(post.publishedAt).toLocaleString('es-EC')}
              </Text>
              <Text maxFontSizeMultiplier={1.5} style={{ color: colors.textPrimary }}>{post.content}</Text>
            </View>
          ))}
          {feed.hasNextPage ? (
            <Pressable accessibilityRole="button" disabled={feed.isFetchingNextPage} onPress={() => { void feed.fetchNextPage(); }} style={styles.inlineButton}>
              <Text style={[styles.actionText, { color: colors.actionPrimary }]}>Ver más</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {tab === 'discover' ? (
        <>
          {discover.isPending ? <Text accessibilityLiveRegion="polite" style={[styles.helper, { color: colors.textSecondary }]}>Buscando perfiles…</Text> : null}
          {discover.isError ? (
            <Pressable accessibilityRole="button" onPress={() => { void discover.refetch(); }}>
              <Text style={[styles.helper, { color: colors.danger }]}>No pudimos cargar las sugerencias. Toca para reintentar.</Text>
            </Pressable>
          ) : null}
          {discover.data?.items.length === 0 ? (
            <Text style={[styles.helper, { color: colors.textSecondary }]}>No hay sugerencias nuevas. Puedes actualizar tus intereses o volver más tarde.</Text>
          ) : null}
          {!discover.isError && discover.data?.items.map((person) => (
            <View key={person.partyId} style={card} accessibilityLabel={person.displayName}>
              <Text maxFontSizeMultiplier={1.5} style={[styles.itemTitle, { color: colors.textPrimary }]}>{person.displayName}</Text>
              <Text maxFontSizeMultiplier={1.5} style={[styles.helper, { color: colors.textSecondary }]}>
                {person.reason === 'shared_interests' ? 'Intereses musicales compartidos' : 'Perfil público de la comunidad'}
              </Text>
              <SocialV2RelationshipActions partyId={person.partyId} displayName={person.displayName} initial={person.relationship} ownerPartyId={ownerPartyId} />
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  helper: { fontSize: 13 },
  meta: { fontSize: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 },
  switchLabel: { flex: 1, flexShrink: 1 },
  tabs: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 1 },
  tab: { flex: 1, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  tabText: { textAlign: 'center', fontWeight: '700', fontSize: 13 },
  item: { borderWidth: 1, padding: 12, borderRadius: 10, gap: 6 },
  itemTitle: { fontSize: 15, fontWeight: '700' },
  actionsWrap: { gap: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  action: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, justifyContent: 'center' },
  actionText: { fontWeight: '700', fontSize: 12 },
  inlineButton: { minHeight: 44, justifyContent: 'center' },
  errorRow: { gap: 4 },
  disabled: { opacity: 0.6 },
});
