import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAnalytics } from '../../src/analytics/AnalyticsProvider';
import {
  evaluateFeatureAccess,
  featureLabel,
  resolveMobileDestination,
  searchFeatures,
  type FeatureAccessDecision,
  type MobileFeature,
} from '../../src/features/featureRegistry';
import { mobileFeatureGroups, mobileFeatureRegistry } from '../../src/features/generatedFeatureRegistry';
import { useAuth } from '../../src/providers/AuthProvider';
import { useUserSettings } from '../../src/providers/UserSettingsProvider';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import {
  listNavigationPreferences,
  recordFeatureVisit,
  updateNavigationPreference,
  type NavigationPreference,
} from '../../src/api/navigationPreferences';

type MaterialIconName = keyof typeof MaterialCommunityIcons.glyphMap;

const ICONS: Record<string, MaterialIconName> = {
  home: 'home-outline',
  people: 'account-group-outline',
  person: 'account-outline',
  badge: 'card-account-details-outline',
  instagram: 'instagram',
  inbox: 'inbox-outline',
  event: 'calendar-star',
  calendar: 'calendar-month-outline',
  inventory: 'package-variant-closed',
  ddex: 'file-xml-box',
  help: 'help-circle-outline',
  settings: 'cog-outline',
  lock: 'lock-outline',
};

const groupLabel = (groupId: string | null, locale: string): string => {
  const group = mobileFeatureGroups.find((entry) => entry.id === groupId);
  if (!group) return locale.startsWith('en') ? 'Other' : 'Otros';
  return locale.startsWith('en') ? group.labelEn : group.labelEs;
};

type FeatureSection = { title: string; data: FeatureAccessDecision[] };

