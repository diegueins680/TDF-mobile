import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';

import { decideAccessRequest, listAccessRequestsForReview, type AccessRequest } from '../../src/api/accessRequests';
import { FeatureAccessNotice } from '../../src/components/FeatureAccessNotice';
import { evaluateFeatureAccess, featureLabel, getFeatureById } from '../../src/features/featureRegistry';
import { useAnalytics } from '../../src/analytics/AnalyticsProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { useUserSettings } from '../../src/providers/UserSettingsProvider';
import { useAppTheme } from '../../src/theme/ThemeProvider';

function ReviewCard({ request, locale }: { request: AccessRequest; locale: string }) {
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const { colors } = useAppTheme();
  const [notes, setNotes] = useState('');
  const english = locale.startsWith('en');
  const feature = getFeatureById(request.featureId);
  const mutation = useMutation({
    mutationFn: (decision: 'approved' | 'rejected') => decideAccessRequest(request.id, decision, notes.trim() || null),
    onSuccess: async (updated) => {
      analytics.capture('feature_access_request_reviewed', { feature_id: updated.featureId, feature_action: updated.action, decision: updated.status, platform: 'mobile' });
      await queryClient.invalidateQueries({ queryKey: ['access-requests', 'review'] });
    },
  });
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{feature ? featureLabel(feature, locale) : (english ? 'Unavailable feature' : 'Función no disponible')}</Text>
      <Text style={[styles.meta, { color: colors.textSecondary }]}>
        {english ? 'Request' : 'Solicitud'} #{request.id} · {request.action}
      </Text>
      <Text style={[styles.meta, { color: colors.textSecondary }]}>
        {english ? 'Context categories' : 'Categorías de contexto'}: {request.roleContext.length} {english ? 'role entries' : 'roles'}, {request.moduleContext.length} {english ? 'module entries' : 'módulos'}
      </Text>
      {request.justification ? <Text style={[styles.justification, { color: colors.textPrimary }]}>{request.justification}</Text> : null}
      <TextInput
        accessibilityLabel={english ? 'Reviewer notes' : 'Notas del revisor'}
        maxLength={2000}
        multiline
        onChangeText={setNotes}
        placeholder={english ? 'Reviewer note (required for rejection)' : 'Nota del revisor (obligatoria para rechazar)'}
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
        textAlignVertical="top"
        value={notes}
      />
      <Text style={[styles.provisioning, { color: colors.textSecondary }]}>
        {english ? 'Approval records provisioning intent only; it cannot broaden roles or modules.' : 'Aprobar registra la intención de provisión; no puede ampliar roles ni módulos.'}
      </Text>
      {mutation.isError ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{english ? 'Decision failed.' : 'La decisión falló.'}</Text> : null}
      <View style={styles.cardActions}>
        <TouchableOpacity accessibilityRole="button" disabled={mutation.isPending} onPress={() => mutation.mutate('approved')} style={[styles.primary, { backgroundColor: colors.actionPrimary }]}>
          <Text style={[styles.primaryText, { color: colors.actionPrimaryContrast }]}>{english ? 'Approve for provisioning' : 'Aprobar para provisión'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: !notes.trim() || mutation.isPending }}
          disabled={!notes.trim() || mutation.isPending}
          onPress={() => mutation.mutate('rejected')}
          style={[styles.reject, { borderColor: colors.danger, opacity: notes.trim() ? 1 : 0.5 }]}
        >
          <Text style={{ color: colors.danger, fontWeight: '800' }}>{english ? 'Reject' : 'Rechazar'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function AccessRequestReviewScreen() {
  const { token, roles, modules } = useAuth();
  const { locale } = useUserSettings();
  const { colors } = useAppTheme();
  const english = locale.startsWith('en');
  const access = evaluateFeatureAccess('access-requests.review', { authenticated: Boolean(token), roles, modules }, 'view');
  const requests = useQuery({ queryKey: ['access-requests', 'review', 'pending'], queryFn: () => listAccessRequestsForReview('pending'), enabled: access.state === 'allowed' });
  if (access.state !== 'allowed') return <FeatureAccessNotice decision={access} locale={locale} />;
  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <Stack.Screen options={{ headerShown: true, title: english ? 'Review access' : 'Revisar accesos' }} />
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{english ? 'Review access requests' : 'Revisar solicitudes de acceso'}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{english ? 'Only exact actions you are authorized to grant appear here.' : 'Solo aparecen acciones exactas que estás autorizado a conceder.'}</Text>
      </View>
      {requests.isLoading ? <ActivityIndicator style={styles.loader} color={colors.actionPrimary} /> : null}
      {requests.isError ? <Text accessibilityRole="alert" style={[styles.alert, { color: colors.danger }]}>{english ? 'Review queue could not be loaded.' : 'No se pudo cargar la cola de revisión.'}</Text> : null}
      <FlatList
        contentContainerStyle={styles.list}
        data={requests.data ?? []}
        keyExtractor={(request) => String(request.id)}
        renderItem={({ item }) => <ReviewCard request={item} locale={locale} />}
        ListEmptyComponent={!requests.isLoading ? <Text style={[styles.empty, { color: colors.textSecondary }]}>{english ? 'No requests you can review.' : 'No hay solicitudes que puedas revisar.'}</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, header: { padding: 20, gap: 6 }, title: { fontSize: 25, fontWeight: '800' }, subtitle: { fontSize: 14, lineHeight: 20 },
  loader: { flex: 1 }, alert: { paddingHorizontal: 20, fontWeight: '800' }, list: { paddingHorizontal: 20, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 14, padding: 15, marginBottom: 12, gap: 9 }, cardTitle: { fontSize: 17, fontWeight: '800' }, meta: { fontSize: 12, lineHeight: 17 },
  justification: { fontSize: 14, lineHeight: 20 }, input: { minHeight: 100, borderWidth: 1, borderRadius: 10, padding: 11, fontSize: 15 },
  provisioning: { fontSize: 12, lineHeight: 17 }, cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  primary: { minHeight: 48, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' }, primaryText: { fontWeight: '800' },
  reject: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' }, empty: { textAlign: 'center', paddingVertical: 40 },
});
