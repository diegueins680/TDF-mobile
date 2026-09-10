import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MerchReputation, type MerchReviewSubmit } from '../../src/api/merchReputation';
import { normalizeRouteParam } from '../../src/lib/routeParams';
import { useUserSettings } from '../../src/providers/UserSettingsProvider';
import { useAppTheme } from '../../src/theme/ThemeProvider';

type Selection =
  | { kind: 'store'; revision: number }
  | { kind: 'product'; lineId: string; name: string; revision: number };

const dimensionsByKind = {
  store: ['preparation_dispatch', 'communication', 'packaging'],
  product: ['description_accuracy', 'product_quality'],
} as const;

const labels: Record<string, { es: string; en: string }> = {
  preparation_dispatch: { es: 'Preparación y despacho', en: 'Preparation and dispatch' },
  communication: { es: 'Comunicación', en: 'Communication' },
  packaging: { es: 'Empaque', en: 'Packaging' },
  problem_resolution: { es: 'Resolución de problemas', en: 'Problem resolution' },
  description_accuracy: { es: 'Conforme a la descripción', en: 'Matches the description' },
  product_quality: { es: 'Calidad del producto', en: 'Product quality' },
};

type ReviewState = 'available' | 'edit_available' | 'period_expired';

function reviewStateLabel(state: ReviewState, eligible: boolean, received: boolean, english: boolean) {
  if (state === 'period_expired') return english ? 'Review period expired' : 'Periodo de evaluación expirado';
  if (state === 'edit_available') return english ? 'Review submitted · Editing available' : 'Evaluación enviada · Edición disponible';
  if (!eligible && !received) return english ? 'Available after receiving this line' : 'Disponible después de recibir esta línea';
  if (!eligible) return english ? 'Not eligible for this account' : 'Esta cuenta no puede evaluar';
  return english ? 'Review available' : 'Evaluación disponible';
}

