import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { type Href, Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { getDdexDocument, getDdexValidationReport } from '../../../src/api/ddex';
import { FeatureAccessNotice } from '../../../src/components/FeatureAccessNotice';
import { evaluateFeatureAccess } from '../../../src/features/featureRegistry';
import { useAuth } from '../../../src/providers/AuthProvider';
import { useUserSettings } from '../../../src/providers/UserSettingsProvider';
import { useAppTheme } from '../../../src/theme/ThemeProvider';

export default function DdexDocumentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Number(params.id);
  const validId = Number.isSafeInteger(id) && id > 0;
  const { token, roles, modules } = useAuth();
  const { locale } = useUserSettings();
  const { colors } = useAppTheme();
  const english = locale.startsWith('en');
  const access = evaluateFeatureAccess('label.ddex.document', { authenticated: Boolean(token), roles, modules }, 'view');
  const documentQuery = useQuery({ queryKey: ['ddex-document', id], queryFn: () => getDdexDocument(id), enabled: access.state === 'allowed' && validId });
  const validationQuery = useQuery({ queryKey: ['ddex-validation', id], queryFn: () => getDdexValidationReport(id), enabled: access.state === 'allowed' && validId });

  if (access.state !== 'allowed') return <FeatureAccessNotice decision={access} locale={locale} />;
  if (!validId) {
    return <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{english ? 'Invalid document link.' : 'Enlace de documento inválido.'}</Text>;
  }
  if (documentQuery.isLoading) return <ActivityIndicator style={styles.loader} color={colors.actionPrimary} accessibilityLabel="Cargando documento DDEX" />;
  if (documentQuery.isError || !documentQuery.data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.canvas }]}>
        <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{english ? 'Document unavailable.' : 'Documento no disponible.'}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.replace('/ddex' as Href)} style={styles.backButton}>
          <Text style={{ color: colors.actionPrimary, fontWeight: '800' }}>{english ? 'Back to inbox' : 'Volver a la bandeja'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const document = documentQuery.data;
  const report = validationQuery.data;
  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.canvas }]}>
      <Stack.Screen options={{ headerShown: true, title: english ? 'DDEX document' : 'Documento DDEX' }} />
      <TouchableOpacity accessibilityRole="button" onPress={() => router.replace('/ddex' as Href)} style={styles.backButton}>
        <MaterialCommunityIcons name="arrow-left" size={20} color={colors.actionPrimary} />
        <Text style={{ color: colors.actionPrimary, fontWeight: '800' }}>{english ? 'Inbox' : 'Bandeja'}</Text>
      </TouchableOpacity>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{document.ddexDocumentFileName}</Text>
      <View style={[styles.status, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={[styles.statusText, { color: colors.textPrimary }]}>{document.ddexDocumentStatus}</Text>
      </View>
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        {[
          [english ? 'Family' : 'Familia', document.ddexDocumentFamily],
          [english ? 'Version' : 'Versión', document.ddexDocumentVersion],
          [english ? 'Message' : 'Mensaje', document.ddexDocumentMessageId ?? '—'],
          [english ? 'Sender' : 'Remitente', document.ddexDocumentSenderId ?? '—'],
          [english ? 'Received' : 'Recibido', new Date(document.ddexDocumentCreatedAt).toLocaleString(locale)],
        ].map(([label, value]) => (
          <View key={label} style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
            <Text selectable style={[styles.fieldValue, { color: colors.textPrimary }]}>{value}</Text>
          </View>
        ))}
      </View>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textPrimary }]}>{english ? 'Validation' : 'Validación'}</Text>
      {validationQuery.isLoading ? <ActivityIndicator color={colors.actionPrimary} /> : null}
      {report ? (
        <View style={[styles.card, { borderColor: report.reportIsValid ? colors.border : colors.dangerBorder, backgroundColor: colors.surface }]}>
          <Text accessibilityLiveRegion="polite" style={[styles.validationSummary, { color: report.reportIsValid ? colors.success : colors.danger }]}>
            {report.reportIsValid
              ? (english ? 'No validation errors reported.' : 'No se reportan errores de validación.')
              : `${report.reportIssues.length} ${english ? 'validation issues' : 'problemas de validación'}`}
          </Text>
          {report.reportIssues.map((issue, index) => (
            <View key={`${issue.issueCode}:${index}`} style={[styles.issue, { borderTopColor: colors.borderSubtle }]}>
              <Text style={[styles.issueCode, { color: colors.textPrimary }]}>{issue.issueSeverity} · {issue.issueCode || issue.issueLayer}</Text>
              <Text style={[styles.issueMessage, { color: colors.textSecondary }]}>{issue.issueMessage}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={[styles.beta, { backgroundColor: colors.warningSurface, borderColor: colors.warningBorder }]}>
        <Text style={[styles.betaText, { color: colors.textPrimary }]}>
          {english
            ? 'Preview, raw download, conflict resolution, and commit are concealed until their backend implementations are complete.'
            : 'Vista previa, descarga original, resolución de conflictos y confirmación permanecen ocultas hasta completar su implementación de backend.'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  loader: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  backButton: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 4 },
  title: { fontSize: 24, fontWeight: '800', marginTop: 8 },
  status: { minHeight: 40, alignSelf: 'flex-start', paddingHorizontal: 14, borderWidth: 1, borderRadius: 20, justifyContent: 'center', marginTop: 12 },
  statusText: { fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginTop: 16, gap: 14 },
  field: { gap: 3 },
  fieldLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  fieldValue: { fontSize: 15, lineHeight: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginTop: 24 },
  validationSummary: { fontSize: 15, fontWeight: '800' },
  issue: { borderTopWidth: 1, paddingTop: 12, gap: 4 },
  issueCode: { fontSize: 13, fontWeight: '800' },
  issueMessage: { fontSize: 13, lineHeight: 18 },
  beta: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 18 },
  betaText: { fontSize: 13, lineHeight: 19 },
  error: { padding: 20, fontSize: 16, fontWeight: '800' },
});
