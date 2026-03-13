import { Link, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { normalizeRouteParam } from '../../src/lib/routeParams';
import { API_BASE } from '../../src/lib/api';

type Row = {
  id: number;
  ch: number;
  source: string;
  micDi: string;
  medusa?: string | null;
  preamp: string;
  interfaceChan: string;
  dawCh: number;
  notes?: string | null;
};

export default function InputListScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const [data, setData] = React.useState<Row[] | null>(null);
  const id = React.useMemo(() => normalizeRouteParam(rawId), [rawId]);

  React.useEffect(() => {
    if (!id) {
      setData([]);
      return;
    }

    fetch(`${API_BASE}/sessions/${id}/input-list`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData([]));
  }, [id]);

  if (!data) {
    return <Text style={{ padding: 16 }}>Cargando…</Text>;
  }

  if (!id) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
          Input List — HQ
        </Text>
        <Text style={{ marginBottom: 16 }}>Sesion no encontrada.</Text>
        <Link href="/">Volver</Link>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
        Input List — HQ
      </Text>

      {data.map((r) => (
        <View
          key={r.id}
          style={{ borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 8 }}
        >
          <Text>
            #{r.ch} · {r.source} · {r.micDi}
          </Text>
          <Text>
            Preamp: {r.preamp} · IF: {r.interfaceChan} · DAW: {r.dawCh}
          </Text>
        </View>
      ))}

      <Link href="/">Volver</Link>
    </ScrollView>
  );
}
