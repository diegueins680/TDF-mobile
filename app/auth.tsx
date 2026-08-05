import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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

import { loginRequest, googleLoginRequest, signupRequest } from '../src/api/auth';
import { API_BASE } from '../src/lib/api';
import {
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_IOS_URL_SCHEME,
  GOOGLE_WEB_CLIENT_ID
} from '../src/lib/authConfig';
import { loadNativeGoogleSignin, type NativeGoogleSigninModule } from '../src/lib/nativeGoogleSignin';
import { MOBILE_LANDING_ROUTE } from '../src/navigation/mobileSurface';
import FormField from '../src/components/FormField';
import { useAuth } from '../src/providers/AuthProvider';
import { useAppTheme } from '../src/theme/ThemeProvider';

const readErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
};

export default function AuthScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string | string[]; returnTo?: string | string[] }>();
  const { token, loading, setToken, clearToken } = useAuth();
  const requestedMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const rawReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = rawReturnTo?.startsWith('/') && !rawReturnTo.startsWith('//') && rawReturnTo.length <= 500
    ? rawReturnTo as Href
    : MOBILE_LANDING_ROUTE;
  const [mode, setMode] = useState<'login' | 'signup'>(requestedMode === 'signup' ? 'signup' : 'login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const lastNameInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (__DEV__) {
      setUsername('tdf-owner');
      setPassword('TDFowner2025!');
    }
  }, []);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [isSignupSubmitting, setIsSignupSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [googleSigninModule, setGoogleSigninModule] = useState<NativeGoogleSigninModule | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const hasToken = Boolean(token?.trim());
  const canSubmitPassword = username.trim().length > 0 && password.length > 0 && !isPasswordSubmitting;
  const canSubmitSignup =
    firstName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail.trim()) &&
    password.trim().length >= 8 &&
    !isSignupSubmitting;
  const signupEmailError = signupEmail.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail.trim())
    ? 'Ingresa un correo electrónico válido.'
    : null;
  const signupPasswordError = mode === 'signup' && password.length > 0 && password.trim().length < 8
    ? 'La contraseña debe tener al menos 8 caracteres.'
    : null;
  const isGoogleLoginAvailable =
    Platform.OS !== 'web' &&
    Boolean(googleSigninModule) &&
    Boolean(GOOGLE_WEB_CLIENT_ID) &&
    (Platform.OS !== 'ios' || Boolean(GOOGLE_IOS_URL_SCHEME));
  const showLoginActions = !loading && !hasToken;
  const showGoogleLogin = showLoginActions && isGoogleLoginAvailable;

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

      setToken(session.token, session.partyId ?? null);
      setPassword('');
      setFeedbackMessage('Sesión iniciada.');
      router.replace(returnTo);
    } catch (error) {
      setErrorMessage(readErrorMessage(error, 'No pudimos iniciar sesión.'));
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  const handleSignup = async () => {
    if (!canSubmitSignup) return;

    setErrorMessage(null);
    setFeedbackMessage(null);
    setIsSignupSubmitting(true);
    try {
      const session = await signupRequest({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: signupEmail.trim().toLowerCase(),
        password,
        roles: ['Fan'],
      });
      setToken(session.token, session.partyId ?? null);
      setPassword('');
      setFeedbackMessage('Cuenta creada. Ya puedes elegir tus entradas.');
      router.replace(returnTo);
    } catch (error) {
      setErrorMessage(readErrorMessage(error, 'No pudimos crear tu cuenta.'));
    } finally {
      setIsSignupSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setFeedbackMessage(null);

    if (!isGoogleLoginAvailable || !googleSigninModule) {
      setErrorMessage('Google login requiere la build instalada de TDF Records; Expo Go no incluye Google Sign-In nativo.');
      return;
    }

    setIsGoogleSubmitting(true);

    try {
      if (Platform.OS === 'android') {
        await googleSigninModule.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      const response = await googleSigninModule.GoogleSignin.signIn();

      if (!googleSigninModule.isSuccessResponse(response)) {
        setFeedbackMessage('Inicio con Google cancelado.');
        return;
      }

      if (!response.data.idToken) {
        throw new Error('Google no devolvió un idToken válido.');
      }

      const session = await googleLoginRequest({ idToken: response.data.idToken });
      setToken(session.token, session.partyId ?? null);
      setPassword('');
      setFeedbackMessage('Sesión con Google iniciada.');
      router.replace(returnTo);
    } catch (error) {
      if (googleSigninModule.isErrorWithCode(error)) {
        if (error.code === googleSigninModule.statusCodes.SIGN_IN_CANCELLED) {
          setFeedbackMessage('Inicio con Google cancelado.');
          return;
        }

        if (error.code === googleSigninModule.statusCodes.IN_PROGRESS) {
          setFeedbackMessage('Google login ya está en progreso.');
          return;
        }

        if (error.code === googleSigninModule.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          setErrorMessage('Google Play Services no está disponible en este dispositivo.');
          return;
        }
      }

      setErrorMessage(readErrorMessage(error, 'No pudimos iniciar sesión con Google.'));
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleClearSession = async () => {
    setErrorMessage(null);
    setFeedbackMessage('Sesión cerrada.');

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

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>{mode === 'signup' ? 'Crea tu cuenta' : 'Inicia sesión'}</Text>
            <Text style={styles.subtitle}>
              {mode === 'signup'
                ? 'Solo toma un minuto. Después volverás directo a elegir tus entradas.'
                : 'Accede a tus eventos, compras y códigos QR con tu cuenta de TDF Records.'}
            </Text>
            {__DEV__ ? <Text style={styles.meta}>API base: {API_BASE}</Text> : null}
          </View>

          {showLoginActions ? (
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
                  <Text style={[styles.modeButtonText, mode === 'login' && styles.modeButtonTextActive]}>Ingresar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeButton, mode === 'signup' && styles.modeButtonActive]}
                  onPress={() => {
                    setMode('signup');
                    setErrorMessage(null);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === 'signup' }}
                >
                  <Text style={[styles.modeButtonText, mode === 'signup' && styles.modeButtonTextActive]}>Crear cuenta</Text>
                </TouchableOpacity>
              </View>

              {mode === 'signup' ? (
                <>
                  <View style={styles.nameRow}>
                    <FormField
                      label="Nombre"
                      containerStyle={styles.nameField}
                      value={firstName}
                      onChangeText={(value) => {
                        setFirstName(value);
                        setErrorMessage(null);
                      }}
                      placeholder="Tu nombre"
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
                      label="Apellido"
                      optional
                      containerStyle={styles.nameField}
                      value={lastName}
                      onChangeText={(value) => {
                        setLastName(value);
                        setErrorMessage(null);
                      }}
                      placeholder="Tu apellido"
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
                    label="Correo electrónico"
                    value={signupEmail}
                    onChangeText={(value) => {
                      setSignupEmail(value);
                      setErrorMessage(null);
                    }}
                    placeholder="tu@correo.com"
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
                  label="Usuario o correo"
                  value={username}
                  onChangeText={(value) => {
                    setUsername(value);
                    setErrorMessage(null);
                  }}
                  placeholder="usuario o correo"
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
                label="Contraseña"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setErrorMessage(null);
                }}
                placeholder={mode === 'signup' ? 'Mínimo 8 caracteres' : 'Tu contraseña'}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={mode === 'signup' ? 'new-password' : 'password'}
                textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                secureTextEntry
                error={signupPasswordError}
                accessibilityHint={mode === 'signup' ? 'Usa al menos 8 caracteres.' : undefined}
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
                    {mode === 'signup' ? 'Crear cuenta y continuar' : 'Ingresar'}
                  </Text>
                )}
              </TouchableOpacity>

              {showGoogleLogin && mode === 'login' ? (
                <>
                  <View style={styles.dividerRow}>
                    <View style={styles.divider} />
                    <Text style={styles.dividerText}>o</Text>
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
                      <Text style={styles.secondaryButtonText}>Continuar con Google</Text>
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

          <View style={styles.card}>
            <Text style={styles.label}>Estado de sesión</Text>
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.actionPrimary} />
                <Text style={styles.statusText}>Cargando sesión guardada…</Text>
              </View>
            ) : (
              <>
                <Text style={styles.statusText}>
                  Sesión: {hasToken ? 'Activa' : 'No iniciada'}
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
                  <Text style={styles.ghostButtonText}>Cerrar sesión</Text>
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
  buttonDisabled: { opacity: 0.5 }
});
