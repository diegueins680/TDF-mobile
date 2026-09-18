import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Platform, View } from 'react-native';

import { NewUserOnboardingGate } from '../../src/experiments/NewUserOnboardingGate';
import { HIDDEN_INTERNAL_TABS, NEW_USER_VISIBLE_TABS, getVisibleMobileTabs, mobileTabAccessibilityLabel } from '../../src/navigation/mobileSurface';
import { useUserSettings } from '../../src/providers/UserSettingsProvider';
import { onboardingLanguage } from '../../src/localization/onboardingCopy';
import { t } from '../../src/i18n';
import { useAuth } from '../../src/providers/AuthProvider';
import { useAppTheme } from '../../src/theme/ThemeProvider';

type MaterialCommunityIconName = keyof typeof MaterialCommunityIcons.glyphMap;

export default function TabsLayout() {
  const { locale } = useUserSettings();
  const { token, loading } = useAuth();
  const { colors } = useAppTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.actionPrimary} accessibilityLabel={t('common.loadingSession', undefined, onboardingLanguage(locale))} />
      </View>
    );
  }

  return token?.trim() ? (
    <NewUserOnboardingGate>
      <TabsInner authenticated />
    </NewUserOnboardingGate>
  ) : (
    <TabsInner authenticated={false} />
  );
}

function TabsInner({ authenticated }: { authenticated: boolean }) {
  const { colors } = useAppTheme();
  const { locale } = useUserSettings();
  const language = onboardingLanguage(locale);
  const visibleTabs = getVisibleMobileTabs(language, authenticated);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.actionPrimary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      {visibleTabs.map((tab, index) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: mobileTabAccessibilityLabel(tab.title, index, visibleTabs.length, language, Platform.OS),
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons
                name={tab.icon as MaterialCommunityIconName}
                size={24}
                color={color}
              />
            )
          }}
        />
      ))}
      {!authenticated && NEW_USER_VISIBLE_TABS.filter((tab) => tab.name !== 'directory').map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ href: null }} />
      ))}
      {HIDDEN_INTERNAL_TABS.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}
