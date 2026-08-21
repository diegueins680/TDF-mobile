export interface ClassifiedFormPolicyInput {
  required: Set<string>;
  cityIds: string[];
  remote: boolean;
  availableToTravel: boolean;
  professionIds: string[];
  instrumentIds: string[];
  genreIds: string[];
  startsAt: string;
  endsAt: string;
  compensationTypeId: string;
  budgetMode?: string;
  budgetMin: string;
  budgetMax: string;
  serviceOfferingId: string;
}

export const requirementLabel = (value: string) => ({
  instrumentIds: 'instrumento', genreIds: 'género', professionIds: 'profesión', locations: 'ubicación',
  locationsOrRemote: 'ubicación o remoto', dateRange: 'periodo', compensationTypeId: 'compensación',
  budget: 'presupuesto', serviceOfferingId: 'servicio', expiresAt: 'vencimiento de 30 días',
}[value] ?? value);

export function taxonomyRequirements(item?: { requirements?: Record<string, unknown> }): Set<string> {
  const raw = item?.requirements?.required;
  return new Set(Array.isArray(raw) ? raw.filter((value): value is string => typeof value === 'string') : []);
}

export const moneyToMinor = (value: string, minorUnits = 2): number | undefined => {
  if (!value.trim()) return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * (10 ** minorUnits)) : undefined;
};

export const parseIsoInput = (value: string): string | undefined => {
  if (!value.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.trim() : date.toISOString();
};

export function classifiedFormError(input: ClassifiedFormPolicyInput): string | null {
  const { required } = input;
  if (!input.cityIds.length && !input.remote && !input.availableToTravel) return 'Selecciona una ciudad, remoto o disponibilidad para viajar.';
  if (required.has('professionIds') && !input.professionIds.length) return 'Selecciona al menos una profesión.';
  if (required.has('instrumentIds') && !input.instrumentIds.length) return 'Selecciona al menos un instrumento.';
  if (required.has('genreIds') && !input.genreIds.length) return 'Selecciona al menos un género.';
  if (required.has('locations') && !input.cityIds.length) return 'Selecciona al menos una ciudad.';
  if (required.has('locationsOrRemote') && !input.cityIds.length && !input.remote) return 'Selecciona una ciudad o activa remoto.';
  if (required.has('dateRange') && (!input.startsAt || !input.endsAt)) return 'Indica el periodo completo.';
  if (input.startsAt && Number.isNaN(new Date(input.startsAt).getTime())) return 'El inicio no es una fecha ISO válida.';
  if (input.endsAt && Number.isNaN(new Date(input.endsAt).getTime())) return 'El fin no es una fecha ISO válida.';
  if (input.startsAt && input.endsAt && new Date(input.endsAt) < new Date(input.startsAt)) return 'El fin no puede preceder al inicio.';
  if (required.has('compensationTypeId') && !input.compensationTypeId) return 'Selecciona la compensación.';
  if (required.has('budget') && !input.budgetMin) return 'Indica el presupuesto.';
  if (input.budgetMode === 'range' && (!input.budgetMin || !input.budgetMax)) return 'Indica el rango completo.';
  if (input.budgetMin && input.budgetMax && Number(input.budgetMax) < Number(input.budgetMin)) return 'El máximo no puede ser menor que el mínimo.';
  if (required.has('serviceOfferingId') && !input.serviceOfferingId) return 'Selecciona el servicio vinculado.';
  return null;
}
