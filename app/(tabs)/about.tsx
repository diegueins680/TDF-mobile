import Constants from 'expo-constants';
import { useQuery } from '@tanstack/react-query';
import { fetchHealth, API_BASE } from '../../src/lib/api';
import { DEFAULT_TZ } from '../../src/lib/time';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type ReleaseUrls = {
  support?: string;
  privacyPolicy?: string;
  termsOfService?: string;
  dataDeletion?: string;
};

type ExpoExtra = {
  supportEmail?: string;
  urls?: ReleaseUrls;
};

export default function About() {
  const q = useQuery({ queryKey: ['health'], queryFn: fetchHealth });
  const extra = Constants.expoConfig?.extra as ExpoExtra | undefined;
  const supportEmail = extra?.supportEmail ?? 'soporte@tdfrecords.com';
  const links = [
    { label: 'Support', url: extra?.urls?.support },
    { label: 'Privacy Policy', url: extra?.urls?.privacyPolicy },
    { label: 'Terms of Service', url: extra?.urls?.termsOfService },
    { label: 'Data Deletion', url: extra?.urls?.dataDeletion }
  ].filter((link): link is { label: string; url: string } => Boolean(link.url));

  const openExternalUrl = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open link');
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>TDF Records</Text>
      <Text style={styles.meta}>API: {API_BASE}</Text>
      <Text style={styles.meta}>TZ: {DEFAULT_TZ}</Text>
      <Text style={styles.meta}>Status: {q.isLoading ? '…' : q.data?.status || 'unknown'}</Text>
      {q.data?.version ? <Text style={styles.meta}>Version: {q.data.version}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <Text style={styles.meta}>Email: {supportEmail}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support & Legal</Text>
        {links.map((link) => (
          <TouchableOpacity key={link.label} style={styles.linkButton} onPress={() => openExternalUrl(link.url)}>
            <Text style={styles.linkLabel}>{link.label}</Text>
            <Text style={styles.linkUrl}>{link.url}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 8 },
  h1: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  meta: { color: '#334155' },
  section: { marginTop: 12, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  linkButton: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    gap: 4
  },
  linkLabel: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  linkUrl: { color: '#2563eb' }
});
