import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { API_BASE } from '../src/lib/api';
import { useAnalytics } from '../src/analytics/AnalyticsProvider';
import { useUserSettings } from '../src/providers/UserSettingsProvider';
import {
  Merch,
  loadMerchCapability,
  loadOrCreateMerchCheckoutKey,
  loadStoreCartReference,
  merchIdempotencyKey,
  saveMerchCapability,
  saveStoreCartReference,
  type MerchCheckoutRequest,
  type MerchProduct,
} from '../src/api/merch';
import { MerchReputation } from '../src/api/merchReputation';
import { MerchReputationPreview } from '../src/components/merch/MerchStoreReputation';

const param = (value?: string | string[]) => Array.isArray(value) ? value[0] ?? '' : value ?? '';
const money = (minor: number, locale: string, currency = 'USD') => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100);
const imageUrl = (value?: string | null) => !value ? undefined : /^https:\/\//i.test(value) ? value : `${API_BASE}/${value.replace(/^\//, '')}`;

type CartLine = { variantId: string; productName: string; variantName: string; quantity: number; subtotalMinor: number; available: boolean };
type SellerOrder = { id: string; orderNumber: string; totalMinor: number; currency: string; paymentStatus: string; fulfillmentStatus: string; shippingMethod?: string };

export default function MerchScreen() {
  const raw = useLocalSearchParams<{ storeSlug?: string | string[]; productSlug?: string | string[]; view?: string | string[]; orderId?: string | string[] }>();
  const storeSlug = param(raw.storeSlug);
  const productSlug = param(raw.productSlug);
  const view = param(raw.view);
  const orderId = param(raw.orderId);
  const router = useRouter();
  const analytics = useAnalytics();
  const { locale } = useUserSettings();
  const english = locale.startsWith('en');
  const capabilities = useQuery({ queryKey: ['merch-capabilities'], queryFn: Merch.capabilities, retry: false });

  useEffect(() => { analytics.screen('Artist merch', { merch_view: view || (orderId ? 'order' : productSlug ? 'product' : storeSlug ? 'store' : 'discover') }); }, [analytics, orderId, productSlug, storeSlug, view]);

  const back = <TouchableOpacity accessibilityRole="button" accessibilityLabel={english ? 'Go back' : 'Volver'} onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>← {english ? 'Back' : 'Volver'}</Text></TouchableOpacity>;
  if (capabilities.isLoading) return <ScreenState><ActivityIndicator size="large" color="#6d28d9" accessibilityLabel={english ? 'Checking availability' : 'Comprobando disponibilidad'} /></ScreenState>;
  if (capabilities.isError || !capabilities.data) return <ScreenState>{back}<Text accessibilityRole="alert" style={styles.error}>{english ? 'We could not verify merch availability.' : 'No pudimos verificar la disponibilidad de merch.'}</Text></ScreenState>;
  if (view === 'seller') return <SellerView english={english} locale={locale} back={back} />;
  if (orderId) return <OrderView orderId={orderId} english={english} locale={locale} back={back} />;
  if (view === 'cart' && storeSlug) return <CartView storeSlug={storeSlug} english={english} locale={locale} checkoutAvailable={capabilities.data.features.checkout} back={back} />;
  if (storeSlug && productSlug) return <ProductView storeSlug={storeSlug} productSlug={productSlug} english={english} locale={locale} checkoutAvailable={capabilities.data.features.checkout} back={back} />;
  if (storeSlug) return <StoreView storeSlug={storeSlug} english={english} locale={locale} back={back} />;
  return <DiscoveryView english={english} locale={locale} publicAvailable={capabilities.data.features.storefronts && capabilities.data.features.publicCatalog} />;
}

function ScreenState({ children }: { children: ReactNode }) {
  return <SafeAreaView style={styles.safe}><View style={styles.state}>{children}</View></SafeAreaView>;
}

