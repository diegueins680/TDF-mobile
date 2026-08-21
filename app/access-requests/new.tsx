import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Href, Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { submitAccessRequest } from '../../src/api/accessRequests';
import { useAnalytics } from '../../src/analytics/AnalyticsProvider';
import {
  evaluateFeatureAccess,
  featureLabel,
  getFeatureById,
  resolveMobileDestination,
  type FeatureAction,
} from '../../src/features/featureRegistry';
import { mobileFeatureRegistry } from '../../src/features/generatedFeatureRegistry';
import { useAuth } from '../../src/providers/AuthProvider';
import { useUserSettings } from '../../src/providers/UserSettingsProvider';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import { markFirstValueCompleted } from '../../src/lib/onboardingIntent';
import { markNewUserOnboardingCompleted } from '../../src/lib/firstRunFlags';

const ACTIONS = new Set<FeatureAction>(['discover', 'view', 'create', 'edit', 'delete', 'archive', 'deactivate', 'import', 'export', 'submit', 'validate', 'approve', 'reject', 'assign', 'publish', 'report', 'administer']);

export default function NewAccessRequestScreen() {
  const router = useRouter();
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ feature?: string; action?: string }>();
  const { token, partyId, roles, modules } = useAuth();
  const { locale } = useUserSettings();
  const { colors } = useAppTheme();
  const english = locale.startsWith('en');
  const initialAction = typeof params.action === 'string' && ACTIONS.has(params.action.toLowerCase() as FeatureAction)
    ? params.action.toLowerCase() as FeatureAction : 'view';
  const [selection, setSelection] = useState<{ featureId: string; action: FeatureAction } | null>(
    typeof params.feature === 'string' ? { featureId: params.feature.trim(), action: initialAction } : null,
  );
  const [justification, setJustification] = useState('');
  const feature = selection ? getFeatureById(selection.featureId) : null;
  const decision = feature && selection
    ? evaluateFeatureAccess(feature, { authenticated: Boolean(token), roles, modules }, selection.action)
    : null;
  const requestable = Boolean(feature && selection && feature.accessRequestEligible && !feature.technical && decision?.state === 'locked');
  const choices = useMemo(() => mobileFeatureRegistry.flatMap((candidate) => {
    if (!candidate.accessRequestEligible || candidate.technical || !resolveMobileDestination(candidate)) return [];
    const candidateDecision = evaluateFeatureAccess(candidate, { authenticated: Boolean(token), roles, modules }, 'view');
    return candidateDecision.state === 'locked' ? [{ feature: candidate, decision: candidateDecision }] : [];
  }).slice(0, 40), [modules, roles, token]);
  const submit = useMutation({
    mutationFn: () => submitAccessRequest({ featureId: feature?.id ?? '', action: selection?.action ?? 'view', justification: justification.trim() || null }),
    onSuccess: async (request) => {
      analytics.capture('feature_access_request_submitted', { feature_id: request.featureId, feature_action: request.action, platform: 'mobile' });
      if (await markFirstValueCompleted(partyId, 'access_requested')) {
        analytics.capture('first_value_completed', { platform: 'mobile', value: 'access_requested' });
        analytics.capture('onboarding_completed', { platform: 'mobile', reason: 'first_value', value: 'access_requested' });
        if (partyId) await markNewUserOnboardingCompleted(partyId);
      }
      await queryClient.invalidateQueries({ queryKey: ['access-requests'] });
      router.replace('/access-requests' as Href);
    },
  });

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.canvas }]} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ headerShown: true, title: english ? 'Request access' : 'Solicitar acceso' }} />
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{english ? 'Request access' : 'Solicitar acceso'}</Text>
      {!selection ? (
        <>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{english ? 'Choose a relevant locked feature. Sensitive features stay concealed.' : 'Elige una función bloqueada relevante. Las funciones sensibles permanecen ocultas.'}</Text>
          <View style={styles.choices}>
            {choices.map(({ feature: choice }) => (
              <TouchableOpacity
                key={choice.id}
                accessibilityRole="button"
                onPress={() => setSelection({ featureId: choice.id, action: 'view' })}
                style={[styles.choice, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={[styles.choiceTitle, { color: colors.textPrimary }]}>{featureLabel(choice, locale)}</Text>
                <Text numberOfLines={2} style={[styles.choiceDescription, { color: colors.textSecondary }]}>{choice.description[english ? 'en' : 'es']}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}
      {selection && (!feature || !ACTIONS.has(selection.action) || feature.technical || !feature.accessRequestEligible) ? (
        <Text accessibilityRole="alert" style={[styles.alert, { color: colors.danger }]}>{english ? 'This destination cannot be requested.' : 'Este destino no admite solicitudes.'}</Text>
      ) : null}
      {decision?.state === 'allowed' ? <Text style={[styles.info, { color: colors.textPrimary }]}>{english ? 'You already have this action.' : 'Ya tienes acceso a esta acción.'}</Text> : null}
      {requestable && feature && selection ? (
        <View style={styles.form}>
          <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>{featureLabel(feature, locale)}</Text>
            <Text style={[styles.summaryText, { color: colors.textSecondary }]}>{english ? 'Action' : 'Acción'}: {selection.action}</Text>
            <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
              {english ? 'Missing category' : 'Categoría faltante'}: {decision.missingModules.length > 0 ? (english ? 'module' : 'módulo') : (english ? 'role' : 'rol')}
            </Text>
          </View>
          <TextInput
            accessibilityLabel={english ? 'Optional justification' : 'Justificación opcional'}
            maxLength={2000}
            multiline
            numberOfLines={5}
            onChangeText={setJustification}
            placeholder={english ? 'Why do you need this action? Do not include secrets or personal data.' : '¿Para qué necesitas esta acción? No incluyas secretos ni datos personales.'}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
            textAlignVertical="top"
            value={justification}
          />
          <Text style={[styles.counter, { color: colors.textSecondary }]}>{justification.length}/2000</Text>
          {submit.isError ? <Text accessibilityRole="alert" style={[styles.alert, { color: colors.danger }]}>{english ? 'The request could not be submitted.' : 'No se pudo enviar la solicitud.'}</Text> : null}
          <TouchableOpacity accessibilityRole="button" disabled={submit.isPending} onPress={() => submit.mutate()} style={[styles.primary, { backgroundColor: colors.actionPrimary }]}>
            <Text style={[styles.primaryText, { color: colors.actionPrimaryContrast }]}>{submit.isPending ? (english ? 'Sending…' : 'Enviando…') : (english ? 'Send request' : 'Enviar solicitud')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {selection ? (
        <TouchableOpacity accessibilityRole="button" onPress={() => setSelection(null)} style={styles.back}>
          <Text style={{ color: colors.actionPrimary, fontWeight: '800' }}>{english ? 'Choose another feature' : 'Elegir otra función'}</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingBottom: 40 }, title: { fontSize: 26, fontWeight: '800' }, subtitle: { fontSize: 14, lineHeight: 20, marginTop: 7 },
  choices: { gap: 9, marginTop: 18 }, choice: { minHeight: 64, borderWidth: 1, borderRadius: 12, padding: 12, justifyContent: 'center', gap: 3 },
  choiceTitle: { fontSize: 15, fontWeight: '800' }, choiceDescription: { fontSize: 13, lineHeight: 18 }, form: { gap: 12, marginTop: 18 },
  summary: { borderWidth: 1, borderRadius: 13, padding: 14, gap: 4 }, summaryTitle: { fontSize: 18, fontWeight: '800' }, summaryText: { fontSize: 13 },
  input: { minHeight: 130, borderWidth: 1, borderRadius: 12, padding: 13, fontSize: 16 }, counter: { fontSize: 12, textAlign: 'right' },
  primary: { minHeight: 48, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, primaryText: { fontSize: 15, fontWeight: '800' },
  alert: { marginTop: 16, fontWeight: '800' }, info: { marginTop: 16, lineHeight: 20 }, back: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', marginTop: 12 },
});
