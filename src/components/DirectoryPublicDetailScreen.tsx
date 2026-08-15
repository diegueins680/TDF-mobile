import { useMutation, useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Directory, type DirectoryEntityType } from '../api/directory';
import { useAnalytics } from '../analytics/AnalyticsProvider';
import { useAuth } from '../providers/AuthProvider';
import { useAppTheme } from '../theme/ThemeProvider';

type DetailValue = Record<string, unknown>;

const textValue = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined;
const arrayValue = (value: unknown): DetailValue[] => Array.isArray(value) ? value.filter((item): item is DetailValue => Boolean(item) && typeof item === 'object') : [];

const loadDetail = async (kind: DirectoryEntityType, identifier: string): Promise<DetailValue> => {
  if (kind === 'profile') return await Directory.profile(identifier) as unknown as DetailValue;
  if (kind === 'classified') return await Directory.classified(identifier) as unknown as DetailValue;
  if (kind === 'event') return await Directory.event(identifier) as unknown as DetailValue;
  return await Directory.venue(identifier) as unknown as DetailValue;
};

export function DirectoryPublicDetailScreen({ kind, identifier }: { kind: DirectoryEntityType; identifier: string }) {
  const router = useRouter();
  const analytics = useAnalytics();
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const [message, setMessage] = useState('Hola, vi tu perfil en el directorio de TDF y quisiera conversar.');
  const detail = useQuery({
    queryKey: ['directory-detail', kind, identifier],
    queryFn: () => loadDetail(kind, identifier),
  });
  const profiles = useQuery({
    queryKey: ['directory-managed-profiles'],
    queryFn: Directory.managedProfiles,
    enabled: Boolean(token?.trim()),
  });
  const data = useMemo(() => (detail.data ?? {}) as DetailValue, [detail.data]);
  const id = textValue(data.id) ?? identifier;
  const title = textValue(data.name) ?? textValue(data.title) ?? 'Directorio musical TDF';
  const description = textValue(data.bio) ?? textValue(data.description);
  const location = data.location && typeof data.location === 'object' ? data.location as DetailValue : undefined;
  const locations = useMemo(() => arrayValue(data.locations), [data.locations]);
  const shareUrl = useMemo(
    () => Linking.createURL(`/directory/${kind}/${encodeURIComponent(identifier)}`),
    [identifier, kind],
  );
  const selectedProfile = profiles.data?.[0];

  const facts = useMemo(() => {
    const values: Array<[string, string | undefined]> = [
      ['Ciudad', textValue(location?.city) ?? textValue(locations[0]?.city)],
      ['Experiencia', textValue(data.experience)],
      ['Créditos', textValue(data.creditsSummary)],
      ['Inicio', textValue(data.startTime) ?? textValue(data.startsAt)],
      ['Fin', textValue(data.endTime) ?? textValue(data.endsAt)],
      ['Vence', textValue(data.expiresAt)],
    ];
    return values.filter((entry): entry is [string, string] => Boolean(entry[1]));
  }, [data, location?.city, locations]);

  const contact = useMutation({
    mutationFn: async () => {
      if (!token?.trim()) {
        router.push({ pathname: '/auth', params: { returnTo: `/directory/${kind}/${identifier}` } });
        return null;
      }
      if (!selectedProfile) throw new Error('Crea o administra un perfil público antes de contactar.');
      if (kind === 'classified') {
        return Directory.apply(id, {
          applicantProfileId: selectedProfile.id,
          message,
          portfolio: [],
        });
      }
      if (kind !== 'profile') throw new Error('El contacto directo está disponible en perfiles y clasificados.');
      return Directory.contact({
        senderProfileId: selectedProfile.id,
        targetProfileId: id,
        contextKind: 'profile',
        contextId: id,
        message,
      });
    },
    onSuccess: (result) => {
      if (result) {
        analytics.capture(kind === 'classified' ? 'directory_application_submitted' : 'directory_contact_started', { platform: 'mobile', entity_id: id });
        Alert.alert(kind === 'classified' ? 'Postulación enviada' : 'Conversación abierta', 'Tu información privada no se compartió automáticamente.');
      }
    },
    onError: (error) => Alert.alert('No pudimos completar la acción', error instanceof Error ? error.message : 'Inténtalo nuevamente.'),
  });

  if (detail.isLoading) return <SafeAreaView style={[styles.centered, { backgroundColor: colors.canvas }]}><ActivityIndicator color={colors.actionPrimary} /></SafeAreaView>;
  if (detail.isError) return (
    <SafeAreaView style={[styles.centered, { backgroundColor: colors.canvas }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>Este contenido no está disponible</Text>
      <Text style={{ color: colors.textSecondary }}>Puede estar pausado, vencido o pendiente de moderación.</Text>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={{ color: colors.actionPrimary }}>← Volver a buscar</Text></Pressable>
        <Text style={[styles.kind, { color: colors.actionPrimary }]}>{kind.toUpperCase()}</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        {description ? <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text> : null}
        {facts.length ? (
          <View style={[styles.panel, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderSubtle }]}>
            {facts.map(([label, value]) => <Text key={label} style={{ color: colors.textPrimary }}><Text style={styles.factLabel}>{label}: </Text>{value}</Text>)}
          </View>
        ) : null}
        {arrayValue(data.professions).length ? (
          <View style={styles.chips}>{arrayValue(data.professions).map((profession) => <Text key={textValue(profession.id)} style={[styles.chip, { backgroundColor: colors.selected, color: colors.textPrimary }]}>{textValue(profession.name)}</Text>)}</View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          style={[styles.secondaryButton, { borderColor: colors.border }]}
          onPress={() => void Share.share({ message: `${title} — TDF\n${shareUrl}`, url: shareUrl })}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Compartir</Text>
        </Pressable>
        {kind === 'profile' || kind === 'classified' ? (
          <View style={[styles.panel, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderSubtle }]}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textPrimary }]}>{kind === 'classified' ? 'Postularme' : 'Contactar'}</Text>
            <Text style={{ color: colors.textSecondary }}>Usaremos uno de tus perfiles públicos. Tu correo y teléfono permanecen ocultos.</Text>
            <TextInput
              accessibilityLabel="Mensaje privado"
              multiline
              value={message}
              onChangeText={setMessage}
              style={[styles.messageInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
            />
            <Pressable
              accessibilityRole="button"
              disabled={contact.isPending || !message.trim()}
              style={[styles.primaryButton, { backgroundColor: colors.actionPrimary, opacity: contact.isPending || !message.trim() ? 0.6 : 1 }]}
              onPress={() => contact.mutate()}
            >
              <Text style={{ color: colors.actionPrimaryContrast, fontWeight: '800' }}>{token?.trim() ? (kind === 'classified' ? 'Enviar postulación' : 'Abrir conversación') : 'Iniciar sesión para continuar'}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  kind: { fontSize: 12, letterSpacing: 1.5, fontWeight: '900' },
  title: { fontSize: 31, lineHeight: 37, fontWeight: '900' },
  description: { fontSize: 16, lineHeight: 24 },
  panel: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  factLabel: { fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, overflow: 'hidden' },
  sectionTitle: { fontSize: 20, fontWeight: '800' },
  messageInput: { minHeight: 120, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top' },
  primaryButton: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondaryButton: { minHeight: 46, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
