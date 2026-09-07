import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Events } from '../src/api/events';
import { getParty } from '../src/api/parties';
import { TicketOrderCard } from '../src/components/tickets/TicketOrderCard';
import { useAnalytics } from '../src/analytics/AnalyticsProvider';
import {
  formatTicketDateTime,
  formatTicketMoney,
  getTicketTierSaleState,
  isEventTicketPurchaseEligible,
  isTicketTierOnSale,
  isValidTicketEmail,
  MAX_TICKETS_PER_ORDER,
  ticketTierAvailability,
  ticketTierSaleStateLabel,
} from '../src/lib/tickets';
import {
  getStripeCoreApiVersion,
  initNativePaymentSheet,
  initNativeStripe,
  presentNativePaymentSheet,
} from '../src/lib/nativeStripe';
import { normalizeRouteParam } from '../src/lib/routeParams';
import { notificationSuccess } from '../src/utils/haptics';
import {
  clearTicketCheckoutKey,
  getOrCreateTicketCheckoutKey,
  isClosedTicketCheckoutConflict,
  rotateTicketCheckoutKey,
} from '../src/lib/ticketCheckoutIdempotency';
import { useAuth } from '../src/providers/AuthProvider';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import type {
  EventTicketOrder,
  EventTicketPaymentIntent,
  EventTicketTier,
  ID,
} from '../src/types';

type PurchaseResult =
  | { kind: 'zero-total-confirmed'; orderId: string; quantity: number }
  | { kind: 'payment-received'; orderId: string; quantity: number }
  | { kind: 'verification-needed'; orderId: string }
  | { kind: 'cancelled'; orderId: string; releasedReservation: boolean };

type Feedback = {
  tone: 'success' | 'warning' | 'error';
  title: string;
  message: string;
};

const STRIPE_MERCHANT_DISPLAY_NAME = 'TDF Records';
const STRIPE_RETURN_URL = 'tdf://stripe-redirect';
const STRIPE_MERCHANT_IDENTIFIER =
  process.env.STRIPE_MERCHANT_IDENTIFIER?.trim() ||
  process.env.EXPO_PUBLIC_STRIPE_MERCHANT_IDENTIFIER?.trim() ||
  undefined;

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim() ? error.message.trim() : fallback;

const normalizePurchaseName = (value: string): string | null => value.trim() || null;
const isTerminalOrderStatus = (status: string): boolean =>
  ['paid', 'cancelled', 'refunded'].includes(status.trim().toLowerCase());

