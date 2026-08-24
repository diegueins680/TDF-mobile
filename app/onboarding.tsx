import { useEffect, useRef, type ComponentType } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useAnalytics } from '../src/analytics/AnalyticsProvider';
import { setOnboardingSeen } from '../src/lib/onboarding';
import { useUserSettings } from '../src/providers/UserSettingsProvider';
import { onboardingCopy, onboardingLanguage } from '../src/localization/onboardingCopy';

const AnimatedView = Animated.createAnimatedComponent(View) as ComponentType<Animated.AnimatedProps<ViewProps>>;

export default function OnboardingScreen() {
  const router = useRouter();
  const analytics = useAnalytics();
  const { locale, getCatalogItems, setRegionalPreferences } = useUserSettings();
  const language = onboardingLanguage(locale);
  const copy = onboardingCopy[language];
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const entryLanguage = useRef(language).current;

  useEffect(() => {
    analytics.capture('onboarding_viewed', { platform: 'mobile', locale: entryLanguage });
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!active) return;
      if (reduceMotion) {
        fadeAnim.setValue(1);
        return;
      }
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    });
    return () => {
      active = false;
      fadeAnim.stopAnimation();
    };
  }, [analytics, entryLanguage, fadeAnim]);

  const complete = (path: Href, action: 'create_account' | 'login') => {
    analytics.capture('onboarding_primary_clicked', { platform: 'mobile', action });
    if (action === 'login') analytics.capture('onboarding_skipped', { platform: 'mobile', reason: 'existing_account' });
    void setOnboardingSeen(true);
    router.replace(path);
  };

  const chooseLanguage = (code: 'es' | 'en') => {
    const option = getCatalogItems('locales').find((item) => item.code === code);
    if (option) setRegionalPreferences({ localeId: option.id });
  };

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar style="light" />
      <ScrollView testID="onboardingScroll" contentContainerStyle={styles.content}>
        <View testID="onboardingPanel" style={styles.panel}>
          <View style={styles.languageRow} accessibilityRole="radiogroup">
            {(['es', 'en'] as const).map((code) => (
              <TouchableOpacity
                key={code}
                accessibilityRole="radio"
                accessibilityState={{ selected: language === code }}
                onPress={() => chooseLanguage(code)}
                style={[styles.languageButton, language === code && styles.languageButtonActive]}
              >
                <Text style={[styles.languageText, language === code && styles.languageTextActive]}>
                  {code === 'es' ? 'Español' : 'English'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <AnimatedView
            style={[
              styles.hero,
              {
                opacity: fadeAnim,
                transform: [{
                  translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
                }],
              },
            ]}
          >
            <Text style={styles.kicker}>{copy.kicker}</Text>
            <Text accessibilityRole="header" style={styles.title}>{copy.title}</Text>
            <Text style={styles.subtitle}>{copy.subtitle}</Text>
          </AnimatedView>

          <View style={styles.valueCard}>
            <Text style={styles.valueTitle}>{copy.proofTitle}</Text>
            <Text style={styles.valueBody}>{copy.proofBody}</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              testID="goToLoginButton"
              style={styles.primaryButton}
              onPress={() => complete({ pathname: '/auth', params: { mode: 'signup', intent: 'events' } }, 'create_account')}
              accessibilityRole="button"
              accessibilityLabel={copy.create}
            >
              <Text style={styles.primaryText}>{copy.create}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => complete('/auth', 'login')}
              accessibilityRole="button"
              accessibilityLabel={copy.login}
            >
              <Text style={styles.secondaryText}>{copy.login}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0b1220' },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: Platform.select({ web: 44, default: 20 }),
  },
  panel: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    marginVertical: 'auto',
    gap: 18,
  },
  languageRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  languageButton: {
    minHeight: 44,
    minWidth: 76,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#64748b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageButtonActive: { backgroundColor: '#1d4ed8', borderColor: '#60a5fa' },
  languageText: { color: '#cbd5e1', fontWeight: '700' },
  languageTextActive: { color: '#ffffff' },
  hero: { gap: 12, paddingVertical: 8 },
  kicker: { color: '#93c5fd', fontSize: 13, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#f8fafc', fontSize: 32, lineHeight: 38, fontWeight: '900' },
  subtitle: { color: '#cbd5e1', fontSize: 17, lineHeight: 25 },
  valueCard: {
    gap: 8,
    padding: 18,
    borderRadius: 14,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#334155',
  },
  valueTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '800' },
  valueBody: { color: '#cbd5e1', lineHeight: 21 },
  actions: { gap: 10, paddingTop: 6 },
  primaryButton: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
  },
  primaryText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#64748b',
    paddingHorizontal: 16,
  },
  secondaryText: { color: '#f8fafc', fontSize: 15, fontWeight: '700' },
});
