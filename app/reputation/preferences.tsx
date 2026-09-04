import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { CategoryPriorityList } from '../../src/components/reputation/CategoryPriorityList';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import { useUserSettings } from '../../src/providers/UserSettingsProvider';

export default function ReputationPreferencesScreen() {
  const { colors } = useAppTheme();
  const { locale } = useUserSettings();
  const selectedLocale = locale.startsWith('en') ? 'en' : 'es';
  return <ScrollView contentContainerStyle={[styles.page, { backgroundColor: colors.canvas }]}>
    <Stack.Screen options={{ headerShown: true, title: selectedLocale === 'en' ? 'Your priorities' : 'Tus prioridades' }} />
    <View><Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{selectedLocale === 'en' ? 'What matters most to you?' : '¿Qué es más importante para ti?'}</Text><CategoryPriorityList locale={selectedLocale} /></View>
  </ScrollView>;
}

const styles = StyleSheet.create({ page: { flexGrow: 1, padding: 20 }, title: { fontSize: 24, fontWeight: '800', marginBottom: 12 } });
