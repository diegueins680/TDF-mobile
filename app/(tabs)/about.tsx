import Constants from 'expo-constants';
import { useQuery } from '@tanstack/react-query';
import { fetchHealth, API_BASE, UPLOAD_BASE } from '../../src/lib/api';
import { DEFAULT_TZ } from '../../src/lib/time';
import { View, Text, StyleSheet } from 'react-native';

export default function About() {
  const q = useQuery({ queryKey: ['health'], queryFn: fetchHealth });
  const appEnvironment =
    typeof Constants.expoConfig?.extra?.appEnvironment === 'string'
      ? Constants.expoConfig.extra.appEnvironment
      : 'development';
  const appVersion = Constants.expoConfig?.version ?? 'unknown';
  const iosBuild = Constants.expoConfig?.ios?.buildNumber;
  const androidVersionCode = Constants.expoConfig?.android?.versionCode;

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>TDF Records</Text>
      <Text>App version: {appVersion}</Text>
      <Text>
        Build: iOS {iosBuild ?? 'n/a'} / Android {androidVersionCode ?? 'n/a'}
      </Text>
      <Text>Environment: {appEnvironment}</Text>
      <Text>API: {API_BASE}</Text>
      <Text>Uploads: {UPLOAD_BASE ?? 'Not configured'}</Text>
      <Text>TZ: {DEFAULT_TZ}</Text>
      <Text>Status: {q.isLoading ? '…' : q.data?.status || 'unknown'}</Text>
      {q.data?.version ? <Text>Version: {q.data.version}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, gap: 6 },
  h1: { fontSize: 22, fontWeight: '800', marginBottom: 8 }
});
