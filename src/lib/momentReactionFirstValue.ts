import type { MomentMutationResult } from './eventMomentsRepository';
import {
  recordFirstValueCompletion,
  type FirstValueAnalytics,
  type MarkFirstValue,
} from './firstValueCompletion';

export async function recordMomentReactionFirstValue(
  result: MomentMutationResult,
  ownerPartyId: string | null,
  stillOwnsParty: () => boolean,
  analytics: FirstValueAnalytics,
  markFirstValue?: MarkFirstValue,
): Promise<boolean> {
  if (result.source !== 'remote' || result.selected !== true || !ownerPartyId || !stillOwnsParty()) {
    return false;
  }
  return recordFirstValueCompletion(
    ownerPartyId,
    'moment_reaction',
    stillOwnsParty,
    analytics,
    markFirstValue,
  );
}
