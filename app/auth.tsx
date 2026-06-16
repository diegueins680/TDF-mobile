import { useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';

import { loginRequest, googleLoginRequest } from '../src/api/auth';
import { API_BASE } from '../src/lib/api';
import {
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_IOS_URL_SCHEME,
  GOOGLE_WEB_CLIENT_ID
} from '../src/lib/authConfig';
import { loadNativeGoogleSignin, type NativeGoogleSigninModule } from '../src/lib/nativeGoogleSignin';
import { useAuth } from '../src/providers/AuthProvider';

const readErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
};

export default function AuthScreen() {
  const router = useRouter();
  const { token, partyId, loading, setToken, clearToken } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (__DEV__) {
      setUsername('tdf-owner');
      setPassword('TDFowner2025!');
    }
  }, []);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [googleSigninModule, setGoogleSigninModule] = useState<NativeGoogleSigninModule | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const hasToken = Boolean(token?.trim());
  const canSubmitPassword = username.trim().length > 0 && password.length > 0 && !isPasswordSubmitting;
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
      setFeedbackMessage(
        session.partyId
          ? `Sesión iniciada. Party activa: ${session.partyId}.`
          : 'Sesión iniciada.'
      );
      router.replace('/(tabs)/parties');
    } catch (error) {
      setErrorMessage(readErrorMessage(error, 'No pudimos iniciar sesión.'));
    } finally {
      setIsPasswordSubmitting(false);
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
      setFeedbackMessage(
        session.partyId
          ? `Sesión con Google iniciada. Party activa: ${session.partyId}.`
          : 'Sesión con Google iniciada.'
      );
      router.replace('/(tabs)/parties');
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
            <Text style={styles.title}>Inicia sesión</Text>
            <Text style={styles.subtitle}>
              Usa tu cuenta de TDF Records para desbloquear inventario, bookings, parties y social desde mobile.
            </Text>
            <Text style={styles.meta}>API base: {API_BASE}</Text>
          </View>

          {showLoginActions ? (
            <View style={styles.card}>
              <Text style={styles.label}>Usuario o correo</Text>
              <TextInput
                testID="usernameInput"
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
                style={styles.input}
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                testID="passwordInput"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setErrorMessage(null);
                }}
                placeholder="Tu password"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                secureTextEntry
                style={styles.input}
                onSubmitEditing={() => {
                  void handlePasswordLogin();
                }}
              />

              <TouchableOpacity
                testID="loginButton"
                style={[styles.primaryButton, !canSubmitPassword && styles.buttonDisabled]}
                onPress={() => {
                  void handlePasswordLogin();
                }}
                disabled={!canSubmitPassword}
              >
                {isPasswordSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Entrar con password</Text>
                )}
              </TouchableOpacity>

              {showGoogleLogin ? (
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
                  >
                    {isGoogleSubmitting ? (
                      <ActivityIndicator color="#111827" />
                    ) : (
                      <Text style={styles.secondaryButtonText}>Continuar con Google</Text>
                    )}
                  </TouchableOpacity>

                  <Text style={styles.helperText}>
                    Google login usa el mismo backend /login/google que ya existe en web.
                  </Text>
                </>
              ) : null}
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.label}>Estado de sesión</Text>
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#2563eb" />
                <Text style={styles.statusText}>Cargando sesión guardada…</Text>
              </View>
            ) : (
              <>
                <Text style={styles.statusText}>
                  Sesión: {hasToken ? 'Activa' : 'No iniciada'}
                </Text>
                <Text style={styles.statusText}>
                  Party ID: {partyId ?? 'Pendiente'}
                </Text>
                {feedbackMessage ? <Text style={styles.successText}>{feedbackMessage}</Text> : null}
                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
                <TouchableOpacity
                  style={[styles.ghostButton, !hasToken && styles.buttonDisabled]}
                  onPress={() => {
                    void handleClearSession();
                  }}
                  disabled={!hasToken}
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    gap: 10
  },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  subtitle: { color: '#475569', lineHeight: 20 },
  meta: { color: '#1d4ed8', fontSize: 12, fontWeight: '600' },
  label: { fontWeight: '700', color: '#0f172a' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#fff'
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: {
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center'
  },
  secondaryButtonText: { color: '#111827', fontWeight: '700' },
  ghostButton: {
    alignItems: 'center',
    paddingVertical: 8
  },
  ghostButtonText: { color: '#1d4ed8', fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { color: '#334155' },
  successText: { color: '#166534', fontSize: 12, lineHeight: 18 },
  errorText: { color: '#b91c1c', fontSize: 12, lineHeight: 18 },
  helperText: { color: '#475569', fontSize: 12, lineHeight: 18 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  divider: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  dividerText: { color: '#64748b', fontSize: 12, fontWeight: '700' },
  buttonDisabled: { opacity: 0.5 }
});
