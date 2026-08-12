import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAppTheme } from '../theme/ThemeProvider';
import type { EventLiveBroadcast } from '../types';

type EventLiveBroadcastCardProps = {
  broadcast: EventLiveBroadcast;
  currentPartyId?: string | null;
  ending?: boolean;
  onWatch: (broadcast: EventLiveBroadcast) => void;
  onEnd: (broadcast: EventLiveBroadcast) => void;
};

const isExternalPlaybackUrl = (url?: string | null): url is string =>
  Boolean(url && /^https?:\/\//i.test(url.trim()));

export function EventLiveBroadcastCard({
  broadcast,
  currentPartyId,
  ending,
  onWatch,
  onEnd,
}: EventLiveBroadcastCardProps) {
  const { colors } = useAppTheme();
  const isLive = broadcast.status === 'live';
  const canEnd = isLive && !!currentPartyId && broadcast.broadcasterPartyId === currentPartyId;
  const hasPlayback = isExternalPlaybackUrl(broadcast.playbackUrl);

  return (
    <View
      style={[
        styles.card,
        { borderColor: colors.borderSubtle, backgroundColor: colors.surface },
        isLive && { borderColor: colors.dangerBorder, backgroundColor: colors.dangerSurface },
      ]}
    >
      <View style={styles.header}>
        <View
          style={styles.statusRow}
          accessibilityLabel={`Estado: ${isLive ? 'En vivo' : 'Finalizado'}, ${broadcast.viewerCount} espectadores`}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isLive ? colors.danger : colors.textSecondary },
            ]}
          />
          <Text
            maxFontSizeMultiplier={1.5}
            style={[styles.statusText, { color: isLive ? colors.danger : colors.textSecondary }]}
          >
            {isLive ? 'En vivo' : 'Finalizado'}
          </Text>
        </View>
        <View
          style={[styles.viewerBadge, { backgroundColor: colors.borderSubtle }]}
          accessibilityLabel={`${broadcast.viewerCount} espectadores`}
        >
          <MaterialCommunityIcons name="eye-outline" size={14} color={colors.textSecondary} />
          <Text maxFontSizeMultiplier={1.5} style={[styles.viewerText, { color: colors.textSecondary }]}>
            {broadcast.viewerCount}
          </Text>
        </View>
      </View>

      <Text maxFontSizeMultiplier={1.5} style={[styles.title, { color: colors.textPrimary }]}>{broadcast.title}</Text>
      <Text maxFontSizeMultiplier={1.5} style={[styles.meta, { color: colors.textSecondary }]}>
        Fanclub de {broadcast.artistName} · {broadcast.broadcasterName}
      </Text>
      {broadcast.description ? (
        <Text maxFontSizeMultiplier={1.5} style={[styles.description, { color: colors.textSecondary }]}>
          {broadcast.description}
        </Text>
      ) : null}

      <View style={styles.detailRow}>
        <View style={styles.detail}>
          <Text maxFontSizeMultiplier={1.5} style={[styles.detailLabel, { color: colors.textSecondary }]}>Inicio</Text>
          <Text maxFontSizeMultiplier={1.5} style={[styles.detailValue, { color: colors.textPrimary }]}>
            {new Date(broadcast.startedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <View style={styles.detail}>
          <Text maxFontSizeMultiplier={1.5} style={[styles.detailLabel, { color: colors.textSecondary }]}>Artista</Text>
          <Text maxFontSizeMultiplier={1.5} style={[styles.detailValue, { color: colors.textPrimary }]} numberOfLines={1}>
            {broadcast.artistName}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.watchButton,
            { backgroundColor: colors.dangerAction },
            !hasPlayback && styles.disabledButton,
          ]}
          onPress={() => onWatch(broadcast)}
          disabled={!hasPlayback}
          accessibilityRole="button"
          accessibilityLabel={`Ver transmisión de ${broadcast.title}`}
          accessibilityState={{ disabled: !hasPlayback }}
        >
          <MaterialCommunityIcons name="play-circle-outline" size={18} color={colors.dangerActionContrast} />
          <Text maxFontSizeMultiplier={1.5} style={[styles.watchButtonText, { color: colors.dangerActionContrast }]}>Ver</Text>
        </TouchableOpacity>
        {canEnd ? (
          <TouchableOpacity
            style={[
              styles.endButton,
              { borderColor: colors.dangerBorder, backgroundColor: colors.surface },
              ending && styles.disabledButton,
            ]}
            onPress={() => onEnd(broadcast)}
            disabled={ending}
            accessibilityRole="button"
            accessibilityLabel="Terminar transmisión"
          >
            <Text maxFontSizeMultiplier={1.5} style={[styles.endButtonText, { color: colors.danger }]}>
              {ending ? 'Cerrando...' : 'Terminar'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export function openLiveBroadcastPlayback(broadcast: EventLiveBroadcast): void {
  if (!isExternalPlaybackUrl(broadcast.playbackUrl)) return;
  Linking.openURL(broadcast.playbackUrl).catch(() => undefined);
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  viewerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewerText: {
    fontWeight: '800',
    fontSize: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  meta: {
    fontSize: 13,
    fontWeight: '600',
  },
  description: {
    lineHeight: 19,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 10,
  },
  detail: {
    flex: 1,
    minWidth: 0,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontWeight: '700',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minHeight: 44,
  },
  watchButtonText: {
    fontWeight: '800',
  },
  endButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minHeight: 44,
  },
  endButtonText: {
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.45,
  },
});
