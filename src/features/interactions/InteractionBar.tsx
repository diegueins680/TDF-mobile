import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { Interactions } from '../../api/interactions';
import type { InteractionIdentity, InteractionSummary } from '../../api/interactions';
import { useAuth } from '../../providers/AuthProvider';
import { useAppTheme } from '../../theme/ThemeProvider';
import { getAnalyticsClient } from '../../analytics/posthog';
import { ReactionPeople } from './ReactionPeople';
import { discussionLink, optimisticReaction } from './model';

export function InteractionBar({ kind, entityKey, onReactionAdded }: InteractionIdentity & { onReactionAdded?: () => void }) {
  const { partyId, token } = useAuth(); const { colors } = useAppTheme(); const router = useRouter(); const client = useQueryClient();
  const [error, setError] = useState(''); const [people, setPeople] = useState(false); const identity = { kind, entityKey };
  const queryKey = ['interactions', token ? `account:${partyId ?? 'pending'}` : 'anonymous', kind, entityKey, 'summary'];
  const summary = useQuery({ queryKey, queryFn: ({ signal }) => Interactions.summary(identity, Boolean(token), signal), retry: false });
  const mutation = useMutation({ mutationFn: (id: string | null) => Interactions.command(summary.data!.id, { operation: 'reaction.set', reactionTypeId: id }, randomUUID()),
    onMutate: async (id) => { setError(''); await client.cancelQueries({ queryKey }); const before = client.getQueryData<InteractionSummary>(queryKey);
      if (before) client.setQueryData(queryKey, optimisticReaction(before, id)); return before; },
    onError: (_err, _id, before) => { if (before) client.setQueryData(queryKey, before); setError('No se pudo guardar la reacción. Vuelve a intentarlo.'); },
    onSuccess: (_result, id, before) => { getAnalyticsClient().capture(id === null ? 'reaction_removed' : before?.myReactionTypeId ? 'reaction_changed' : 'reaction_added', { platform: 'mobile', entity_kind: kind }); if (id !== null) onReactionAdded?.(); },
    onSettled: async () => { await client.invalidateQueries({ queryKey: ['interactions'] }); },
  });
  if (!summary.data || summary.isError) return null;
  const data = summary.data;
  return <View style={{ gap: 8, marginTop: 12 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {data.reactable && data.reactions.filter((item) => item.selectable || item.count > 0).map((item) => <Pressable key={item.id}
        accessibilityRole="button" accessibilityLabel={`${item.label}: ${item.count}`}
        accessibilityState={{ selected: data.myReactionTypeId === item.id, disabled: !data.canReact || mutation.isPending }}
        disabled={!data.canReact || (!item.selectable && data.myReactionTypeId !== item.id) || mutation.isPending}
        onPress={() => mutation.mutate(data.myReactionTypeId === item.id ? null : item.id)}
        style={{ minHeight: 48, minWidth: 48, padding: 12, borderRadius: 12, borderWidth: data.myReactionTypeId === item.id ? 1 : 0, borderColor: colors.actionPrimary }}>
        <Text style={{ color: colors.textPrimary }}>{item.emoji} {item.count || ''}</Text>
      </Pressable>)}
      {data.commentable && <Pressable accessibilityRole="button" onPress={() => router.push(discussionLink('target', data.id) as never)} style={{ minHeight: 48, padding: 12 }}>
        <Text style={{ color: colors.actionPrimary }}>{data.commentCount ? `Ver ${data.commentCount} comentarios` : 'Comentar'}</Text>
      </Pressable>}
    </View>
    {token && data.reactions.some((item) => item.count > 0) && <Pressable accessibilityRole="button" onPress={() => setPeople(true)} style={{ minHeight: 48, padding: 12 }}><Text style={{ color: colors.actionPrimary }}>Ver quiénes reaccionaron</Text></Pressable>}
    {people && <ReactionPeople identity={identity} summary={data} onClose={() => setPeople(false)} />}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
  </View>;
}
