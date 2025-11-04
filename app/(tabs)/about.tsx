import { useQuery } from '@tanstack/react-query';
import { fetchHealth, API_BASE } from '../../src/lib/api';
import { DEFAULT_TZ } from '../../src/lib/time';
import { View, Text, StyleSheet } from 'react-native';

export default function About() {
  const q = useQuery({ queryKey: ['health'], queryFn: fetchHealth });

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>TDF Records</Text>
      <Text>API: {API_BASE}</Text>
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
