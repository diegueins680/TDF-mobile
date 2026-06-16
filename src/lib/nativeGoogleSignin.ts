type GoogleSigninResponse = {
  data?: {
    idToken?: string | null;
  } | null;
};

type GoogleSigninError = {
  code?: string;
};

export type NativeGoogleSigninModule = {
  GoogleSignin: {
    configure: (options: { webClientId: string; iosClientId?: string }) => void;
    hasPlayServices: (options: { showPlayServicesUpdateDialog: boolean }) => Promise<boolean>;
    signIn: () => Promise<GoogleSigninResponse>;
    signOut: () => Promise<void>;
  };
  isErrorWithCode: (error: unknown) => error is GoogleSigninError;
  isSuccessResponse: (response: GoogleSigninResponse) => boolean;
  statusCodes: {
    SIGN_IN_CANCELLED: string;
    IN_PROGRESS: string;
    PLAY_SERVICES_NOT_AVAILABLE: string;
  };
};

let cachedModule: NativeGoogleSigninModule | null | undefined;

export async function loadNativeGoogleSignin(): Promise<NativeGoogleSigninModule | null> {
  if (cachedModule !== undefined) return cachedModule;

  try {
    cachedModule = await import('@react-native-google-signin/google-signin');
  } catch {
    cachedModule = null;
  }

  return cachedModule;
}
