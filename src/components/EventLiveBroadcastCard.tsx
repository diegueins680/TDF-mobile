import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { EventLiveBroadcast } from '../types';

type EventLiveBroadcastCardProps = {
  broadcast: EventLiveBroadcast;
  currentPartyId?: string | null;
  watchDisabled?: boolean;
  endDisabled?: boolean;
  onWatch: (broadcast: EventLiveBroadcast) => void;
  onEnd: (broadcast: EventLiveBroadcast) => void;
};

const isExternalPlaybackUrl = (url?: string | null): boolean =>
  Boolean(url && !url.startsWith('tdf://'));

export function EventLiveBroadcastCard({
  broadcast,
  currentPartyId,
  watchDisabled = false,
  endDisabled = false,
  onWatch,
  onEnd,
}: EventLiveBroadcastCardProps) {
  const isLive = broadcast.status === 'live';
  const canEnd = isLive && !!currentPartyId && broadcast.broadcasterPartyId === currentPartyId;
  const hasExternalPlayback = isExternalPlaybackUrl(broadcast.playbackUrl);

  return (
    <View style={[styles.card, !isLive && styles.cardEnded]}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, isLive ? styles.statusBadgeLive : styles.statusBadgeEnded]}>
              <MaterialCommunityIcons
                name={isLive ? 'broadcast' : 'check-circle-outline'}
                size={14}
                color={isLive ? '#b91c1c' : '#475569'}
              />
              <Text style={[styles.statusText, isLive ? styles.statusTextLive : styles.statusTextEnded]}>
                {isLive ? 'En vivo' : 'Finalizada'}
              </Text>
            </View>
            <Text style={styles.viewerText}>{broadcast.viewerCount} viendo</Text>
          </View>
          <Text style={styles.title}>{broadcast.title}</Text>
          <Text style={styles.metaText}>
            Fanclub de {broadcast.artistName} · {broadcast.broadcasterName}
          </Text>
        </View>
      </View>

      {broadcast.description ? <Text style={styles.description}>{broadcast.description}</Text> : null}

      <View style={styles.detailGrid}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Inicio</Text>
          <Text style={styles.detailValue}>{new Date(broadcast.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Destino</Text>
          <Text style={styles.detailValue}>{broadcast.artistName}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.watchButton,
            (!isLive || !hasExternalPlayback || watchDisabled) && styles.buttonDisabled,
          ]}
          onPress={() => onWatch(broadcast)}
          disabled={!isLive || !hasExternalPlayback || watchDisabled}
        >
          <MaterialCommunityIcons name="play-circle-outline" size={17} color="#fff" />
          <Text style={styles.watchButtonText}>Ver stream</Text>
        </TouchableOpacity>
        {canEnd ? (
          <TouchableOpacity
            style={[styles.endButton, endDisabled && styles.buttonDisabled]}
            onPress={() => onEnd(broadcast)}
            disabled={endDisabled}
          >
            <Text style={styles.endButtonText}>Cerrar vivo</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {!hasExternalPlayback && isLive ? (
        <Text style={styles.inlineHint}>Vista local activa. El enlace de reproducción aparecerá cuando esté disponible.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 16,
    padding: 14,
  },
  cardEnded: {
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleGroup: {
    flex: 1,
    gap: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  statusBadgeLive: {
    backgroundColor: '#fee2e2',
  },
  statusBadgeEnded: {
    backgroundColor: '#e2e8f0',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusTextLive: {
    color: '#b91c1c',
  },
  statusTextEnded: {
    color: '#475569',
  },
  viewerText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  metaText: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 16,
  },
  description: {
    color: '#334155',
    lineHeight: 20,
  },
  detailGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  detailItem: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    padding: 10,
    gap: 2,
  },
  detailLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detailValue: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  watchButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  endButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  endButtonText: {
    color: '#b91c1c',
    fontWeight: '800',
  },
  inlineHint: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