function RatingField({
  label,
  value,
  onChange,
  english,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  english: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((rating) => (
          <Pressable
            key={rating}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === rating }}
            accessibilityLabel={`${label}: ${rating} ${english ? 'of' : 'de'} 5`}
            onPress={() => onChange(rating)}
            style={[
              styles.ratingButton,
              { borderColor: colors.border },
              value === rating && { backgroundColor: colors.actionPrimary },
            ]}
          >
            <Text style={{ color: value === rating ? colors.actionPrimaryContrast : colors.textPrimary }}>
              {rating} ★
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function MerchOrderReviewScreen() {
  const { colors } = useAppTheme();
  const { locale } = useUserSettings();
  const english = locale.startsWith('en');
  const t = (es: string, en: string) => english ? en : es;
  const queryClient = useQueryClient();
  const { orderId: rawOrderId } = useLocalSearchParams<{ orderId?: string | string[] }>();
  const orderId = normalizeRouteParam(rawOrderId);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [overall, setOverall] = useState(0);
  const [issue, setIssue] = useState(false);
  const [comment, setComment] = useState('');
  const [dimensions, setDimensions] = useState<Record<string, number>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const beginReview = (nextSelection: Selection) => {
    setSelection(nextSelection);
    setOverall(0);
    setIssue(false);
    setComment('');
    setDimensions({});
    setValidationError(null);
  };
  const eligibility = useQuery({
    queryKey: ['merch-review-eligibility', orderId],
    queryFn: () => MerchReputation.eligibility(orderId!),
    enabled: Boolean(orderId),
    retry: false,
  });
  const dimensionKeys = useMemo(() => {
    if (!selection) return [];
    const base: string[] = [...dimensionsByKind[selection.kind]];
    if (selection.kind === 'store' && issue) base.push('problem_resolution');
    if (selection.kind === 'store' && eligibility.data?.orderState === 'cancelled') {
      return issue ? ['communication', 'problem_resolution'] : ['communication'];
    }
    return base;
  }, [eligibility.data?.orderState, issue, selection]);
  const mutation = useMutation({
    mutationFn: (body: MerchReviewSubmit) => {
      if (!selection || !orderId) throw new Error('missing selection');
      return selection.kind === 'store'
        ? MerchReputation.submitStore(orderId, body)
        : MerchReputation.submitProduct(orderId, selection.lineId, body);
    },
    onSuccess: async () => {
      setSelection(null);
      setOverall(0);
      setIssue(false);
      setComment('');
      setDimensions({});
      await queryClient.invalidateQueries({ queryKey: ['merch-review-eligibility', orderId] });
    },
  });

  const submit = () => {
    if (!selection || overall < 1 || dimensionKeys.some((key) => !dimensions[key])) {
      setValidationError(t('Completa la evaluación general y cada categoría.', 'Complete the overall rating and every category.'));
      return;
    }
    if (comment.trim().length > 0 && comment.trim().length < 10) {
      setValidationError(t('El comentario debe tener al menos 10 caracteres.', 'The comment must be at least 10 characters long.'));
      return;
    }
    setValidationError(null);
    mutation.mutate({
      overallRating: overall,
      issueOccurred: issue,
      comment: comment.trim() || undefined,
      dimensions: Object.fromEntries(dimensionKeys.map((key) => [key, dimensions[key]])),
      expectedRevision: selection.revision,
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[styles.heading, { color: colors.textPrimary }]}>
          {t('Evalúa tu compra', 'Review your purchase')}
        </Text>
        <Text style={{ color: colors.textSecondary }}>
          {t(
            'Producto, atención y logística se califican por separado. No necesitas comparar tiendas.',
            'Product, service, and logistics are rated separately. You do not need to compare stores.',
          )}
        </Text>
        {!orderId && (
          <Text accessibilityRole="alert" style={[styles.errorState, { color: colors.danger }]}>
            {t('Falta una orden válida para evaluar.', 'A valid order is required to review.')}
          </Text>
        )}
        {orderId && eligibility.isLoading && (
          <ActivityIndicator accessibilityLabel={t('Cargando evaluación', 'Loading review')} />
        )}
        {orderId && eligibility.isError && (
          <View style={styles.errorState}>
            <Text accessibilityRole="alert" style={{ color: colors.danger }}>
              {t('No pudimos cargar esta orden o no tienes permiso.', 'We could not load this order, or you do not have permission.')}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => eligibility.refetch()}
              style={[styles.retry, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{t('Reintentar', 'Try again')}</Text>
            </Pressable>
          </View>
        )}
        {eligibility.isFetching && !eligibility.isLoading && (
          <ActivityIndicator accessibilityLabel={t('Actualizando evaluación', 'Refreshing review')} />
        )}
        {eligibility.data?.storeReview && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !eligibility.data.storeReview.eligible }}
            disabled={!eligibility.data.storeReview.eligible}
            onPress={() => beginReview({
              kind: 'store',
              revision: eligibility.data.storeReview.currentRevision,
            })}
            style={[
              styles.card,
              { borderColor: colors.border, backgroundColor: colors.surface },
              !eligibility.data.storeReview.eligible && styles.disabled,
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('Experiencia con la tienda', 'Store experience')}</Text>
            <Text style={{ color: colors.textSecondary }}>{t('Atención y logística', 'Service and logistics')}</Text>
            <Text style={{ color: colors.textSecondary }}>
              {reviewStateLabel(
                eligibility.data.storeReview.state,
                eligibility.data.storeReview.eligible,
                ['delivered', 'picked_up', 'partially_delivered'].includes(eligibility.data.fulfillmentState),
                english,
              )}
            </Text>
          </Pressable>
        )}
        {eligibility.data?.productLines.map((line) => (
          <Pressable
            key={line.lineId}
            accessibilityRole="button"
            accessibilityState={{ disabled: !line.eligible }}
            disabled={!line.eligible}
            onPress={() => beginReview({
              kind: 'product',
              lineId: line.lineId,
              name: line.productName,
              revision: line.currentRevision,
            })}
            style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }, !line.eligible && styles.disabled]}
          >
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{line.productName}</Text>
            <Text style={{ color: colors.textSecondary }}>
              {t('Valoración del producto', 'Product rating')} · {reviewStateLabel(
                line.state,
                line.eligible,
                ['delivered', 'picked_up'].includes(line.fulfillmentState),
                english,
              )}
            </Text>
          </Pressable>
        ))}
        {selection && (
          <View style={[styles.form, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.textPrimary }]}>
              {selection.kind === 'store' ? t('Experiencia comercial', 'Commercial experience') : selection.name}
            </Text>
            <RatingField label={t('Evaluación general', 'Overall rating')} value={overall} onChange={setOverall} english={english} />
            {selection.kind === 'store' && (
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: issue }} onPress={() => setIssue(!issue)}>
                <Text style={{ color: colors.textPrimary }}>
                  {issue ? '☑' : '☐'} {t('Hubo un problema que resolver', 'There was a problem to resolve')}
                </Text>
              </Pressable>
            )}
            {dimensionKeys.map((key) => (
              <RatingField
                key={key}
                label={labels[key]?.[english ? 'en' : 'es'] ?? key}
                value={dimensions[key] ?? 0}
                onChange={(value) => setDimensions((current) => ({ ...current, [key]: value }))}
                english={english}
              />
            ))}
            <Text style={[styles.label, { color: colors.textPrimary }]}>{t('Comentario opcional', 'Optional comment')}</Text>
            <TextInput
              accessibilityLabel={t('Comentario opcional', 'Optional comment')}
              multiline
              maxLength={3000}
              value={comment}
              onChangeText={setComment}
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
            />
            {(validationError || mutation.isError) && (
              <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                {validationError ?? t('No se guardó. Inténtalo nuevamente.', 'It was not saved. Please try again.')}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: mutation.isPending }}
              disabled={mutation.isPending}
              onPress={submit}
              style={[styles.submit, { backgroundColor: colors.actionPrimary }]}
            >
              <Text style={{ color: colors.actionPrimaryContrast, fontWeight: '800' }}>
                {mutation.isPending
                  ? t('Guardando…', 'Saving…')
                  : selection.revision > 0
                    ? t('Guardar cambios', 'Save changes')
                    : t('Enviar evaluación', 'Submit review')}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  heading: { fontSize: 28, fontWeight: '900' },
  errorState: { gap: 10 },
  retry: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 4 },
  cardTitle: { fontSize: 18, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  form: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 16 },
  field: { gap: 8 },
  label: { fontSize: 15, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  ratingButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, minWidth: 48, alignItems: 'center' },
  input: { minHeight: 96, borderWidth: 1, borderRadius: 8, padding: 12, textAlignVertical: 'top' },
  submit: { alignItems: 'center', borderRadius: 8, padding: 14 },
});
