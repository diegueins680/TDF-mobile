import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';

import { createDdexPartner, listDdexPartners } from '../../src/api/ddex';
import { FeatureAccessNotice } from '../../src/components/FeatureAccessNotice';
import { evaluateFeatureAccess } from '../../src/features/featureRegistry';
import { useAnalytics } from '../../src/analytics/AnalyticsProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { useUserSettings } from '../../src/providers/UserSettingsProvider';
import { useAppTheme } from '../../src/theme/ThemeProvider';

const ALLOWED_VERSIONS = ['3.8.2', '4.2', '4.3'] as const;

export default function DdexPartnersScreen() {
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const { token, roles, modules } = useAuth();
  const { locale } = useUserSettings();
  const { colors } = useAppTheme();
  const english = locale.startsWith('en');
  const [name, setName] = useState('');
  const [dpid, setDpid] = useState('');
  const [version, setVersion] = useState<(typeof ALLOWED_VERSIONS)[number]>('4.3');
  const [showForm, setShowForm] = useState(false);
  const access = evaluateFeatureAccess('label.ddex.partners', { authenticated: Boolean(token), roles, modules }, 'view');
  const createAccess = evaluateFeatureAccess('label.ddex.partners', { authenticated: Boolean(token), roles, modules }, 'create');
  const partners = useQuery({ queryKey: ['ddex-partners'], queryFn: listDdexPartners, enabled: access.state === 'allowed' });
  const createPartner = useMutation({
    mutationFn: createDdexPartner,
    onSuccess: async () => {
      analytics.capture('ddex_partner_created', { feature_id: 'label.ddex.partners', platform: 'mobile' });
      setName(''); setDpid(''); setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ['ddex-partners'] });
    },
  });

  if (access.state !== 'allowed') return <FeatureAccessNotice decision={access} locale={locale} />;

  const submit = () => {
    const cleanName = name.trim();
    const cleanDpid = dpid.trim();
    if (!cleanName || cleanName.length > 160 || cleanDpid.length > 200) return;
    createPartner.mutate({ partnerName: cleanName, partnerDpid: cleanDpid || null, partnerAllowedVersions: [version] });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <Stack.Screen options={{ headerShown: true, title: 'DDEX / Partners' }} />
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>DDEX / Partners</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {english ? 'Administrative delivery-partner configuration.' : 'Configuración administrativa de socios de entrega.'}
        </Text>
        {createAccess.state === 'allowed' ? (
          <TouchableOpacity accessibilityRole="button" onPress={() => setShowForm((current) => !current)} style={[styles.primaryButton, { backgroundColor: colors.actionPrimary }]}>
            <Text style={[styles.primaryText, { color: colors.actionPrimaryContrast }]}>{showForm ? (english ? 'Cancel' : 'Cancelar') : (english ? 'New partner' : 'Nuevo partner')}</Text>
          </TouchableOpacity>
        ) : null}
        {showForm ? (
          <View style={[styles.form, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <TextInput
              accessibilityLabel={english ? 'Partner name' : 'Nombre del partner'}
              autoCapitalize="words"
              maxLength={160}
              onChangeText={setName}
              placeholder={english ? 'Partner name' : 'Nombre del partner'}
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
              value={name}
            />
            <TextInput
              accessibilityLabel="DPID"
              autoCapitalize="none"
              maxLength={200}
              onChangeText={setDpid}
              placeholder="DPID (opcional)"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
              value={dpid}
            />
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{english ? 'Allowed ERN version' : 'Versión ERN permitida'}</Text>
            <View style={styles.versions}>
              {ALLOWED_VERSIONS.map((value) => (
                <TouchableOpacity
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: version === value }}
                  onPress={() => setVersion(value)}
                  style={[styles.version, { borderColor: colors.border, backgroundColor: version === value ? colors.selected : colors.surface }]}
                >
                  <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{value}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {createPartner.isError ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{english ? 'Partner could not be created.' : 'No se pudo crear el partner.'}</Text> : null}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: !name.trim() || createPartner.isPending }}
              disabled={!name.trim() || createPartner.isPending}
              onPress={submit}
              style={[styles.primaryButton, { backgroundColor: colors.actionPrimary, opacity: !name.trim() ? 0.55 : 1 }]}
            >
              <Text style={[styles.primaryText, { color: colors.actionPrimaryContrast }]}>{createPartner.isPending ? (english ? 'Creating…' : 'Creando…') : (english ? 'Create partner' : 'Crear partner')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
      {partners.isLoading ? <ActivityIndicator style={styles.loader} color={colors.actionPrimary} /> : null}
      {partners.isError ? <Text accessibilityRole="alert" style={[styles.alert, { color: colors.danger }]}>{english ? 'Partners could not be loaded.' : 'No se pudieron cargar los partners.'}</Text> : null}
      <FlatList
        contentContainerStyle={styles.list}
        data={partners.data ?? []}
        keyExtractor={(partner) => String(partner.ddexPartnerId)}
        renderItem={({ item }) => (
          <View style={[styles.partner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.partnerName, { color: colors.textPrimary }]}>{item.ddexPartnerName}</Text>
            <Text style={[styles.partnerMeta, { color: colors.textSecondary }]}>{item.ddexPartnerDpid ?? (english ? 'No DPID' : 'Sin DPID')}</Text>
            <Text style={[styles.partnerMeta, { color: colors.textSecondary }]}>{item.ddexPartnerAllowedVersions.join(', ') || '—'}</Text>
          </View>
        )}
        ListEmptyComponent={!partners.isLoading ? <Text style={[styles.empty, { color: colors.textSecondary }]}>{english ? 'No partners configured.' : 'No hay partners configurados.'}</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, gap: 10 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 20 },
  primaryButton: { minHeight: 48, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { fontSize: 15, fontWeight: '800' },
  form: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 11 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  versions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  version: { minWidth: 60, minHeight: 44, borderWidth: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  loader: { flex: 1 },
  alert: { paddingHorizontal: 20, fontWeight: '800' },
  list: { paddingHorizontal: 20, paddingBottom: 36 },
  partner: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 9, gap: 4 },
  partnerName: { fontSize: 16, fontWeight: '800' },
  partnerMeta: { fontSize: 13 },
  empty: { textAlign: 'center', paddingVertical: 38 },
});