function DiscoveryView({ english, locale, publicAvailable }: { english: boolean; locale: string; publicAvailable: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const stores = useQuery({ queryKey: ['merch-storefronts', search], queryFn: () => Merch.storefronts(search), enabled: publicAvailable, retry: false });
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}><Text accessibilityRole="header" style={styles.title}>{english ? 'Artist merch' : 'Merch de artistas'}</Text><Text style={styles.subtitle}>{english ? 'Physical products sold by each participating artist.' : 'Productos físicos vendidos por cada artista participante.'}</Text>{!publicAvailable ? <Notice text={english ? 'Artist stores are still in a closed pilot.' : 'Las tiendas de artistas siguen en piloto cerrado.'} /> : <><TextInput accessibilityLabel={english ? 'Search stores' : 'Buscar tiendas'} placeholder={english ? 'Search stores' : 'Buscar tiendas'} value={search} onChangeText={setSearch} style={styles.input} />{stores.isLoading ? <ActivityIndicator /> : stores.isError ? <Text accessibilityRole="alert" style={styles.error}>{english ? 'The catalog could not be loaded.' : 'No se pudo cargar el catálogo.'}</Text> : stores.data?.map((store) => <TouchableOpacity key={store.id} accessibilityRole="button" accessibilityLabel={`${english ? 'Open store' : 'Abrir tienda'} ${store.displayName}`} style={styles.card} onPress={() => router.push({ pathname: '/merch', params: { storeSlug: store.slug } })}>{store.coverImageUrl ? <Image source={imageUrl(store.coverImageUrl)} style={styles.cardImage} contentFit="cover" accessibilityLabel="" /> : null}<Text style={styles.cardTitle}>{store.displayName}</Text>{store.discovery?.newStore ? <Text style={styles.exploration}>{english ? 'New-store discovery' : 'Descubre una tienda nueva'}</Text> : null}<MerchReputationPreview subjectKind="store" subjectId={store.id} english={english} /><Text style={styles.cardBody}>{store.description}</Text><Text style={styles.meta}>{store.products?.length ?? 0} {english ? 'products' : 'productos'}{typeof store.products?.[0]?.priceFromMinor === 'number' ? ` · ${english ? 'from' : 'desde'} ${money(store.products[0].priceFromMinor, locale)}` : ''}</Text></TouchableOpacity>)}<TouchableOpacity style={styles.secondaryButton} accessibilityRole="button" onPress={() => router.push('/merchSeller')}><Text style={styles.secondaryButtonText}>{english ? 'Manage my artist store' : 'Administrar mi tienda de artista'}</Text></TouchableOpacity></>}</ScrollView></SafeAreaView>;
}

function StoreView({ storeSlug, english, locale, back }: { storeSlug: string; english: boolean; locale: string; back: ReactNode }) {
  const router = useRouter();
  const store = useQuery({ queryKey: ['merch-storefront', storeSlug], queryFn: () => Merch.storefront(storeSlug), retry: false });
  if (store.isLoading) return <ScreenState>{back}<ActivityIndicator /></ScreenState>;
  if (store.isError || !store.data) return <ScreenState>{back}<Text accessibilityRole="alert" style={styles.error}>{english ? 'Store unavailable.' : 'Tienda no disponible.'}</Text></ScreenState>;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>{back}{store.data.coverImageUrl ? <Image source={imageUrl(store.data.coverImageUrl)} style={styles.hero} contentFit="cover" accessibilityLabel="" /> : null}<Text accessibilityRole="header" style={styles.title}>{store.data.displayName}</Text><Text style={styles.subtitle}>{store.data.description}</Text><MerchReputationPreview subjectKind="store" subjectId={store.data.id} english={english} /><View style={styles.list}>{store.data.products?.map((product) => <TouchableOpacity key={product.id} accessibilityRole="button" accessibilityLabel={product.name} style={styles.card} onPress={() => router.push({ pathname: '/merch', params: { storeSlug, productSlug: product.slug } })}>{product.imageUrl ? <Image source={imageUrl(product.imageUrl)} style={styles.cardImage} contentFit="cover" accessibilityLabel="" /> : null}<Text style={styles.cardTitle}>{product.name}</Text>{typeof product.priceFromMinor === 'number' ? <Text>{money(product.priceFromMinor, locale, product.currency)}</Text> : null}<Text style={styles.meta}>{product.available === false ? (english ? 'Sold out' : 'Agotado') : product.availabilityMode === 'preorder' ? (english ? 'Preorder' : 'Preventa') : (english ? 'Available' : 'Disponible')}</Text></TouchableOpacity>)}</View></ScrollView></SafeAreaView>;
}

