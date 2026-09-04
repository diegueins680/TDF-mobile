import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Reputation, type ReputationCategory } from '../../api/reputation';
import { useAppTheme } from '../../theme/ThemeProvider';

export const rankOrderCentroid = (count: number): number[] => {
  if (count <= 0) return [];
  const values = Array.from({ length: Math.max(0, count - 1) }, (_, index) => {
    const rank = index + 1;
    return 100 * Array.from({ length: count - rank + 1 }, (_, offset) => 1 / (rank + offset)).reduce((total, value) => total + value, 0) / count;
  });
  return [...values, 100 - values.reduce((total, value) => total + value, 0)];
};

export function CategoryPriorityList({ locale = 'es' }: { locale?: 'es' | 'en' }) {
  const { colors } = useAppTheme();
  const categories = useQuery({ queryKey: ['reputation-categories', locale], queryFn: () => Reputation.categories(locale) });
  const [order, setOrder] = useState<ReputationCategory[]>([]);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => { if (categories.data && order.length === 0) setOrder(categories.data); }, [categories.data, order.length]);
  const weights = useMemo(() => rankOrderCentroid(order.length), [order.length]);
  const move = (index: number, delta: number) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= order.length) return;
    const next = [...order]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setOrder(next); setAnnouncement(`${next[nextIndex].name} ahora tiene prioridad ${nextIndex + 1}.`);
  };
  if (categories.isLoading) return <ActivityIndicator accessibilityLabel="Cargando categorías" color={colors.actionPrimary} />;
  if (categories.isError) return <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>No pudimos cargar las categorías. Inténtalo nuevamente.</Text>;
  return <View accessibilityLiveRegion="polite">
    <Text style={[styles.help, { color: colors.textSecondary }]}>Tu orden define compatibilidad personal; no modifica la reputación pública.</Text>
    <Text accessibilityRole="alert" style={styles.srOnly}>{announcement}</Text>
    {order.map((category, index) => <View key={category.id} style={[styles.card, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderSubtle }]}>
      <View style={styles.header}><Text style={[styles.position, { color: colors.textPrimary }]}>{index + 1}</Text><View style={styles.copy}><Text style={[styles.name, { color: colors.textPrimary }]}>{category.name}</Text><Text style={[styles.description, { color: colors.textSecondary }]}>{category.description}</Text></View><Text style={[styles.weight, { color: colors.actionPrimary }]}>{weights[index].toFixed(1)}%</Text></View>
      <View style={styles.actions}><Pressable accessibilityRole="button" accessibilityLabel={`Subir ${category.name}`} disabled={index === 0} onPress={() => move(index, -1)} style={({ pressed }) => [styles.button, { borderColor: colors.border }, (pressed || index === 0) && styles.muted]}><Text style={{ color: colors.textPrimary }}>Subir</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Bajar ${category.name}`} disabled={index === order.length - 1} onPress={() => move(index, 1)} style={({ pressed }) => [styles.button, { borderColor: colors.border }, (pressed || index === order.length - 1) && styles.muted]}><Text style={{ color: colors.textPrimary }}>Bajar</Text></Pressable></View>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({ help: { marginBottom: 12, lineHeight: 20 }, error: { padding: 12 }, card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginBottom: 10 }, header: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, position: { fontWeight: '800', minWidth: 18 }, copy: { flex: 1 }, name: { fontWeight: '700', fontSize: 16 }, description: { marginTop: 2, lineHeight: 18 }, weight: { fontWeight: '800' }, actions: { flexDirection: 'row', gap: 8, marginTop: 10 }, button: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }, muted: { opacity: 0.45 }, srOnly: { position: 'absolute', width: 1, height: 1, opacity: 0 } });
