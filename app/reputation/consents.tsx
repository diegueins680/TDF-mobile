import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Reputation } from '../../src/api/reputation';
import { useAppTheme } from '../../src/theme/ThemeProvider';

export default function ReputationConsentsScreen() {
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['reputation-consents'], queryFn: Reputation.getMyConsents });
  const mutation = useMutation({
    mutationFn: ({ consentKind, granted }: { consentKind: string; granted: boolean }) =>
      Reputation.updateMyConsents([{
        consentKind: consentKind as 'pilot_participation' | 'public_visibility' | 'public_rankings' | 'rating_reminders',
        granted,
        ...(granted ? { consentCopyVersion: 'reputation-consent-v0.1', consentLocale: 'es' as const } : {}),
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
      {query.data?.map((consent) => (
        <View key={consent.consentKind} style={[styles.row, { borderColor: colors.border }]}>
          <View style={styles.copy}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>{consent.consentKind}</Text>
            <Text style={{ color: colors.textSecondary }}>{consent.granted ? 'Permitido' : 'No permitido'}</Text>
          </View>
          <Switch
            accessibilityLabel={'Consentimiento ' + consent.consentKind}
            value={consent.granted}
            disabled={mutation.isPending}
            onValueChange={(granted) => mutation.mutate({ consentKind: consent.consentKind, granted })}
          />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 20, gap: 16 },
  title: { fontSize: 24, fontWeight: '800' },
  explanation: { fontSize: 15, lineHeight: 22 },
  row: { borderWidth: 1, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center' },
  copy: { flex: 1, gap: 3 },
  label: { fontWeight: '700' },
});
