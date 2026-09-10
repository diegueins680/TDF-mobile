import { getFeaturesByMobilePath } from '../features/featureRegistry';

const APP_SCHEME = 'tdf';
const DEVELOPMENT_SCHEMES = new Set(['exp', 'exps']);
const INTERNAL_ORIGIN = 'https://mobile.tdf.invalid';
const MAX_INTERNAL_HREF_LENGTH = 500;
const MAX_QUERY_ENTRIES = 25;
const MAX_QUERY_PART_LENGTH = 200;

const hasUnsafeCharacter = (value: string): boolean =>
  value.includes('\\') || Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });

const decodeRouteSegment = (value: string): string | null => {
  try {
    const decoded = decodeURIComponent(value);
    return decoded && !hasUnsafeCharacter(decoded) && !decoded.includes('/') ? decoded : null;
  } catch {
    return null;
  }
};

const registeredInternalRoute = (candidate: string): string | null => {
  if (
    !candidate.startsWith('/')
    || candidate.startsWith('//')
    || candidate.length > MAX_INTERNAL_HREF_LENGTH
    || hasUnsafeCharacter(candidate)
  ) return null;

  try {
    const parsed = new URL(candidate, INTERNAL_ORIGIN);
    const decodedPath = decodeURIComponent(parsed.pathname);
    if (
      parsed.origin !== INTERNAL_ORIGIN
      || hasUnsafeCharacter(decodedPath)
      || decodedPath.startsWith('//')
      || getFeaturesByMobilePath(parsed.pathname).length === 0
    ) return null;
  } catch {
    return null;
  }

  return candidate;
};

export function safeInternalRoute(candidate: string | null | undefined): string | null {
  return candidate ? registeredInternalRoute(candidate) : null;
}

export function currentRouteReturnTo(routePath: string, globalHref: string): string | null {
  const exactTarget = safeInternalRoute(globalHref);
  if (exactTarget) return exactTarget;

  if (!globalHref.startsWith('/') || globalHref.startsWith('//') || hasUnsafeCharacter(globalHref)) {
    return safeInternalRoute(routePath);
  }

  const suffixIndex = globalHref.search(/[?#]/);
  const suffix = suffixIndex >= 0 ? globalHref.slice(suffixIndex) : '';
  return safeInternalRoute(`${routePath}${suffix}`) ?? safeInternalRoute(routePath);
}

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

const logicalPathForUrl = (parsed: URL): string | null => {
  const scheme = parsed.protocol.replace(/:$/, '').toLowerCase();
  if (scheme === APP_SCHEME) {
    return [parsed.hostname, ...parsed.pathname.split('/')].filter(Boolean).join('/');
  }
  if (DEVELOPMENT_SCHEMES.has(scheme)) {
    const segments = parsed.pathname.split('/').filter(Boolean);
    const routeMarker = segments.indexOf('--');
    return routeMarker >= 0 ? segments.slice(routeMarker + 1).join('/') : null;
  }
  return null;
};

const appendQuery = (
  target: string,
  source: URLSearchParams,
  reservedKeys: ReadonlySet<string> = new Set(),
): string | null => {
  const [path, existingQuery = ''] = target.split('?', 2);
  const query = new URLSearchParams(existingQuery);
  let count = 0;
  for (const [key, value] of source.entries()) {
    count += 1;
    if (count > MAX_QUERY_ENTRIES || key.length > MAX_QUERY_PART_LENGTH || value.length > MAX_QUERY_PART_LENGTH) {
      return null;
    }
    if (!reservedKeys.has(key)) query.append(key, value);
  }
  const encoded = query.toString();
  return registeredInternalRoute(encoded ? `${path}?${encoded}` : path);
};

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

export function mobileDeepLinkTarget(url: string, currentPathname: string): string | null {
  if (!url || url.length > 2_048) return null;

  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password || parsed.hash) return null;
    const logicalPath = logicalPathForUrl(parsed);
    if (!logicalPath) return null;

    const segments = logicalPath.split('/').filter(Boolean).map(decodeRouteSegment);
    if (segments.some((segment) => segment === null)) return null;
    const safeSegments = segments as string[];

    if (safeSegments[0] === 'event' && safeSegments.length === 2) {
      return appendQuery(
        `/eventDetail?eventId=${encodeURIComponent(safeSegments[1])}`,
        parsed.searchParams,
        new Set(['eventId']),
      );
    }
    if (safeSegments[0] === 'artist' && safeSegments.length === 2) {
      return appendQuery(
        `/artistDetail?artistId=${encodeURIComponent(safeSegments[1])}`,
        parsed.searchParams,
        new Set(['artistId']),
      );
    }
    if (safeSegments.length === 1 && safeSegments[0] === 'stripe-redirect') {
      return safeInternalRoute('/tickets');
    }
    if (safeSegments.length === 1 && safeSegments[0] === 'directory') {
      return appendQuery('/(tabs)/directory', parsed.searchParams);
    }

    const merchTarget = merchDeepLinkTarget(safeSegments.join('/'));
    if (merchTarget) return safeInternalRoute(merchTarget);

    const directoryTarget = directoryDeepLinkTarget(safeSegments.join('/'), currentPathname);
    return directoryTarget ? appendQuery(directoryTarget, parsed.searchParams) : null;
  } catch {
    return null;
  }
}
