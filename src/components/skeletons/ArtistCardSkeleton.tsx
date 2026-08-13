import { View, StyleSheet } from 'react-native';
import { useAppTheme } from '../../theme/ThemeProvider';

export function ArtistCardSkeleton() {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
      {/* Avatar placeholder */}
      <View style={[styles.avatar, { backgroundColor: colors.canvas }]} />
      {/* Content */}
      <View style={styles.content}>
        <View style={[styles.line, styles.nameLine, { backgroundColor: colors.canvas }]} />
        <View style={[styles.line, styles.bioLine1, { backgroundColor: colors.canvas }]} />
        <View style={[styles.line, styles.bioLine2, { backgroundColor: colors.canvas }]} />
      </View>
    </View>
  );
}

export function ArtistDetailSkeleton() {
  const { colors } = useAppTheme();
  return (
    <View style={styles.detailContainer}>
      {/* Hero image placeholder */}
      <View style={[styles.heroImage, { backgroundColor: colors.canvas }]} />
      {/* Name */}
      <View style={[styles.line, styles.nameLine, { backgroundColor: colors.canvas }]} />
      {/* Bio lines */}
      <View style={[styles.line, styles.bioLine1, { backgroundColor: colors.canvas }]} />
      <View style={[styles.line, styles.bioLine2, { backgroundColor: colors.canvas }]} />
      {/* Genre tags */}
      <View style={styles.genresRow}>
        <View style={[styles.genreTag, { backgroundColor: colors.canvas }]} />
        <View style={[styles.genreTag, styles.genreTagWide, { backgroundColor: colors.canvas }]} />
        <View style={[styles.genreTag, { backgroundColor: colors.canvas }]} />
      </View>
      {/* Action buttons */}
      <View style={styles.buttonsRow}>
        <View style={[styles.buttonPlaceholder, { backgroundColor: colors.canvas }]} />
        <View style={[styles.buttonPlaceholder, styles.buttonPlaceholderWide, { backgroundColor: colors.canvas }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 12 },
  content: { flex: 1 },
  detailContainer: { paddingHorizontal: 16, paddingVertical: 16 },
  heroImage: { height: 240, width: '100%', borderRadius: 12, marginBottom: 16 },
  line: { height: 14, borderRadius: 4, marginBottom: 8 },
  nameLine: { width: '50%', height: 20, marginBottom: 10 },
  bioLine1: { width: '90%' },
  bioLine2: { width: '60%' },
  genresRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 16 },
  genreTag: { width: 70, height: 28, borderRadius: 16 },
  genreTagWide: { width: 90 },
  buttonsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  buttonPlaceholder: { height: 44, borderRadius: 8, flex: 1 },
  buttonPlaceholderWide: { flex: 2 },
});
