import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { API_BASE } from '../../src/lib/api';
import { useAuth } from '../../src/providers/AuthProvider';

const readEnvToken = () => {
  const raw = process.env.EXPO_PUBLIC_API_TOKEN;
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

export default function AuthScreen() {
  const { token, partyId, loading, setToken, clearToken } = useAuth();
  const [draftToken, setDraftToken] = useState(token ?? '');
  const [justSaved, setJustSaved] = useState(false);

  const hasToken = Boolean(token?.trim());
  const envToken = useMemo(readEnvToken, []);

  useEffect(() => {
    setDraftToken(token ?? '');
  }, [token]);

  const handleSaveToken = () => {
    setToken(draftToken);
    setJustSaved(true);
  };

  const handleUseEnvToken = () => {
    if (!envToken) return;
    setToken(envToken);
    setJustSaved(true);
  };

  const handleClearToken = () => {
    clearToken();
    setDraftToken('');
    setJustSaved(false);
  };

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Access Token</Text>
          <Text style={styles.subtitle}>
            Configure your Bearer token to unlock protected APIs in mobile screens.
          </Text>
          <Text style={styles.meta}>
            API base: {API_BASE}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Bearer token</Text>
          <TextInput
            value={draftToken}
            onChangeText={(value) => {
              setDraftToken(value);
              setJustSaved(false);
            }}
            placeholder="Paste token or Bearer token"
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            style={styles.input}
          />
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.primaryButton, !draftToken.trim() && styles.buttonDisabled]}
              onPress={handleSaveToken}
              disabled={!draftToken.trim()}
            >
              <Text style={styles.primaryButtonText}>Save token</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, !hasToken && styles.buttonDisabled]}
              onPress={handleClearToken}
              disabled={!hasToken}
            >
              <Text style={styles.secondaryButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
          {!!envToken && (
            <TouchableOpacity style={styles.ghostButton} onPress={handleUseEnvToken}>
              <Text style={styles.ghostButtonText}>Use EXPO_PUBLIC_API_TOKEN</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Session status</Text>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#2563eb" />
              <Text style={styles.statusText}>Loading saved token…</Text>
            </View>
          ) : (
            <>
              <Text style={styles.statusText}>
                Token: {hasToken ? 'Configured' : 'Not configured'}
              </Text>
              <Text style={styles.statusText}>
                Party ID: {partyId ?? 'Not linked yet'}
              </Text>
              {justSaved && (
                <Text style={styles.successText}>
                  Token saved. If Party ID remains empty, verify `/parties/me` access for this token.
                </Text>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    gap: 8
  },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  subtitle: { color: '#475569', lineHeight: 20 },
  meta: { color: '#1d4ed8', fontSize: 12, fontWeight: '600' },
  label: { fontWeight: '700', color: '#0f172a' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    minHeight: 90,
    padding: 10,
    textAlignVertical: 'top'
  },
  actions: { flexDirection: 'row', gap: 8 },
  primaryButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: {
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    justifyContent: 'center'
  },
  secondaryButtonText: { color: '#111827', fontWeight: '700' },
  ghostButton: {
    alignItems: 'center',
    paddingVertical: 6
  },
  ghostButtonText: { color: '#1d4ed8', fontWeight: '700', fontSize: 12 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { color: '#334155' },
  successText: { color: '#166534', fontSize: 12, lineHeight: 18 },
  buttonDisabled: { opacity: 0.5 }
});
