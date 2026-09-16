import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import {
  MerchReputation,
  type MerchNotificationPreferences,
  type MerchReputationPriorities,
} from '../../src/api/merchReputation';
import { getLocale } from '../../src/i18n';
import { useAppTheme } from '../../src/theme/ThemeProvider';

type SubjectKind = 'store' | 'product';
const emptyNotifications: MerchNotificationPreferences = {
  reviewInvitation: false,
  reviewReminder: false,
  sellerResponseNotification: false,
  moderationChange: false,
  evidenceRequest: false,
  appealResult: false,
  badgeChange: false,
};

export default function MerchReputationPreferencesScreen() {
  const { colors } = useAppTheme();
  const locale = getLocale();
  const isEnglish = locale === 'en';
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<SubjectKind>('store');
  const [dimensions, setDimensions] = useState<MerchReputationPriorities['orderedDimensions']>([]);
  const [notifications, setNotifications] = useState(emptyNotifications);
  const [suggestionLabel, setSuggestionLabel] = useState('');
  const [suggestionDefinition, setSuggestionDefinition] = useState('');
  const query = useQuery({
    queryKey: ['merch-reputation-priorities', kind],
    queryFn: () => MerchReputation.priorities(kind),
    retry: false,
  });
  useEffect(() => setDimensions(query.data?.orderedDimensions ?? []), [query.data]);
  const notificationQuery = useQuery({
    queryKey: ['merch-reputation-notification-preferences'],
    queryFn: MerchReputation.notificationPreferences,
  });
  useEffect(() => setNotifications(notificationQuery.data ?? emptyNotifications), [notificationQuery.data]);
  const mutation = useMutation({
    mutationFn: () => MerchReputation.savePriorities(
      kind,
      dimensions.map((dimension) => dimension.code),
      query.data?.revision ?? 0,
    ),
    onSuccess: async (saved) => {
      queryClient.setQueryData(['merch-reputation-priorities', kind], saved);
      await queryClient.invalidateQueries({ queryKey: ['merch-reputation-priorities', kind] });
    },
  });
  const notificationMutation = useMutation({
    mutationFn: () => MerchReputation.saveNotificationPreferences(notifications),
    onSuccess: (saved) => queryClient.setQueryData(
      ['merch-reputation-notification-preferences'],saved,
    ),
  });
  const suggestionMutation = useMutation({
    mutationFn: () => MerchReputation.suggestCategory({
      suggestionSubjectKind: kind,
      suggestionLabel,
      suggestionDefinition,
    }),
    onSuccess: () => {
      setSuggestionLabel('');
      setSuggestionDefinition('');
    },
  });
  const move = (index: number, delta: -1 | 1) => setDimensions((current) => {
    const destination = index + delta;
    if (destination < 0 || destination >= current.length) return current;
    const next = [...current];
    const item = next[index]!;
    next[index] = next[destination]!;
    next[destination] = item;
    return next;
  });
  const nameFor = (dimension: MerchReputationPriorities['orderedDimensions'][number]) =>
    isEnglish ? dimension.nameEn : dimension.nameEs;

  return (
    <ScrollView contentContainerStyle={[styles.page, { backgroundColor: colors.canvas }]}>
      <Stack.Screen options={{ headerShown: true, title: isEnglish ? 'Merch priorities' : 'Prioridades de merch' }} />
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
        {isEnglish ? 'Merch discovery priorities' : 'Prioridades para descubrir merch'}
      </Text>
      <Text style={[styles.explanation, { color: colors.textSecondary }]}>
        {isEnglish
          ? 'This order personalizes discovery and never changes a public store or product score.'
          : 'Este orden personaliza el descubrimiento y nunca cambia el puntaje público de una tienda o producto.'}
      </Text>
      <View style={styles.tabs} accessibilityLabel={isEnglish ? 'Reputation subject' : 'Sujeto de reputación'}>
        {(['store', 'product'] as const).map((subject) => (
          <Pressable
            key={subject}
            accessibilityRole="button"
            accessibilityState={{ selected: kind === subject }}
            onPress={() => setKind(subject)}
            style={[styles.tab, { borderColor: colors.border }, kind === subject && { backgroundColor: colors.actionPrimary }]}
          >
            <Text style={{ color: kind === subject ? colors.actionPrimaryContrast : colors.textPrimary }}>
              {subject === 'store' ? (isEnglish ? 'Stores' : 'Tiendas') : (isEnglish ? 'Products' : 'Productos')}
            </Text>
          </Pressable>
        ))}
      </View>
      {query.isLoading && <ActivityIndicator accessibilityLabel={isEnglish ? 'Loading priorities' : 'Cargando prioridades'} />}
      {query.isError && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{isEnglish ? 'Could not load priorities.' : 'No se pudieron cargar las prioridades.'}</Text>}
      {dimensions.map((dimension, index) => (
        <View key={dimension.code} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={styles.copy}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>{nameFor(dimension)}</Text>
            <Text style={{ color: colors.textSecondary }}>
              {isEnglish ? dimension.definitionEn : dimension.definitionEs}
            </Text>
          </View>
          <View style={styles.buttons}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={(isEnglish ? 'Move up ' : 'Subir ') + nameFor(dimension)}
              accessibilityState={{ disabled: index === 0 }}
              disabled={index === 0}
              onPress={() => move(index, -1)}
              style={[styles.move, { borderColor: colors.border }, index === 0 && styles.disabled]}
            ><Text style={{ color: colors.textPrimary }}>↑</Text></Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={(isEnglish ? 'Move down ' : 'Bajar ') + nameFor(dimension)}
              accessibilityState={{ disabled: index === dimensions.length - 1 }}
              disabled={index === dimensions.length - 1}
              onPress={() => move(index, 1)}
              style={[styles.move, { borderColor: colors.border }, index === dimensions.length - 1 && styles.disabled]}
            ><Text style={{ color: colors.textPrimary }}>↓</Text></Pressable>
          </View>
        </View>
      ))}
      {mutation.isError && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{isEnglish ? 'Changes were not saved. Reload and retry.' : 'No se guardaron los cambios. Recarga e intenta de nuevo.'}</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: mutation.isPending || !dimensions.length }}
        disabled={mutation.isPending || !dimensions.length}
        onPress={() => mutation.mutate()}
        style={[styles.save, { backgroundColor: colors.actionPrimary }]}
      >
        <Text style={{ color: colors.actionPrimaryContrast, fontWeight: '800' }}>
          {mutation.isPending ? (isEnglish ? 'Saving…' : 'Guardando…') : (isEnglish ? 'Save order' : 'Guardar orden')}
        </Text>
      </Pressable>
      <View style={[styles.notificationSection, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {isEnglish ? 'Suggest another category' : 'Sugerir otra categoría'}
        </Text>
        <Text style={{ color: colors.textSecondary }}>
          {isEnglish
            ? 'Moderation checks duplicates, sample size, bias and utility. Suggestions do not change today’s score.'
            : 'Moderación comprueba duplicados, muestra, sesgo y utilidad. Las sugerencias no cambian el puntaje actual.'}
        </Text>
        <TextInput
          accessibilityLabel={isEnglish ? 'Category name' : 'Nombre de categoría'}
          placeholder={isEnglish ? 'Category name' : 'Nombre de categoría'}
          placeholderTextColor={colors.textSecondary}
          value={suggestionLabel}
          onChangeText={setSuggestionLabel}
          maxLength={80}
          style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
        />
        <TextInput
          accessibilityLabel={isEnglish ? 'Clear definition' : 'Definición comprensible'}
          placeholder={isEnglish ? 'Clear definition' : 'Definición comprensible'}
          placeholderTextColor={colors.textSecondary}
          value={suggestionDefinition}
          onChangeText={setSuggestionDefinition}
          maxLength={500}
          multiline
          style={[styles.input, styles.multiline, { color: colors.textPrimary, borderColor: colors.border }]}
        />
        {suggestionMutation.isSuccess && <Text accessibilityRole="alert" style={{ color: colors.success }}>
          {isEnglish ? 'Suggestion received for moderation.' : 'Sugerencia recibida para moderación.'}
        </Text>}
        {suggestionMutation.isError && <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {isEnglish ? 'The suggestion could not be submitted.' : 'No se pudo enviar la sugerencia.'}
        </Text>}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: suggestionMutation.isPending
            || suggestionLabel.trim().length < 3 || suggestionDefinition.trim().length < 20 }}
          disabled={suggestionMutation.isPending || suggestionLabel.trim().length < 3
            || suggestionDefinition.trim().length < 20}
          onPress={() => suggestionMutation.mutate()}
          style={[styles.secondarySave, { borderColor: colors.actionPrimary }]}
        >
          <Text style={{ color: colors.actionPrimary, fontWeight: '800' }}>
            {isEnglish ? 'Send suggestion' : 'Enviar sugerencia'}
          </Text>
        </Pressable>
      </View>
      <View style={[styles.notificationSection, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {isEnglish ? 'Optional notifications' : 'Notificaciones opcionales'}
        </Text>
        <Text style={{ color: colors.textSecondary }}>
          {isEnglish ? 'All choices start off. Previews omit order and review details.' : 'Todas empiezan apagadas. Los previews omiten detalles de la orden y evaluación.'}
        </Text>
        {([
          ['reviewInvitation', isEnglish ? 'Review invitation' : 'Invitación para evaluar'],
          ['reviewReminder', isEnglish ? 'One reminder' : 'Un recordatorio'],
          ['sellerResponseNotification', isEnglish ? 'Seller response' : 'Respuesta del vendedor'],
          ['moderationChange', isEnglish ? 'Moderation status' : 'Estado de moderación'],
          ['evidenceRequest', isEnglish ? 'Evidence request' : 'Solicitud de evidencia'],
          ['appealResult', isEnglish ? 'Appeal result' : 'Resultado de apelación'],
          ['badgeChange', isEnglish ? 'Badge changes' : 'Cambios de insignias'],
        ] as const).map(([key,label]) => (
          <View key={key} style={styles.notificationRow}>
            <Text style={[styles.notificationLabel, { color: colors.textPrimary }]}>{label}</Text>
            <Switch
              accessibilityLabel={label}
              value={notifications[key]}
              onValueChange={(enabled) => setNotifications((current) => ({ ...current,[key]: enabled }))}
            />
          </View>
        ))}
        {notificationMutation.isError && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{isEnglish ? 'Notification choices were not saved.' : 'No se guardaron las notificaciones.'}</Text>}
        <Pressable
          accessibilityRole="button"
          disabled={notificationMutation.isPending || notificationQuery.isLoading}
          onPress={() => notificationMutation.mutate()}
          style={[styles.secondarySave, { borderColor: colors.actionPrimary }]}
        >
          <Text style={{ color: colors.actionPrimary, fontWeight: '800' }}>
            {isEnglish ? 'Save notifications' : 'Guardar notificaciones'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 20, gap: 14 },
  title: { fontSize: 24, fontWeight: '900' },
  explanation: { fontSize: 15, lineHeight: 22 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, gap: 4 },
  label: { fontWeight: '800' },
  buttons: { flexDirection: 'row', gap: 6 },
  move: { borderWidth: 1, borderRadius: 8, minWidth: 42, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  save: { borderRadius: 8, padding: 14, alignItems: 'center' },
  notificationSection: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  notificationRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  notificationLabel: { flex: 1 },
  secondarySave: { borderWidth: 1, borderRadius: 8, padding: 12, alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 8, minHeight: 48, paddingHorizontal: 12, paddingVertical: 10 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
});
