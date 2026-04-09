import Constants from 'expo-constants';

type ExpoExtra = {
  googleAuth?: {
    webClientId?: unknown;
    iosClientId?: unknown;
    iosUrlScheme?: unknown;
  };
};

type LegacyConstants = {
  manifest?: {
    extra?: ExpoExtra;
  };
  manifest2?: {
    extra?: ExpoExtra & {
      expoClient?: {
        extra?: ExpoExtra;
      };
    };
  };
};

const readConfigValue = (value?: unknown) => {
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  return trimmed || undefined;
};

const readExpoExtra = (): ExpoExtra | undefined => {
  const legacy = Constants as LegacyConstants;

  return (
    (Constants.expoConfig?.extra as ExpoExtra | undefined) ||
    legacy.manifest?.extra ||
    legacy.manifest2?.extra?.expoClient?.extra ||
    legacy.manifest2?.extra
  );
};

const expoExtra = readExpoExtra();

export const GOOGLE_WEB_CLIENT_ID =
  readConfigValue(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) ||
  readConfigValue(expoExtra?.googleAuth?.webClientId);

export const GOOGLE_IOS_CLIENT_ID =
  readConfigValue(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) ||
  readConfigValue(expoExtra?.googleAuth?.iosClientId);

export const GOOGLE_IOS_URL_SCHEME =
  readConfigValue(process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME) ||
  readConfigValue(expoExtra?.googleAuth?.iosUrlScheme);