export default function FeatureExplorerScreen() {
  const router = useRouter();
  const analytics = useAnalytics();
  const { token, roles, modules, featureFlags, loading } = useAuth();
  const { locale } = useUserSettings();
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const preferencesQuery = useQuery({
    queryKey: ['navigation-preferences'],
    queryFn: listNavigationPreferences,
    enabled: Boolean(token),
    staleTime: 30_000,
  });
  const preferenceMap = useMemo(
    () => new Map((preferencesQuery.data ?? []).map((preference) => [preference.featureId, preference])),
    [preferencesQuery.data],
  );
  const updatePreference = useMutation({
    mutationFn: ({ featureId, favorite, pinned, pinOrder }: NavigationPreference) =>
      updateNavigationPreference(featureId, { favorite, pinned, pinOrder }),
    onSuccess: (preference) => queryClient.setQueryData<NavigationPreference[]>(['navigation-preferences'], (current = []) => [
      preference,
      ...current.filter((entry) => entry.featureId !== preference.featureId),
    ]),
  });
  const recordVisit = useMutation({
    mutationFn: recordFeatureVisit,
    onSuccess: (preference) => queryClient.setQueryData<NavigationPreference[]>(['navigation-preferences'], (current = []) => [
      preference,
      ...current.filter((entry) => entry.featureId !== preference.featureId),
    ]),
  });

  const decisions = useMemo(() => {
    const candidates = searchFeatures(query, mobileFeatureRegistry).filter((feature) =>
      (feature.globalMenu || feature.id === 'social.vcard') && resolveMobileDestination(feature) !== null,
    );
    return candidates.flatMap((feature) => {
      const decision = evaluateFeatureAccess(feature, {
        authenticated: Boolean(token),
        roles,
        modules,
        featureFlags,
      }, 'discover');
      return decision.state === 'concealed' ? [] : [decision];
    });
  }, [featureFlags, modules, query, roles, token]);

  const sections = useMemo<FeatureSection[]>(() => {
    const byGroup = new Map<string, FeatureAccessDecision[]>();
    decisions.forEach((decision) => {
      const key = decision.feature.navigationGroup ?? 'other';
      byGroup.set(key, [...(byGroup.get(key) ?? []), decision]);
    });
    return mobileFeatureGroups.flatMap((group) => {
      const data = (byGroup.get(group.id) ?? []).sort((left, right) => {
        const leftPreference = preferenceMap.get(left.feature.id);
        const rightPreference = preferenceMap.get(right.feature.id);
        const rank = (preference: NavigationPreference | undefined) => preference?.pinned ? 3 : preference?.favorite ? 2 : preference?.lastVisitedAt ? 1 : 0;
        return rank(rightPreference) - rank(leftPreference)
          || (leftPreference?.pinOrder ?? 0) - (rightPreference?.pinOrder ?? 0)
          || (rightPreference?.lastVisitedAt ?? '').localeCompare(leftPreference?.lastVisitedAt ?? '');
      });
      return data.length > 0 ? [{ title: groupLabel(group.id, locale), data }] : [];
    });
  }, [decisions, locale, preferenceMap]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length >= 3 && decisions.length === 0) {
      analytics.capture('feature_search_no_results', {
        platform: 'mobile',
        locale: locale.startsWith('en') ? 'en' : 'es',
        query_length: trimmed.length,
      });
    }
  }, [analytics, decisions.length, locale, query]);

  const openDecision = async (decision: FeatureAccessDecision) => {
    const feature = decision.feature;
    if (decision.state === 'locked') {
      analytics.capture('locked_feature_selected', { feature_id: feature.id, action: 'view', platform: 'mobile' });
      router.push({ pathname: '/access-requests/new', params: { feature: feature.id, action: 'view' } } as Href);
      return;
    }

    const destination = resolveMobileDestination(feature);
    if (!destination) {
      analytics.capture('feature_destination_unresolved', { feature_id: feature.id, platform: 'mobile' });
      return;
    }
    analytics.capture('feature_navigation_selected', {
      feature_id: feature.id,
      platform: 'mobile',
      destination_kind: destination.kind,
    });
    recordVisit.mutate(feature.id);
    if (destination.kind === 'web') {
      await Linking.openURL(destination.value);
    } else {
      router.push(destination.value as Href);
    }
  };

  const togglePreference = (feature: MobileFeature, kind: 'favorite' | 'pinned') => {
    const current = preferenceMap.get(feature.id);
    const pinned = (preferencesQuery.data ?? []).filter((preference) => preference.pinned);
    const next: NavigationPreference = {
      featureId: feature.id,
      favorite: kind === 'favorite' ? !current?.favorite : Boolean(current?.favorite),
      pinned: kind === 'pinned' ? !current?.pinned : Boolean(current?.pinned),
      pinOrder: kind === 'pinned' && !current?.pinned
        ? Math.max(-1, ...pinned.map((preference) => preference.pinOrder ?? 0)) + 1
        : current?.pinned ? current.pinOrder ?? 0 : null,
      lastVisitedAt: current?.lastVisitedAt ?? null,
      useCount: current?.useCount ?? 0,
      updatedAt: current?.updatedAt ?? '',
    };
    if (!next.pinned) next.pinOrder = null;
    updatePreference.mutate(next);
    analytics.capture(kind === 'favorite' ? 'feature_favorite_changed' : 'feature_pin_changed', {
      feature_id: feature.id,
      enabled: kind === 'favorite' ? next.favorite : next.pinned,
      platform: 'mobile',
    });
  };

  if (loading) {
    return <ActivityIndicator style={styles.loader} color={colors.actionPrimary} accessibilityLabel="Cargando funciones" />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
          {locale.startsWith('en') ? 'Explore' : 'Explorar'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {locale.startsWith('en')
            ? 'Your authorized features, web tools, and access requests.'
            : 'Tus funciones autorizadas, herramientas web y solicitudes de acceso.'}
        </Text>
        <TextInput
          accessibilityLabel={locale.startsWith('en') ? 'Search features' : 'Buscar funciones'}
          clearButtonMode="while-editing"
          onChangeText={setQuery}
          placeholder={locale.startsWith('en') ? 'Search in English or Spanish' : 'Buscar en español o inglés'}
          placeholderTextColor={colors.textSecondary}
          returnKeyType="search"
          style={[styles.search, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
          value={query}
        />
        <Text accessibilityLiveRegion="polite" style={styles.srSummary}>
          {decisions.length} {locale.startsWith('en') ? 'feature results' : 'resultados de funciones'}
        </Text>
      </View>
      <SectionList
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        sections={sections}
        keyExtractor={(item) => item.feature.id}
        renderSectionHeader={({ section }) => (
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textSecondary, backgroundColor: colors.canvas }]}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => {
          const feature = item.feature;
          const locked = item.state === 'locked';
          const preference = preferenceMap.get(feature.id);
          return (
            <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity
                accessibilityLabel={`${featureLabel(feature, locale)}${locked ? (locale.startsWith('en') ? ', locked' : ', bloqueada') : ''}`}
                accessibilityHint={locked
                  ? (locale.startsWith('en') ? 'Opens an access request without showing protected data' : 'Abre una solicitud de acceso sin mostrar datos protegidos')
                  : feature.description[locale.startsWith('en') ? 'en' : 'es']}
                accessibilityRole="button"
                onPress={() => void openDecision(item)}
                style={styles.rowMain}
              >
                <MaterialCommunityIcons name={ICONS[feature.icon] ?? 'apps'} size={24} color={locked ? colors.textSecondary : colors.actionPrimary} />
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{featureLabel(feature, locale)}</Text>
                  <Text numberOfLines={2} style={[styles.rowDescription, { color: colors.textSecondary }]}>
                    {locked ? (locale.startsWith('en') ? 'Access required · Request it internally' : 'Requiere acceso · Solicítalo internamente') : feature.description[locale.startsWith('en') ? 'en' : 'es']}
                  </Text>
                </View>
                <MaterialCommunityIcons name={locked ? 'lock-outline' : 'chevron-right'} size={22} color={colors.textSecondary} />
              </TouchableOpacity>
              {!locked && feature.favoriteEligible ? (
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${preference?.favorite ? 'Quitar favorito' : 'Favorito'} ${featureLabel(feature, locale)}`} onPress={() => togglePreference(feature, 'favorite')} style={styles.preferenceButton}>
                  <MaterialCommunityIcons name={preference?.favorite ? 'star' : 'star-outline'} size={22} color={colors.actionPrimary} />
                </TouchableOpacity>
              ) : null}
              {!locked && feature.pinEligible ? (
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${preference?.pinned ? 'Desfijar' : 'Fijar'} ${featureLabel(feature, locale)}`} onPress={() => togglePreference(feature, 'pinned')} style={styles.preferenceButton}>
                  <MaterialCommunityIcons name={preference?.pinned ? 'pin' : 'pin-outline'} size={22} color={colors.actionPrimary} />
                </TouchableOpacity>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={(
          <Text accessibilityLiveRegion="polite" style={[styles.empty, { color: colors.textSecondary }]}>
            {locale.startsWith('en') ? 'No safe feature results.' : 'No hay resultados de funciones seguras.'}
          </Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1 },
  heading: { paddingHorizontal: 18, paddingTop: 18, gap: 8 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 20 },
  search: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, marginTop: 4 },
  srSummary: { width: 1, height: 1, opacity: 0 },
  listContent: { paddingHorizontal: 18, paddingBottom: 32 },
  sectionTitle: { paddingTop: 18, paddingBottom: 7, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  row: { minHeight: 64, borderWidth: 1, borderRadius: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  rowMain: { flex: 1, minHeight: 64, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  preferenceButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 16, fontWeight: '700' },
  rowDescription: { fontSize: 13, lineHeight: 18 },
  empty: { paddingVertical: 40, textAlign: 'center', fontSize: 15 },
});
