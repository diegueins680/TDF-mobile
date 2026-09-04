import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { CategoryPriorityList } from '../../src/components/reputation/CategoryPriorityList';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import { useUserSettings } from '../../src/providers/UserSettingsProvider';
import { useAuth } from '../../src/providers/AuthProvider';

export default function ReputationPreferencesScreen() {
  const { colors } = useAppTheme();
  const { locale } = useUserSettings();
  const { featureFlags } = useAuth();
  const selectedLocale = locale.startsWith('en') ? 'en' : 'es';
  const enabled = featureFlags.includes('CONTEXTUAL_REPUTATION_ENABLED');
  return <ScrollView contentContainerStyle={[styles.page, { backgroundColor: colors.canvas }]}>
    <Stack.Screen options={{ headerShown: true, title: selectedLocale === 'en' ? 'Your priorities' : 'Tus prioridades' }} />
    <View>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{selectedLocale === 'en' ? 'What matters most to you?' : '¿Qué es más importante para ti?'}</Text>
      {enabled
        ? <CategoryPriorityList locale={selectedLocale} />
        : <Text accessibilityRole="alert" style={[styles.unavailable, { color: colors.textSecondary }]}>{selectedLocale === 'en' ? 'This pilot is not available for your account yet.' : 'Este piloto todavía no está disponible para tu cuenta.'}</Text>}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({ page: { flexGrow: 1, padding: 20 }, title: { fontSize: 24, fontWeight: '800', marginBottom: 12 }, unavailable: { fontSize: 16, lineHeight: 22 } });
