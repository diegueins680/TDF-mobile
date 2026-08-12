import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import type { EventTicketOrder } from '../../types';
import {
  formatTicketDateTime,
  formatTicketMoney,
  ticketOrderStatusLabel,
  ticketStatusLabel,
} from '../../lib/tickets';
import { useAppTheme } from '../../theme/ThemeProvider';

type Props = {
  order: EventTicketOrder;
  eventTitle?: string | null;
};

export function TicketOrderCard({ order, eventTitle }: Props) {
  const { colors } = useAppTheme();
  const timestamp = order.purchasedAt ?? order.createdAt;
  const activeTickets = order.tickets.filter((ticket) =>
    ['issued', 'checked_in', 'checkedin'].includes(ticket.status.trim().toLowerCase()),
  );

  const statusStyle = (status: string) => {
    switch (status.trim().toLowerCase()) {
      case 'paid':
        return { backgroundColor: colors.surfaceMuted };
      case 'pending':
        return { backgroundColor: colors.warningSurface };
      case 'cancelled':
      case 'canceled':
      case 'refunded':
        return { backgroundColor: colors.surfaceMuted };
      default:
        return { backgroundColor: colors.warningSurface };
    }
  };

  return (
    <View style={[styles.card, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]} accessibilityLabel={`Orden ${ticketOrderStatusLabel(order.status)}`}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          {eventTitle ? <Text style={[styles.eventTitle, { color: colors.textPrimary }]}>{eventTitle}</Text> : null}
          <Text style={[styles.summary, { color: colors.textSecondary }]}>
            {order.quantity} {order.quantity === 1 ? 'entrada' : 'entradas'} ·{' '}
            {formatTicketMoney(order.amountCents, order.currency)}
          </Text>
          {timestamp ? <Text style={[styles.date, { color: colors.textSecondary }]}>{formatTicketDateTime(timestamp)}</Text> : null}
        </View>
        <View style={[styles.status, statusStyle(order.status)]}>
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>{ticketOrderStatusLabel(order.status)}</Text>
        </View>
      </View>

      {order.status.trim().toLowerCase() === 'pending' ? (
        <View style={[styles.processingBox, { backgroundColor: colors.warningSurface }]} accessibilityRole="alert">
          <Text style={[styles.processingTitle, { color: colors.warningBorder }]}>Estamos verificando la orden</Text>
          <Text style={[styles.processingText, { color: colors.warningBorder }]}>
            Confirmaremos el estado con Stripe. No vuelvas a pagar mientras esta orden esté procesando.
          </Text>
        </View>
      ) : null}

      {activeTickets.length > 0 ? (
        <View style={styles.ticketList}>
          {activeTickets.map((ticket, index) => (
            <View
              key={ticket.id}
              style={[styles.ticket, { backgroundColor: colors.surfaceMuted }]}
              accessible
              accessibilityLabel={`Entrada ${index + 1}, código ${ticket.code}, ${ticketStatusLabel(ticket.status)}`}
            >
              <QRCode value={ticket.code} size={112} backgroundColor={colors.surface} color={colors.textPrimary} />
              <View style={styles.ticketCopy}>
                <Text style={[styles.ticketIndex, { color: colors.actionPrimary }]}>ENTRADA {index + 1}</Text>
                <Text style={[styles.ticketCode, { color: colors.textPrimary }]} selectable>{ticket.code}</Text>
                <Text style={[styles.ticketStatus, { color: colors.textSecondary }]}>{ticketStatusLabel(ticket.status)}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 14,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headerCopy: { flex: 1, gap: 3 },
  eventTitle: { fontSize: 16, fontWeight: '800' },
  summary: { fontSize: 14, fontWeight: '700' },
  date: { fontSize: 12 },
  status: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontSize: 12, fontWeight: '800' },
  processingBox: { borderRadius: 12, padding: 12, gap: 4 },
  processingTitle: { fontWeight: '800' },
  processingText: { fontSize: 12, lineHeight: 18 },
  ticketList: { gap: 12 },
  ticket: {
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ticketCopy: { flex: 1, gap: 5 },
  ticketIndex: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  ticketCode: { fontSize: 17, fontWeight: '900' },
  ticketStatus: { fontSize: 12 },
});
