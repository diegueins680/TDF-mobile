export function artistPublicUrl(segment: string | string[] | undefined): string | null {
  const value = Array.isArray(segment) ? segment[0] : segment;
  if (!value || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(value)) return null;
  return `https://www.tdfrecords.net/a/${encodeURIComponent(value)}`;
}

export function isArtistWebNavigation(url: string): boolean {
  try {
    const value = new URL(url);
    return value.origin === 'https://www.tdfrecords.net' && !value.username && !value.password;
  } catch { return false; }
}

export function isVideoProviderNavigation(url: string): boolean {
  try {
    const value = new URL(url);
    return value.protocol === 'https:' && !value.username && !value.password && !value.port && ['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com', 'www.instagram.com', 'www.tiktok.com'].includes(value.hostname);
  } catch { return false; }
}
