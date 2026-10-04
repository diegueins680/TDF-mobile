import * as SecureStore from 'expo-secure-store';
import type { components } from './generated/types';
import { del, get, patch, post, put } from './client';

export type MerchCapabilities = components['schemas']['MerchCapabilities'];
export type MerchStorefront = components['schemas']['MerchStorefront'];
export type MerchProduct = components['schemas']['MerchProduct'];
export type MerchStockRequest = components['schemas']['MerchStockRequest'];
export type MerchCart = components['schemas']['MerchCart'];
export type MerchCheckoutRequest = components['schemas']['MerchCheckoutRequest'];
export type MerchOrder = components['schemas']['MerchOrder'];
export type MerchOperationalIssue = components['schemas']['MerchOperationalIssue'];
export type MerchIssueTriageRequest = components['schemas']['MerchIssueTriageRequest'];

const safeSegment = (value: string) => encodeURIComponent(value.trim());
const capabilityKey = (kind: 'cart' | 'order', id: string) => `tdf.merch.${kind}.${id}`;

export const merchIdempotencyKey = (scope: string) =>
  `mobile-${scope}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export async function saveMerchCapability(kind: 'cart' | 'order', id: string, token: string) {
  await SecureStore.setItemAsync(capabilityKey(kind, id), token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export const loadMerchCapability = (kind: 'cart' | 'order', id: string) =>
  SecureStore.getItemAsync(capabilityKey(kind, id));

export const saveStoreCartReference = (storeSlug: string, cartId: string) =>
  SecureStore.setItemAsync(`tdf.merch.store-cart.${storeSlug}`, cartId, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

export const loadStoreCartReference = (storeSlug: string) =>
  SecureStore.getItemAsync(`tdf.merch.store-cart.${storeSlug}`);

export async function loadOrCreateMerchCheckoutKey(cartId: string) {
  const key = `tdf.merch.checkout-key.${cartId}`;
  const existing = await SecureStore.getItemAsync(key);
  if (existing) return existing;
  const created = merchIdempotencyKey('checkout');
  await SecureStore.setItemAsync(key, created, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return created;
}

export const Merch = {
  capabilities: () => get<MerchCapabilities>('/merch/capabilities'),
  storefronts: (q?: string) => get<MerchStorefront[]>(`/merch/storefronts${q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`),
  storefront: (slug: string) => get<MerchStorefront>(`/merch/storefronts/${safeSegment(slug)}`),
  product: (storeSlug: string, productSlug: string) => get<MerchProduct>(`/merch/storefronts/${safeSegment(storeSlug)}/products/${safeSegment(productSlug)}`),
  createCart: (storeSlug: string) => post<MerchCart>('/merch/carts', { storeSlug }),
  cart: (cartId: string, token: string) => get<MerchCart>(`/merch/carts/${safeSegment(cartId)}`, { headers: { 'X-Cart-Lookup-Token': token } }),
  putCartItem: (cartId: string, token: string, variantId: string, quantity: number) => put<MerchCart>(`/merch/carts/${safeSegment(cartId)}/items`, { variantId, quantity }, { headers: { 'X-Cart-Lookup-Token': token } }),
  deleteCartItem: (cartId: string, token: string, variantId: string) => del<MerchCart>(`/merch/carts/${safeSegment(cartId)}/items/${safeSegment(variantId)}`, { headers: { 'X-Cart-Lookup-Token': token } }),
  checkout: (cartId: string, token: string, idempotencyKey: string, body: MerchCheckoutRequest) => post<MerchOrder>(`/merch/carts/${safeSegment(cartId)}/checkout`, body, { headers: { 'X-Cart-Lookup-Token': token, 'Idempotency-Key': idempotencyKey } }),
  order: (orderId: string, token: string) => get<MerchOrder>(`/merch/orders/${safeSegment(orderId)}`, { headers: { 'X-Order-Lookup-Token': token } }),
  reportIssue: (orderId: string, token: string, issueType: string, message: string, idempotencyKey: string) => post<components['schemas']['MerchOrderIssue']>(`/merch/orders/${safeSegment(orderId)}/issues`, { issueType, message }, { headers: { 'X-Order-Lookup-Token': token, 'Idempotency-Key': idempotencyKey } }),
  cancelUnpaidOrder: (orderId: string, token: string, reason: string, idempotencyKey: string) => post<MerchOrder>(`/merch/orders/${safeSegment(orderId)}/cancel`, { reason }, { headers: { 'X-Order-Lookup-Token': token, 'Idempotency-Key': idempotencyKey } }),
  sellerStores: () => get<MerchStorefront[]>('/merch/seller/stores'),
  sellerProducts: (storeId: string) => get<MerchProduct[]>(`/merch/seller/stores/${safeSegment(storeId)}/products`),
  updateVariantStock: (storeId: string, variantId: string, body: MerchStockRequest) => patch<components['schemas']['MerchVariant']>(`/merch/seller/stores/${safeSegment(storeId)}/variants/${safeSegment(variantId)}/stock`, body),
  sellerOrders: (storeId: string) => get<MerchOrder[]>(`/merch/seller/stores/${safeSegment(storeId)}/orders`),
  sellerIssues: (storeId: string) => get<MerchOperationalIssue[]>(`/merch/seller/stores/${safeSegment(storeId)}/issues`),
  updateSellerIssue: (storeId: string, issueId: string, body: MerchIssueTriageRequest) => patch<MerchOperationalIssue>(`/merch/seller/stores/${safeSegment(storeId)}/issues/${safeSegment(issueId)}`, body),
  updateFulfillment: (storeId: string, orderId: string, body: components['schemas']['MerchFulfillmentRequest']) => patch<MerchOrder>(`/merch/seller/stores/${safeSegment(storeId)}/orders/${safeSegment(orderId)}/fulfillment`, body),
};
