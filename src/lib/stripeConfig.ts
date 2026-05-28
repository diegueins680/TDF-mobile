import Constants from 'expo-constants';

type StripeExtra = {
  stripe?: {
    publishableKey?: string | null;
    merchantIdentifier?: string | null;
  } | null;
};

const expoExtra = Constants.expoConfig?.extra as StripeExtra | undefined;

const readTrimmed = (value?: string | null) => value?.trim() || undefined;

export const STRIPE_PUBLISHABLE_KEY =
  readTrimmed(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) ||
  readTrimmed(expoExtra?.stripe?.publishableKey);

export const STRIPE_MERCHANT_IDENTIFIER =
  readTrimmed(process.env.EXPO_PUBLIC_STRIPE_MERCHANT_IDENTIFIER) ||
  readTrimmed(expoExtra?.stripe?.merchantIdentifier);

// Displayed inside Stripe's PaymentSheet UI — should match the legal merchant name.
export const STRIPE_MERCHANT_DISPLAY_NAME = 'TDF Records';

// Must match the Stripe API version the installed @stripe/stripe-react-native was
// built against. The mobile SDK forwards this when requesting an ephemeral key
// from our backend; mismatches cause the SDK to reject the response. Bump this
// when upgrading @stripe/stripe-react-native — check that SDK's release notes for
// the version it pins.
export const MOBILE_SDK_STRIPE_VERSION = '2024-12-18.acacia';

export const isStripeConfigured = (): boolean => Boolean(STRIPE_PUBLISHABLE_KEY);