export default function TicketCheckoutScreen() {
  const { eventId: rawEventId } = useLocalSearchParams<{ eventId?: string | string[] }>();
  const eventId = normalizeRouteParam(rawEventId);
  const router = useRouter();
  const queryClient = useQueryClient();
  const analytics = useAnalytics();
  const { token, partyId, session, loading: authLoading, clearToken } = useAuth();
  const displayName = session?.displayName ?? '';

  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState(displayName);
  const [buyerEmail, setBuyerEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [promoExpanded, setPromoExpanded] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [showOrders, setShowOrders] = useState(false);
  const [submittedOrderId, setSubmittedOrderId] = useState<string | null>(null);
  const pendingPollStartedAt = useRef<number | null>(null);
  const checkoutKeysByFingerprint = useRef(new Map<string, string>());
  const checkoutFingerprintsByOrderId = useRef(new Map<string, string>());
  const activeCheckoutFingerprint = useRef<string | null>(null);

  const forgetCheckoutFingerprint = useCallback(async (fingerprint: string): Promise<void> => {
    checkoutKeysByFingerprint.current.delete(fingerprint);
    checkoutFingerprintsByOrderId.current.forEach((storedFingerprint, orderId) => {
      if (storedFingerprint === fingerprint) {
        checkoutFingerprintsByOrderId.current.delete(orderId);
      }
    });
    if (activeCheckoutFingerprint.current === fingerprint) {
      activeCheckoutFingerprint.current = null;
    }
    await clearTicketCheckoutKey(fingerprint);
  }, []);

  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => Events.getById(eventId as ID),
    enabled: Boolean(eventId),
  });

  const tiersQuery = useQuery({
    queryKey: ['event-ticket-tiers', eventId],
    queryFn: () => Events.listTicketTiers(eventId as ID),
    enabled: Boolean(eventId && token?.trim()),
    refetchInterval: 15000,
  });

  const partyQuery = useQuery({
    queryKey: ['ticket-checkout-party', partyId],
    queryFn: () => getParty(partyId as string),
    enabled: Boolean(partyId && /^[1-9]\d*$/.test(partyId)),
  });

  const ordersQuery = useQuery({
    queryKey: ['event-ticket-orders', eventId, partyId],
    queryFn: () => Events.listTicketOrders(eventId as ID, partyId),
    enabled: Boolean(eventId && partyId),
    refetchInterval: (query) => {
      const orders = query.state.data as EventTicketOrder[] | undefined;
      if (!orders?.some((order) => order.status.toLowerCase() === 'pending')) {
        pendingPollStartedAt.current = null;
        return false;
      }
      const startedAt = pendingPollStartedAt.current ?? Date.now();
      pendingPollStartedAt.current = startedAt;
      const elapsed = Date.now() - startedAt;
      if (elapsed >= 2 * 60 * 1000) return false;
      if (elapsed >= 60 * 1000) return 15000;
      if (elapsed >= 15 * 1000) return 5000;
      return 2000;
    },
  });

  const tiers = useMemo(() => tiersQuery.data ?? [], [tiersQuery.data]);
  const eventCanSellTickets = eventQuery.data
    ? isEventTicketPurchaseEligible(eventQuery.data)
    : false;
  const availableTiers = useMemo(
    () => eventCanSellTickets ? tiers.filter((tier) => isTicketTierOnSale(tier)) : [],
    [eventCanSellTickets, tiers],
  );
  const unavailableTiers = useMemo(
    () => tiers.filter((tier) => !isTicketTierOnSale(tier)),
    [tiers],
  );
  const selectedTier = useMemo(
    () => availableTiers.find((tier) => tier.id === selectedTierId) ?? availableTiers[0] ?? null,
    [availableTiers, selectedTierId],
  );
  const maxQuantity = selectedTier
    ? Math.min(ticketTierAvailability(selectedTier), MAX_TICKETS_PER_ORDER)
    : 1;
  const totalCents = selectedTier ? selectedTier.priceCents * quantity : 0;
  const hasPromoCode = Boolean(promoCode.trim());
  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const activeOrderCount = orders.filter((order) =>
    ['paid', 'pending'].includes(order.status.toLowerCase()),
  ).length;
  const emailError = emailTouched && !isValidTicketEmail(buyerEmail)
    ? buyerEmail.trim()
      ? 'Ingresa un correo válido.'
      : 'El correo es necesario para recuperar tus entradas.'
    : null;

  useEffect(() => {
    analytics.screen('Ticket checkout', { event_id: eventId ?? 'unknown' });
  }, [analytics, eventId]);

  useEffect(() => {
    if (authLoading || token?.trim() || !eventId) return;
    router.replace({
      pathname: '/auth',
      params: { returnTo: `/ticketCheckout?eventId=${encodeURIComponent(eventId)}` },
    });
  }, [authLoading, eventId, router, token]);

  useEffect(() => {
    if (availableTiers.length === 0) {
      setSelectedTierId(null);
      return;
    }
    if (selectedTierId && availableTiers.some((tier) => tier.id === selectedTierId)) return;
    setSelectedTierId(availableTiers[0].id);
  }, [availableTiers, selectedTierId]);

  useEffect(() => {
    setQuantity((current) => Math.max(1, Math.min(current, maxQuantity)));
  }, [maxQuantity, selectedTierId]);

  useEffect(() => {
    const profile = partyQuery.data;
    if (!profile) return;
    setBuyerName((current) => current.trim() || profile.name || displayName || '');
    setBuyerEmail((current) => current.trim() || profile.email || '');
  }, [displayName, partyQuery.data]);

  useEffect(() => {
    if (!submittedOrderId) return;
    const submittedOrder = orders.find((order) => order.id === submittedOrderId);
    if (submittedOrder && isTerminalOrderStatus(submittedOrder.status)) {
      const fingerprint = checkoutFingerprintsByOrderId.current.get(submittedOrderId);
      if (fingerprint) void forgetCheckoutFingerprint(fingerprint);
      checkoutFingerprintsByOrderId.current.delete(submittedOrderId);
      setSubmittedOrderId(null);
    }
  }, [forgetCheckoutFingerprint, orders, submittedOrderId]);

  const releasePendingOrder = useCallback(async (orderId: string): Promise<boolean> => {
    if (!eventId) return false;
    return Events.updateTicketOrderStatus(eventId, orderId, 'cancelled')
      .then(() => true)
      .catch(() => false);
  }, [eventId]);

  const purchaseMutation = useMutation<PurchaseResult>({
    mutationFn: async () => {
      if (!eventId) throw new Error('No encontramos este evento.');
      if (!partyId || !token?.trim()) throw new Error('Vuelve a iniciar sesión para comprar.');
      if (!selectedTier) throw new Error('Selecciona una entrada disponible.');
      if (!isValidTicketEmail(buyerEmail)) throw new Error('Ingresa un correo válido.');
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > maxQuantity) {
        throw new Error('La cantidad seleccionada ya no está disponible.');
      }

      const input = {
        eventId,
        tierId: selectedTier.id,
        quantity,
        buyerPartyId: partyId,
        buyerName: normalizePurchaseName(buyerName),
        buyerEmail: buyerEmail.trim().toLowerCase(),
        promoCode: promoCode.trim().toUpperCase() || null,
        checkoutKey: undefined as string | undefined,
      };

      const checkoutFingerprint = JSON.stringify([
        eventId,
        selectedTier.id,
        quantity,
        normalizePurchaseName(buyerName),
        buyerEmail.trim().toLowerCase(),
        promoCode.trim().toUpperCase(),
      ]);
      const checkoutKey = checkoutKeysByFingerprint.current.get(checkoutFingerprint)
        ?? await getOrCreateTicketCheckoutKey(checkoutFingerprint);
      checkoutKeysByFingerprint.current.set(checkoutFingerprint, checkoutKey);
      activeCheckoutFingerprint.current = checkoutFingerprint;
      input.checkoutKey = checkoutKey;

      const stripeApiVersion = selectedTier.priceCents === 0
        ? undefined
        : await getStripeCoreApiVersion();
      if (selectedTier.priceCents > 0 && !stripeApiVersion) {
        throw new Error(
          Platform.OS === 'web'
            ? 'Completa el pago desde la app instalada de TDF Records.'
            : 'Actualiza o instala la app oficial de TDF Records para pagar con tarjeta.',
        );
      }

      const createCheckout = () => Events.createTicketPaymentSheet(input, stripeApiVersion);
      let paymentIntent: EventTicketPaymentIntent;
      try {
        paymentIntent = await createCheckout();
      } catch (error) {
        if (!isClosedTicketCheckoutConflict(error)) throw error;

        const rotatedKey = await rotateTicketCheckoutKey(checkoutFingerprint);
        checkoutKeysByFingerprint.current.set(checkoutFingerprint, rotatedKey);
        input.checkoutKey = rotatedKey;
        paymentIntent = await createCheckout();
      }

      if (paymentIntent.amountCents === 0 && !paymentIntent.paymentSheet) {
        await forgetCheckoutFingerprint(checkoutFingerprint);
        return {
          kind: 'zero-total-confirmed',
          orderId: paymentIntent.orderId,
          quantity,
        };
      }

      checkoutFingerprintsByOrderId.current.set(paymentIntent.orderId, checkoutFingerprint);

      if (!paymentIntent.paymentSheet) {
        const released = await releasePendingOrder(paymentIntent.orderId);
        if (released) {
          await forgetCheckoutFingerprint(checkoutFingerprint);
        }
        throw new Error(
          released
            ? 'No recibimos los datos necesarios para abrir el pago. La reserva fue liberada.'
            : 'No recibimos los datos necesarios para abrir el pago. Revisa Mis entradas antes de volver a intentarlo.',
        );
      }
      const paymentSheet = paymentIntent.paymentSheet;

      try {
        await initNativeStripe({
          publishableKey: paymentSheet.publishableKey,
          merchantIdentifier: STRIPE_MERCHANT_IDENTIFIER,
          urlScheme: 'tdf',
          setReturnUrlSchemeOnAndroid: true,
        });

        const initResult = await initNativePaymentSheet({
          merchantDisplayName: STRIPE_MERCHANT_DISPLAY_NAME,
          customerId: paymentSheet.customerId,
          customerEphemeralKeySecret: paymentSheet.ephemeralKeySecret,
          paymentIntentClientSecret: paymentSheet.paymentIntentClientSecret,
          returnURL: STRIPE_RETURN_URL,
          allowsDelayedPaymentMethods: false,
          primaryButtonLabel: `Pagar ${formatTicketMoney(paymentIntent.amountCents, paymentIntent.currency)}`,
          defaultBillingDetails: {
            name: normalizePurchaseName(buyerName) ?? undefined,
            email: buyerEmail.trim().toLowerCase(),
          },
        });
        if (initResult.error) {
          throw new Error(
            initResult.error.localizedMessage ?? initResult.error.message ?? 'No pudimos abrir el pago.',
          );
        }

        analytics.capture('ticket_payment_sheet_opened', {
          event_id: eventId,
          tier_id: selectedTier.id,
          quantity,
          amount_cents: paymentIntent.amountCents,
        });
      } catch (error) {
        const released = await releasePendingOrder(paymentIntent.orderId);
        if (released) {
          await forgetCheckoutFingerprint(checkoutFingerprint);
        }
        const message = errorMessage(error, 'No pudimos abrir el pago.');
        throw new Error(
          released
            ? `${message} No se realizó el cobro y liberamos la reserva.`
            : `${message} Revisa Mis entradas antes de volver a intentarlo.`,
        );
      }

      try {
        const presentResult = await presentNativePaymentSheet();
        if (presentResult.error?.code === 'Canceled') {
          const releasedReservation = await releasePendingOrder(paymentIntent.orderId);
          if (releasedReservation) {
            await forgetCheckoutFingerprint(checkoutFingerprint);
          }
          return {
            kind: 'cancelled',
            orderId: paymentIntent.orderId,
            releasedReservation,
          };
        }
        if (presentResult.error) {
          return { kind: 'verification-needed', orderId: paymentIntent.orderId };
        }
      } catch {
        // Once PaymentSheet has been presented, a bridge/network error is not
        // proof that the charge failed. Keep the order pending for webhook reconciliation.
        return { kind: 'verification-needed', orderId: paymentIntent.orderId };
      }

      return {
        kind: 'payment-received',
        orderId: paymentIntent.orderId,
        quantity,
      };
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['event-ticket-tiers', eventId] });
      void queryClient.invalidateQueries({ queryKey: ['event-ticket-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['my-ticket-orders'] });
      void ordersQuery.refetch();

      if (result.kind === 'cancelled') {
        analytics.capture('ticket_checkout_cancelled', { event_id: eventId });
        setFeedback({
          tone: 'warning',
          title: 'Pago cancelado',
          message: result.releasedReservation
            ? 'No se realizó el cobro y la reserva fue liberada.'
            : 'No se realizó el cobro. Revisa Mis entradas antes de intentarlo otra vez.',
        });
        return;
      }

      if (result.kind === 'verification-needed') {
        setSubmittedOrderId(result.orderId);
        analytics.capture('ticket_payment_verification_needed', { event_id: eventId });
        setShowOrders(true);
        setFeedback({
          tone: 'warning',
          title: 'Estamos verificando el pago',
          message: 'No vuelvas a pagar todavía. Revisa Mis entradas; actualizaremos la orden cuando Stripe confirme el resultado.',
        });
        return;
      }

      analytics.capture('ticket_purchase_succeeded', {
        event_id: eventId,
        quantity: result.quantity,
        free: result.kind === 'zero-total-confirmed',
      });
      void notificationSuccess();
      setShowOrders(true);
      if (result.kind === 'payment-received') {
        setSubmittedOrderId(result.orderId);
      }
      setQuantity(1);
      setFeedback({
        tone: 'success',
        title: result.kind === 'zero-total-confirmed'
          ? '¡Entradas confirmadas!'
          : '¡Pago recibido!',
        message:
          result.kind === 'zero-total-confirmed'
            ? 'Tus códigos ya están listos en Mis entradas.'
            : 'Estamos emitiendo tus entradas. Los códigos aparecerán aquí en unos segundos.',
      });
    },
    onError: (error) => {
      analytics.capture('ticket_checkout_failed', { event_id: eventId });
      setFeedback({
        tone: 'error',
        title: 'No pudimos completar la compra',
        message: errorMessage(error, 'Inténtalo nuevamente.'),
      });
    },
  });

  const handlePurchase = useCallback(() => {
    setEmailTouched(true);
    setFeedback(null);
    if (!isValidTicketEmail(buyerEmail)) return;
    analytics.capture('ticket_checkout_started', {
      event_id: eventId,
      tier_id: selectedTier?.id,
      quantity,
      amount_cents: totalCents,
    });
    purchaseMutation.mutate();
  }, [analytics, buyerEmail, eventId, purchaseMutation, quantity, selectedTier?.id, totalCents]);

  const handleSelectTier = useCallback((tier: EventTicketTier) => {
    if (!isTicketTierOnSale(tier) || purchaseMutation.isPending) return;
    setSelectedTierId(tier.id);
    setFeedback(null);
    analytics.capture('ticket_tier_selected', { event_id: eventId, tier_id: tier.id });
  }, [analytics, eventId, purchaseMutation.isPending]);

  const handleExternalTickets = useCallback(() => {
    const url = eventQuery.data?.ticketUrl;
    if (!url) return;
    void Linking.openURL(url).catch(() => {
      setFeedback({
        tone: 'error',
        title: 'No pudimos abrir el sitio de venta',
        message: 'Comprueba tu conexión e inténtalo otra vez.',
      });
    });
  }, [eventQuery.data?.ticketUrl]);

  if (authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7c3aed" accessibilityLabel="Abriendo inicio de sesión" />
        </View>
      </SafeAreaView>
    );
  }

  if (!token?.trim()) {
    const returnTo = eventId
      ? `/ticketCheckout?eventId=${encodeURIComponent(eventId)}`
      : '/events';
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <View style={[styles.stateCard, styles.authStateCard]} accessibilityRole="summary">
            <MaterialCommunityIcons name="ticket-confirmation-outline" size={36} color="#7c3aed" />
            <Text style={styles.sectionTitle}>Inicia sesión para comprar entradas</Text>
            <Text style={styles.helperText}>
              {eventQuery.data?.title
                ? `Continuarás con ${eventQuery.data.title} después de ingresar.`
                : 'Conservaremos este evento para que continúes después de ingresar.'}
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, styles.authAction]}
              onPress={() => router.replace({
                pathname: '/auth',
                params: { mode: 'signup', intent: 'events', returnTo },
              })}
              accessibilityRole="button"
              accessibilityLabel="Crear cuenta para comprar entradas"
            >
              <Text style={styles.primaryButtonText}>Crear cuenta</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, styles.authAction]}
              onPress={() => router.replace({ pathname: '/auth', params: { returnTo } })}
              accessibilityRole="button"
              accessibilityLabel="Iniciar sesión para comprar entradas"
            >
              <Text style={styles.secondaryButtonText}>Ya tengo cuenta</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.authBackAction}
              onPress={() => router.back()}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryButtonText}>Volver al evento</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!eventId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>No encontramos el evento</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isInitialLoading = eventQuery.isLoading || tiersQuery.isLoading;
  const hasAccount = Boolean(token?.trim() && partyId);

  return (
    <ScreenErrorBoundary>
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.headerButton, purchaseMutation.isPending && styles.buttonDisabled]}
          onPress={() => router.back()}
          disabled={purchaseMutation.isPending}
          accessibilityRole="button"
          accessibilityLabel="Volver al evento"
          accessibilityState={{ disabled: purchaseMutation.isPending }}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Comprar entradas</Text>
        <TouchableOpacity
          style={[styles.headerButton, purchaseMutation.isPending && styles.buttonDisabled]}
          onPress={() => router.push('/tickets')}
          disabled={purchaseMutation.isPending}
          accessibilityRole="button"
          accessibilityLabel="Abrir Mis entradas"
          accessibilityState={{ disabled: purchaseMutation.isPending }}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="ticket-confirmation-outline" size={23} color="#7c3aed" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <View style={styles.contentColumn}>
            {eventQuery.data ? (
              <View style={styles.eventSummary}>
                <Text style={styles.eventTitle}>{eventQuery.data.title}</Text>
                <View style={styles.eventMetaRow}>
                  <MaterialCommunityIcons name="calendar-blank-outline" size={18} color="#6b7280" />
                  <Text style={styles.eventMeta}>{formatTicketDateTime(eventQuery.data.startTime)}</Text>
                </View>
                {eventQuery.data.venue ? (
                  <View style={styles.eventMetaRow}>
                    <MaterialCommunityIcons name="map-marker-outline" size={18} color="#6b7280" />
                    <Text style={styles.eventMeta}>
                      {eventQuery.data.venue.name} · {eventQuery.data.venue.city}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {feedback ? (
              <View
                style={[
                  styles.feedback,
                  feedback.tone === 'success' && styles.feedbackSuccess,
                  feedback.tone === 'warning' && styles.feedbackWarning,
                  feedback.tone === 'error' && styles.feedbackError,
                ]}
                accessibilityRole="alert"
              >
                <MaterialCommunityIcons
                  name={
                    feedback.tone === 'success'
                      ? 'check-circle-outline'
                      : feedback.tone === 'warning'
                        ? 'information-outline'
                        : 'alert-circle-outline'
                  }
                  size={24}
                  color={feedback.tone === 'success' ? '#15803d' : feedback.tone === 'warning' ? '#a16207' : '#b91c1c'}
                />
                <View style={styles.feedbackCopy}>
                  <Text style={styles.feedbackTitle}>{feedback.title}</Text>
                  <Text style={styles.feedbackText}>{feedback.message}</Text>
                  {feedback.tone === 'success' ? (
                    <TouchableOpacity
                      onPress={() => router.push('/tickets')}
                      accessibilityRole="button"
                      accessibilityLabel="Ver todas mis entradas"
                    >
                      <Text style={styles.feedbackLink}>Ver todas mis entradas</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : null}

            {isInitialLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#7c3aed" />
                <Text style={styles.loadingText}>Comprobando entradas disponibles…</Text>
              </View>
            ) : eventQuery.isError || tiersQuery.isError ? (
              <View style={styles.stateCard} accessibilityRole="alert">
                <Text style={styles.errorTitle}>No pudimos cargar las entradas</Text>
                <Text style={styles.helperText}>Comprueba tu conexión y vuelve a intentarlo.</Text>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    void eventQuery.refetch();
                    void tiersQuery.refetch();
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.secondaryButtonText}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            ) : availableTiers.length === 0 ? (
              <View style={styles.stateCard}>
                <MaterialCommunityIcons name="ticket-outline" size={34} color="#6b7280" />
                <Text style={styles.sectionTitle}>
                  {unavailableTiers.some((tier) => getTicketTierSaleState(tier) === 'upcoming')
                    ? 'Venta próximamente'
                    : !eventCanSellTickets && eventQuery.data
                      ? 'La venta no está disponible'
                    : unavailableTiers.length > 0
                      ? 'No hay entradas disponibles'
                      : 'Aún no hay entradas publicadas'}
                </Text>
                {unavailableTiers[0] ? (
                  <Text style={styles.helperText}>{ticketTierSaleStateLabel(unavailableTiers[0])}</Text>
                ) : null}
                {eventQuery.data?.ticketUrl ? (
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleExternalTickets}
                    accessibilityRole="link"
                  >
                    <Text style={styles.primaryButtonText}>Ir a la venta externa</Text>
                    <MaterialCommunityIcons name="open-in-new" size={18} color="#fff" />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <>
                <View style={styles.section}>
                  <View style={styles.sectionHeading}>
                    <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
                    <View style={styles.sectionHeadingCopy}>
                      <Text style={styles.sectionTitle}>Elige tu entrada</Text>
                      <Text style={styles.helperText}>Puedes cambiarla antes de pagar.</Text>
                    </View>
                  </View>
                  <View style={styles.tierList} accessibilityRole="radiogroup">
                    {tiers.map((tier) => {
                      const selected = selectedTier?.id === tier.id;
                      const selectable = isTicketTierOnSale(tier);
                      return (
                        <TouchableOpacity
                          key={tier.id}
                          style={[
                            styles.tierCard,
                            selected && styles.tierCardSelected,
                            !selectable && styles.tierCardUnavailable,
                          ]}
                          onPress={() => handleSelectTier(tier)}
                          disabled={!selectable || purchaseMutation.isPending}
                          accessibilityRole="radio"
                          accessibilityState={{
                            selected,
                            disabled: !selectable || purchaseMutation.isPending,
                          }}
                          accessibilityLabel={`${tier.name}, ${tier.priceCents === 0 ? 'gratis' : formatTicketMoney(tier.priceCents, tier.currency)}, ${ticketTierSaleStateLabel(tier)}`}
                        >
                          <View style={styles.tierRadio}>
                            {selected ? <View style={styles.tierRadioDot} /> : null}
                          </View>
                          <View style={styles.tierCopy}>
                            <Text style={styles.tierName}>{tier.name}</Text>
                            {tier.description ? <Text style={styles.tierDescription}>{tier.description}</Text> : null}
                            <Text style={styles.tierAvailability}>{ticketTierSaleStateLabel(tier)}</Text>
                          </View>
                          <Text style={styles.tierPrice}>
                            {tier.priceCents === 0 ? 'Gratis' : formatTicketMoney(tier.priceCents, tier.currency)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionHeading}>
                    <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>2</Text></View>
                    <View style={styles.sectionHeadingCopy}>
                      <Text style={styles.sectionTitle}>Cantidad</Text>
                      <Text style={styles.helperText}>Máximo {maxQuantity} en esta compra.</Text>
                    </View>
                  </View>
                  <View style={styles.quantityRow}>
                    <TouchableOpacity
                      style={[styles.quantityButton, quantity <= 1 && styles.buttonDisabled]}
                      onPress={() => setQuantity((current) => Math.max(1, current - 1))}
                      disabled={quantity <= 1 || purchaseMutation.isPending}
                      accessibilityRole="button"
                      accessibilityLabel="Restar una entrada"
                    >
                      <MaterialCommunityIcons name="minus" size={22} color="#374151" />
                    </TouchableOpacity>
                    <View style={styles.quantityValue} accessible accessibilityLabel={`${quantity} entradas`}>
                      <Text style={styles.quantityNumber}>{quantity}</Text>
                      <Text style={styles.quantityLabel}>{quantity === 1 ? 'entrada' : 'entradas'}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.quantityButton, quantity >= maxQuantity && styles.buttonDisabled]}
                      onPress={() => setQuantity((current) => Math.min(maxQuantity, current + 1))}
                      disabled={quantity >= maxQuantity || purchaseMutation.isPending}
                      accessibilityRole="button"
                      accessibilityLabel="Agregar una entrada"
                    >
                      <MaterialCommunityIcons name="plus" size={22} color="#374151" />
                    </TouchableOpacity>
                  </View>
                </View>

                {!hasAccount ? (
                  <View style={styles.accountCard} accessibilityRole="alert">
                    <MaterialCommunityIcons name="account-alert-outline" size={26} color="#92400e" />
                    <View style={styles.accountCopy}>
                      <Text style={styles.accountTitle}>Vuelve a iniciar sesión</Text>
                      <Text style={styles.accountText}>Necesitamos vincular la compra con tu cuenta.</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.accountButton}
                      onPress={() => {
                        clearToken();
                        router.replace({
                          pathname: '/auth',
                          params: { returnTo: `/ticketCheckout?eventId=${encodeURIComponent(eventId)}` },
                        });
                      }}
                      accessibilityRole="button"
                    >
                      <Text style={styles.accountButtonText}>Volver a ingresar</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.section}>
                    <View style={styles.sectionHeading}>
                      <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>3</Text></View>
                      <View style={styles.sectionHeadingCopy}>
                        <Text style={styles.sectionTitle}>Datos de entrega</Text>
                        <Text style={styles.helperText}>Usaremos este correo para ayudarte a recuperar tus entradas.</Text>
                      </View>
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Nombre <Text style={styles.optionalLabel}>(opcional)</Text></Text>
                      <TextInput
                        value={buyerName}
                        onChangeText={setBuyerName}
                        style={styles.input}
                        placeholder="Tu nombre"
                        autoCapitalize="words"
                        autoComplete="name"
                        textContentType="name"
                        maxLength={160}
                        editable={!purchaseMutation.isPending}
                        accessibilityLabel="Nombre para las entradas"
                      />
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Correo electrónico</Text>
                      <TextInput
                        value={buyerEmail}
                        onChangeText={(value) => {
                          setBuyerEmail(value);
                          if (emailTouched) setFeedback(null);
                        }}
                        onBlur={() => setEmailTouched(true)}
                        style={[styles.input, emailError && styles.inputError]}
                        placeholder="tu@correo.com"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        textContentType="emailAddress"
                        keyboardType="email-address"
                        maxLength={254}
                        editable={!purchaseMutation.isPending}
                        accessibilityLabel="Correo para recuperar las entradas"
                        aria-invalid={Boolean(emailError)}
                      />
                      {emailError ? <Text style={styles.fieldError} accessibilityRole="alert">{emailError}</Text> : null}
                    </View>

                    <TouchableOpacity
                      style={styles.promoToggle}
                      onPress={() => setPromoExpanded((current) => !current)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: promoExpanded }}
                    >
                      <MaterialCommunityIcons name="ticket-percent-outline" size={19} color="#7c3aed" />
                      <Text style={styles.promoToggleText}>¿Tienes un código promocional?</Text>
                      <MaterialCommunityIcons
                        name={promoExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="#6b7280"
                      />
                    </TouchableOpacity>
                    {promoExpanded ? (
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Código promocional</Text>
                        <TextInput
                          value={promoCode}
                          onChangeText={setPromoCode}
                          style={styles.input}
                          placeholder="EJEMPLO-20"
                          autoCapitalize="characters"
                          autoCorrect={false}
                          maxLength={50}
                          editable={!purchaseMutation.isPending}
                          accessibilityLabel="Código promocional"
                        />
                        <Text style={styles.helperText}>Confirmaremos el descuento antes de cobrar.</Text>
                      </View>
                    ) : null}
                  </View>
                )}

                <View style={styles.trustRow}>
                  <MaterialCommunityIcons name="lock-outline" size={19} color="#15803d" />
                  <Text style={styles.trustText}>Pago cifrado por Stripe. TDF Records no guarda los datos de tu tarjeta.</Text>
                </View>
              </>
            )}

            {partyId ? (
              <View style={styles.ordersSection}>
                <TouchableOpacity
                  style={styles.ordersToggle}
                  onPress={() => setShowOrders((current) => !current)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showOrders }}
                >
                  <View style={styles.ordersToggleCopy}>
                    <MaterialCommunityIcons name="ticket-account" size={22} color="#7c3aed" />
                    <Text style={styles.ordersToggleText}>Mis entradas de este evento</Text>
                    {activeOrderCount > 0 ? <View style={styles.countBadge}><Text style={styles.countBadgeText}>{activeOrderCount}</Text></View> : null}
                  </View>
                  <MaterialCommunityIcons name={showOrders ? 'chevron-up' : 'chevron-down'} size={22} color="#6b7280" />
                </TouchableOpacity>
                {showOrders ? (
                  <View style={styles.orderList}>
                    {ordersQuery.isLoading ? (
                      <ActivityIndicator color="#7c3aed" accessibilityLabel="Cargando mis entradas" />
                    ) : ordersQuery.isError ? (
                      <View style={styles.messageGroup}>
                        <Text style={styles.helperText}>No pudimos cargar tus entradas.</Text>
                        <TouchableOpacity style={styles.secondaryButton} onPress={() => void ordersQuery.refetch()}>
                          <Text style={styles.secondaryButtonText}>Reintentar</Text>
                        </TouchableOpacity>
                      </View>
                    ) : orders.length === 0 ? (
                      <Text style={styles.helperText}>Todavía no tienes entradas para este evento.</Text>
                    ) : (
                      orders.map((order) => (
                        <TicketOrderCard key={order.id} order={order} />
                      ))
                    )}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </ScrollView>

        {selectedTier && hasAccount && !eventQuery.isError && !tiersQuery.isError ? (
          <View style={styles.checkoutBar}>
            <View style={styles.checkoutTotal}>
              <Text style={styles.checkoutTotalLabel}>
                {hasPromoCode && selectedTier.priceCents > 0 ? 'Subtotal' : 'Total'}
              </Text>
              <Text style={styles.checkoutTotalValue}>
                {selectedTier.priceCents === 0
                  ? 'Gratis'
                  : formatTicketMoney(totalCents, selectedTier.currency)}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.checkoutButton, (purchaseMutation.isPending || submittedOrderId) && styles.buttonDisabled]}
              onPress={handlePurchase}
              disabled={purchaseMutation.isPending || Boolean(submittedOrderId)}
              accessibilityRole="button"
              accessibilityLabel={
                selectedTier.priceCents === 0
                  ? `Confirmar ${quantity} ${quantity === 1 ? 'entrada gratis' : 'entradas gratis'}`
                  : hasPromoCode
                    ? 'Validar código promocional y continuar'
                  : `Pagar ${formatTicketMoney(totalCents, selectedTier.currency)}`
              }
              accessibilityState={{
                disabled: purchaseMutation.isPending || Boolean(submittedOrderId),
                busy: purchaseMutation.isPending || Boolean(submittedOrderId),
              }}
            >
              {purchaseMutation.isPending || submittedOrderId ? <ActivityIndicator color="#fff" size="small" /> : null}
              <Text style={styles.checkoutButtonText}>
                {submittedOrderId
                  ? 'Confirmando pago…'
                  : purchaseMutation.isPending
                  ? selectedTier.priceCents === 0
                    ? 'Confirmando…'
                    : hasPromoCode
                      ? 'Validando…'
                      : 'Abriendo pago…'
                  : selectedTier.priceCents === 0
                    ? 'Confirmar entradas'
                    : hasPromoCode
                      ? 'Validar descuento'
                    : `Pagar ${formatTicketMoney(totalCents, selectedTier.currency)}`}
              </Text>
              {!purchaseMutation.isPending && !submittedOrderId ? (
                <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
              ) : null}
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f7f5' },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  header: {
    minHeight: 58,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#111827', fontSize: 17, fontWeight: '800' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  contentColumn: { width: '100%', maxWidth: 620, alignSelf: 'center', gap: 16 },
  eventSummary: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 9 },
  eventTitle: { color: '#111827', fontSize: 22, lineHeight: 28, fontWeight: '900' },
  eventMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventMeta: { flex: 1, color: '#4b5563', fontSize: 13, lineHeight: 19 },
  loadingBox: { minHeight: 190, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#6b7280', fontSize: 13 },
  feedback: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  feedbackSuccess: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  feedbackWarning: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  feedbackError: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  feedbackCopy: { flex: 1, gap: 4 },
  feedbackTitle: { color: '#111827', fontSize: 15, fontWeight: '900' },
  feedbackText: { color: '#4b5563', fontSize: 13, lineHeight: 19 },
  feedbackLink: { color: '#6d28d9', fontSize: 13, fontWeight: '900', marginTop: 5 },
  stateCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: 18,
    alignItems: 'flex-start',
    gap: 10,
  },
  authStateCard: { width: '100%', maxWidth: 520 },
  authAction: { width: '100%' },
  authBackAction: { minHeight: 44, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: 16,
    gap: 14,
  },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sectionHeadingCopy: { flex: 1, gap: 2 },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { color: '#6d28d9', fontSize: 13, fontWeight: '900' },
  sectionTitle: { color: '#111827', fontSize: 17, fontWeight: '900' },
  helperText: { color: '#6b7280', fontSize: 12, lineHeight: 18 },
  errorTitle: { color: '#991b1b', fontSize: 17, fontWeight: '900' },
  tierList: { gap: 10 },
  tierCard: {
    minHeight: 86,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  tierCardSelected: { borderColor: '#7c3aed', borderWidth: 2, backgroundColor: '#faf5ff' },
  tierCardUnavailable: { opacity: 0.55, backgroundColor: '#f9fafb' },
  tierRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tierRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#7c3aed' },
  tierCopy: { flex: 1, gap: 4 },
  tierName: { color: '#111827', fontSize: 15, fontWeight: '900' },
  tierDescription: { color: '#4b5563', fontSize: 12, lineHeight: 17 },
  tierAvailability: { color: '#6d28d9', fontSize: 11, fontWeight: '800' },
  tierPrice: { color: '#2e1065', fontSize: 15, fontWeight: '900' },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  quantityButton: {
    width: 50,
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityValue: { minWidth: 86, alignItems: 'center', gap: 1 },
  quantityNumber: { color: '#111827', fontSize: 28, fontWeight: '900' },
  quantityLabel: { color: '#6b7280', fontSize: 11, fontWeight: '700' },
  fieldGroup: { gap: 7 },
  fieldLabel: { color: '#374151', fontSize: 13, fontWeight: '800' },
  optionalLabel: { color: '#9ca3af', fontWeight: '600' },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 13,
    color: '#111827',
    fontSize: 15,
  },
  inputError: { borderColor: '#dc2626', backgroundColor: '#fff7f7' },
  fieldError: { color: '#b91c1c', fontSize: 12, lineHeight: 17 },
  promoToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  promoToggleText: { flex: 1, color: '#6d28d9', fontSize: 13, fontWeight: '800' },
  trustRow: {
    borderRadius: 13,
    padding: 13,
    backgroundColor: '#f0fdf4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  trustText: { flex: 1, color: '#166534', fontSize: 12, lineHeight: 18 },
  accountCard: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#fffbeb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountCopy: { flex: 1, gap: 3 },
  accountTitle: { color: '#92400e', fontWeight: '900' },
  accountText: { color: '#78350f', fontSize: 12, lineHeight: 17 },
  accountButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 10 },
  accountButtonText: { color: '#92400e', fontSize: 12, fontWeight: '900' },
  ordersSection: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  ordersToggle: {
    minHeight: 58,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ordersToggleCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  ordersToggleText: { color: '#111827', fontSize: 14, fontWeight: '900' },
  countBadge: { borderRadius: 999, minWidth: 22, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: '#ede9fe' },
  countBadgeText: { color: '#6d28d9', fontSize: 11, textAlign: 'center', fontWeight: '900' },
  orderList: { borderTopWidth: 1, borderTopColor: '#e5e7eb', padding: 12, gap: 12 },
  messageGroup: { gap: 8 },
  checkoutBar: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  checkoutTotal: { minWidth: 92, gap: 1 },
  checkoutTotalLabel: { color: '#6b7280', fontSize: 11, fontWeight: '700' },
  checkoutTotalValue: { color: '#111827', fontSize: 19, fontWeight: '900' },
  checkoutButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  checkoutButtonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  primaryButton: {
    minHeight: 50,
    borderRadius: 13,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  secondaryButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#c4b5fd',
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: '#6d28d9', fontWeight: '900' },
  buttonDisabled: { opacity: 0.48 },
});
