import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { countMomentReactions } from '../lib/eventMoments';
import type { EventMoment, EventMomentMedia, EventMomentReactionOption } from '../types';

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
  pending?: boolean;
  imagePriority?: 'high' | 'normal' | 'low';
  reactionDisabled?: boolean;
  reactionOptions: readonly EventMomentReactionOption[];
  reactionUnavailableLabel: string;
  commentDisabled?: boolean;
  connectDisabled?: boolean;
  commentDraft: string;
  onChangeComment: (momentId: string, value: string) => void;
  onSubmitComment: (momentId: string) => void;
  onToggleReaction: (momentId: string, reaction: EventMomentReactionOption) => void;
  onReactionPosted?: () => void;
  onConnectAuthor?: (partyId: string) => void;
  onOpenMedia?: (media: EventMomentMedia) => void;
};

export function EventMomentCard({
  moment,
  currentActorKey,
  currentPartyId,
  featured = false,
  pending = false,
  imagePriority = 'normal',
  reactionDisabled = false,
  reactionOptions,
  reactionUnavailableLabel,
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
  const [imageLoading, setImageLoading] = useState(moment.media.kind === 'image');
  const [imageFailed, setImageFailed] = useState(false);
  const totalReactions = countMomentReactions(moment);
  const canConnect =
    !!moment.authorPartyId &&
    !!onConnectAuthor &&
    (!currentPartyId || currentPartyId !== moment.authorPartyId);

  return (
    <View style={[styles.card, featured && styles.cardFeatured]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <View style={styles.headerRow}>
            <Text style={styles.authorName}>{moment.authorName}</Text>
            {featured ? (
              <View style={styles.featuredBadge}>
                <Text style={styles.featuredBadgeText}>Top moment</Text>
              </View>
            ) : null}
            {pending ? (
              <View style={styles.pendingBadge} accessibilityLiveRegion="polite">
                <ActivityIndicator size="small" color="#1d4ed8" />
                <Text style={styles.pendingBadgeText}>Publicando…</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.metaText}>
            {new Date(moment.createdAt).toLocaleString()}
            {moment.authorPartyId ? ` · Party #${moment.authorPartyId}` : ''}
          </Text>
        </View>
        {canConnect ? (
          <TouchableOpacity
            style={[styles.connectButton, (connectDisabled || pending) && styles.buttonDisabled]}
            onPress={() => moment.authorPartyId && onConnectAuthor?.(moment.authorPartyId)}
            disabled={connectDisabled || pending}
          >
            <Text style={styles.connectButtonText}>Conectar</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity
        activeOpacity={onOpenMedia ? 0.85 : 1}
        disabled={!onOpenMedia}
        onPress={() => onOpenMedia?.(moment.media)}
        accessibilityRole={onOpenMedia ? 'button' : undefined}
        accessibilityLabel={
          moment.media.kind === 'image'
            ? `Ver foto de ${moment.authorName}`
            : `Abrir video de ${moment.authorName}`
        }
      >
        {moment.media.kind === 'image' ? (
          <View style={styles.mediaFrame}>
            {imageLoading && !imageFailed ? (
              <ActivityIndicator style={styles.mediaLoader} color="#2563eb" />
            ) : null}
            {imageFailed ? (
              <View style={styles.mediaFallback}>
                <MaterialCommunityIcons name="image-off-outline" size={32} color="#64748b" />
                <Text style={styles.mediaFallbackText}>No pudimos cargar esta foto</Text>
              </View>
            ) : (
              <Image
                source={{
                  uri: moment.media.uri,
                  width: moment.media.width,
                  height: moment.media.height,
                }}
                style={styles.mediaImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                priority={imagePriority}
                recyclingKey={moment.id}
                transition={120}
                onLoadStart={() => {
                  setImageFailed(false);
                  setImageLoading(true);
                }}
                onDisplay={() => setImageLoading(false)}
                onError={() => {
                  setImageLoading(false);
                  setImageFailed(true);
                }}
                accessibilityRole="image"
                accessibilityLabel={moment.caption || `Foto compartida por ${moment.authorName}`}
              />
            )}
          </View>
        ) : (
          <View style={styles.videoBox}>
            <MaterialCommunityIcons name="play-circle-outline" size={40} color="#f8fafc" />
            <Text style={styles.videoTitle}>Video del evento</Text>
            <Text style={styles.videoMeta}>{formatDuration(moment.media.durationMs)}</Text>
            {onOpenMedia ? <Text style={styles.videoHint}>Toca para abrir</Text> : null}
          </View>
        )}
      </TouchableOpacity>

      {moment.caption ? <Text style={styles.caption}>{moment.caption}</Text> : null}

      <View style={styles.reactionRow}>
        {reactionOptions.map((reaction) => {
          const actors = moment.reactions[reaction.id] ?? [];
          const count = actors.length;
          const active = actors.includes(currentActorKey);
          return (
            <TouchableOpacity
              key={reaction.id}
              style={[
                styles.reactionChip,
                active && styles.reactionChipActive,
                (reactionDisabled || pending) && styles.buttonDisabled,
              ]}
              onPress={async () => {
                try {
                  await onToggleReaction(moment.id, reaction);
                  onReactionPosted?.();
                } catch {
                  // Swallow — the parent owns error surfacing for the toggle
                  // mutation; we only fire the conversion callback on success.
                }
              }}
              disabled={reactionDisabled || pending}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled: reactionDisabled || pending }}
              accessibilityLabel={count > 0 ? `${reaction.label}: ${count}` : reaction.label}
            >
              <Text accessibilityElementsHidden style={styles.reactionEmoji}>{reaction.emoji}</Text>
              <Text style={[styles.reactionText, active && styles.reactionTextActive]}>
                {reaction.label} {count > 0 ? count : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {reactionOptions.length === 0 ? (
        <Text style={styles.reactionUnavailable} accessibilityRole="alert">
          {reactionUnavailableLabel}
        </Text>
      ) : null}

      <Text style={styles.summaryText}>
        {totalReactions} reacciones · {moment.comments.length} comentarios
      </Text>

      <View style={styles.commentsList}>
        {moment.comments.slice(0, 2).map((comment) => (
          <View key={comment.id} style={styles.commentBubble}>
            <Text style={styles.commentAuthor}>{comment.authorName}</Text>
            <Text style={styles.commentBody}>{comment.body}</Text>
          </View>
        ))}
      </View>

      <View style={styles.commentComposer}>
        <TextInput
          placeholder="Escribe un comentario"
          value={commentDraft}
          onChangeText={(value) => onChangeComment(moment.id, value)}
          style={styles.commentInput}
          editable={!commentDisabled && !pending}
        />
        <TouchableOpacity
          style={[
            styles.commentButton,
            (!commentDraft.trim() || commentDisabled || pending) && styles.buttonDisabled,
          ]}
          onPress={() => onSubmitComment(moment.id)}
          disabled={!commentDraft.trim() || commentDisabled || pending}
        >
          <Text style={styles.commentButtonText}>Enviar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 18,
    padding: 14,
  },
  cardFeatured: {
    borderColor: '#c7d2fe',
    backgroundColor: '#f8faff',
  },
  reactionChipActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  reactionTextActive: { color: '#1d4ed8' },
  reactionEmoji: { fontSize: 16, lineHeight: 20 },
  reactionUnavailable: { color: '#64748b', fontSize: 12 },
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
    color: '#0f172a',
  },
  metaText: {
    color: '#64748b',
    fontSize: 12,
  },
  featuredBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#dbeafe',
  },
  featuredBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#eff6ff',
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  connectButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#eef2ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  connectButtonText: {
    color: '#1e3a8a',
    fontSize: 12,
    fontWeight: '700',
  },
  mediaFrame: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaLoader: {
    ...StyleSheet.absoluteFillObject,
  },
  mediaFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mediaFallbackText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  videoBox: {
    height: 220,
    borderRadius: 14,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  videoTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  videoMeta: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  videoHint: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '600',
  },
  caption: {
    color: '#111827',
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
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 44,
    minWidth: 44,
  },
  reactionText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  summaryText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  commentsList: {
    gap: 8,
  },
  commentBubble: {
    gap: 2,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    padding: 10,
  },
  commentAuthor: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700',
  },
  commentBody: {
    color: '#334155',
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
    borderColor: '#d4d4d8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
  },
  commentButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  commentButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
