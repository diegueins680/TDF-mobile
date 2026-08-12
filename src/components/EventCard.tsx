import React, { memo } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

import { useAnalytics } from '../analytics/AnalyticsProvider';
import { formatTicketMoney, isEventTicketPurchaseEligible } from '../lib/tickets';
import { formatDate, formatTime } from '../lib/formatters';
import type { SocialEvent } from '../types';
import { useUserSettings } from '../providers/UserSettingsProvider';
import { useAppTheme } from '../theme/ThemeProvider';

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
  const { locale } = useUserSettings();
  const { colors } = useAppTheme();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push({ pathname: '/eventDetail', params: { eventId: String(event.id) } });
    }
  };

  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);
  const isSameDay = formatDate(startDate) === formatDate(endDate);

  const a11yLabel = `${event.title}, ${formatDate(startDate)} ${formatTime(startDate)}${event.venue ? ` en ${event.venue.name}` : ''}`;
  const hasTicketAction =
    Boolean(event.ticketUrl) ||
    isEventTicketPurchaseEligible(event);

  const handleTicketPress = () => {
    analytics.capture('ticket_cta_tapped', { event_id: String(event.id), source: 'event_card' });
    router.push({ pathname: '/ticketCheckout', params: { eventId: String(event.id) } });
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <TouchableOpacity onPress={handlePress} accessibilityRole="button" accessibilityLabel={a11yLabel}>
        {event.imageUrl && (
          <Image source={{ uri: event.imageUrl }} style={[styles.image, { backgroundColor: colors.canvas }]} />
        )}

        <View style={styles.content}>
          <Text maxFontSizeMultiplier={1.5} style={[styles.title, { color: colors.textPrimary }]}>{event.title}</Text>

          <View style={styles.meta}>
            <Text maxFontSizeMultiplier={1.5} style={[styles.date, { color: colors.textSecondary }]}>
              {formatDate(startDate)} {formatTime(startDate)}
              {!isSameDay && ` - ${formatDate(endDate)}`}
            </Text>
            {event.venue && <Text maxFontSizeMultiplier={1.5} style={[styles.venue, { color: colors.textSecondary }]}>{event.venue.name}</Text>}
          </View>

          {event.artists && event.artists.length > 0 && (
            <View style={styles.artists}>
              <Text maxFontSizeMultiplier={1.5} style={[styles.artistsLabel, { color: colors.textSecondary }]}>Artistas:</Text>
              <Text maxFontSizeMultiplier={1.5} style={[styles.artistsList, { color: colors.textPrimary }]}>
                {event.artists.map(a => a.name).join(', ')}
              </Text>
            </View>
          )}

          <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
            {typeof event.ticketPrice === 'number' && (
              <View>
                {event.ticketPrice > 0 ? <Text maxFontSizeMultiplier={1.5} style={[styles.priceEyebrow, { color: colors.actionPrimary }]}>DESDE</Text> : null}
                <Text maxFontSizeMultiplier={1.5} style={[styles.price, { color: colors.actionPrimary }]}>
                  {event.ticketPrice === 0
                    ? 'Gratis'
                    : formatTicketMoney(Math.round(event.ticketPrice * 100), event.currency ?? 'USD', locale)}
                </Text>
              </View>
            )}
            <View style={styles.stats}>
              <Text maxFontSizeMultiplier={1.5} style={[styles.stat, { color: colors.textSecondary }]}>{event.rsvpCount} asisten</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {hasTicketAction ? (
        <View style={styles.ticketActionRow}>
          <TouchableOpacity
            style={[styles.ticketButton, { backgroundColor: colors.actionPrimary }]}
            onPress={handleTicketPress}
            accessibilityRole="button"
            accessibilityLabel={`Ver entradas para ${event.title}`}
            accessibilityHint="Abre el checkout del evento"
          >
            <Text maxFontSizeMultiplier={1.5} style={[styles.ticketButtonText, { color: colors.actionPrimaryContrast }]}>Ver entradas</Text>
            <Text maxFontSizeMultiplier={1.5} style={[styles.ticketButtonArrow, { color: colors.actionPrimaryContrast }]}>→</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {onToggleSaved && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              { borderColor: colors.border, backgroundColor: colors.surface },
              saved && { borderColor: colors.actionPrimary, backgroundColor: colors.selected },
              saveDisabled && styles.saveButtonDisabled
            ]}
            onPress={onToggleSaved}
            disabled={saveDisabled}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Quitar de guardados' : 'Guardar evento'}
            accessibilityState={{ disabled: saveDisabled }}
          >
            <Text maxFontSizeMultiplier={1.5} style={[styles.saveButtonText, { color: colors.textPrimary }, saved && { color: colors.actionPrimary }]}>
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
    height: 160
  },
  content: {
    padding: 12,
    gap: 8
  },
  title: {
    fontSize: 16,
    fontWeight: '700'
  },
  meta: {
    gap: 4
  },
  date: {
    fontSize: 13,
    fontWeight: '500'
  },
  venue: {
    fontSize: 12
  },
  artists: {
    gap: 4
  },
  artistsLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  artistsList: {
    fontSize: 12
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1
  },
  price: {
    fontSize: 16,
    fontWeight: '800'
  },
  priceEyebrow: {
    fontSize: 12,
    letterSpacing: 0.7,
    fontWeight: '800'
  },
  stats: {
    flexDirection: 'row',
    gap: 12
  },
  stat: {
    fontSize: 12
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
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  ticketButtonText: {
    fontSize: 14,
    fontWeight: '800'
  },
  ticketButtonArrow: {
    fontSize: 18,
    fontWeight: '700'
  },
  saveButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 44
  },
  saveButtonDisabled: {
    opacity: 0.6
  },
  saveButtonText: {
    fontSize: 12,
    fontWeight: '700'
  }
});

export const EventCard = memo(EventCardComponent);
