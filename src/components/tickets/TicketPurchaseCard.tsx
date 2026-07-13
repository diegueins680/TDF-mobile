import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { EventTicketTier } from '../../types';
import {
  formatTicketMoney,
  getStartingTicketPrice,
  getTicketTierSaleState,
  ticketTierSaleStateLabel,
} from '../../lib/tickets';

type Props = {
  tiers: EventTicketTier[];
  fallbackPrice?: number | null;
  externalTicketUrl?: string | null;
  canBuyInternally?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  onBuy: () => void;
  onOpenExternal: () => void;
  onRetry: () => void;
};

export function TicketPurchaseCard({
  tiers,
  fallbackPrice,
  externalTicketUrl,
  canBuyInternally = true,
  isLoading = false,
  isError = false,
  onBuy,
  onOpenExternal,
  onRetry,
}: Props) {
  const startingPrice = getStartingTicketPrice(tiers);
  const availableTiers = canBuyInternally
    ? tiers.filter((tier) => getTicketTierSaleState(tier) === 'available')
    : [];
  const upcomingTier = canBuyInternally
    ? tiers.find((tier) => getTicketTierSaleState(tier) === 'upcoming')
    : undefined;
  const soldOut = canBuyInternally && tiers.length > 0 && tiers.every((tier) => {
    const state = getTicketTierSaleState(tier);
    return state === 'sold-out' || state === 'ended' || state === 'inactive';
  });

  const renderAction = () => {
    if (isLoading) {
      return <ActivityIndicator color="#6d28d9" accessibilityLabel="Cargando entradas" />;
    }

    if (isError) {
      return (
        <View style={styles.messageGroup}>
          <Text style={styles.message}>No pudimos comprobar la disponibilidad.</Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Reintentar cargar entradas"
          >
            <Text style={styles.secondaryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (availableTiers.length > 0 && startingPrice) {
      const isFree = startingPrice.amountCents === 0;
      return (
        <>
          <View style={styles.priceGroup}>
            <Text style={styles.eyebrow}>{isFree ? 'ENTRADAS' : 'DESDE'}</Text>
            <Text style={styles.price}>
              {isFree ? 'Gratis' : formatTicketMoney(startingPrice.amountCents, startingPrice.currency)}
            </Text>
            <Text style={styles.message}>
              {availableTiers.length === 1
                ? ticketTierSaleStateLabel(availableTiers[0])
                : `${availableTiers.length} tipos disponibles`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onBuy}
            accessibilityRole="button"
            accessibilityLabel={isFree ? 'Obtener entradas gratis' : 'Comprar entradas'}
            accessibilityHint="Abre el checkout de este evento"
          >
            <Text style={styles.primaryButtonText}>{isFree ? 'Obtener entradas' : 'Comprar entradas'}</Text>
            <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
          </TouchableOpacity>
        </>
      );
    }

    if (upcomingTier) {
      return (
        <View style={styles.messageGroup}>
          <Text style={styles.stateTitle}>Venta próximamente</Text>
          <Text style={styles.message}>{ticketTierSaleStateLabel(upcomingTier)}</Text>
        </View>
      );
    }

    if (externalTicketUrl) {
      const fallbackCents = typeof fallbackPrice === 'number' ? Math.round(fallbackPrice * 100) : null;
      return (
        <>
          <View style={styles.priceGroup}>
            <Text style={styles.stateTitle}>Venta en sitio externo</Text>
            {fallbackCents !== null ? (
              <Text style={styles.price}>
                {fallbackCents === 0 ? 'Gratis' : formatTicketMoney(fallbackCents, 'USD')}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onOpenExternal}
            accessibilityRole="link"
            accessibilityLabel="Abrir venta externa de entradas"
          >
            <Text style={styles.primaryButtonText}>Ir a la venta</Text>
            <MaterialCommunityIcons name="open-in-new" size={18} color="#fff" />
          </TouchableOpacity>
        </>
      );
    }

    return (
      <View style={styles.messageGroup}>
        <Text style={styles.stateTitle}>{soldOut ? 'Entradas agotadas' : 'Venta no disponible'}</Text>
        <Text style={styles.message}>
          {soldOut
            ? 'No quedan entradas disponibles en este momento.'
            : 'Aún no hay entradas publicadas para este evento.'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.card} accessibilityLabel="Entradas del evento">
      <View style={styles.headingRow}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name="ticket-confirmation-outline" size={24} color="#6d28d9" />
        </View>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Entradas</Text>
          <Text style={styles.subtitle}>Compra segura dentro de TDF Records</Text>
        </View>
      </View>
      {renderAction()}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    backgroundColor: '#faf5ff',
    padding: 16,
    gap: 14,
  },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingCopy: { flex: 1, gap: 2 },
  title: { color: '#2e1065', fontSize: 18, fontWeight: '800' },
  subtitle: { color: '#6b7280', fontSize: 12, lineHeight: 17 },
  priceGroup: { gap: 3 },
  eyebrow: { color: '#7c3aed', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  price: { color: '#2e1065', fontSize: 24, fontWeight: '900' },
  stateTitle: { color: '#2e1065', fontSize: 16, fontWeight: '800' },
  message: { color: '#5b6473', fontSize: 13, lineHeight: 18 },
  messageGroup: { gap: 8 },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: '#6d28d9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c4b5fd',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  secondaryButtonText: { color: '#6d28d9', fontWeight: '800' },
});
