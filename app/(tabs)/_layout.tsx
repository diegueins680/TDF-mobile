import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const { width, fontScale } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const measurementKey = `${width}:${fontScale}:${language}:${authenticated}`;
  const [measurement, setMeasurement] = useState({ key: '', height: 0 });
  const measureLabel = useCallback((height: number) => {
    if (!Number.isFinite(height) || height <= 0) return;
    setMeasurement(previous => {
      const previousHeight = previous.key === measurementKey ? previous.height : 0;
      return previous.key === measurementKey && previousHeight >= height
        ? previous
        : { key: measurementKey, height: Math.max(previousHeight, height) };
    });
  }, [measurementKey]);
  const labelHeight = Math.max(14 * fontScale, measurement.key === measurementKey ? measurement.height : 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.actionPrimary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: Math.max(49, Math.ceil(40 + labelHeight)) + bottom,
        },
        tabBarLabelPosition: 'below-icon',
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
            tabBarLabel: ({ color }) => (
              <Text
                accessible={false}
                allowFontScaling
                style={{ color, fontSize: 12, lineHeight: 14, fontWeight: '600', textAlign: 'center', width: '100%', flexShrink: 0 }}
                onTextLayout={({ nativeEvent }) => measureLabel(nativeEvent.lines.reduce(
                  (height, line) => Math.max(height, line.y + line.height), 0,
                ))}
              >
                {tab.title}
              </Text>
            ),
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
