import type { ReactNode } from 'react';
import { Linking, Text, View } from 'react-native';
import type { InteractionComment } from '../../api/interactions';
import { useAppTheme } from '../../theme/ThemeProvider';

export function CommentBody({ comment, onError }: { comment: InteractionComment; onError: () => void }) {
  const { colors } = useAppTheme();
  if (comment.state !== 'visible') return <Text style={{ color: colors.textSecondary }}>{comment.state === 'deleted' ? 'Comentario eliminado' : 'Comentario no disponible'}</Text>;
  const points = [...comment.body]; const nodes: ReactNode[] = []; let offset = 0;
  const open = (url: string) => { void Linking.openURL(url).catch(onError); };
  const plain = (text: string, key: string) => text.split(/(https?:\/\/[^\s<>]+)/g).map((part, index) => /^https?:\/\//i.test(part)
    ? <Text key={`${key}-${index}`} accessibilityRole="link" onPress={() => open(part)} style={{ color: colors.actionPrimary, textDecorationLine: 'underline' }}>{part}</Text> : part);
  for (const mention of comment.mentions) {
    nodes.push(...plain(points.slice(offset, mention.start).join(''), String(offset)));
    nodes.push(<Text key={`mention-${mention.start}`} accessibilityRole="link" onPress={() => open(`https://www.tdfrecords.net/perfil/${mention.partyId}`)} style={{ color: colors.actionPrimary, textDecorationLine: 'underline' }}>{points.slice(mention.start, mention.end).join('')}</Text>);
    offset = mention.end;
  }
  nodes.push(...plain(points.slice(offset).join(''), String(offset)));
  return <View style={{ gap: 8 }}>
    {comment.legacyPresentation?.title && <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{comment.legacyPresentation.title}</Text>}
    <Text selectable style={{ color: colors.textPrimary }}>{nodes}</Text>
    {comment.legacyPresentation?.mediaUrls?.filter((url) => /^https?:\/\//i.test(url) || /^\/[^/]/.test(url)).map((url, index) => <Text key={`${index}-${url}`} accessibilityRole="link" onPress={() => open(url.startsWith('/') ? `https://www.tdfrecords.net${url}` : url)} style={{ minHeight: 48, padding: 12, color: colors.actionPrimary, textDecorationLine: 'underline' }}>Archivo adjunto {index + 1}</Text>)}
  </View>;
}
