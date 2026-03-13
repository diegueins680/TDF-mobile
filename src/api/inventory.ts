import { get, post, patch } from './client';
import type {
  Asset,
  AssetCheckout,
  AssetCheckoutRequest,
  AssetCheckinRequest,
  AssetCreate,
  AssetUpdate
} from '../types';

type AssetListResponse = { items: Asset[] } | Asset[];

export function normalizeAssets(payload: AssetListResponse): Asset[] {
  if (Array.isArray(payload)) return payload;
  return payload.items ?? [];
}

export const Inventory = {
  list: () => get<AssetListResponse>('/assets'),
  create: (body: AssetCreate) => post<Asset>('/assets', body),
  update: (assetId: string, body: AssetUpdate) => patch<Asset>(`/assets/${assetId}`, body),
  checkout: (assetId: string, body: AssetCheckoutRequest) =>
    post<AssetCheckout>(`/assets/${assetId}/checkout`, body),
  checkin: (assetId: string, body: AssetCheckinRequest) =>
    post<AssetCheckout>(`/assets/${assetId}/checkin`, body),
  history: (assetId: string) => get<AssetCheckout[]>(`/assets/${assetId}/history`)
};
