import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { type Href, Stack, useRouter } from 'expo-router';

import { DDEX_ERROR_STATUSES, DDEX_PENDING_STATUSES, listDdexDocuments } from '../../src/api/ddex';
import { FeatureAccessNotice } from '../../src/components/FeatureAccessNotice';
import { evaluateFeatureAccess } from '../../src/features/featureRegistry';
import { useAnalytics } from '../../src/analytics/AnalyticsProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { useUserSettings } from '../../src/providers/UserSettingsProvider';
import { useAppTheme } from '../../src/theme/ThemeProvider';

const STATUS_LABELS: Record<string, { es: string; en: string }> = {
  received: { es: 'Recibido', en: 'Received' },
  queued: { es: 'Pendiente', en: 'Queued' },
  validating: { es: 'Validando', en: 'Validating' },
  invalid: { es: 'Inválido', en: 'Invalid' },
  valid: { es: 'Válido', en: 'Valid' },
  mapping_required: { es: 'Requiere mapeo', en: 'Mapping required' },
  ready_to_import: { es: 'Listo para importar', en: 'Ready to import' },
  importing: { es: 'Importando', en: 'Importing' },
  imported: { es: 'Importado', en: 'Imported' },
  import_failed: { es: 'Importación fallida', en: 'Import failed' },
  quarantined: { es: 'En cuarentena', en: 'Quarantined' },
};

