import React, { useState } from 'react';
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { countMomentReactions } from '../lib/eventMoments';
import { impactLight } from '../utils/haptics';
import { useAppTheme } from '../theme/ThemeProvider';
import type { EventMoment, EventMomentReactionKind } from '../types';

const REACTION_META: Array<{
  kind: EventMomentReactionKind;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
}> = [
  { kind: 'fire', label: 'Fire', icon: 'fire', color: '#ea580c' },
  { kind: 'love', label: 'Love', icon: 'heart', color: '#db2777' },
  { kind: 'applause', label: 'Clap', icon: 'hand-clap', color: '#2563eb' },
];

const formatDuration = (durationMs?: number | null): string => {
  if (!durationMs || durationMs <= 0) return 'Video corto';
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

type EventMomentCardProps = {
  moment: EventMoment;
  currentActorKey: string;
  currentPartyId?: string | null;
  featured?: boolean;
  reactionDisabled?: boolean;
  commentDisabled?: boolean;
  connectDisabled?: boolean;
  commentDraft: string;
  onChangeComment: (momentId: string, value: string) => void;
  onSubmitComment: (momentId: string) => void;
  onToggleReaction: (momentId: string, reaction: EventMomentReactionKind) => void;
  onReactionPosted?: () => void;
  onConnectAuthor?: (partyId: string) => void;
  onOpenMedia?: (uri: string) => void;
};

export function EventMomentCard({
  moment,
  currentActorKey,
  currentPartyId,
  featured = false,
  reactionDisabled = false,
  commentDisabled = false,
  connectDisabled = false,
  commentDraft,
  onChangeComment,
  onSubmitComment,
  onToggleReaction,
  onReactionPosted,
  onConnectAuthor,
  onOpenMedia,
}: EventMomentCardProps) {
  const { colors } = useAppTheme();
  const [imageError, setImageError] = useState(false);
  const totalReactions = countMomentReactions(moment);
  const canConnect =
    !!moment.authorPartyId &&
    !!onConnectAuthor &&
    (!currentPartyId || currentPartyId !== moment.authorPartyId);

  return (
    <View style={[styles.card, featured && { borderColor: colors.selected, backgroundColor: colors.infoSurface }]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <View style={styles.headerRow}>
            <Text maxFontSizeMultiplier={1.5} style={[styles.authorName, { color: colors.textPrimary }]}>{moment.authorName}</Text>
            {featured ? (
              <View style={[styles.featuredBadge, { backgroundColor: colors.selected }]}>
                <Text maxFontSizeMultiplier={1.5} style={[styles.featuredBadgeText, { color: colors.actionPrimary }]}>Top moment</Text>
              </View>
            ) : null}
          </View>
          <Text maxFontSizeMultiplier={1.5} style={[styles.metaText, { color: colors.textSecondary }]}>
            {new Date(moment.createdAt).toLocaleString()}
            {moment.authorPartyId ? ` · Party #${moment.authorPartyId}` : ''}
          </Text>
        </View>
        {canConnect ? (
          <TouchableOpacity
            style={[
              styles.connectButton,
              { backgroundColor: colors.selected },
              connectDisabled && styles.buttonDisabled,
            ]}
            onPress={() => moment.authorPartyId && onConnectAuthor?.(moment.authorPartyId)}
            disabled={connectDisabled}
            accessibilityRole="button"
            accessibilityLabel="Conectar con artista"
          >
            <Text maxFontSizeMultiplier={1.5} style={[styles.connectButtonText, { color: colors.actionPrimary }]}>Conectar</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity
        activeOpacity={moment.media.kind === 'video' ? 0.8 : 1}
        disabled={!onOpenMedia || moment.media.kind !== 'video'}
        onPress={() => onOpenMedia?.(moment.media.uri)}
        accessibilityRole={moment.media.kind === 'video' ? 'button' : 'image'}
        accessibilityLabel={`Video de ${moment.authorName}`}
      >
        {moment.media.kind === 'image' && !imageError ? (
          <Image
            source={{ uri: moment.media.uri }}
            style={[styles.mediaImage, { backgroundColor: colors.borderSubtle }]}
            onError={() => setImageError(true)}
          />
        ) : moment.media.kind === 'image' && imageError ? (
          <View style={[styles.mediaImage, styles.mediaPlaceholder, { backgroundColor: colors.borderSubtle }]}>
            <Text style={styles.fallbackIcon}>🎵</Text>
          </View>
        ) : (
          <View style={[styles.videoBox, { backgroundColor: colors.textPrimary }]}>
            <MaterialCommunityIcons name="play-circle-outline" size={40} color={colors.surface} />
            <Text maxFontSizeMultiplier={1.5} style={[styles.videoTitle, { color: colors.surface }]}>Video del evento</Text>
            <Text maxFontSizeMultiplier={1.5} style={[styles.videoMeta, { color: colors.textSecondary }]}>
              {formatDuration(moment.media.durationMs)}
            </Text>
            {onOpenMedia ? (
              <Text maxFontSizeMultiplier={1.5} style={[styles.videoHint, { color: colors.actionPrimary }]}>Toca para abrir</Text>
            ) : null}
          </View>
        )}
      </TouchableOpacity>

      {moment.caption ? (
        <Text maxFontSizeMultiplier={1.5} style={[styles.caption, { color: colors.textPrimary }]}>{moment.caption}</Text>
      ) : null}

      <View style={styles.reactionRow}>
        {REACTION_META.map((reaction) => {
          const count = moment.reactions[reaction.kind].length;
          const active = moment.reactions[reaction.kind].includes(currentActorKey);
          return (
            <TouchableOpacity
              key={reaction.kind}
              style={[
                styles.reactionChip,
                { borderColor: active ? reaction.color : colors.borderSubtle },
                active && { backgroundColor: `${reaction.color}14` },
                reactionDisabled && styles.buttonDisabled,
              ]}
              onPress={async () => {
                void impactLight();
                try {
                  await onToggleReaction(moment.id, reaction.kind);
                  onReactionPosted?.();
                } catch {
                  // Swallow — the parent owns error surfacing for the toggle
                  // mutation; we only fire the conversion callback on success.
                }
              }}
              disabled={reactionDisabled}
              accessibilityRole="button"
              accessibilityLabel={`${reaction.label}, ${count} reacciones`}
              accessibilityState={{ disabled: reactionDisabled }}
            >
              <MaterialCommunityIcons
                name={reaction.icon}
                size={16}
                color={active ? reaction.color : colors.textSecondary}
              />
              <Text maxFontSizeMultiplier={1.5} style={[styles.reactionText, { color: colors.textSecondary }, active && { color: reaction.color }]}>
                {reaction.label} {count > 0 ? count : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text maxFontSizeMultiplier={1.5} style={[styles.summaryText, { color: colors.textSecondary }]}>
        {totalReactions} reacciones · {moment.comments.length} comentarios
      </Text>

      <View style={styles.commentsList}>
        {moment.comments.slice(0, 2).map((comment) => (
          <View key={comment.id} style={[styles.commentBubble, { backgroundColor: colors.surfaceMuted }]}>
            <Text maxFontSizeMultiplier={1.5} style={[styles.commentAuthor, { color: colors.textPrimary }]}>{comment.authorName}</Text>
            <Text maxFontSizeMultiplier={1.5} style={[styles.commentBody, { color: colors.textSecondary }]}>{comment.body}</Text>
          </View>
        ))}
      </View>

      <View style={styles.commentComposer}>
        <TextInput
          maxFontSizeMultiplier={1.5}
          placeholder="Escribe un comentario"
          value={commentDraft}
          onChangeText={(value) => onChangeComment(moment.id, value)}
          style={[styles.commentInput, { borderColor: colors.border, color: colors.textPrimary }]}
          editable={!commentDisabled}
          accessibilityLabel="Escribe un comentario"
        />
        <TouchableOpacity
          style={[
            styles.commentButton,
            { backgroundColor: colors.actionPrimary },
            (!commentDraft.trim() || commentDisabled) && styles.buttonDisabled,
          ]}
          onPress={() => onSubmitComment(moment.id)}
          disabled={!commentDraft.trim() || commentDisabled}
          accessibilityRole="button"
          accessibilityLabel="Enviar comentario"
          accessibilityState={{ disabled: !commentDraft.trim() || commentDisabled }}
        >
          <Text maxFontSizeMultiplier={1.5} style={[styles.commentButtonText, { color: colors.actionPrimaryContrast }]}>Enviar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  authorName: {
    fontSize: 15,
    fontWeight: '800',
  },
  metaText: {
    fontSize: 12,
  },
  featuredBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  featuredBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  connectButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 44,
  },
  connectButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  mediaImage: {
    width: '100%',
    height: 220,
    borderRadius: 14,
  },
  mediaPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackIcon: {
    fontSize: 40,
  },
  videoBox: {
    height: 220,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  videoMeta: {
    fontSize: 12,
  },
  videoHint: {
    fontSize: 12,
    fontWeight: '600',
  },
  caption: {
    lineHeight: 20,
  },
  reactionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 44,
  },
  reactionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  summaryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  commentsList: {
    gap: 8,
  },
  commentBubble: {
    gap: 2,
    borderRadius: 12,
    padding: 10,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '700',
  },
  commentBody: {
    lineHeight: 18,
  },
  commentComposer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  commentButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  commentButtonText: {
    fontWeight: '700',
    fontSize: 12,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
