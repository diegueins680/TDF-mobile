export function directoryDeepLinkTarget(
  path: string,
  currentPathname: string,
): string | null {
  const normalizedPath = path.replace(/^\/+|\/+$/g, '');
  if (!normalizedPath.startsWith('directory/')) return null;

  const target = `/${normalizedPath}`;
  const current = `/${currentPathname.replace(/^\/+|\/+$/g, '')}`;
  return target === current ? null : target;
}

export function merchDeepLinkTarget(path: string): string | null {
  const normalized = path.replace(/^\/+|\/+$/g, '');
  if (normalized === 'merch') return '/merch';
  if (normalized === 'merch/seller') return '/merchSeller';
  const order = /^merch\/order\/([^/]+)$/.exec(normalized);
  if (order) return `/merch?orderId=${encodeURIComponent(decodeURIComponent(order[1]))}`;
  const product = /^merch\/store\/([^/]+)\/product\/([^/]+)$/.exec(normalized);
  if (product) return `/merch?storeSlug=${encodeURIComponent(decodeURIComponent(product[1]))}&productSlug=${encodeURIComponent(decodeURIComponent(product[2]))}`;
  const cart = /^merch\/store\/([^/]+)\/cart$/.exec(normalized);
  if (cart) return `/merch?storeSlug=${encodeURIComponent(decodeURIComponent(cart[1]))}&view=cart`;
  const store = /^merch\/store\/([^/]+)$/.exec(normalized);
  if (store) return `/merch?storeSlug=${encodeURIComponent(decodeURIComponent(store[1]))}`;
  return null;
}