export default function DdexInboxScreen() {
  const router = useRouter();
  const analytics = useAnalytics();
  const { token, roles, modules } = useAuth();
  const { locale } = useUserSettings();
  const { colors } = useAppTheme();
  const [status, setStatus] = useState<string | undefined>();
  const english = locale.startsWith('en');
  const access = evaluateFeatureAccess('label.ddex.inbox', { authenticated: Boolean(token), roles, modules }, 'view');
  const importAccess = evaluateFeatureAccess('label.ddex.inbox', { authenticated: Boolean(token), roles, modules }, 'import');
  const partnersAccess = evaluateFeatureAccess('label.ddex.partners', { authenticated: Boolean(token), roles, modules }, 'view');
  const query = useQuery({
    queryKey: ['ddex-documents', status ?? 'all'],
    queryFn: () => listDdexDocuments(status),
    enabled: access.state === 'allowed',
  });

  const counts = useMemo(() => {
    const documents = query.data ?? [];
    return {
      errors: documents.filter((document) => DDEX_ERROR_STATUSES.has(document.ddexDocumentStatus)).length,
      pending: documents.filter((document) => DDEX_PENDING_STATUSES.has(document.ddexDocumentStatus)).length,
    };
  }, [query.data]);

  if (access.state !== 'allowed') return <FeatureAccessNotice decision={access} locale={locale} />;

  const filters = [undefined, 'invalid', 'import_failed', 'ready_to_import', 'imported'] as const;
  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <Stack.Screen options={{ headerShown: true, title: english ? 'DDEX / Inbox' : 'DDEX / Bandeja' }} />
      <View style={styles.header}>
        <View style={styles.headingRow}>
          <View style={styles.headingText}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>DDEX / {english ? 'Inbox' : 'Bandeja'}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {english ? 'Validation and import status without unauthorized counts.' : 'Estado de validación e importación sin conteos no autorizados.'}
            </Text>
          </View>
          {partnersAccess.state !== 'concealed' ? (
            <TouchableOpacity
              accessibilityLabel="DDEX Partners"
              accessibilityRole="button"
              onPress={() => partnersAccess.state === 'allowed'
                ? router.push('/ddex/partners' as Href)
                : router.push({ pathname: '/access-requests/new', params: { feature: 'label.ddex.partners', action: 'view' } } as Href)}
              style={[styles.iconButton, { borderColor: colors.border }]}
            >
              <MaterialCommunityIcons name={partnersAccess.state === 'allowed' ? 'account-multiple-outline' : 'lock-outline'} size={23} color={colors.actionPrimary} />
            </TouchableOpacity>
          ) : null}
        </View>
        <View accessibilityRole="summary" style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: colors.dangerSurface, borderColor: colors.dangerBorder }]}>
            <Text style={[styles.badgeText, { color: colors.danger }]}>{counts.errors} {english ? 'errors' : 'errores'}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.warningSurface, borderColor: colors.warningBorder }]}>
            <Text style={[styles.badgeText, { color: colors.textPrimary }]}>{counts.pending} {english ? 'pending' : 'pendientes'}</Text>
          </View>
        </View>
        <View style={[styles.notice, { backgroundColor: colors.infoSurface, borderColor: colors.infoBorder }]}>
          <MaterialCommunityIcons name="information-outline" size={20} color={colors.textPrimary} />
          <Text style={[styles.noticeText, { color: colors.textPrimary }]}>
            {importAccess.state === 'locked'
              ? (english ? 'Import requires additional access. Use Request access.' : 'Importar requiere acceso adicional. Usa Solicitar acceso.')
              : (english ? 'Import upload and commit remain beta and are disabled until private storage and transactional commit are complete.' : 'La carga y confirmación de importaciones sigue beta y está deshabilitada hasta completar almacenamiento privado y confirmación transaccional.')}
          </Text>
        </View>
        {importAccess.state === 'locked' ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/access-requests/new', params: { feature: 'label.ddex.inbox', action: 'import' } } as Href)}
            style={[styles.requestButton, { borderColor: colors.actionPrimary }]}
          >
            <Text style={[styles.requestText, { color: colors.actionPrimary }]}>{english ? 'Request import access' : 'Solicitar acceso para importar'}</Text>
          </TouchableOpacity>
        ) : null}
        <View style={styles.filters} accessibilityRole="toolbar">
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter ?? 'all'}
              accessibilityRole="button"
              accessibilityState={{ selected: status === filter }}
              onPress={() => setStatus(filter)}
              style={[styles.filter, { borderColor: colors.border, backgroundColor: status === filter ? colors.selected : colors.surface }]}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
                {filter ? (STATUS_LABELS[filter]?.[english ? 'en' : 'es'] ?? filter) : (english ? 'All' : 'Todos')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {query.isLoading ? <ActivityIndicator style={styles.loader} color={colors.actionPrimary} accessibilityLabel="Cargando DDEX" /> : null}
      {query.isError ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>
          {english ? 'DDEX documents could not be loaded.' : 'No se pudieron cargar los documentos DDEX.'}
        </Text>
      ) : null}
      <FlatList
        contentContainerStyle={styles.list}
        data={query.data ?? []}
        keyExtractor={(document) => String(document.ddexDocumentId)}
        refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={() => void query.refetch()} />}
        ListEmptyComponent={!query.isLoading ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>{english ? 'No DDEX documents.' : 'No hay documentos DDEX.'}</Text>
        ) : null}
        renderItem={({ item }) => {
          const isError = DDEX_ERROR_STATUSES.has(item.ddexDocumentStatus);
          return (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`${item.ddexDocumentFileName}, ${STATUS_LABELS[item.ddexDocumentStatus]?.[english ? 'en' : 'es'] ?? item.ddexDocumentStatus}`}
              onPress={() => {
                analytics.capture('feature_navigation_selected', { feature_id: 'label.ddex.document', platform: 'mobile', source: 'ddex_inbox' });
                router.push(`/ddex/document/${item.ddexDocumentId}` as Href);
              }}
              style={[styles.document, { backgroundColor: colors.surface, borderColor: isError ? colors.dangerBorder : colors.border }]}
            >
              <MaterialCommunityIcons name={isError ? 'alert-circle-outline' : 'file-xml-box'} size={25} color={isError ? colors.danger : colors.actionPrimary} />
              <View style={styles.documentText}>
                <Text numberOfLines={1} style={[styles.fileName, { color: colors.textPrimary }]}>{item.ddexDocumentFileName}</Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  {item.ddexDocumentFamily} · {item.ddexDocumentVersion} · {STATUS_LABELS[item.ddexDocumentStatus]?.[english ? 'en' : 'es'] ?? item.ddexDocumentStatus}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 18, gap: 12 },
  headingRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  headingText: { flex: 1 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  iconButton: { width: 48, height: 48, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { minHeight: 36, borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontWeight: '800' },
  notice: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: 'row', gap: 9 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18 },
  requestButton: { minHeight: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  requestText: { fontWeight: '800' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filter: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  loader: { flex: 1 },
  error: { paddingHorizontal: 18, paddingVertical: 14, fontWeight: '700' },
  list: { paddingHorizontal: 18, paddingBottom: 28 },
  document: { minHeight: 68, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 12 },
  documentText: { flex: 1, gap: 4 },
  fileName: { fontSize: 15, fontWeight: '800' },
  meta: { fontSize: 12, lineHeight: 17 },
  empty: { textAlign: 'center', paddingVertical: 42 },
});
