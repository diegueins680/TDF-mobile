import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Interactions } from '../../api/interactions';
import type { InteractionIdentity, InteractionSummary } from '../../api/interactions';
import { useAuth } from '../../providers/AuthProvider';
import { useAppTheme } from '../../theme/ThemeProvider';

export function ReactionPeople({ identity, summary, onClose }: { identity: InteractionIdentity; summary: InteractionSummary; onClose: () => void }) {
  const { colors } = useAppTheme(); const { partyId, token } = useAuth();
  const query = useInfiniteQuery({ queryKey: ['interactions', token ? `account:${partyId ?? 'pending'}` : 'anonymous', identity.kind, identity.entityKey, 'reactors'],
    initialPageParam: undefined as number | undefined, queryFn: ({ pageParam, signal }) => Interactions.reactors(identity, Boolean(token), pageParam, signal),
    getNextPageParam: (page) => page.nextCursor ?? undefined, retry: false });
  const button = (label: string, onPress: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={{ minHeight: 48, padding: 12 }}><Text style={{ color: colors.actionPrimary }}>{label}</Text></Pressable>;
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}><ScrollView accessibilityViewIsModal style={{ maxHeight: '80%', backgroundColor: colors.surfaceRaised }} contentContainerStyle={{ padding: 24, gap: 12 }}>
      <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 22 }}>Reacciones</Text>
      <Text style={{ color: colors.textSecondary }}>Solo se muestran las personas cuya privacidad permite identificarlas.</Text>
      {query.isPending && <ActivityIndicator accessibilityLabel="Cargando reacciones" />}
      {query.isError && <View><Text accessibilityRole="alert" style={{ color: colors.danger }}>No se pudieron cargar las reacciones.</Text>{button('Reintentar', () => { void query.refetch(); })}</View>}
      {query.data?.pages.every((page) => page.items.length === 0) && <Text style={{ color: colors.textPrimary }}>No hay identidades disponibles.</Text>}
      {query.data?.pages.flatMap((page) => page.items).map((item) => <View key={item.author.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
        {item.author.avatarUrl && <Image source={{ uri: item.author.avatarUrl }} style={{ width: 36, height: 36, borderRadius: 18 }} accessible={false} />}
        <Text style={{ color: colors.textPrimary }}>{item.author.displayName} · {summary.reactions.find((reaction) => reaction.id === item.reactionTypeId)?.emoji}</Text>
      </View>)}
      {query.hasNextPage && button('Ver más personas', () => { void query.fetchNextPage(); }, query.isFetchingNextPage)}
      {button('Cerrar', onClose)}
    </ScrollView></View>
  </Modal>;
}
