import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { z } from 'zod';

import { API_BASE } from '../lib/api';
import { assertAuthSession, authSessionRequestConfig, captureAuthSession, getAuthToken, http } from './client';
import type { components } from './generated/types';

// Social v2 contract (tdf-hq TDF.Social.API / Server). Every route answers 404
// while SOCIAL_V2_ENABLED is off or social_v2_runtime.enabled is false, so the
// app decides at runtime, never at build time, which social flow to show.

const id = z.number().int().positive().safe();
const revision = z.number().int().nonnegative().safe();
const relationship = z.object({
  partyId: id, revision, following: z.boolean(), requested: z.boolean(),
  incoming: z.boolean(), connected: z.boolean(), blocked: z.boolean(),
  muted: z.boolean(), dismissed: z.boolean(),
});
const preferences = z.object({ discoverable: z.boolean(), personalized: z.boolean(), revision });
const me = preferences.extend({ relationships: z.array(relationship.extend({ displayName: z.string() })).max(50) });
const cursor = z.string().regex(/^[1-9]\d{0,18}$/);
const feed = z.object({
  items: z.array(z.object({
    postId: id, position: cursor, publishedAt: z.string(), createdAt: z.string(),
    title: z.string().nullable(), content: z.string(), authorId: id,
    authorName: z.string(), artistId: id,
  })).max(50),
  nextCursor: cursor.nullable(),
});
const discovery = z.object({
  personalized: z.boolean(),
  items: z.array(z.object({
    partyId: id, displayName: z.string(), reason: z.enum(['shared_interests', 'public_profile']), relationship,
  })).max(50),
});

export type SocialV2Relationship = components['schemas']['SocialV2State'];
export type SocialV2Me = components['schemas']['SocialV2Me'];
export type SocialV2Feed = z.infer<typeof feed>;
export type SocialV2Discover = components['schemas']['SocialV2Discover'];
export type SocialV2Operation = components['schemas']['SocialV2Command']['operation'];

export const SOCIAL_V2_OPERATIONS: readonly SocialV2Operation[] = [
  'request', 'accept', 'disconnect', 'follow', 'unfollow', 'block', 'unblock',
  'mute', 'unmute', 'dismiss', 'undismiss',
];

export const createSocialRequestKey = (): string => randomUUID();

export const SocialV2 = {
  me: async (): Promise<SocialV2Me> => me.parse((await http.get<unknown>('/social/v2/me')).data),
  relationship: async (partyId: number, binding = captureAuthSession(getAuthToken())): Promise<SocialV2Relationship> => relationship.parse(
    (await http.get<unknown>(`/social/v2/relationships/${id.parse(partyId)}`, authSessionRequestConfig(binding))).data),
  command: async (
    partyId: number,
    operation: SocialV2Operation,
    expectedRevision: number,
    requestKey: string = createSocialRequestKey(),
    binding = captureAuthSession(getAuthToken()),
  ): Promise<SocialV2Relationship> => {
    if (!SOCIAL_V2_OPERATIONS.includes(operation)) throw new Error('Operación social inválida.');
    const body: components['schemas']['SocialV2Command'] = {
      operation,
      expectedRevision: revision.parse(expectedRevision),
      requestKey: z.string().min(1).max(80).parse(requestKey),
    };
    return relationship.parse((await http.post<unknown>(`/social/v2/relationships/${id.parse(partyId)}`, body, authSessionRequestConfig(binding))).data);
  },
  preferences: async (
    value: Pick<SocialV2Me, 'discoverable' | 'personalized'>,
    expectedRevision: number,
  ): Promise<components['schemas']['SocialV2Preferences']> => {
    const body: components['schemas']['SocialV2PreferenceUpdate'] = {
      discoverable: value.discoverable,
      personalized: value.personalized,
      expectedRevision: revision.parse(expectedRevision),
    };
    return preferences.parse((await http.put<unknown>('/social/v2/preferences', body)).data);
  },
  following: async (before?: string): Promise<SocialV2Feed> => feed.parse((await http.get<unknown>(
    `/social/v2/following?limit=20${before ? `&cursor=${cursor.parse(before)}` : ''}`)).data),
  discover: async (): Promise<SocialV2Discover> => discovery.parse(
    (await http.get<unknown>('/social/v2/discover?limit=20')).data),
};

export const responseStatus = (error: unknown): number | null => {
  if (!error || typeof error !== 'object' || !('response' in error)) return null;
  const response = (error as { response?: { status?: unknown } }).response;
  return typeof response?.status === 'number' ? response.status : null;
};

export const LEGACY_SOCIAL_RETIRED_MESSAGE =
  'Esta acción de amistad ya no está disponible. Actualizamos tu vista social: usa Seguir o Conectar.';

/** A legacy relationship write answered 410: the server retired it for good. */
export class SocialLegacyRetiredError extends Error {
  constructor() {
    super(LEGACY_SOCIAL_RETIRED_MESSAGE);
    this.name = 'SocialLegacyRetiredError';
  }
}

export const isSocialLegacyRetiredError = (error: unknown): error is SocialLegacyRetiredError =>
  error instanceof SocialLegacyRetiredError;

