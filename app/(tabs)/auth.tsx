import { View, Text, StyleSheet } from 'react-native';

export default function AuthScreen() {
  return (
    <View style={styles.page}>
      <Text style={styles.title}>Acceso</Text>
      <Text style={styles.subtitle}>
        El acceso se gestiona fuera de la app móvil. Si necesitas permisos, contacta al equipo de operaciones.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f8fafc', padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  subtitle: { color: '#475569', lineHeight: 20 }
});
