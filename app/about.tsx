import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { API_BASE } from '../src/lib/api';
import { PublicLinksSection } from '../src/components/PublicLinksSection';

type VersionInfo = {
  name: string;
  version: string;
  commit?: string;
  buildTime?: string;
};

type Health = { status?: string } | null;

export default function About() {
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [health, setHealth] = useState<Health>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/version`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`${API_BASE}/health`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    ]).then(([v, h]) => {
      setVersion(v);
      setHealth(h);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: '600' }}>About TDF</Text>
      <Text>API Base: {API_BASE}</Text>
      <Text>Health: {health?.status ?? 'unknown'}</Text>
      {version && (
        <View style={{ marginTop: 8 }}>
          <Text>
            Backend: {version.name} v{version.version}
          </Text>
          {version.commit && <Text>Commit: {version.commit}</Text>}
          {version.buildTime && (
            <Text>Built: {new Date(version.buildTime).toUTCString()}</Text>
          )}
        </View>
      )}
      <PublicLinksSection />
    </ScrollView>
  );
}