function ProductView({ storeSlug, productSlug, english, locale, checkoutAvailable, back }: { storeSlug: string; productSlug: string; english: boolean; locale: string; checkoutAvailable: boolean; back: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const product = useQuery({ queryKey: ['merch-product', storeSlug, productSlug], queryFn: () => Merch.product(storeSlug, productSlug), retry: false });
  const variants = product.data?.variants ?? [];
  const selected = variants.find((variant) => variant.id === selectedId) ?? variants.find((variant) => variant.available !== false);
  const add = useMutation({ mutationFn: async () => {
    let cartId = await loadStoreCartReference(storeSlug);
    let token = cartId ? await loadMerchCapability('cart', cartId) : null;
    if (!cartId || !token) {
      const created = await Merch.createCart(storeSlug);
      if (!created.lookupToken) throw new Error(english ? 'Cart security capability missing.' : 'Falta la capacidad segura del carrito.');
      cartId = created.id; token = created.lookupToken;
      await Promise.all([saveMerchCapability('cart', cartId, token), saveStoreCartReference(storeSlug, cartId)]);
    }
    await Merch.putCartItem(cartId, token, selected!.id, 1);
    await queryClient.invalidateQueries({ queryKey: ['merch-cart', cartId] });
  }, onSuccess: () => router.push({ pathname: '/merch', params: { storeSlug, view: 'cart' } }) });
  if (product.isLoading) return <ScreenState>{back}<ActivityIndicator /></ScreenState>;
  if (product.isError || !product.data) return <ScreenState>{back}<Text style={styles.error}>{english ? 'Product unavailable.' : 'Producto no disponible.'}</Text></ScreenState>;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>{back}{product.data.images?.[0] ? <Image source={imageUrl(product.data.images[0].url)} style={styles.productImage} contentFit="contain" accessibilityLabel={product.data.images[0].altText} /> : <Notice text={english ? 'Image pending review.' : 'Imagen pendiente de revisión.'} />}<Text accessibilityRole="header" style={styles.title}>{product.data.name}</Text><Text style={styles.subtitle}>{product.data.description}</Text><MerchReputationPreview subjectKind="product" subjectId={product.data.id} english={english} /><MerchReputationPreview subjectKind="store" subjectId={product.data.storeId} english={english} /><Text style={styles.price}>{selected ? money(selected.priceMinor, locale, selected.currency) : '—'}</Text><Text style={styles.label}>{english ? 'Variant' : 'Variante'}</Text><View style={styles.choiceRow}>{variants.map((variant: NonNullable<MerchProduct['variants']>[number]) => <TouchableOpacity key={variant.id} disabled={variant.available === false} style={[styles.choice, selected?.id === variant.id && styles.choiceSelected, variant.available === false && styles.disabled]} onPress={() => setSelectedId(variant.id)} accessibilityRole="radio" accessibilityState={{ checked: selected?.id === variant.id, disabled: variant.available === false }}><Text style={styles.choiceText}>{variant.name}</Text></TouchableOpacity>)}</View>{!checkoutAvailable ? <Notice text={english ? 'Purchases remain disabled during the pilot.' : 'Las compras siguen deshabilitadas durante el piloto.'} /> : null}{add.isError ? <Text accessibilityRole="alert" style={styles.error}>{add.error.message}</Text> : null}<TouchableOpacity accessibilityRole="button" disabled={!checkoutAvailable || !selected || selected.available === false || add.isPending} style={[styles.primaryButton, (!checkoutAvailable || !selected || add.isPending) && styles.disabled]} onPress={() => add.mutate()}><Text style={styles.primaryButtonText}>{add.isPending ? (english ? 'Adding…' : 'Agregando…') : (english ? 'Add to cart' : 'Agregar al carrito')}</Text></TouchableOpacity></ScrollView></SafeAreaView>;
}

function CartView({ storeSlug, english, locale, checkoutAvailable, back }: { storeSlug: string; english: boolean; locale: string; checkoutAvailable: boolean; back: ReactNode }) {
  const router = useRouter();
  const [recipient, setRecipient] = useState({ name: '', email: '', phone: '', city: '', address: '', subdivision: '' });
  const [zoneId, setZoneId] = useState('');
  const cartRef = useQuery({ queryKey: ['merch-cart-reference', storeSlug], queryFn: () => loadStoreCartReference(storeSlug) });
  const token = useQuery({ queryKey: ['merch-cart-token', cartRef.data], queryFn: () => loadMerchCapability('cart', cartRef.data!), enabled: Boolean(cartRef.data) });
  const cart = useQuery({ queryKey: ['merch-cart', cartRef.data], queryFn: () => Merch.cart(cartRef.data!, token.data!), enabled: Boolean(cartRef.data && token.data), retry: false });
  const store = useQuery({ queryKey: ['merch-storefront', storeSlug], queryFn: () => Merch.storefront(storeSlug), retry: false });
  const zones = store.data?.shippingZones ?? [];
  const selectedZone = zones.find((zone) => zone.id === zoneId) ?? zones[0];
  const lines = (cart.data?.items ?? []) as CartLine[];
  const checkout = useMutation({ mutationFn: async () => {
    const body: MerchCheckoutRequest = { recipient: { name: recipient.name.trim(), email: recipient.email.trim(), phone: recipient.phone.trim() || null, countryCode: 'EC', subdivision: recipient.subdivision.trim() || null, city: recipient.city.trim(), addressLine1: recipient.address.trim(), addressLine2: null, postalCode: null, deliveryNote: null }, shippingZoneId: selectedZone!.id, createAccount: false, locale: english ? 'en' : 'es' };
    const order = await Merch.checkout(cartRef.data!, token.data!, await loadOrCreateMerchCheckoutKey(cartRef.data!), body);
    const orderToken = order.lookupToken ?? token.data;
    if (!orderToken) throw new Error(english ? 'Tracking capability missing.' : 'Falta la capacidad de seguimiento.');
    await saveMerchCapability('order', order.id, orderToken);
    return order;
  }, onSuccess: (order) => router.replace({ pathname: '/merch', params: { orderId: order.id } }) });
  if (cartRef.isLoading || token.isLoading || cart.isLoading || store.isLoading) return <ScreenState>{back}<ActivityIndicator /></ScreenState>;
  if (!cartRef.data || !token.data || cart.isError) return <ScreenState>{back}<Text style={styles.error}>{english ? 'This cart expired or is not available on this device.' : 'Este carrito venció o no está disponible en este dispositivo.'}</Text></ScreenState>;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>{back}<Text accessibilityRole="header" style={styles.title}>{english ? 'Your cart' : 'Tu carrito'}</Text>{store.data?.id ? <MerchReputationPreview subjectKind="store" subjectId={store.data.id} english={english} /> : null}{lines.map((line) => <View key={line.variantId} style={styles.row}><View style={styles.flex}><Text style={styles.cardTitle}>{line.productName}</Text><Text>{line.variantName} × {line.quantity}</Text></View><Text>{money(line.subtotalMinor, locale)}</Text></View>)}{!checkoutAvailable ? <Notice text={english ? 'Checkout is not enabled; no payment can be submitted.' : 'El checkout no está habilitado; no se puede enviar ningún pago.'} /> : null}<Text style={styles.sectionTitle}>{english ? 'Delivery details' : 'Datos de entrega'}</Text>{([['name', english ? 'Full name' : 'Nombre completo'],['email','Email'],['phone',english ? 'Phone (optional)' : 'Teléfono (opcional)'],['city',english ? 'City' : 'Ciudad'],['subdivision',english ? 'Province' : 'Provincia'],['address',english ? 'Address' : 'Dirección']] as const).map(([key,label]) => <TextInput key={key} accessibilityLabel={label} placeholder={label} autoCapitalize={key === 'email' ? 'none' : 'sentences'} keyboardType={key === 'email' ? 'email-address' : key === 'phone' ? 'phone-pad' : 'default'} value={recipient[key]} onChangeText={(value) => setRecipient({ ...recipient, [key]: value })} style={styles.input} />)}<Text style={styles.label}>{english ? 'Delivery option' : 'Opción de entrega'}</Text><View style={styles.choiceRow}>{zones.map((zone) => <TouchableOpacity key={zone.id} style={[styles.choice, selectedZone?.id === zone.id && styles.choiceSelected]} onPress={() => setZoneId(zone.id)} accessibilityRole="radio" accessibilityState={{ checked: selectedZone?.id === zone.id }}><Text style={styles.choiceText}>{zone.name} · {money(zone.rateMinor, locale)}</Text></TouchableOpacity>)}</View><View style={styles.row}><Text style={styles.cardTitle}>{english ? 'Products' : 'Productos'}</Text><Text>{money(cart.data?.productSubtotalMinor ?? 0, locale)}</Text></View><Text style={styles.meta}>{english ? 'The server recalculates totals and reserves stock atomically. Creating an order does not mark it paid.' : 'El servidor recalcula los totales y reserva el stock de forma atómica. Crear la orden no la marca como pagada.'}</Text>{checkout.isError ? <Text accessibilityRole="alert" style={styles.error}>{checkout.error.message}</Text> : null}<TouchableOpacity accessibilityRole="button" disabled={!checkoutAvailable || !selectedZone || lines.length === 0 || !recipient.name.trim() || !recipient.email.trim() || !recipient.city.trim() || !recipient.address.trim() || checkout.isPending} style={[styles.primaryButton, (!checkoutAvailable || !selectedZone || checkout.isPending) && styles.disabled]} onPress={() => checkout.mutate()}><Text style={styles.primaryButtonText}>{checkout.isPending ? (english ? 'Reserving…' : 'Reservando…') : (english ? 'Continue to payment' : 'Continuar al pago')}</Text></TouchableOpacity></ScrollView></SafeAreaView>;
}

function OrderView({ orderId, english, locale, back }: { orderId: string; english: boolean; locale: string; back: ReactNode }) {
  const router = useRouter();
  const [issueType, setIssueType] = useState('general');
  const [issueMessage, setIssueMessage] = useState('');
  const [issueKey, setIssueKey] = useState(() => merchIdempotencyKey('issue'));
  const [cancelReason, setCancelReason] = useState('');
  const [cancelKey, setCancelKey] = useState(() => merchIdempotencyKey('cancel-order'));
  const token = useQuery({ queryKey: ['merch-order-token', orderId], queryFn: () => loadMerchCapability('order', orderId) });
  const order = useQuery({ queryKey: ['merch-order', orderId], queryFn: () => Merch.order(orderId, token.data!), enabled: Boolean(token.data), retry: false, refetchInterval: 30_000 });
  const report = useMutation({ mutationFn: () => Merch.reportIssue(orderId, token.data!, issueType, issueMessage.trim(), issueKey), onSuccess: async () => { setIssueMessage(''); setIssueKey(merchIdempotencyKey('issue')); await order.refetch(); } });
  const cancel = useMutation({ mutationFn: () => Merch.cancelUnpaidOrder(orderId, token.data!, cancelReason.trim(), cancelKey), onSuccess: async () => { setCancelReason(''); setCancelKey(merchIdempotencyKey('cancel-order')); await order.refetch(); } });
  const claimReview = useMutation({
    mutationFn: () => MerchReputation.claimBuyer(orderId, token.data!),
    onSuccess: () => router.push({ pathname: '/merch/review', params: { orderId } }),
  });
  if (token.isLoading || order.isLoading) return <ScreenState>{back}<ActivityIndicator /></ScreenState>;
  if (!token.data || order.isError || !order.data) return <ScreenState>{back}<Text accessibilityRole="alert" style={styles.error}>{english ? 'This device has no valid private tracking capability.' : 'Este dispositivo no tiene una capacidad privada de seguimiento válida.'}</Text></ScreenState>;
  const canCancelUnpaid = order.data.commercialStatus === 'created' && order.data.paymentStatus === 'pending' && order.data.fulfillmentStatus === 'pending';
  const canReviewExperience = order.data.commercialStatus === 'cancelled' || order.data.fulfillmentStatus === 'delivered';
  const issueChoices = [
    ['general', english ? 'General' : 'General'],
    ['return', english ? 'Return' : 'Devolución'],
    ['refund', english ? 'Refund' : 'Reembolso'],
    ['dispute', english ? 'Dispute' : 'Disputa'],
  ] as const;
  if (canReviewExperience) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          {back}
          <Text accessibilityRole="header" style={styles.title}>
            {english ? 'Order tracking' : 'Seguimiento del pedido'}
          </Text>
          <Text style={styles.cardTitle}>{order.data.orderNumber}</Text>
          <View style={styles.card}>
            <Text style={styles.label}>
              {english ? 'Payment' : 'Pago'}: {order.data.paymentStatus}
            </Text>
            <Text style={styles.label}>
              {english ? 'Fulfillment' : 'Preparación'}: {order.data.fulfillmentStatus}
            </Text>
            <Text style={styles.price}>
              {money(order.data.totalMinor, locale, order.data.currency)}
            </Text>
          </View>
          {order.data.issues?.length ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                {english ? 'Requests and issues' : 'Solicitudes e incidencias'}
              </Text>
              {order.data.issues.map((item) => (
                <View key={item.id}>
                  <Text style={styles.label}>{item.issueType} · {item.status}</Text>
                  <Text>{item.message}</Text>
                  {item.resolution ? <Text style={styles.meta}>{item.resolution}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {english ? 'Verified purchase review' : 'Evaluación de compra verificada'}
            </Text>
            <Text style={styles.meta}>
              {english
                ? 'Link this private order to your signed-in account. Its tracking capability is never shown publicly.'
                : 'Vincula esta orden privada con tu cuenta iniciada. Su capacidad de seguimiento nunca se muestra públicamente.'}
            </Text>
            {claimReview.isError ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {english
                  ? 'Sign in with the buyer account and try again. The order may already belong to another account.'
                  : 'Inicia sesión con la cuenta compradora e inténtalo de nuevo. La orden puede pertenecer ya a otra cuenta.'}
              </Text>
            ) : null}
            <Action
              disabled={claimReview.isPending}
              label={claimReview.isPending
                ? (english ? 'Linking…' : 'Vinculando…')
                : (english ? 'Review verified purchase' : 'Evaluar compra verificada')}
              onPress={() => claimReview.mutate()}
            />
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {english ? 'Report a problem' : 'Reportar un problema'}
            </Text>
            <View style={styles.choiceRow}>
              {issueChoices.map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: issueType === value }}
                  style={[styles.choice, issueType === value && styles.choiceSelected]}
                  onPress={() => setIssueType(value)}
                >
                  <Text style={styles.choiceText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              accessibilityLabel={english ? 'Problem details' : 'Detalles del problema'}
              multiline
              placeholder={english ? 'Tell us what happened' : 'Cuéntanos qué ocurrió'}
              value={issueMessage}
              onChangeText={setIssueMessage}
              style={[styles.input, styles.multiline]}
            />
            {report.isError ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {english ? 'The issue could not be recorded.' : 'No se pudo registrar la incidencia.'}
              </Text>
            ) : null}
            {report.isSuccess ? (
              <Text accessibilityRole="alert" style={styles.success}>
                {english ? 'The issue was recorded.' : 'La incidencia quedó registrada.'}
              </Text>
            ) : null}
            <Action
              disabled={issueMessage.trim().length < 10 || report.isPending}
              label={report.isPending
                ? (english ? 'Sending…' : 'Enviando…')
                : (english ? 'Submit issue' : 'Enviar incidencia')}
              onPress={() => report.mutate()}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>{back}<Text accessibilityRole="header" style={styles.title}>{english ? 'Order tracking' : 'Seguimiento del pedido'}</Text><Text style={styles.cardTitle}>{order.data.orderNumber}</Text>{order.data.paymentStatus !== 'paid' ? <Notice text={english ? 'Payment is pending verification. The order is not paid yet.' : 'El pago está pendiente de verificación. La orden aún no está pagada.'} /> : null}<View style={styles.card}><Text style={styles.label}>{english ? 'Payment' : 'Pago'}: {order.data.paymentStatus}</Text><Text style={styles.label}>{english ? 'Fulfillment' : 'Preparación'}: {order.data.fulfillmentStatus}</Text><Text style={styles.price}>{money(order.data.totalMinor, locale, order.data.currency)}</Text></View>{order.data.issues?.length ? <View style={styles.card}><Text style={styles.sectionTitle}>{english ? 'Requests and issues' : 'Solicitudes e incidencias'}</Text>{order.data.issues.map((item) => <View key={item.id}><Text style={styles.label}>{item.issueType} · {item.status}</Text><Text>{item.message}</Text>{item.resolution ? <Text style={styles.meta}>{item.resolution}</Text> : null}</View>)}</View> : null}{canCancelUnpaid ? <View style={styles.card}><Text style={styles.sectionTitle}>{english ? 'Cancel unpaid order' : 'Cancelar orden sin pagar'}</Text><Notice text={english ? 'This is immediate only before payment processing and fulfillment start. Reserved stock will be released.' : 'Esto es inmediato solo antes de iniciar el pago y la preparación. El stock reservado será liberado.'} /><TextInput accessibilityLabel={english ? 'Cancellation reason' : 'Motivo de cancelación'} multiline placeholder={english ? 'Cancellation reason' : 'Motivo de cancelación'} value={cancelReason} onChangeText={setCancelReason} style={[styles.input, styles.multiline]} />{cancel.isError ? <Text accessibilityRole="alert" style={styles.error}>{english ? 'Cancellation is no longer available. Report an issue instead.' : 'La cancelación ya no está disponible. Registra una incidencia.'}</Text> : null}<Action disabled={cancelReason.trim().length < 10 || cancel.isPending} label={cancel.isPending ? (english ? 'Cancelling…' : 'Cancelando…') : (english ? 'Cancel unpaid order' : 'Cancelar orden sin pagar')} onPress={() => cancel.mutate()} /></View> : null}<View style={styles.card}><Text style={styles.sectionTitle}>{english ? 'Report a problem' : 'Reportar un problema'}</Text><View style={styles.choiceRow}>{issueChoices.map(([value, label]) => <TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{ checked: issueType === value }} style={[styles.choice, issueType === value && styles.choiceSelected]} onPress={() => setIssueType(value)}><Text style={styles.choiceText}>{label}</Text></TouchableOpacity>)}</View><TextInput accessibilityLabel={english ? 'Problem details' : 'Detalles del problema'} multiline placeholder={english ? 'Tell us what happened' : 'Cuéntanos qué ocurrió'} value={issueMessage} onChangeText={setIssueMessage} style={[styles.input, styles.multiline]} />{report.isError ? <Text accessibilityRole="alert" style={styles.error}>{english ? 'The issue could not be recorded.' : 'No se pudo registrar la incidencia.'}</Text> : null}{report.isSuccess ? <Text accessibilityRole="alert" style={styles.success}>{english ? 'The issue was recorded.' : 'La incidencia quedó registrada.'}</Text> : null}<Action disabled={issueMessage.trim().length < 10 || report.isPending} label={report.isPending ? (english ? 'Sending…' : 'Enviando…') : (english ? 'Submit issue' : 'Enviar incidencia')} onPress={() => report.mutate()} /></View></ScrollView></SafeAreaView>;
}

function SellerView({ english, locale, back }: { english: boolean; locale: string; back: ReactNode }) {
  const client = useQueryClient();
  const [tracking, setTracking] = useState<Record<string, { carrier: string; number: string }>>({});
  const stores = useQuery({ queryKey: ['merch-seller-stores'], queryFn: Merch.sellerStores, retry: false });
  const store = stores.data?.[0];
  const orders = useQuery({ queryKey: ['merch-seller-orders', store?.id], queryFn: () => Merch.sellerOrders(store!.id), enabled: Boolean(store?.permissions?.orders), retry: false });
  const fulfillment = useMutation({ mutationFn: ({ order, status }: { order: SellerOrder; status: 'preparing' | 'ready_for_pickup' | 'shipped' }) => { const value = tracking[order.id] ?? { carrier: '', number: '' }; return Merch.updateFulfillment(store!.id, order.id, { status, publicNote: null, privateNote: null, carrier: status === 'shipped' ? value.carrier : null, trackingNumber: status === 'shipped' ? value.number : null, trackingUrl: null }); }, onSuccess: () => void client.invalidateQueries({ queryKey: ['merch-seller-orders', store?.id] }) });
  if (stores.isLoading || orders.isLoading) return <ScreenState>{back}<ActivityIndicator /></ScreenState>;
  if (stores.isError) return <ScreenState>{back}<Text style={styles.error}>{english ? 'Sign in with store permission to continue.' : 'Inicia sesión con permiso de tienda para continuar.'}</Text></ScreenState>;
  if (!store) return <ScreenState>{back}<Notice text={english ? 'You do not have an active pilot store. Apply from the responsive web panel.' : 'No tienes una tienda piloto activa. Solicítala desde el panel web responsive.'} /></ScreenState>;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>{back}<Text accessibilityRole="header" style={styles.title}>{store.displayName}</Text><Text style={styles.subtitle}>{english ? 'Essential order operations' : 'Operaciones esenciales de pedidos'}</Text>{!store.permissions?.orders ? <Notice text={english ? 'You do not have order permission.' : 'No tienes permiso de pedidos.'} /> : orders.data?.map((order) => { const value = tracking[order.id] ?? { carrier: '', number: '' }; return <View key={order.id} style={styles.card}><Text style={styles.cardTitle}>{order.orderNumber}</Text><Text>{money(order.totalMinor, locale, order.currency)} · {order.paymentStatus} · {order.fulfillmentStatus}</Text>{store.permissions?.fulfillment && order.paymentStatus === 'paid' ? <View style={styles.list}>{order.fulfillmentStatus === 'pending' ? <Action label={english ? 'Start preparing' : 'Empezar preparación'} onPress={() => fulfillment.mutate({ order, status: 'preparing' })} /> : null}{order.fulfillmentStatus === 'preparing' && (order as SellerOrder).shippingMethod === 'coordinated_pickup' ? <Action label={english ? 'Pickup ready' : 'Listo para retirar'} onPress={() => fulfillment.mutate({ order, status: 'ready_for_pickup' })} /> : null}{order.fulfillmentStatus === 'preparing' && (order as SellerOrder).shippingMethod === 'national_shipping' ? <><TextInput placeholder={english ? 'Carrier' : 'Transportista'} value={value.carrier} onChangeText={(carrier) => setTracking({ ...tracking, [order.id]: { ...value, carrier } })} style={styles.input} /><TextInput placeholder="Tracking" value={value.number} onChangeText={(number) => setTracking({ ...tracking, [order.id]: { ...value, number } })} style={styles.input} /><Action disabled={!value.carrier.trim() || !value.number.trim()} label={english ? 'Mark shipped' : 'Marcar enviado'} onPress={() => fulfillment.mutate({ order, status: 'shipped' })} /></> : null}</View> : null}</View>; })}<SellerIssueQueue storeId={store.id} enabled={Boolean(store.permissions?.orders)} english={english} /></ScrollView></SafeAreaView>;
}

function SellerIssueQueue({ storeId, enabled, english }: { storeId: string; enabled: boolean; english: boolean }) {
  const client = useQueryClient();
  const [responses, setResponses] = useState<Record<string, string>>({});
  const issues = useQuery({ queryKey: ['merch-seller-issues', storeId], queryFn: () => Merch.sellerIssues(storeId), enabled, retry: false });
  const update = useMutation({
    mutationFn: ({ issueId, status }: { issueId: string; status: Parameters<typeof Merch.updateSellerIssue>[2]['status'] }) => Merch.updateSellerIssue(storeId, issueId, { status, publicResponse: responses[issueId]?.trim() || null, internalNotes: null }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['merch-seller-issues', storeId] }),
  });
  if (!enabled) return null;
  if (issues.isLoading) return <ActivityIndicator />;
  if (issues.isError) return <Text accessibilityRole="alert" style={styles.error}>{english ? 'The issue queue could not be loaded.' : 'No se pudo cargar la cola de incidencias.'}</Text>;
  return <View style={styles.list}>
    <Text accessibilityRole="header" style={styles.sectionTitle}>{english ? 'Requests and issues' : 'Solicitudes e incidencias'}</Text>
    <Notice text={english ? 'Refunds, disputes, fraud, and paid cancellations must be escalated to TDF. Updating a case does not change payment or refund state.' : 'Los reembolsos, disputas, fraude y cancelaciones pagadas deben escalarse a TDF. Actualizar un caso no cambia el pago ni el reembolso.'} />
    {issues.data?.map((item) => {
      const response = responses[item.id] ?? '';
      const terminal = ['resolved', 'rejected', 'cancelled'].includes(item.status);
      const financial = ['cancellation', 'refund', 'dispute', 'fraud'].includes(item.issueType);
      return <View key={item.id} style={styles.card}>
        <Text style={styles.cardTitle}>{item.orderNumber} · {item.issueType}</Text>
        <Text style={styles.meta}>{item.status}</Text>
        <Text>{item.message}</Text>
        {item.resolution ? <Text style={styles.success}>{item.resolution}</Text> : null}
        {!terminal ? <View style={styles.list}>
          <TextInput accessibilityLabel={english ? 'Public response to buyer' : 'Respuesta pública para el comprador'} multiline placeholder={english ? 'Public response to buyer' : 'Respuesta pública para el comprador'} value={response} onChangeText={(value) => setResponses({ ...responses, [item.id]: value })} style={[styles.input, styles.multiline]} />
          {item.status === 'open' ? <Action label={english ? 'Start review' : 'Iniciar revisión'} onPress={() => update.mutate({ issueId: item.id, status: 'seller_review' })} /> : null}
          <Action label={english ? 'Escalate to TDF' : 'Escalar a TDF'} onPress={() => update.mutate({ issueId: item.id, status: 'staff_review' })} />
          {!financial ? <Action disabled={response.trim().length < 10} label={english ? 'Resolve operational case' : 'Resolver caso operativo'} onPress={() => update.mutate({ issueId: item.id, status: 'resolved' })} /> : null}
        </View> : null}
      </View>;
    })}
    {issues.data?.length === 0 ? <Text style={styles.meta}>{english ? 'No issues reported.' : 'No hay incidencias reportadas.'}</Text> : null}
    {update.isError ? <Text accessibilityRole="alert" style={styles.error}>{english ? 'The case changed or requires staff review.' : 'El caso cambió o requiere revisión de TDF.'}</Text> : null}
  </View>;
}

export function MerchSellerScreen() {
  const router = useRouter();
  const { locale } = useUserSettings();
  const english = locale.startsWith('en');
  const back = <TouchableOpacity accessibilityRole="button" accessibilityLabel={english ? 'Go back' : 'Volver'} onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>← {english ? 'Back' : 'Volver'}</Text></TouchableOpacity>;
  return <SellerView english={english} locale={locale} back={back} />;
}

function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) { return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} style={[styles.secondaryButton, disabled && styles.disabled]} onPress={onPress}><Text style={styles.secondaryButtonText}>{label}</Text></TouchableOpacity>; }
function Notice({ text }: { text: string }) { return <View style={styles.notice} accessibilityRole="text"><Text style={styles.noticeText}>{text}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f7f5' },
  content: { padding: 16, paddingBottom: 48, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center' },
  state: { flex: 1, padding: 24, gap: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '900', color: '#111827' },
  subtitle: { fontSize: 17, lineHeight: 25, color: '#4b5563' },
  sectionTitle: { fontSize: 22, fontWeight: '800', marginTop: 8 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 18, padding: 16, gap: 8 },
  cardImage: { width: '100%', height: 180, borderRadius: 12 },
  hero: { width: '100%', height: 240, borderRadius: 18 },
  productImage: { width: '100%', height: 360, borderRadius: 18, backgroundColor: '#fff' },
  cardTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800', color: '#111827' },
  cardBody: { color: '#4b5563', lineHeight: 20 },
  meta: { color: '#6b7280', lineHeight: 20 },
  exploration: { color: '#0e7490', fontWeight: '800', lineHeight: 20 },
  success: { color: '#166534', lineHeight: 20 },
  price: { fontSize: 24, fontWeight: '900', color: '#111827' },
  label: { fontWeight: '800', color: '#111827' },
  list: { gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 8 },
  flex: { flex: 1 },
  input: { minHeight: 50, backgroundColor: '#fff', borderColor: '#8b8b92', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, color: '#111827' },
  multiline: { minHeight: 96, paddingVertical: 12, textAlignVertical: 'top' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: '#8b8b92', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff' },
  choiceSelected: { borderColor: '#6d28d9', borderWidth: 2, backgroundColor: '#f5f3ff' },
  choiceText: { color: '#111827', fontWeight: '700' },
  primaryButton: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6d28d9', paddingHorizontal: 18 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  secondaryButton: { minHeight: 48, borderWidth: 1, borderColor: '#6d28d9', borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondaryButtonText: { color: '#5b21b6', fontWeight: '800' },
  disabled: { opacity: 0.45 },
  notice: { borderWidth: 1, borderColor: '#0e7490', backgroundColor: '#ecfeff', padding: 14, borderRadius: 12 },
  noticeText: { color: '#164e63', lineHeight: 21 },
  error: { color: '#b91c1c', textAlign: 'center', lineHeight: 21 },
  backButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { color: '#5b21b6', fontWeight: '800' },
});
