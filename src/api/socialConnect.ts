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

async function connectV2(partyId: number, requestKey: string, switchedToV2: boolean): Promise<SocialConnectResult> {
  const { state, changed } = await applySocialV2Intent(partyId, 'request', requestKey);
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
  mode: SocialMode['mode'] | 'pending',
  options: { resolveMode?: () => Promise<SocialMode>; requestKey?: string } = {},
): Promise<SocialConnectResult> {
  const resolveMode = options.resolveMode ?? resolveSocialMode;
  const requestKey = options.requestKey ?? createSocialRequestKey();
  if (mode === 'v2') return connectV2(partyId, requestKey, false);
  if (mode === 'paused') throw new Error(SOCIAL_PAUSED_MESSAGE);
  try {
    await Social.addFriend(partyId);
    return { message: 'Agregaste este contacto a tu red.', via: 'legacy', switchedToV2: false };
  } catch (error) {
    if (!isSocialLegacyRetiredError(error)) throw error;
    const next = await resolveMode();
    if (next.mode === 'v2') return connectV2(partyId, requestKey, true);
    throw error;
  }
}
