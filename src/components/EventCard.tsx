import React, { memo } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

import { useAnalytics } from '../analytics/AnalyticsProvider';
import { formatTicketMoney, isEventTicketPurchaseEligible } from '../lib/tickets';
import type { SocialEvent } from '../types';

type Props = {
  event: SocialEvent;
  onPress?: () => void;
  saved?: boolean;
  onToggleSaved?: () => void;
  saveDisabled?: boolean;
};

function EventCardComponent({ event, onPress, saved = false, onToggleSaved, saveDisabled = false }: Props) {
  const router = useRouter();
  const analytics = useAnalytics();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push({ pathname: '/eventDetail', params: { eventId: String(event.id) } });
    }
  };

  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);
  const isSameDay = startDate.toDateString() === endDate.toDateString();

  const a11yLabel = `${event.title}, ${startDate.toLocaleDateString('es-EC')} ${startDate.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}${event.venue ? ` en ${event.venue.name}` : ''}`;
  const hasTicketAction =
    Boolean(event.ticketUrl) ||
    isEventTicketPurchaseEligible(event);

  const handleTicketPress = () => {
    analytics.capture('ticket_cta_tapped', { event_id: String(event.id), source: 'event_card' });
    router.push({ pathname: '/ticketCheckout', params: { eventId: String(event.id) } });
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={handlePress} accessibilityRole="button" accessibilityLabel={a11yLabel}>
        {event.imageUrl && (
          <Image source={{ uri: event.imageUrl }} style={styles.image} />
        )}

        <View style={styles.content}>
          <Text style={styles.title}>{event.title}</Text>

          <View style={styles.meta}>
            <Text style={styles.date}>
              {startDate.toLocaleDateString('es-EC')} {startDate.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
              {!isSameDay && ` - ${endDate.toLocaleDateString('es-EC')}`}
            </Text>
            {event.venue && <Text style={styles.venue}>{event.venue.name}</Text>}
          </View>

          {event.artists && event.artists.length > 0 && (
            <View style={styles.artists}>
              <Text style={styles.artistsLabel}>Artistas:</Text>
              <Text style={styles.artistsList}>
                {event.artists.map(a => a.name).join(', ')}
              </Text>
            </View>
          )}

          <View style={styles.footer}>
            {typeof event.ticketPrice === 'number' && (
              <View>
                {event.ticketPrice > 0 ? <Text style={styles.priceEyebrow}>DESDE</Text> : null}
                <Text style={styles.price}>
                  {event.ticketPrice === 0
                    ? 'Gratis'
                    : formatTicketMoney(Math.round(event.ticketPrice * 100), event.currency ?? 'USD')}
                </Text>
              </View>
            )}
            <View style={styles.stats}>
              <Text style={styles.stat}>{event.rsvpCount} asisten</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {hasTicketAction ? (
        <View style={styles.ticketActionRow}>
          <TouchableOpacity
            style={styles.ticketButton}
            onPress={handleTicketPress}
            accessibilityRole="button"
            accessibilityLabel={`Ver entradas para ${event.title}`}
            accessibilityHint="Abre el checkout del evento"
          >
            <Text style={styles.ticketButtonText}>Ver entradas</Text>
            <Text style={styles.ticketButtonArrow}>→</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {onToggleSaved && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.saveButton, saved && styles.saveButtonActive, saveDisabled && styles.saveButtonDisabled]}
            onPress={onToggleSaved}
            disabled={saveDisabled}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Quitar de guardados' : 'Guardar evento'}
            accessibilityState={{ disabled: saveDisabled }}
          >
            <Text style={[styles.saveButtonText, saved && styles.saveButtonTextActive]}>
              {saveDisabled ? 'Actualizando…' : saved ? 'Guardado' : 'Guardar'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }
  },
  image: {
    width: '100%',
    height: 160,
    backgroundColor: '#f0f0f0'
  },
  content: {
    padding: 12,
    gap: 8
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a'
  },
  meta: {
    gap: 4
  },
  date: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500'
  },
  venue: {
    fontSize: 12,
    color: '#888'
  },
  artists: {
    gap: 4
  },
  artistsLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  artistsList: {
    fontSize: 12,
    color: '#333'
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0'
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: '#6d28d9'
  },
  priceEyebrow: {
    fontSize: 9,
    letterSpacing: 0.7,
    fontWeight: '800',
    color: '#7c3aed'
  },
  stats: {
    flexDirection: 'row',
    gap: 12
  },
  stat: {
    fontSize: 12,
    color: '#666'
  },
  actions: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    alignItems: 'flex-end'
  },
  ticketActionRow: {
    paddingHorizontal: 12,
    paddingBottom: 12
  },
  ticketButton: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  ticketButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800'
  },
  ticketButtonArrow: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700'
  },
  saveButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff'
  },
  saveButtonActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff'
  },
  saveButtonDisabled: {
    opacity: 0.6
  },
  saveButtonText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '700'
  },
  saveButtonTextActive: {
    color: '#1d4ed8'
  }
});

export const EventCard = memo(EventCardComponent);
