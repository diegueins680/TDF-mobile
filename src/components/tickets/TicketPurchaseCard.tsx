import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { EventTicketTier } from '../../types';
import {
  formatTicketMoney,
  getStartingTicketPrice,
  getTicketTierSaleState,
  ticketTierSaleStateLabel,
} from '../../lib/tickets';
import { useAppTheme } from '../../theme/ThemeProvider';

type Props = {
  tiers: EventTicketTier[];
  fallbackPrice?: number | null;
  fallbackCurrency?: string;
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
  fallbackCurrency = 'USD',
  externalTicketUrl,
  canBuyInternally = true,
  isLoading = false,
  isError = false,
  onBuy,
  onOpenExternal,
  onRetry,
}: Props) {
  const { colors } = useAppTheme();
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
      return <ActivityIndicator color={colors.actionPrimary} accessibilityLabel="Cargando entradas" />;
    }

    if (isError) {
      return (
        <View style={styles.messageGroup}>
          <Text style={[styles.message, { color: colors.textSecondary }]}>No pudimos comprobar la disponibilidad.</Text>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.selected }]}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Reintentar cargar entradas"
          >
            <Text style={[styles.secondaryButtonText, { color: colors.actionPrimary }]}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (availableTiers.length > 0 && startingPrice) {
      const isFree = startingPrice.amountCents === 0;
      return (
        <>
          <View style={styles.priceGroup}>
            <Text style={[styles.eyebrow, { color: colors.actionPrimary }]}>{isFree ? 'ENTRADAS' : 'DESDE'}</Text>
            <Text style={[styles.price, { color: colors.selected }]}>
              {isFree ? 'Gratis' : formatTicketMoney(startingPrice.amountCents, startingPrice.currency)}
            </Text>
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              {availableTiers.length === 1
                ? ticketTierSaleStateLabel(availableTiers[0])
                : `${availableTiers.length} tipos disponibles`}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.actionPrimary }]}
            onPress={onBuy}
            accessibilityRole="button"
            accessibilityLabel={isFree ? 'Obtener entradas gratis' : 'Comprar entradas'}
            accessibilityHint="Abre el checkout de este evento"
          >
            <Text style={[styles.primaryButtonText, { color: colors.actionPrimaryContrast }]}>{isFree ? 'Obtener entradas' : 'Comprar entradas'}</Text>
            <MaterialCommunityIcons name="arrow-right" size={20} color={colors.actionPrimaryContrast} />
          </TouchableOpacity>
        </>
      );
    }

    if (upcomingTier) {
      return (
        <View style={styles.messageGroup}>
          <Text style={[styles.stateTitle, { color: colors.selected }]}>Venta próximamente</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>{ticketTierSaleStateLabel(upcomingTier)}</Text>
        </View>
      );
    }

    if (externalTicketUrl) {
      const fallbackCents = typeof fallbackPrice === 'number' ? Math.round(fallbackPrice * 100) : null;
      return (
        <>
          <View style={styles.priceGroup}>
            <Text style={[styles.stateTitle, { color: colors.selected }]}>Venta en sitio externo</Text>
            {fallbackCents !== null ? (
              <Text style={[styles.price, { color: colors.selected }]}>
                {fallbackCents === 0 ? 'Gratis' : formatTicketMoney(fallbackCents, fallbackCurrency)}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.actionPrimary }]}
            onPress={onOpenExternal}
            accessibilityRole="link"
            accessibilityLabel="Abrir venta externa de entradas"
          >
            <Text style={[styles.primaryButtonText, { color: colors.actionPrimaryContrast }]}>Ir a la venta</Text>
            <MaterialCommunityIcons name="open-in-new" size={18} color={colors.actionPrimaryContrast} />
          </TouchableOpacity>
        </>
      );
    }

    return (
      <View style={styles.messageGroup}>
        <Text style={[styles.stateTitle, { color: colors.selected }]}>{soldOut ? 'Entradas agotadas' : 'Venta no disponible'}</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          {soldOut
            ? 'No quedan entradas disponibles en este momento.'
            : 'Aún no hay entradas publicadas para este evento.'}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.card, { borderColor: colors.selected, backgroundColor: colors.canvas }]} accessibilityLabel="Entradas del evento">
      <View style={styles.headingRow}>
        <View style={[styles.iconBox, { backgroundColor: colors.selected }]}>
          <MaterialCommunityIcons name="ticket-confirmation-outline" size={24} color={colors.actionPrimary} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: colors.selected }]}>Entradas</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Compra segura dentro de TDF Records</Text>
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
    padding: 16,
    gap: 14,
  },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingCopy: { flex: 1, gap: 2 },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 12, lineHeight: 17 },
  priceGroup: { gap: 3 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  price: { fontSize: 24, fontWeight: '900' },
  stateTitle: { fontSize: 16, fontWeight: '800' },
  message: { fontSize: 13, lineHeight: 18 },
  messageGroup: { gap: 8 },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: { fontSize: 15, fontWeight: '800' },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  secondaryButtonText: { fontWeight: '800' },
});
