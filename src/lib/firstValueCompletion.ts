import type { AnalyticsClient } from '../analytics/posthog';
import type { OnboardingFirstValue } from '../api/onboarding';
import { markFirstValueCompleted } from './onboardingIntent';

export type FirstValueAnalytics = Pick<AnalyticsClient, 'capture'>;
export type MarkFirstValue = (
  partyId: string | null | undefined,
  value: OnboardingFirstValue,
  stillOwnsParty?: () => boolean,
) => Promise<boolean | OnboardingFirstValue>;

export async function recordFirstValueCompletion(
  ownerPartyId: string | null | undefined,
  value: OnboardingFirstValue,
  stillOwnsParty: () => boolean,
  analytics: FirstValueAnalytics,
  markFirstValue: MarkFirstValue = markFirstValueCompleted,
): Promise<boolean> {
  if (!ownerPartyId?.trim() || !stillOwnsParty()) return false;

  const newlyCompleted = await markFirstValue(ownerPartyId, value, stillOwnsParty);
  if (!newlyCompleted || !stillOwnsParty()) return false;

  const completedValue = typeof newlyCompleted === 'string' ? newlyCompleted : value;
  analytics.capture('first_value_completed', { platform: 'mobile', value: completedValue });
  analytics.capture('onboarding_completed', { platform: 'mobile', reason: 'first_value', value: completedValue });
  return true;
}
