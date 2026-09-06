import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { loginRequest, googleLoginRequest, signupRequest, requestPasswordReset } from '../src/api/auth';
import { API_BASE } from '../src/lib/api';
import {
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_IOS_URL_SCHEME,
  GOOGLE_WEB_CLIENT_ID
} from '../src/lib/authConfig';
import { loadNativeGoogleSignin, type NativeGoogleSigninModule } from '../src/lib/nativeGoogleSignin';
import FormField from '../src/components/FormField';
import { useAuth } from '../src/providers/AuthProvider';
import { useAnalytics } from '../src/analytics/AnalyticsProvider';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { useUserSettings } from '../src/providers/UserSettingsProvider';
import {
  clearPendingOnboardingIntent,
  DEFAULT_ONBOARDING_INTENT,
  ONBOARDING_INTENT_OPTIONS,
  parseOnboardingIntent,
  persistOnboardingIntent,
  readPendingOnboardingIntent,
  resolveMobileIntentDestination,
  type OnboardingIntent,
} from '../src/lib/onboardingIntent';
import { updateOnboardingIntent } from '../src/api/onboarding';
import { evaluateFeatureAccess, getFeaturesByMobilePath } from '../src/features/featureRegistry';
import { authCopy, onboardingLanguage } from '../src/localization/onboardingCopy';
import { isValidSignupPassword } from '../src/lib/passwordPolicy';

const ACCOUNT_TERMS_VERSION = 'tdf-account-terms-v1';
const TERMS_URL = 'https://tdf-app.pages.dev/mobile-app/terms.html';
const PRIVACY_URL = 'https://tdf-app.pages.dev/mobile-app/privacy.html';

const readErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
};

const resolveAuthorizedReturnTo = (
  candidate: Href | null,
  roles: readonly string[],
  modules: readonly string[],
): Href | null => {
  if (!candidate) return null;
  const path = typeof candidate === 'string' ? candidate : candidate.pathname;
  const features = getFeaturesByMobilePath(path);
  if (features.length === 0) return null;
  return features.some((feature) => evaluateFeatureAccess(
    feature,
    { authenticated: true, roles, modules },
    feature.routeAction,
  ).state === 'allowed') ? candidate : null;
};

