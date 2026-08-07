import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Href, Stack, useRouter } from 'expo-router';

import { cancelAccessRequest, listMyAccessRequests } from '../../src/api/accessRequests';
import { getFeatureById, featureLabel, evaluateFeatureAccess } from '../../src/features/featureRegistry';
import { useAnalytics } from '../../src/analytics/AnalyticsProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { useUserSettings } from '../../src/providers/UserSettingsProvider';
import { useAppTheme } from '../../src/theme/ThemeProvider';

const STATUS: Record<string, { es: string; en: string }> = {
  pending: { es: 'Pendiente', en: 'Pending' }, approved: { es: 'Aprobada', en: 'Approved' },
  rejected: { es: 'Rechazada', en: 'Rejected' }, cancelled: { es: 'Cancelada', en: 'Cancelled' }, expired: { es: 'Expirada', en: 'Expired' },
};

export default function AccessRequestsScreen() {
  const router = useRouter();
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const { token, roles, modules } = useAuth();
  const { locale } = useUserSettings();
  const { colors } = useAppTheme();
  const english = locale.startsWith('en');
  const reviewAccess = evaluateFeatureAccess('access-requests.review', { authenticated: Boolean(token), roles, modules }, 'view');
  const requests = useQuery({ queryKey: ['access-requests', 'mine'], queryFn: listMyAccessRequests });
  const cancelRequest = useMutation({
    mutationFn: cancelAccessRequest,
    onSuccess: async (request) => {
      analytics.capture('feature_access_request_cancelled', { feature_id: request.featureId, feature_action: request.action, platform: 'mobile' });
      await queryClient.invalidateQueries({ queryKey: ['access-requests'] });
    },
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <Stack.Screen options={{ headerShown: true, title: english ? 'Access requests' : 'Solicitudes de acceso' }} />
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{english ? 'Access requests' : 'Solicitudes de acceso'}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {english ? 'Approval accepts a request for provisioning; it does not silently broaden roles or modules.' : 'La aprobación acepta la solicitud para provisión; no amplía roles ni módulos silenciosamente.'}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/access-requests/new' as Href)} style={[styles.primary, { backgroundColor: colors.actionPrimary }]}>
            <Text style={[styles.primaryText, { color: colors.actionPrimaryContrast }]}>{english ? 'New request' : 'Nueva solicitud'}</Text>
          </TouchableOpacity>
          {reviewAccess.state !== 'concealed' ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => reviewAccess.state === 'allowed'
                ? router.push('/access-requests/review' as Href)
                : router.push({ pathname: '/access-requests/new', params: { feature: 'access-requests.review', action: 'view' } } as Href)}
              style={[styles.secondary, { borderColor: colors.actionPrimary }]}
            >
              <Text style={[styles.secondaryText, { color: colors.actionPrimary }]}>{english ? 'Review' : 'Revisar'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {requests.isLoading ? <ActivityIndicator style={styles.loader} color={colors.actionPrimary} /> : null}
      {requests.isError || cancelRequest.isError ? <Text accessibilityRole="alert" style={[styles.alert, { color: colors.danger }]}>{english ? 'The request operation failed.' : 'La operación de solicitud falló.'}</Text> : null}
      <FlatList
        contentContainerStyle={styles.list}
        data={requests.data ?? []}
        keyExtractor={(request) => String(request.id)}
        ListEmptyComponent={!requests.isLoading ? <Text style={[styles.empty, { color: colors.textSecondary }]}>{english ? 'No access requests yet.' : 'Todavía no hay solicitudes.'}</Text> : null}
        renderItem={({ item }) => {
          const feature = getFeatureById(item.featureId);
          return (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitle}>
                  <Text style={[styles.feature, { color: colors.textPrimary }]}>{feature ? featureLabel(feature, locale) : (english ? 'Unavailable feature' : 'Función no disponible')}</Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>{item.action} · {new Date(item.requestedAt).toLocaleString(locale)}</Text>
                </View>
                <View style={[styles.status, { borderColor: colors.border }]}><Text style={{ color: colors.textPrimary, fontWeight: '800' }}>{STATUS[item.status]?.[english ? 'en' : 'es'] ?? item.status}</Text></View>
              </View>
              {item.justification ? <Text style={[styles.note, { color: colors.textPrimary }]}>{item.justification}</Text> : null}
              {item.reviewerNotes ? <Text style={[styles.reviewNote, { color: colors.textSecondary }]}>{item.reviewerNotes}</Text> : null}
              {item.status === 'pending' ? (
                <TouchableOpacity accessibilityRole="button" disabled={cancelRequest.isPending} onPress={() => cancelRequest.mutate(item.id)} style={styles.cancel}>
                  <Text style={{ color: colors.danger, fontWeight: '800' }}>{english ? 'Cancel request' : 'Cancelar solicitud'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, header: { padding: 20, gap: 10 }, title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 20 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  primary: { minHeight: 48, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' }, primaryText: { fontWeight: '800' },
  secondary: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' }, secondaryText: { fontWeight: '800' },
  loader: { flex: 1 }, alert: { paddingHorizontal: 20, fontWeight: '800' }, list: { paddingHorizontal: 20, paddingBottom: 36 },
  card: { borderWidth: 1, borderRadius: 13, padding: 14, marginBottom: 10, gap: 10 }, cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { flex: 1, gap: 3 }, feature: { fontSize: 16, fontWeight: '800' }, meta: { fontSize: 12 },
  status: { minHeight: 36, borderWidth: 1, borderRadius: 18, paddingHorizontal: 10, justifyContent: 'center' }, note: { fontSize: 14, lineHeight: 20 },
  reviewNote: { fontSize: 13, lineHeight: 18 }, cancel: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' }, empty: { textAlign: 'center', paddingVertical: 40 },
});
