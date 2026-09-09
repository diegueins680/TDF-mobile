import { get, post, put } from './client';
import type { components } from './generated/types';
import type { AxiosRequestConfig } from 'axios';

export type OnboardingIntent = components['schemas']['OnboardingIntent'];
export type OnboardingFirstValue = NonNullable<
  components['schemas']['OnboardingCompletionRequest']['firstValue']
>;
export type OnboardingProgress = components['schemas']['OnboardingProgress'];
export type OnboardingCompletionResult = components['schemas']['OnboardingCompletionResult'];

export const getOnboardingProgress = (
  config?: AxiosRequestConfig,
): Promise<OnboardingProgress> =>
  config
    ? get<OnboardingProgress>('/session/onboarding', config)
    : get<OnboardingProgress>('/session/onboarding');

export const updateOnboardingIntent = (
  onboardingIntent: OnboardingIntent,
): Promise<OnboardingProgress> =>
  put<OnboardingProgress>('/session/onboarding/intent', { onboardingIntent });

export async function completeOnboardingProgress(
  firstValue?: OnboardingFirstValue,
  config?: AxiosRequestConfig,
): Promise<OnboardingCompletionResult> {
  const body = firstValue ? { firstValue } : {};
  return config
    ? post<OnboardingCompletionResult>('/session/onboarding/complete', body, config)
    : post<OnboardingCompletionResult>('/session/onboarding/complete', body);
}

export async function reconcileOnboardingProgress(
  config?: AxiosRequestConfig,
): Promise<OnboardingCompletionResult> {
  return config
    ? post<OnboardingCompletionResult>('/session/onboarding/reconcile', undefined, config)
    : post<OnboardingCompletionResult>('/session/onboarding/reconcile', undefined);
}
