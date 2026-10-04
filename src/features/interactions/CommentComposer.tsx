import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { PartySelector } from '../../components/PartySelector';
import { useAppTheme } from '../../theme/ThemeProvider';
import type { InteractionMention } from '../../api/interactions';
import { appendMention, mentionQuery, reconcileMentions } from './model';

export function CommentComposer({ targetId, initialBody = '', initialMentions = [], label = 'Escribe un comentario', focusOnMount = false, onSave, onCancel }: {
  targetId: string; initialBody?: string; initialMentions?: InteractionMention[]; label?: string; focusOnMount?: boolean;
  onSave: (body: string, mentions: InteractionMention[], requestKey: string) => Promise<void>; onCancel?: () => void;
}) {
  const { colors } = useAppTheme(); const [body, setBody] = useState(initialBody); const [mentions, setMentions] = useState(initialMentions);
  const [picker, setPicker] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState('');
  const input = useRef<TextInput>(null); const key = useRef<string | null>(null);
  useEffect(() => { if (focusOnMount) input.current?.focus(); }, [focusOnMount]);
  const button = { minHeight: 48, padding: 12 };
  return <View style={{ gap: 8, paddingVertical: 12 }}>
    <Text style={{ color: colors.textPrimary }}>{label}</Text>
    <TextInput ref={input} multiline accessibilityLabel={label} value={body} editable={!pending}
      onChangeText={(next) => { setMentions(reconcileMentions(body, next, mentions)); setBody(next); key.current = null; if (mentionQuery(next) !== undefined) setPicker(true); }}
      style={{ minHeight: 80, maxHeight: 180, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, color: colors.textPrimary, textAlignVertical: 'top' }} />
    <Text style={{ color: colors.textSecondary }}>{[...body].length}/4096</Text>
    {picker && <PartySelector value={null} context="interaction_mention" scopeId={targetId} initialQuery={mentionQuery(body)} label="Mencionar a una persona" onChange={(person) => {
      if (!person) return;
      const next = appendMention(body, mentions, person.partyId, person.username ?? person.displayName);
      setBody(next.body); setMentions(next.mentions);
      key.current = null; setPicker(false); input.current?.focus();
    }} />}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: picker }} disabled={pending || mentions.length >= 20} onPress={() => setPicker(!picker)} style={button}><Text style={{ color: colors.actionPrimary }}>@ Mencionar</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: pending || !body.trim() || [...body].length > 4096 }}
        disabled={pending || !body.trim() || [...body].length > 4096} style={button} onPress={() => {
          setPending(true); setError(''); key.current ??= randomUUID();
          void onSave(body, mentions, key.current).then(() => { setBody(''); setMentions([]); key.current = null; })
            .catch(() => setError('No se pudo publicar. Tu texto sigue aquí; vuelve a intentarlo.')).finally(() => setPending(false));
        }}>{pending ? <ActivityIndicator accessibilityLabel="Publicando comentario" /> : <Text style={{ color: colors.actionPrimary }}>Publicar</Text>}</Pressable>
      {onCancel && <Pressable accessibilityRole="button" disabled={pending} onPress={onCancel} style={button}><Text style={{ color: colors.textPrimary }}>Cancelar</Text></Pressable>}
    </View>
  </View>;
}
