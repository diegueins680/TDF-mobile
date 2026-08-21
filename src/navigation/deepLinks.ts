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
