import type { DirectoryPortfolioItem, DirectoryProfileLink } from '../../api/directory';

export const minorToMoney = (value: number | null | undefined, minorUnits = 2): string =>
  value == null ? '' : String(value / (10 ** minorUnits));

export const isSafeProfileUrl = (value: string): boolean => {
  const trimmed = value.trim();
  if (/[\\\s\u0000-\u001f\u007f]/u.test(trimmed)) return false;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  try {
    const parsed = new URL(trimmed);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      && !parsed.username
      && !parsed.password;
  } catch {
    return false;
  }
};

export function profileFormError(input: {
  name: string;
  cityIds: string[];
  primaryCityId: string;
  hasPreservedPrimaryArea?: boolean;
  onsite: boolean;
  remote: boolean;
  availableToTravel: boolean;
  rateMin: string;
  rateMax: string;
  portfolio: DirectoryPortfolioItem[];
  links: DirectoryProfileLink[];
}): string | null {
  if (!input.name.trim()) return 'Indica un nombre público.';
  if ((!input.cityIds.length || !input.primaryCityId || !input.cityIds.includes(input.primaryCityId)) && !input.hasPreservedPrimaryArea) {
    return 'Selecciona al menos una ciudad y marca la principal.';
  }
  if (!input.onsite && !input.remote && !input.availableToTravel) {
    return 'Selecciona al menos una modalidad de trabajo.';
  }
  if ([input.rateMin, input.rateMax].some((value) => value && (!Number.isFinite(Number(value)) || Number(value) < 0))) {
    return 'Las tarifas deben ser números no negativos.';
  }
  if (input.rateMax && !input.rateMin) return 'Indica la tarifa mínima antes de la máxima.';
  if (input.rateMin && input.rateMax && Number(input.rateMax) < Number(input.rateMin)) {
    return 'La tarifa máxima no puede ser menor que la mínima.';
  }
  if (input.portfolio.some((item) => !item.title.trim() || !isSafeProfileUrl(item.url))) {
    return 'Cada elemento del portafolio necesita título y una URL HTTP(S) o ruta interna válida sin credenciales.';
  }
  if (input.links.some((item) => !item.label.trim() || !isSafeProfileUrl(item.url))) {
    return 'Cada enlace necesita etiqueta y una URL HTTP(S) o ruta interna válida sin credenciales.';
  }
  return null;
}