export default function AuthScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: string | string[];
    returnTo?: string | string[];
    intent?: string | string[];
    roles?: string | string[];
  }>();
  const { token, loading, setToken, clearToken } = useAuth();
  const analytics = useAnalytics();
  const { locale, getCatalogItems, setRegionalPreferences } = useUserSettings();
  const language = onboardingLanguage(locale);
  const english = language === 'en';
  const copy = authCopy[language];
  const requestedMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const rawIntent = Array.isArray(params.intent) ? params.intent[0] : params.intent;
  const legacyRoles = Array.isArray(params.roles) ? params.roles[0] : params.roles;
  const requestedIntent = parseOnboardingIntent(rawIntent) ?? parseOnboardingIntent(legacyRoles);
  const initialIntent = requestedIntent ?? DEFAULT_ONBOARDING_INTENT;
  const rawReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const safeReturnTo = rawReturnTo?.startsWith('/') && !rawReturnTo.startsWith('//') && rawReturnTo.length <= 500
    ? rawReturnTo as Href
    : null;
  const [mode, setMode] = useState<'login' | 'signup' | 'forgotPassword'>(requestedMode === 'signup' ? 'signup' : 'login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [selectedIntent, setSelectedIntent] = useState<OnboardingIntent>(initialIntent);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const lastNameInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const forgotPasswordEmailInputRef = useRef<TextInput>(null);

  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [isSignupSubmitting, setIsSignupSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [googleSigninModule, setGoogleSigninModule] = useState<NativeGoogleSigninModule | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [isForgotPasswordSubmitting, setIsForgotPasswordSubmitting] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState<string | null>(null);

  const hasToken = Boolean(token?.trim());
  const canSubmitPassword = username.trim().length > 0 && password.length > 0 && !isPasswordSubmitting;
  const canSubmitForgotPassword =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotPasswordEmail.trim()) && !isForgotPasswordSubmitting;
  const signupEmailError = signupEmail.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail.trim())
    ? copy.invalidEmail
    : null;
  const signupPasswordError = mode === 'signup' && password.length > 0 && !isValidSignupPassword(password)
    ? copy.passwordHint
    : null;
  const canSubmitSignup =
    firstName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail.trim()) &&
    isValidSignupPassword(password) &&
    !signupPasswordError &&
    termsAccepted &&
    !isSignupSubmitting;
  const isGoogleLoginAvailable =
    Platform.OS !== 'web' &&
    Boolean(googleSigninModule) &&
    Boolean(GOOGLE_WEB_CLIENT_ID) &&
    (Platform.OS !== 'ios' || Boolean(GOOGLE_IOS_URL_SCHEME));
  const showLoginActions = !loading && !hasToken;
  const showGoogleLogin = showLoginActions && isGoogleLoginAvailable;

  const chooseLanguage = (code: 'es' | 'en') => {
    const option = getCatalogItems('locales').find((item) => item.code === code);
    if (option) setRegionalPreferences({ localeId: option.id });
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      const restoredIntent = requestedIntent ?? await readPendingOnboardingIntent();
      const entryIntent = restoredIntent ?? DEFAULT_ONBOARDING_INTENT;
      if (!active) return;
      setSelectedIntent(entryIntent);
      analytics.capture('auth_mode_viewed', {
        platform: 'mobile',
        mode: requestedMode === 'signup' ? 'signup' : 'login',
        intent: entryIntent,
      });
      if (requestedMode === 'signup') {
        analytics.capture('signup_started', { platform: 'mobile', entry: 'deeplink', intent: entryIntent });
      }
      if (requestedIntent) await persistOnboardingIntent(requestedIntent);
    })();
    return () => {
      active = false;
    };
    // Screen-entry instrumentation must fire once for this route instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistIntentForExistingAccount = async () => {
    const pendingIntent = requestedIntent ?? await readPendingOnboardingIntent();
    if (pendingIntent) {
      try {
        await updateOnboardingIntent(pendingIntent);
      } catch {
        // Personalization sync must not turn a successful login into failure.
      }
    }
    await clearPendingOnboardingIntent();
  };

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let active = true;

    void loadNativeGoogleSignin().then((module) => {
      if (active) {
        setGoogleSigninModule(module);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isGoogleLoginAvailable || !GOOGLE_WEB_CLIENT_ID || !googleSigninModule) return;

    googleSigninModule.GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      ...(GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {})
    });
  }, [googleSigninModule, isGoogleLoginAvailable]);

  const handlePasswordLogin = async () => {
    if (!canSubmitPassword) return;

    setErrorMessage(null);
    setFeedbackMessage(null);
    setIsPasswordSubmitting(true);

    try {
      const session = await loginRequest({
        username: username.trim(),
        password
      });

      setToken(session.token, session.partyId ?? null, {
        roles: session.roles ?? [],
        modules: session.modules ?? [],
      });
      void persistIntentForExistingAccount();
      setPassword('');
      analytics.capture('login_completed', { platform: 'mobile', method: 'password' });
      setFeedbackMessage(copy.loginSuccess);
      router.replace(
        resolveAuthorizedReturnTo(safeReturnTo, session.roles ?? [], session.modules ?? [])
          ?? resolveMobileIntentDestination(selectedIntent, session.roles ?? [], session.modules ?? []),
      );
    } catch (error) {
      analytics.capture('login_failed', { platform: 'mobile', method: 'password' });
      setErrorMessage(readErrorMessage(error, copy.loginFailure));
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  const handleSignup = async () => {
    if (!canSubmitSignup) {
      analytics.capture('signup_validation_failed', {
        platform: 'mobile',
        intent: selectedIntent,
        reason: !termsAccepted ? 'terms_not_accepted' : 'invalid_required_fields',
      });
      return;
    }

    setErrorMessage(null);
    setFeedbackMessage(null);
    setIsSignupSubmitting(true);
    try {
      const session = await signupRequest({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: signupEmail.trim().toLowerCase(),
        password,
        marketingOptIn,
        termsAccepted: true,
        termsVersion: ACCOUNT_TERMS_VERSION,
        onboardingIntent: selectedIntent,
      });
      setToken(session.token, session.partyId ?? null, {
        roles: session.roles ?? [],
        modules: session.modules ?? [],
      });
      await clearPendingOnboardingIntent();
      setPassword('');
      const intentDestination = resolveMobileIntentDestination(
        selectedIntent,
        session.roles ?? [],
        session.modules ?? [],
      );
      const authorizedReturnTo = resolveAuthorizedReturnTo(safeReturnTo, session.roles ?? [], session.modules ?? []);
      const destination = (selectedIntent === 'artist_profile' || selectedIntent === 'internships')
        ? intentDestination
        : authorizedReturnTo ?? intentDestination;
      analytics.capture('signup_completed', {
        platform: 'mobile',
        method: 'password',
        intent: selectedIntent,
        destination_kind: typeof destination === 'string' ? destination : destination.pathname,
      });
      setFeedbackMessage(copy.signupSuccess);
      router.replace(destination);
    } catch (error) {
      analytics.capture('signup_failed', { platform: 'mobile', method: 'password', intent: selectedIntent });
      setErrorMessage(readErrorMessage(error, copy.signupFailure));
    } finally {
      setIsSignupSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setFeedbackMessage(null);

    if (!isGoogleLoginAvailable || !googleSigninModule) {
      setErrorMessage(copy.googleUnavailable);
      return;
    }

    setIsGoogleSubmitting(true);

    try {
      if (Platform.OS === 'android') {
        await googleSigninModule.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      const response = await googleSigninModule.GoogleSignin.signIn();

      if (!googleSigninModule.isSuccessResponse(response)) {
        setFeedbackMessage(copy.googleCancelled);
        return;
      }

      if (!response.data.idToken) {
        throw new Error(copy.googleMissingToken);
      }

      const session = await googleLoginRequest({
        idToken: response.data.idToken,
        ...(mode === 'signup' ? {
          marketingOptIn,
          termsAccepted: true,
          termsVersion: ACCOUNT_TERMS_VERSION,
          onboardingIntent: selectedIntent,
        } : {}),
      });
      setToken(session.token, session.partyId ?? null, {
        roles: session.roles ?? [],
        modules: session.modules ?? [],
      });
      setPassword('');
      const googleCreatedAccount = session.accountCreated === true;
      if (googleCreatedAccount) {
        await clearPendingOnboardingIntent();
      } else {
        void persistIntentForExistingAccount();
      }
      analytics.capture(googleCreatedAccount ? 'signup_completed' : 'login_completed', {
        platform: 'mobile',
        method: 'google',
        ...(googleCreatedAccount ? { intent: selectedIntent } : {}),
      });
      setFeedbackMessage(copy.googleSuccess);
      const authorizedReturnTo = resolveAuthorizedReturnTo(safeReturnTo, session.roles ?? [], session.modules ?? []);
      router.replace(
        mode === 'signup' && (!authorizedReturnTo || selectedIntent === 'artist_profile' || selectedIntent === 'internships')
          ? resolveMobileIntentDestination(selectedIntent, session.roles ?? [], session.modules ?? [])
          : authorizedReturnTo
            ?? resolveMobileIntentDestination(selectedIntent, session.roles ?? [], session.modules ?? []),
      );
    } catch (error) {
      if (googleSigninModule.isErrorWithCode(error)) {
        if (error.code === googleSigninModule.statusCodes.SIGN_IN_CANCELLED) {
          setFeedbackMessage(copy.googleCancelled);
          return;
        }

        if (error.code === googleSigninModule.statusCodes.IN_PROGRESS) {
          setFeedbackMessage(copy.googleInProgress);
          return;
        }

        if (error.code === googleSigninModule.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          setErrorMessage(copy.googlePlayUnavailable);
          return;
        }
      }

      analytics.capture(mode === 'signup' ? 'signup_failed' : 'login_failed', {
        platform: 'mobile',
        method: 'google',
        ...(mode === 'signup' ? { intent: selectedIntent } : {}),
      });
      setErrorMessage(readErrorMessage(error, copy.googleFailure));
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleClearSession = async () => {
    setErrorMessage(null);
    setFeedbackMessage(copy.sessionClosed);

    if (Platform.OS !== 'web' && googleSigninModule) {
      try {
        await googleSigninModule.GoogleSignin.signOut();
      } catch {
        // Ignore sign out failures so local session can still be cleared.
      }
    }

    clearToken();
    setPassword('');
  };

  const handleForgotPassword = async () => {
    if (!canSubmitForgotPassword) return;

    setForgotPasswordError(null);
    setForgotPasswordSuccess(false);
    setIsForgotPasswordSubmitting(true);

    try {
      await requestPasswordReset(forgotPasswordEmail.trim().toLowerCase());
      setForgotPasswordSuccess(true);
    } catch (error) {
      setForgotPasswordError(readErrorMessage(error, copy.resetFailure));
    } finally {
      setIsForgotPasswordSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.languageRow} accessibilityRole="radiogroup">
              {(['es', 'en'] as const).map((code) => (
                <TouchableOpacity
                  key={code}
                  style={[styles.languageButton, locale.startsWith(code) && styles.languageButtonActive]}
                  onPress={() => chooseLanguage(code)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: locale.startsWith(code) }}
                >
                  <Text style={[styles.languageText, locale.startsWith(code) && styles.languageTextActive]}>
                    {code === 'es' ? 'Español' : 'English'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.title}>
              {mode === 'signup' ? copy.createTitle : mode === 'forgotPassword' ? copy.resetTitle : copy.loginTitle}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'signup'
                ? copy.createSubtitle
                : mode === 'forgotPassword'
                  ? copy.resetSubtitle
                  : copy.loginSubtitle}
            </Text>
            {__DEV__ ? <Text style={styles.meta}>API base: {API_BASE}</Text> : null}
          </View>

          {showLoginActions && mode !== 'forgotPassword' ? (
            <View style={styles.card}>
              <View style={styles.modeSwitch}>
                <TouchableOpacity
                  style={[styles.modeButton, mode === 'login' && styles.modeButtonActive]}
                  onPress={() => {
                    setMode('login');
                    setErrorMessage(null);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === 'login' }}
                >
                  <Text style={[styles.modeButtonText, mode === 'login' && styles.modeButtonTextActive]}>{copy.loginTab}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeButton, mode === 'signup' && styles.modeButtonActive]}
                  onPress={() => {
                    setMode('signup');
                    setErrorMessage(null);
                    analytics.capture('signup_started', { platform: 'mobile' });
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === 'signup' }}
                >
                  <Text style={[styles.modeButtonText, mode === 'signup' && styles.modeButtonTextActive]}>{copy.signupTab}</Text>
                </TouchableOpacity>
              </View>

              {mode === 'signup' ? (
                <>
                  <View style={styles.nameRow}>
                    <FormField
                      label={copy.firstName}
                      containerStyle={styles.nameField}
                      value={firstName}
                      onChangeText={(value) => {
                        setFirstName(value);
                        setErrorMessage(null);
                      }}
                      placeholder={copy.firstNamePlaceholder}
                      autoCapitalize="words"
                      autoComplete="given-name"
                      textContentType="givenName"
                      maxLength={80}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => lastNameInputRef.current?.focus()}
                    />
                    <FormField
                      ref={lastNameInputRef}
                      label={copy.lastName}
                      optional
                      containerStyle={styles.nameField}
                      value={lastName}
                      onChangeText={(value) => {
                        setLastName(value);
                        setErrorMessage(null);
                      }}
                      placeholder={copy.lastNamePlaceholder}
                      autoCapitalize="words"
                      autoComplete="family-name"
                      textContentType="familyName"
                      maxLength={80}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => emailInputRef.current?.focus()}
                    />
                  </View>
                  <FormField
                    ref={emailInputRef}
                    label={copy.email}
                    value={signupEmail}
                    onChangeText={(value) => {
                      setSignupEmail(value);
                      setErrorMessage(null);
                    }}
                    placeholder={copy.emailPlaceholder}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    keyboardType="email-address"
                    maxLength={254}
                    error={signupEmailError}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />
                </>
              ) : (
                <FormField
                  testID="usernameInput"
                  label={copy.username}
                  value={username}
                  onChangeText={(value) => {
                    setUsername(value);
                    setErrorMessage(null);
                  }}
                  placeholder={copy.usernamePlaceholder}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  textContentType="username"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                />
              )}

              <FormField
                ref={passwordInputRef}
                testID="passwordInput"
                label={copy.password}
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setErrorMessage(null);
                }}
                placeholder={mode === 'signup' ? copy.newPasswordPlaceholder : copy.currentPasswordPlaceholder}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={mode === 'signup' ? 'new-password' : 'password'}
                textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                secureTextEntry={!showPassword}
                error={signupPasswordError}
                accessibilityHint={mode === 'signup' ? copy.passwordHint : undefined}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (mode === 'signup') {
                    void handleSignup();
                  } else {
                    void handlePasswordLogin();
                  }
                }}
              />

              <TouchableOpacity
                style={styles.inlineControl}
                onPress={() => setShowPassword((current) => !current)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showPassword }}
                accessibilityLabel={showPassword ? copy.hide : copy.show}
              >
                <Text style={styles.inlineControlText}>{showPassword ? copy.hide : copy.show}</Text>
              </TouchableOpacity>

              {mode === 'signup' ? (
                <>
                  <View style={styles.intentSelectorContainer}>
                    <Text style={[styles.label, { color: colors.textPrimary }]}>{copy.intentTitle}</Text>
                    <Text style={styles.intentHint}>{copy.intentHint}</Text>
                    <View style={styles.intentGrid} accessibilityRole="radiogroup">
                      {ONBOARDING_INTENT_OPTIONS.map(({ id, labelEs, labelEn }) => (
                      <TouchableOpacity
                        key={id}
                        style={[
                          styles.intentButton,
                          {
                            backgroundColor: selectedIntent === id ? colors.selected : colors.surface,
                            borderColor: selectedIntent === id ? colors.actionPrimary : colors.border,
                          },
                        ]}
                        onPress={() => {
                          setSelectedIntent(id);
                          setErrorMessage(null);
                          void persistOnboardingIntent(id);
                          analytics.capture('onboarding_intent_selected', { platform: 'mobile', intent: id });
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: selectedIntent === id }}
                      >
                        <Text
                          style={[styles.intentButtonText, { color: selectedIntent === id ? colors.actionPrimary : colors.textPrimary }]}
                        >
                          {english ? labelEn : labelEs}
                        </Text>
                      </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <TouchableOpacity
                    testID="termsCheckbox"
                    style={styles.checkboxRow}
                    onPress={() => setTermsAccepted((current) => !current)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: termsAccepted }}
                    accessibilityLabel={copy.accept}
                  >
                    <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                      <Text style={styles.checkboxMark}>{termsAccepted ? '✓' : ''}</Text>
                    </View>
                    <Text style={styles.checkboxText}>{copy.accept}</Text>
                  </TouchableOpacity>
                  <View style={styles.legalLinks}>
                    <TouchableOpacity accessibilityRole="link" onPress={() => void Linking.openURL(TERMS_URL)}>
                      <Text style={styles.legalLink}>{copy.terms}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityRole="link" onPress={() => void Linking.openURL(PRIVACY_URL)}>
                      <Text style={styles.legalLink}>{copy.privacy}</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setMarketingOptIn((current) => !current)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: marketingOptIn }}
                    accessibilityLabel={copy.marketing}
                  >
                    <View style={[styles.checkbox, marketingOptIn && styles.checkboxChecked]}>
                      <Text style={styles.checkboxMark}>{marketingOptIn ? '✓' : ''}</Text>
                    </View>
                    <Text style={styles.checkboxText}>{copy.marketing}</Text>
                  </TouchableOpacity>
                </>
              ) : null}

              {mode === 'login' ? (
                <TouchableOpacity
                  onPress={() => {
                    setMode('forgotPassword');
                    setErrorMessage(null);
                    setForgotPasswordError(null);
                    setForgotPasswordSuccess(false);
                    setForgotPasswordEmail('');
                  }}
                  accessibilityRole="link"
                >
                  <Text style={styles.forgotPasswordLink}>{copy.forgot}</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                testID={mode === 'signup' ? 'signupButton' : 'loginButton'}
                style={[
                  styles.primaryButton,
                  !(mode === 'signup' ? canSubmitSignup : canSubmitPassword) && styles.buttonDisabled,
                ]}
                onPress={() => {
                  if (mode === 'signup') {
                    void handleSignup();
                  } else {
                    void handlePasswordLogin();
                  }
                }}
                disabled={!(mode === 'signup' ? canSubmitSignup : canSubmitPassword)}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: !(mode === 'signup' ? canSubmitSignup : canSubmitPassword),
                  busy: isPasswordSubmitting || isSignupSubmitting,
                }}
              >
                {isPasswordSubmitting || isSignupSubmitting ? (
                  <ActivityIndicator color={colors.actionPrimaryContrast} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {mode === 'signup' ? copy.create : copy.login}
                  </Text>
                )}
              </TouchableOpacity>

              {showGoogleLogin && (mode !== 'signup' || termsAccepted) ? (
                <>
                  <View style={styles.dividerRow}>
                    <View style={styles.divider} />
                    <Text style={styles.dividerText}>{copy.divider}</Text>
                    <View style={styles.divider} />
                  </View>

                  <TouchableOpacity
                    style={[styles.secondaryButton, isGoogleSubmitting && styles.buttonDisabled]}
                    onPress={() => {
                      void handleGoogleLogin();
                    }}
                    disabled={isGoogleSubmitting}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isGoogleSubmitting, busy: isGoogleSubmitting }}
                  >
                    {isGoogleSubmitting ? (
                      <ActivityIndicator color={colors.textPrimary} />
                    ) : (
                      <Text style={styles.secondaryButtonText}>
                        {mode === 'signup' ? copy.googleCreate : copy.googleLogin}
                      </Text>
                    )}
                  </TouchableOpacity>

                </>
              ) : null}

              {errorMessage ? (
                <Text
                  style={styles.errorText}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="assertive"
                >
                  {errorMessage}
                </Text>
              ) : null}
            </View>
          ) : null}

          {showLoginActions && mode === 'forgotPassword' ? (
            <View style={styles.card}>
              {forgotPasswordSuccess ? (
                <>
                  <Text style={styles.successText} accessibilityLiveRegion="polite">
                    {copy.resetSuccess}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setMode('login');
                      setForgotPasswordSuccess(false);
                      setForgotPasswordEmail('');
                      setForgotPasswordError(null);
                    }}
                    accessibilityRole="link"
                  >
                    <Text style={styles.forgotPasswordLink}>{copy.backToLogin}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <FormField
                    ref={forgotPasswordEmailInputRef}
                    label={copy.email}
                    value={forgotPasswordEmail}
                    onChangeText={(value) => {
                      setForgotPasswordEmail(value);
                      setForgotPasswordError(null);
                    }}
                    placeholder={copy.emailPlaceholder}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    keyboardType="email-address"
                    maxLength={254}
                    returnKeyType="done"
                    onSubmitEditing={() => void handleForgotPassword()}
                  />

                  <TouchableOpacity
                    style={[styles.primaryButton, !canSubmitForgotPassword && styles.buttonDisabled]}
                    onPress={() => void handleForgotPassword()}
                    disabled={!canSubmitForgotPassword}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canSubmitForgotPassword, busy: isForgotPasswordSubmitting }}
                  >
                    {isForgotPasswordSubmitting ? (
                      <ActivityIndicator color={colors.actionPrimaryContrast} />
                    ) : (
                      <Text style={styles.primaryButtonText}>{copy.sendReset}</Text>
                    )}
                  </TouchableOpacity>

                  {forgotPasswordError ? (
                    <Text
                      style={styles.errorText}
                      accessibilityRole="alert"
                      accessibilityLiveRegion="assertive"
                    >
                      {forgotPasswordError}
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    onPress={() => {
                      setMode('login');
                      setForgotPasswordError(null);
                      setForgotPasswordSuccess(false);
                      setForgotPasswordEmail('');
                    }}
                    accessibilityRole="link"
                  >
                    <Text style={styles.forgotPasswordLink}>{copy.backToLogin}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.label}>{copy.sessionStatus}</Text>
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.actionPrimary} />
                <Text style={styles.statusText}>{copy.sessionLoading}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.statusText}>
                  {copy.session}: {hasToken ? copy.sessionActive : copy.sessionInactive}
                </Text>
                {feedbackMessage ? (
                  <Text style={styles.successText} accessibilityLiveRegion="polite">
                    {feedbackMessage}
                  </Text>
                ) : null}
                <TouchableOpacity
                  style={[styles.ghostButton, !hasToken && styles.buttonDisabled]}
                  onPress={() => {
                    void handleClearSession();
                  }}
                  disabled={!hasToken}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !hasToken }}
                >
                  <Text style={styles.ghostButtonText}>{copy.signOut}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) => StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 10
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  subtitle: { color: colors.textSecondary, lineHeight: 20 },
  meta: { color: colors.actionPrimary, fontSize: 12, fontWeight: '600' },
  label: { fontWeight: '700', color: colors.textPrimary },
  languageRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  languageButton: {
    minWidth: 72,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  languageButtonActive: { backgroundColor: colors.selected, borderColor: colors.actionPrimary },
  languageText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  languageTextActive: { color: colors.actionPrimary },
  modeSwitch: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  modeButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modeButtonActive: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.actionPrimary,
  },
  modeButtonText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  modeButtonTextActive: { color: colors.actionPrimary },
  nameRow: { gap: 10 },
  nameField: { flex: 1 },
  primaryButton: {
    minHeight: 48,
    backgroundColor: colors.actionPrimary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: colors.actionPrimaryContrast, fontWeight: '700' },
  secondaryButton: {
    minHeight: 48,
    backgroundColor: colors.canvas,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: colors.textPrimary, fontWeight: '700' },
  ghostButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  ghostButtonText: { color: colors.actionPrimary, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { color: colors.textSecondary },
  successText: { color: colors.success, fontSize: 12, lineHeight: 18 },
  errorText: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  forgotPasswordLink: { color: colors.actionPrimary, fontSize: 13, fontWeight: '600' },
  inlineControl: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  inlineControlText: { color: colors.actionPrimary, fontSize: 13, fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
  intentSelectorContainer: { gap: 8 },
  intentHint: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  intentGrid: { gap: 8 },
  intentButton: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  intentButtonText: { fontSize: 13, fontWeight: '700' },
  checkboxRow: { flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 44 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  checkboxChecked: { backgroundColor: colors.actionPrimary, borderColor: colors.actionPrimary },
  checkboxMark: { color: colors.actionPrimaryContrast, fontWeight: '900' },
  checkboxText: { flex: 1, color: colors.textPrimary, fontSize: 13, lineHeight: 18 },
  legalLinks: { flexDirection: 'row', gap: 20, paddingLeft: 34 },
  legalLink: { color: colors.actionPrimary, minHeight: 44, textAlignVertical: 'center', fontWeight: '600', fontSize: 13 },
});
