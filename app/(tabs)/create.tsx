import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { palette, radii } from '../../src/theme/designTokens';
import { QUICK_ACTIONS } from '../../src/navigation/menu';

const typography = {
  sizes: {
    md: 15,
    lg: 18,
  },
  weights: {
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export default function CreateSheet() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Accesos rápidos</Text>
        {QUICK_ACTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.label}
            style={styles.option}
            onPress={() => router.push(opt.route)}
            activeOpacity={0.7}
          >
            <View style={styles.iconBox}>
              <MaterialCommunityIcons name={opt.icon} size={22} color={palette.primary} />
            </View>
            <Text style={styles.optionLabel}>{opt.label}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={palette.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: palette.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#e4e4e7',
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: palette.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.surface,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: '#f5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: '#27272a',
  },
});
