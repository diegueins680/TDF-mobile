import { get, post, put } from './client';
import type { components } from './generated/types';

export type OnboardingIntent = components['schemas']['OnboardingIntent'];
export type OnboardingFirstValue = NonNullable<
  components['schemas']['OnboardingCompletionRequest']['firstValue']
>;
export type OnboardingProgress = components['schemas']['OnboardingProgress'];
export type OnboardingCompletionResult = components['schemas']['OnboardingCompletionResult'];

export const getOnboardingProgress = (): Promise<OnboardingProgress> =>
  get<OnboardingProgress>('/session/onboarding');

export const updateOnboardingIntent = (
  onboardingIntent: OnboardingIntent,
): Promise<OnboardingProgress> =>
  put<OnboardingProgress>('/session/onboarding/intent', { onboardingIntent });

export async function completeOnboardingProgress(
  firstValue?: OnboardingFirstValue,
): Promise<OnboardingCompletionResult> {
  return post<OnboardingCompletionResult>(
    '/session/onboarding/complete',
    firstValue ? { firstValue } : {},
  );
}
