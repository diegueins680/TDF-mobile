import type { AnalyticsClient } from '../analytics/posthog';
import type { OnboardingFirstValue } from '../api/onboarding';
import type { MomentMutationResult } from './eventMomentsRepository';
import { markFirstValueCompleted } from './onboardingIntent';

type FirstValueAnalytics = Pick<AnalyticsClient, 'capture'>;
type MarkFirstValue = (
  partyId: string | null | undefined,
  value: OnboardingFirstValue,
  stillOwnsParty?: () => boolean,
) => Promise<boolean>;

export async function recordMomentReactionFirstValue(
  result: MomentMutationResult,
  ownerPartyId: string | null,
  stillOwnsParty: () => boolean,
  analytics: FirstValueAnalytics,
  markFirstValue: MarkFirstValue = markFirstValueCompleted,
): Promise<boolean> {
  if (result.source !== 'remote' || result.selected !== true || !ownerPartyId || !stillOwnsParty()) {
    return false;
  }

  const newlyCompleted = await markFirstValue(ownerPartyId, 'moment_reaction', stillOwnsParty);
  if (!newlyCompleted || !stillOwnsParty()) return false;

  analytics.capture('first_value_completed', { platform: 'mobile', value: 'moment_reaction' });
  analytics.capture('onboarding_completed', { platform: 'mobile', reason: 'first_value', value: 'moment_reaction' });
  return true;
}
