import { mobileDeepLinkTarget } from '../src/navigation/deepLinks';

// Resolve notification aliases before Expo Router chooses its initial screen.
// A layout effect is too late when a cold-start URL has no matching route file.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  const candidate = path.startsWith('/') && !path.startsWith('//') ? `tdf://${path.slice(1)}` : path;
  const target = mobileDeepLinkTarget(candidate, '/');
  if (target?.startsWith('/notifications?') || target?.startsWith('/access-requests?')) return target;

  try {
    const url = new URL(candidate);
    if (url.protocol === 'tdf:') {
      const route = [url.hostname, ...url.pathname.split('/')].filter(Boolean).join('/');
      if (/^(notification|notifications|notificaciones)\//.test(route)) return '/notifications';
      if (route.startsWith('access-requests/')) return '/access-requests';
    }
  } catch {
    // Preserve Expo's existing handling for unrelated or malformed system URLs.
  }
  return path;
}
