import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Reputation } from '../../src/api/reputation';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import { LegalDisclosure } from '../../src/components/LegalDisclosure';

const consentCopyVersion = 'reputation-consent-v0.1';

// Same versioned copy as the web consent page (reputation-consent-v0.1, es) so the text the
// user can read matches the consentCopyVersion recorded when they grant it.
const consentCopy: Record<string, { title: string; text: string }> = {
  pilot_participation: {
    title: 'Participar en el piloto',
    text: 'Acepto participar en el piloto de reputación contextual. Puedes retirarte cuando quieras; TDF detiene nuevas señales, solicitudes y agregaciones del piloto sobre tu perfil.',
  },
  public_visibility: {
    title: 'Reputación visible en mi perfil',
    text: 'Permito mostrar mi reputación agregada, badges verificables y tendencia estadísticamente válida en mi perfil público. No publicamos autores ni posiciones individuales; al retirarlo ocultamos los resultados afectados de inmediato.',
  },
  public_rankings: {
    title: 'Rankings públicos',
    text: 'Permito ser considerado para rankings públicos cuando exista muestra suficiente. No hay posiciones exactas en grupos pequeños ni uso de atributos sensibles.',
  },
  rating_reminders: {
    title: 'Solicitudes y recordatorios de valoración',
    text: 'Acepto recibir solicitudes y recordatorios de valoración. Puedes desactivarlos cuando quieras; no enviamos mensajes en cola o reintento después del retiro.',
  },
};

export default function ReputationConsentsScreen() {
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['reputation-consents'], queryFn: Reputation.getMyConsents });
  const mutation = useMutation({
    mutationFn: ({ consentKind, granted }: { consentKind: string; granted: boolean }) =>
      Reputation.updateMyConsents([{
        consentKind: consentKind as 'pilot_participation' | 'public_visibility' | 'public_rankings' | 'rating_reminders',
        granted,
        ...(granted ? { consentCopyVersion, consentLocale: 'es' as const } : {}),
      }]),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['reputation-consents'] }),
  });

  return (
    <ScrollView contentContainerStyle={[styles.page, { backgroundColor: colors.canvas }]}>
      <Stack.Screen options={{ headerShown: true, title: 'Privacidad de reputación' }} />
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
        Consentimientos de reputación
      </Text>
      <Text style={[styles.explanation, { color: colors.textSecondary }]}>
        Puedes retirar consentimientos. La evidencia financiera o de seguridad que deba conservarse
        legalmente se anonimiza cuando corresponda, pero no se falsifica ni se destruye.
      </Text>
      {query.isError && <Text accessibilityRole="alert" style={{ color: colors.danger }}>No se pudieron cargar.</Text>}
      {query.data?.map((consent) => {
        const copy = consentCopy[consent.consentKind];
        const title = copy?.title ?? consent.consentKind;
        return (
          <View key={consent.consentKind} style={[styles.row, { borderColor: colors.border }]}>
            <View style={styles.rowHeader}>
              <View style={styles.copy}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>{title}</Text>
                <Text style={{ color: colors.textSecondary }}>{consent.granted ? 'Permitido' : 'No permitido'}</Text>
              </View>
              <Switch
                accessibilityLabel={'Consentimiento: ' + title}
                value={consent.granted}
                disabled={mutation.isPending}
                onValueChange={(granted) => mutation.mutate({ consentKind: consent.consentKind, granted })}
              />
            </View>
            {copy ? (
              <LegalDisclosure
                testID={`consent-${consent.consentKind}-text`}
                title="Texto del consentimiento"
                summary={`Versión ${consentCopyVersion}`}
                accessibilityLabel={`Texto del consentimiento: ${title}`}
              >
                <Text style={[styles.explanation, { color: colors.textPrimary }]}>{copy.text}</Text>
              </LegalDisclosure>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 20, gap: 16 },
  title: { fontSize: 24, fontWeight: '800' },
  explanation: { fontSize: 15, lineHeight: 22 },
  row: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 12 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, gap: 3 },
  label: { fontWeight: '700' },
});
