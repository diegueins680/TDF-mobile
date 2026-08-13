import { View, StyleSheet } from 'react-native';
import { useAppTheme } from '../../theme/ThemeProvider';

export function EventCardSkeleton() {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
      {/* Image placeholder */}
      <View style={[styles.image, { backgroundColor: colors.canvas }]} />
      {/* Content */}
      <View style={styles.content}>
        <View style={[styles.line, styles.titleLine, { backgroundColor: colors.canvas }]} />
        <View style={[styles.line, styles.dateLine, { backgroundColor: colors.canvas }]} />
        <View style={[styles.line, styles.venueLine, { backgroundColor: colors.canvas }]} />
        <View style={styles.footer}>
          <View style={[styles.line, styles.priceLine, { backgroundColor: colors.canvas }]} />
          <View style={[styles.button, { backgroundColor: colors.canvas }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, marginBottom: 12 },
  image: { height: 160, width: '100%' },
  content: { padding: 12 },
  line: { height: 14, borderRadius: 4, marginBottom: 8 },
  titleLine: { width: '70%', height: 18 },
  dateLine: { width: '50%' },
  venueLine: { width: '40%' },
  priceLine: { width: '30%' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  button: { width: 80, height: 32, borderRadius: 8 },
});
