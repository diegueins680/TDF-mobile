import { PropsWithChildren, useEffect, useState, type ComponentType } from 'react';

type NativeStripeError = {
  code?: string;
  message?: string;
  localizedMessage?: string;
};

type InitPaymentSheetResult = {
  error?: NativeStripeError;
};

type PresentPaymentSheetResult = {
  error?: NativeStripeError;
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

type StripeProviderProps = PropsWithChildren<{
  publishableKey: string;
  merchantIdentifier?: string;
  urlScheme?: string;
  setReturnUrlSchemeOnAndroid?: boolean;
}>;

type NativeStripeModule = {
  Constants?: {
    API_VERSIONS?: {
      CORE?: string;
    };
  };
  StripeProvider: ComponentType<StripeProviderProps>;
  initStripe: (params: InitStripeParams) => Promise<void>;
  initPaymentSheet: (params: InitPaymentSheetParams) => Promise<InitPaymentSheetResult>;
  presentPaymentSheet: () => Promise<PresentPaymentSheetResult>;
};

let cachedModule: NativeStripeModule | null | undefined;

export async function loadNativeStripe(): Promise<NativeStripeModule | null> {
  if (cachedModule !== undefined) return cachedModule;

  try {
    cachedModule = await import('@stripe/stripe-react-native');
  } catch {
    cachedModule = null;
  }

  return cachedModule;
}

export async function getStripeCoreApiVersion(): Promise<string | null> {
  const stripe = await loadNativeStripe();
  return stripe?.Constants?.API_VERSIONS?.CORE?.trim() || null;
}

type OptionalStripeProviderProps = StripeProviderProps;

export function OptionalStripeProvider({
  children,
  publishableKey,
  merchantIdentifier,
  urlScheme,
  setReturnUrlSchemeOnAndroid,
}: OptionalStripeProviderProps) {
  const [Provider, setProvider] = useState<ComponentType<StripeProviderProps> | null>(null);

  useEffect(() => {
    let active = true;

    void loadNativeStripe().then((stripe) => {
      if (active) {
        setProvider(() => stripe?.StripeProvider ?? null);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  if (!Provider) {
    return <>{children}</>;
  }

  return (
    <Provider
      publishableKey={publishableKey}
      merchantIdentifier={merchantIdentifier}
      urlScheme={urlScheme}
      setReturnUrlSchemeOnAndroid={setReturnUrlSchemeOnAndroid}
    >
      {children}
    </Provider>
  );
}

export async function initNativeStripe(params: InitStripeParams): Promise<void> {
  const stripe = await loadNativeStripe();
  if (!stripe) {
    throw new Error('Los pagos con tarjeta requieren la build instalada de TDF Records; Expo Go no incluye Stripe nativo.');
  }
  await stripe.initStripe(params);
}

export async function initNativePaymentSheet(params: InitPaymentSheetParams): Promise<InitPaymentSheetResult> {
  const stripe = await loadNativeStripe();
  if (!stripe) {
    throw new Error('Los pagos con tarjeta requieren la build instalada de TDF Records; Expo Go no incluye Stripe nativo.');
  }
  return stripe.initPaymentSheet(params);
}

export async function presentNativePaymentSheet(): Promise<PresentPaymentSheetResult> {
  const stripe = await loadNativeStripe();
  if (!stripe) {
    throw new Error('Los pagos con tarjeta requieren la build instalada de TDF Records; Expo Go no incluye Stripe nativo.');
  }
  return stripe.presentPaymentSheet();
}
