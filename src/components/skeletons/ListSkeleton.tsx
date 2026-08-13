import { View, StyleSheet } from 'react-native';
import { useAppTheme } from '../../theme/ThemeProvider';

export function ListSkeleton({ rows = 5, hasAvatar = false }: { rows?: number; hasAvatar?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[styles.row, { borderBottomColor: colors.borderSubtle }]}>
          {hasAvatar && <View style={[styles.avatar, { backgroundColor: colors.canvas }]} />}
          <View style={styles.content}>
            <View style={[styles.line, styles.title, { backgroundColor: colors.canvas }]} />
            <View style={[styles.line, styles.subtitle, { backgroundColor: colors.canvas }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  content: { flex: 1 },
  line: { height: 14, borderRadius: 4, marginBottom: 6 },
  title: { width: '60%', height: 16 },
  subtitle: { width: '40%' },
});
