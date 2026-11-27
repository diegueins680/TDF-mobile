import { assertAuthSession, captureAuthSession, getAuthToken, type AuthSessionBinding } from './client';
import { Social } from './social';
import {
  SOCIAL_PAUSED_MESSAGE,
  applySocialV2Intent,
  createSocialRequestKey,
  describeSocialV2Intent,
  isSocialLegacyRetiredError,
  resolveSocialMode,
  type SocialMode,
} from './socialV2';

export type SocialConnectResult = { message: string; via: 'v2' | 'legacy'; switchedToV2: boolean };

async function connectV2(partyId: number, requestKey: string, switchedToV2: boolean, binding: AuthSessionBinding): Promise<SocialConnectResult> {
  const { state, changed } = await applySocialV2Intent(partyId, 'request', requestKey, binding);
  const message = describeSocialV2Intent(state, 'request', changed);
  return {
    message: switchedToV2 ? `Actualizamos tu vista social. ${message}` : message,
    via: 'v2',
    switchedToV2,
  };
}

/**
 * "Conectar" from a profile/moment card, safe in both rollout orders:
 * - v2 live: consent-based connection request (POST /social/v2/relationships/{id}).
 * - v2 not live yet: legacy mutual friend edge (POST /social/friends/{id}).
 * - legacy answers 410: re-check v2 and send the v2 request instead of failing.
 */
export async function connectWithParty(
  partyId: number,
  mode: SocialMode['mode'],
  options: { resolveMode?: () => Promise<SocialMode>; requestKey?: string; binding?: AuthSessionBinding } = {},
): Promise<SocialConnectResult> {
  const binding = options.binding ?? captureAuthSession(getAuthToken());
  assertAuthSession(binding);
  const resolveMode = options.resolveMode ?? resolveSocialMode;
  const requestKey = options.requestKey ?? createSocialRequestKey();
  if (mode === 'v2') return connectV2(partyId, requestKey, false, binding);
  if (mode === 'paused') throw new Error(SOCIAL_PAUSED_MESSAGE);
  try {
    await Social.addFriend(partyId);
    return { message: 'Agregaste este contacto a tu red.', via: 'legacy', switchedToV2: false };
  } catch (error) {
    if (!isSocialLegacyRetiredError(error)) throw error;
    assertAuthSession(binding);
    const next = await resolveMode();
    assertAuthSession(binding);
    if (next.mode === 'v2') return connectV2(partyId, requestKey, true, binding);
    throw error;
  }
}
