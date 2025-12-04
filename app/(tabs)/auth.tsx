import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../../src/providers/AuthProvider';

const DEMO_TOKENS = [
  'admin-token',
  'manager-token',
  'reception-token',
  'accounting-token',
  'scheduling-token',
  'packages-token'
];

export default function AuthScreen() {
  const { token, loading, setToken, clearToken } = useAuth();
  const [input, setInput] = useState(token ?? '');

  const masked = useMemo(() => {
    if (!token) return null;
    if (token.length <= 6) return token;
    return `${token.slice(0, 4)}•••${token.slice(-2)}`;
  }, [token]);

  const save = () => {
    const trimmed = input.trim();
    if (!trimmed) {
      Alert.alert('Token vacío', 'Pega un token Bearer válido.');
      return;
    }
    setToken(trimmed.toLowerCase().startsWith('bearer ') ? trimmed : `Bearer ${trimmed}`);
    Alert.alert('Listo', 'Token guardado. Las secciones protegidas usarán este token.');
  };

  if (loading) {
    return (
      <View style={styles.page}>
        <Text style={styles.subtitle}>Cargando credenciales…</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Autenticación</Text>
      <Text style={styles.subtitle}>
        Pega tu token Bearer para acceder a secciones protegidas (inventario, bookings, pipelines).
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Token API</Text>
        <TextInput
          placeholder="Bearer xxx…"
          value={input}
          onChangeText={setInput}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.primaryBtn} onPress={save}>
          <Text style={styles.primaryText}>Guardar token</Text>
        </TouchableOpacity>
        {token ? (
          <TouchableOpacity style={styles.ghostBtn} onPress={clearToken}>
            <Text style={styles.ghostText}>Eliminar token (cerrar sesión)</Text>
          </TouchableOpacity>
        ) : null}
        {masked ? (
          <Text style={styles.meta}>Token activo: {masked}</Text>
        ) : (
          <Text style={styles.meta}>No hay token activo.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Tokens de demo</Text>
        <Text style={styles.meta}>Úsalos solo en entornos de prueba.</Text>
        <View style={styles.tokenList}>
          {DEMO_TOKENS.map((tkn) => (
            <TouchableOpacity
              key={tkn}
              style={styles.pill}
              onPress={() => {
                const bearer = `Bearer ${tkn}`;
                setInput(bearer);
                setToken(bearer);
                Alert.alert('Token aplicado', `${tkn} activado.`);
              }}
            >
              <Text style={styles.pillText}>{tkn}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f8fafc', padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  subtitle: { color: '#475569', lineHeight: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  primaryBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  ghostBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  ghostText: { color: '#0f172a', fontWeight: '600' },
  meta: { color: '#475569' },
  tokenList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#e0f2fe'
  },
  pillText: { color: '#0f172a', fontWeight: '600' }
});
