import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import type { EventTicketOrder } from '../../types';
import {
  formatTicketDateTime,
  formatTicketMoney,
  ticketOrderStatusLabel,
  ticketStatusLabel,
} from '../../lib/tickets';

type Props = {
  order: EventTicketOrder;
  eventTitle?: string | null;
};

const statusStyle = (status: string) => {
  switch (status.trim().toLowerCase()) {
    case 'paid':
      return styles.statusPaid;
    case 'pending':
      return styles.statusPending;
    case 'cancelled':
    case 'canceled':
    case 'refunded':
      return styles.statusMuted;
    default:
      return styles.statusPending;
  }
};

export function TicketOrderCard({ order, eventTitle }: Props) {
  const timestamp = order.purchasedAt ?? order.createdAt;
  const activeTickets = order.tickets.filter((ticket) =>
    ['issued', 'checked_in', 'checkedin'].includes(ticket.status.trim().toLowerCase()),
  );

  return (
    <View style={styles.card} accessibilityLabel={`Orden ${ticketOrderStatusLabel(order.status)}`}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          {eventTitle ? <Text style={styles.eventTitle}>{eventTitle}</Text> : null}
          <Text style={styles.summary}>
            {order.quantity} {order.quantity === 1 ? 'entrada' : 'entradas'} ·{' '}
            {formatTicketMoney(order.amountCents, order.currency)}
          </Text>
          {timestamp ? <Text style={styles.date}>{formatTicketDateTime(timestamp)}</Text> : null}
        </View>
        <View style={[styles.status, statusStyle(order.status)]}>
          <Text style={styles.statusText}>{ticketOrderStatusLabel(order.status)}</Text>
        </View>
      </View>

      {order.status.trim().toLowerCase() === 'pending' ? (
        <View style={styles.processingBox} accessibilityRole="alert">
          <Text style={styles.processingTitle}>Estamos verificando la orden</Text>
          <Text style={styles.processingText}>
            Confirmaremos el estado con Stripe. No vuelvas a pagar mientras esta orden esté procesando.
          </Text>
        </View>
      ) : null}

      {activeTickets.length > 0 ? (
        <View style={styles.ticketList}>
          {activeTickets.map((ticket, index) => (
            <View
              key={ticket.id}
              style={styles.ticket}
              accessible
              accessibilityLabel={`Entrada ${index + 1}, código ${ticket.code}, ${ticketStatusLabel(ticket.status)}`}
            >
              <QRCode value={ticket.code} size={112} backgroundColor="#fff" color="#111827" />
              <View style={styles.ticketCopy}>
                <Text style={styles.ticketIndex}>ENTRADA {index + 1}</Text>
                <Text style={styles.ticketCode} selectable>{ticket.code}</Text>
                <Text style={styles.ticketStatus}>{ticketStatusLabel(ticket.status)}</Text>
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
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: 14,
    gap: 14,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headerCopy: { flex: 1, gap: 3 },
  eventTitle: { color: '#111827', fontSize: 16, fontWeight: '800' },
  summary: { color: '#374151', fontSize: 14, fontWeight: '700' },
  date: { color: '#6b7280', fontSize: 12 },
  status: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusPaid: { backgroundColor: '#dcfce7' },
  statusPending: { backgroundColor: '#fef3c7' },
  statusMuted: { backgroundColor: '#f3f4f6' },
  statusText: { color: '#374151', fontSize: 11, fontWeight: '800' },
  processingBox: { borderRadius: 12, padding: 12, backgroundColor: '#fffbeb', gap: 4 },
  processingTitle: { color: '#92400e', fontWeight: '800' },
  processingText: { color: '#78350f', fontSize: 12, lineHeight: 18 },
  ticketList: { gap: 12 },
  ticket: {
    borderRadius: 14,
    backgroundColor: '#f9fafb',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ticketCopy: { flex: 1, gap: 5 },
  ticketIndex: { color: '#7c3aed', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  ticketCode: { color: '#111827', fontSize: 17, fontWeight: '900' },
  ticketStatus: { color: '#4b5563', fontSize: 12 },
});
