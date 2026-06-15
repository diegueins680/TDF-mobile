import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
  const isLive = broadcast.status === 'live';
  const canEnd = isLive && !!currentPartyId && broadcast.broadcasterPartyId === currentPartyId;
  const hasPlayback = isExternalPlaybackUrl(broadcast.playbackUrl);

  return (
    <View style={[styles.card, isLive && styles.liveCard]}>
      <View style={styles.header}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, isLive ? styles.liveDot : styles.endedDot]} />
          <Text style={[styles.statusText, isLive ? styles.liveText : styles.endedText]}>
            {isLive ? 'En vivo' : 'Finalizado'}
          </Text>
        </View>
        <View style={styles.viewerBadge}>
          <MaterialCommunityIcons name="eye-outline" size={14} color="#334155" />
          <Text style={styles.viewerText}>{broadcast.viewerCount}</Text>
        </View>
      </View>

      <Text style={styles.title}>{broadcast.title}</Text>
      <Text style={styles.meta}>
        Fanclub de {broadcast.artistName} · {broadcast.broadcasterName}
      </Text>
      {broadcast.description ? (
        <Text style={styles.description}>{broadcast.description}</Text>
      ) : null}

      <View style={styles.detailRow}>
        <View style={styles.detail}>
          <Text style={styles.detailLabel}>Inicio</Text>
          <Text style={styles.detailValue}>
            {new Date(broadcast.startedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <View style={styles.detail}>
          <Text style={styles.detailLabel}>Artista</Text>
          <Text style={styles.detailValue} numberOfLines={1}>
            {broadcast.artistName}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.watchButton, !hasPlayback && styles.disabledButton]}
          onPress={() => onWatch(broadcast)}
          disabled={!hasPlayback}
        >
          <MaterialCommunityIcons name="play-circle-outline" size={18} color="#fff" />
          <Text style={styles.watchButtonText}>Ver</Text>
        </TouchableOpacity>
        {canEnd ? (
          <TouchableOpacity
            style={[styles.endButton, ending && styles.disabledButton]}
            onPress={() => onEnd(broadcast)}
            disabled={ending}
          >
            <Text style={styles.endButtonText}>{ending ? 'Cerrando...' : 'Terminar'}</Text>
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
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    backgroundColor: '#fff',
  },
  liveCard: {
    borderColor: '#fecaca',
    backgroundColor: '#fff7f7',
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
  liveDot: {
    backgroundColor: '#dc2626',
  },
  endedDot: {
    backgroundColor: '#94a3b8',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  liveText: {
    color: '#b91c1c',
  },
  endedText: {
    color: '#64748b',
  },
  viewerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewerText: {
    color: '#334155',
    fontWeight: '800',
    fontSize: 12,
  },
  title: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  meta: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  description: {
    color: '#64748b',
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
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  detailValue: {
    color: '#0f172a',
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
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  watchButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  endButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#fff',
  },
  endButtonText: {
    color: '#b91c1c',
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.45,
  },
});
