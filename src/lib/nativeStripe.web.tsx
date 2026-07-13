import type { PropsWithChildren } from 'react';

type NativeStripeError = {
  code?: string;
  message?: string;
  localizedMessage?: string;
};

type InitStripeParams = {
  publishableKey: string;
  merchantIdentifier?: string;
  urlScheme?: string;
  setReturnUrlSchemeOnAndroid?: boolean;
};

type InitPaymentSheetParams = {
  merchantDisplayName: string;
  customerId: string;
  customerEphemeralKeySecret: string;
  paymentIntentClientSecret: string;
  returnURL: string;
  allowsDelayedPaymentMethods: boolean;
  primaryButtonLabel: string;
  defaultBillingDetails: {
    name?: string;
    email?: string;
  };
};

type OptionalStripeProviderProps = PropsWithChildren<{
  publishableKey: string;
  merchantIdentifier?: string;
  urlScheme?: string;
  setReturnUrlSchemeOnAndroid?: boolean;
}>;

const WEB_PAYMENT_ERROR: NativeStripeError = {
  code: 'UnsupportedPlatform',
  message: 'Completa el pago desde la app instalada de TDF Records.',
  localizedMessage: 'Completa el pago desde la app instalada de TDF Records.',
};

export async function loadNativeStripe(): Promise<null> {
  return null;
}

export async function getStripeCoreApiVersion(): Promise<null> {
  return null;
}

export function OptionalStripeProvider({ children }: OptionalStripeProviderProps) {
  return <>{children}</>;
}

export async function initNativeStripe(_params: InitStripeParams): Promise<void> {
  throw new Error(WEB_PAYMENT_ERROR.localizedMessage);
}

export async function initNativePaymentSheet(
  _params: InitPaymentSheetParams,
): Promise<{ error: NativeStripeError }> {
  return { error: WEB_PAYMENT_ERROR };
}

export async function presentNativePaymentSheet(): Promise<{ error: NativeStripeError }> {
  return { error: WEB_PAYMENT_ERROR };
}
