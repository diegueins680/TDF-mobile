import { useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';

import { useAnalytics } from '../../src/analytics/AnalyticsProvider';
import {
  evaluateFeatureAccess,
  featureLabel,
  resolveMobileDestination,
  type FeatureAction,
} from '../../src/features/featureRegistry';
import { mobileFeatureRegistry } from '../../src/features/generatedFeatureRegistry';
import { useAuth } from '../../src/providers/AuthProvider';
import { useUserSettings } from '../../src/providers/UserSettingsProvider';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import { recordFeatureVisit } from '../../src/api/navigationPreferences';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
const ICONS: Record<string, IconName> = {
  event: 'calendar-star',
  people: 'account-plus-outline',
  calendar: 'calendar-plus',
  releases: 'album',
  ddex: 'file-upload-outline',
};

export default function QuickCreateScreen() {
  const router = useRouter();
  const analytics = useAnalytics();
  const { token, roles, modules, featureFlags } = useAuth();
  const { locale } = useUserSettings();
  const { colors } = useAppTheme();

  const actions = useMemo(() => mobileFeatureRegistry.flatMap((feature) => {
    if (!feature.quickCreate) return [];
    const action = feature.quickCreate.action as FeatureAction;
    const decision = evaluateFeatureAccess(feature, {
      authenticated: Boolean(token), roles, modules, featureFlags,
    }, action);
    return decision.state === 'concealed' ? [] : [{ feature, action, decision }];
  }), [featureFlags, modules, roles, token]);

  const openAction = async (entry: (typeof actions)[number]) => {
    const { feature, action, decision } = entry;
    if (decision.state === 'locked') {
      analytics.capture('quick_create_locked_selected', { feature_id: feature.id, action, platform: 'mobile' });
      router.push({ pathname: '/access-requests/new', params: { feature: feature.id, action } } as Href);
      return;
    }

    const configured = feature.quickCreate?.mobileDestination;
    const destination = configured
      ? { kind: configured.startsWith('https://') ? 'web' as const : 'native' as const, value: configured }
      : resolveMobileDestination(feature);
    if (!destination) {
      analytics.capture('feature_destination_unresolved', { feature_id: feature.id, action, platform: 'mobile' });
      return;
    }
    analytics.capture('quick_create_selected', { feature_id: feature.id, action, platform: 'mobile' });
    void recordFeatureVisit(feature.id).catch(() => undefined);
    if (destination.kind === 'web') await Linking.openURL(destination.value);
    else router.push(destination.value as Href);
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.canvas }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
        {locale.startsWith('en') ? 'Quick create' : 'Creación rápida'}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {locale.startsWith('en')
          ? 'Only actions you can request or legitimately start are shown.'
          : 'Solo se muestran acciones que puedes solicitar o iniciar legítimamente.'}
      </Text>
      <View style={styles.actions}>
        {actions.map((entry) => {
          const locked = entry.decision.state === 'locked';
          return (
            <TouchableOpacity
              key={`${entry.feature.id}:${entry.action}`}
              accessibilityRole="button"
              accessibilityLabel={`${featureLabel(entry.feature, locale)}${locked ? (locale.startsWith('en') ? ', locked' : ', bloqueada') : ''}`}
              accessibilityHint={locked
                ? (locale.startsWith('en') ? 'Opens an internal access request' : 'Abre una solicitud interna de acceso')
                : (locale.startsWith('en') ? 'Starts this action' : 'Inicia esta acción')}
              onPress={() => void openAction(entry)}
              style={[styles.action, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.icon, { backgroundColor: colors.selected }]}>
                <MaterialCommunityIcons
                  name={ICONS[entry.feature.icon] ?? 'plus-circle-outline'}
                  size={26}
                  color={locked ? colors.textSecondary : colors.actionPrimary}
                />
              </View>
              <View style={styles.text}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>
                  {entry.feature.quickCreate?.label[locale.startsWith('en') ? 'en' : 'es'] ?? featureLabel(entry.feature, locale)}
                </Text>
                <Text style={[styles.detail, { color: colors.textSecondary }]}>
                  {locked
                    ? (locale.startsWith('en') ? 'Permission required · Request access' : 'Permiso requerido · Solicitar acceso')
                    : entry.feature.description[locale.startsWith('en') ? 'en' : 'es']}
                </Text>
              </View>
              <MaterialCommunityIcons name={locked ? 'lock-outline' : 'chevron-right'} size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingBottom: 36 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  actions: { marginTop: 20, gap: 10 },
  action: { minHeight: 72, borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 3 },
  label: { fontSize: 16, fontWeight: '700' },
  detail: { fontSize: 13, lineHeight: 18 },
});