// Activation is a durable server latch: once social v2 was live, legacy writes
// return 410 forever, even if v2 is later paused. Remember it so a pause shows a
// maintenance notice instead of reopening the retired legacy controls.
const activationStorageKey = `tdf.social.v2-activated:${API_BASE}`;
let activationMemo: boolean | null = null;

export async function rememberSocialV2Activation(): Promise<void> {
  activationMemo = true;
  try {
    await AsyncStorage.setItem(activationStorageKey, 'true');
  } catch {
    // In-memory memo still protects this app session.
  }
}

export async function hasSeenSocialV2Activation(): Promise<boolean> {
  if (activationMemo !== null) return activationMemo;
  try {
    activationMemo = (await AsyncStorage.getItem(activationStorageKey)) === 'true';
  } catch {
    activationMemo = false;
  }
  return activationMemo;
}

/** Test helper: forget the in-memory activation memo. */
export function resetSocialV2ActivationMemo(): void {
  activationMemo = null;
}

export type SocialMode =
  /** Social v2 answered for this account: use only v2. */
  | { mode: 'v2'; me: SocialV2Me }
  /** V2 not active yet: keep the legacy flow (its writes guard themselves with 410). */
  | { mode: 'legacy' }
  /** Legacy writes were retired, but v2 is not answering now (pause or account not eligible). */
  | { mode: 'paused' };

export async function resolveSocialMode(): Promise<SocialMode> {
  try {
    const profile = await SocialV2.me();
    await rememberSocialV2Activation();
    return { mode: 'v2', me: profile };
  } catch (error) {
    if (responseStatus(error) === 401) throw error;
    // A 200 with an unexpected body means v2 is live but incompatible: surface it.
    if (error instanceof z.ZodError) throw error;
    // 404 (flag/runtime off, account not eligible), 5xx or network: v2 is not usable.
    return (await hasSeenSocialV2Activation()) ? { mode: 'paused' } : { mode: 'legacy' };
  }
}

export const socialModeQueryKey = (partyId: string | null | undefined) => ['social-mode', partyId ?? null] as const;
export const socialV2QueryRoot = (partyId: string | null | undefined) => ['social-v2', partyId ?? null] as const;

export function socialV2ErrorMessage(error: unknown): string {
  switch (responseStatus(error)) {
    case 400: return 'No pudimos reconocer ese perfil.';
    case 401: return 'Tu sesión terminó. Vuelve a iniciar sesión.';
    case 404: return 'Este perfil no está disponible en la red social ahora.';
    case 409: return 'Esta relación cambió mientras tanto. Actualiza para comprobar su estado.';
    case 429: return 'Hiciste muchos cambios seguidos. Espera un minuto e inténtalo otra vez.';
    default: return 'No se pudo actualizar esta relación. Actualiza para comprobar su estado.';
  }
}

/** User-facing message for a failed v2 action (HTTP status first, then local validation). */
export function socialV2ActionErrorMessage(error: unknown): string {
  if (responseStatus(error) !== null) return socialV2ErrorMessage(error);
  const isTransportError = Boolean(error && typeof error === 'object' && 'isAxiosError' in error);
  if (error instanceof Error && !(error instanceof z.ZodError) && !isTransportError) return error.message;
  return socialV2ErrorMessage(error);
}

export const SOCIAL_PAUSED_MESSAGE =
  'Estamos actualizando la red social. Vuelve a intentarlo en unos minutos.';

export type SocialV2Intent = 'request' | 'follow';

export const intentSatisfied = (state: SocialV2Relationship, intent: SocialV2Intent): boolean =>
  intent === 'follow' ? state.following : state.connected || state.requested;

/**
 * One-tap "Conectar"/"Seguir" from a scanned code or a profile card: read the
 * current revision, then send a single idempotent command. Accepts an incoming
 * request instead of sending a duplicate one.
 */
export async function applySocialV2Intent(
  partyId: number,
  intent: SocialV2Intent,
  requestKey: string = createSocialRequestKey(),
  binding = captureAuthSession(getAuthToken()),
): Promise<{ state: SocialV2Relationship; changed: boolean }> {
  assertAuthSession(binding);
  const current = await SocialV2.relationship(partyId, binding);
  assertAuthSession(binding);
  if (current.blocked) throw new Error('Desbloquea a esta persona antes de conectar.');
  if (intentSatisfied(current, intent)) return { state: current, changed: false };
  const operation: SocialV2Operation = intent === 'request' && current.incoming ? 'accept' : intent;
  const state = await SocialV2.command(partyId, operation, current.revision, requestKey, binding);
  assertAuthSession(binding);
  return { state, changed: true };
}

export function describeSocialV2Intent(state: SocialV2Relationship, intent: SocialV2Intent, changed: boolean): string {
  if (intent === 'follow') return changed ? 'Ahora sigues a esta persona.' : 'Ya sigues a esta persona.';
  if (state.connected) return changed ? 'Conexión aceptada.' : 'Ya están conectados.';
  return changed
    ? 'Enviamos tu solicitud de conexión. La otra persona debe aceptarla.'
    : 'Tu solicitud de conexión ya está enviada.';
}
