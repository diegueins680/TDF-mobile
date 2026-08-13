import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';

import type { FeatureAccessDecision, FeatureAction } from '../features/featureRegistry';
import { featureLabel } from '../features/featureRegistry';
import { useAppTheme } from '../theme/ThemeProvider';

export function FeatureAccessNotice({
  decision,
  action = 'view',
  locale = 'es',
}: {
  decision: FeatureAccessDecision;
  action?: FeatureAction;
  locale?: string;
}) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const english = locale.startsWith('en');
  const concealed = decision.state === 'concealed';
  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]} accessibilityRole="summary">
      <MaterialCommunityIcons name="lock-outline" size={42} color={colors.textSecondary} />
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
        {concealed
          ? (english ? 'Destination unavailable' : 'Destino no disponible')
          : (english ? 'Access required' : 'Acceso requerido')}
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        {concealed
          ? (english
              ? 'This destination is unavailable or not enabled for your account.'
              : 'Este destino no está disponible o no está habilitado para tu cuenta.')
          : (english
              ? `${featureLabel(decision.feature, locale)} is relevant, but your current access does not include this action.`
              : `${featureLabel(decision.feature, locale)} es relevante, pero tu acceso actual no incluye esta acción.`)}
      </Text>
      {!concealed && decision.feature.accessRequestEligible ? (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.push({
            pathname: '/access-requests/new',
            params: { feature: decision.feature.id, action },
          } as Href)}
          style={[styles.button, { backgroundColor: colors.actionPrimary }]}
        >
          <Text style={[styles.buttonText, { color: colors.actionPrimaryContrast }]}>
            {english ? 'Request access' : 'Solicitar acceso'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center', gap: 14 },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 440 },
  button: { minHeight: 48, minWidth: 180, borderRadius: 12, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  buttonText: { fontSize: 16, fontWeight: '800' },
});
