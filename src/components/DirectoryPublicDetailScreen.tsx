import { useMutation, useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
  const [actionMode, setActionMode] = useState<'contact' | 'invite'>('contact');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedClassifiedId, setSelectedClassifiedId] = useState('');
  const detail = useQuery({
    queryKey: ['directory-detail', kind, identifier],
    queryFn: () => loadDetail(kind, identifier),
  });
  const profiles = useQuery({
    queryKey: ['directory-managed-profiles'],
    queryFn: Directory.managedProfiles,
    enabled: Boolean(token?.trim()),
  });
  const classifieds = useQuery({
    queryKey: ['directory-managed-classifieds'],
    queryFn: Directory.managedClassifieds,
    enabled: Boolean(token?.trim()) && kind === 'profile',
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
  const selectedProfile = profiles.data?.find((profile) => profile.id === selectedProfileId);
  const profileChoiceRequired = Boolean(token?.trim()) && Boolean(profiles.data?.length) && !selectedProfile;
  const eligibleClassifieds = (classifieds.data ?? []).filter((classified) => classified.authorProfileId === selectedProfileId && classified.status === 'published');
  useEffect(() => {
    if (selectedClassifiedId && !eligibleClassifieds.some((classified) => classified.id === selectedClassifiedId)) setSelectedClassifiedId('');
  }, [eligibleClassifieds, selectedClassifiedId]);

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
      if (!profiles.data?.length) throw new Error('Crea o administra un perfil público antes de continuar.');
      if (!selectedProfile) throw new Error('Elige explícitamente el perfil con el que quieres actuar.');
      if (kind === 'classified') {
        return Directory.apply(id, {
          applicantProfileId: selectedProfile.id,
          message,
          portfolio: [],
        });
      }
      if (kind !== 'profile') throw new Error('El contacto directo está disponible en perfiles y clasificados.');
      if (actionMode === 'invite') {
        return Directory.invite({
          senderProfileId: selectedProfile.id,
          targetProfileId: id,
          classifiedId: selectedClassifiedId || undefined,
          message,
        });
      }
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
        const event = kind === 'classified' ? 'directory_application_submitted' : actionMode === 'invite' ? 'directory_invitation_sent' : 'directory_contact_started';
        analytics.capture(event, { platform: 'mobile', entity_id: id });
        Alert.alert(kind === 'classified' ? 'Postulación enviada' : actionMode === 'invite' ? 'Invitación enviada' : 'Conversación abierta', 'Tu información privada no se compartió automáticamente.');
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
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textPrimary }]}>{kind === 'classified' ? 'Postularme' : actionMode === 'invite' ? 'Invitar a una oportunidad' : 'Contactar'}</Text>
            <Text style={{ color: colors.textSecondary }}>Elige explícitamente el perfil con el que actuarás. Tu correo y teléfono permanecen ocultos.</Text>
            {token?.trim() && (profiles.data?.length ?? 0) > 0 ? <View style={styles.chips}>{profiles.data?.map((profile) => <ChoiceChip key={profile.id} label={profile.name} selected={profile.id === selectedProfileId} onPress={() => setSelectedProfileId(profile.id)} />)}</View> : null}
            {kind === 'profile' && token?.trim() ? <View style={styles.chips}><ChoiceChip label="Contactar" selected={actionMode === 'contact'} onPress={() => setActionMode('contact')} /><ChoiceChip label="Invitar" selected={actionMode === 'invite'} onPress={() => setActionMode('invite')} /></View> : null}
            {kind === 'profile' && actionMode === 'invite' ? <View style={styles.chips}><ChoiceChip label="Invitación general" selected={!selectedClassifiedId} onPress={() => setSelectedClassifiedId('')} />{eligibleClassifieds.map((classified) => <ChoiceChip key={classified.id} label={classified.title} selected={classified.id === selectedClassifiedId} onPress={() => setSelectedClassifiedId(classified.id)} />)}</View> : null}
            <TextInput
              accessibilityLabel="Mensaje privado"
              multiline
              value={message}
              onChangeText={setMessage}
              style={[styles.messageInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
            />
            <Pressable
              accessibilityRole="button"
              disabled={contact.isPending || !message.trim() || profileChoiceRequired}
              style={[styles.primaryButton, { backgroundColor: colors.actionPrimary, opacity: contact.isPending || !message.trim() || profileChoiceRequired ? 0.6 : 1 }]}
              onPress={() => contact.mutate()}
            >
              <Text style={{ color: colors.actionPrimaryContrast, fontWeight: '800' }}>{token?.trim() ? (kind === 'classified' ? 'Enviar postulación' : actionMode === 'invite' ? 'Enviar invitación' : 'Abrir conversación') : 'Iniciar sesión para continuar'}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ChoiceChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choiceChip, { borderColor: selected ? colors.actionPrimary : colors.border, backgroundColor: selected ? colors.selected : colors.surface }]}><Text style={{ color: colors.textPrimary, fontWeight: selected ? '800' : '500' }}>{label}</Text></Pressable>;
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
  choiceChip: { minHeight: 42, paddingHorizontal: 12, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 20, fontWeight: '800' },
  messageInput: { minHeight: 120, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top' },
  primaryButton: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondaryButton: { minHeight: 46, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
