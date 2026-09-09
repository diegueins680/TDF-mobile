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
import { useAppTheme } from '../../src/theme/ThemeProvider';

type Selection =
  | { kind: 'store'; revision: number }
  | { kind: 'product'; lineId: string; name: string; revision: number };

const dimensionsByKind = {
  store: ['preparation_dispatch', 'communication', 'packaging'],
  product: ['description_accuracy', 'product_quality'],
} as const;

const labels: Record<string, string> = {
  preparation_dispatch: 'Preparación y despacho',
  communication: 'Comunicación',
  packaging: 'Empaque',
  problem_resolution: 'Resolución de problemas',
  description_accuracy: 'Conforme a la descripción',
  product_quality: 'Calidad del producto',
};

function RatingField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
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
            accessibilityLabel={rating + ' de 5'}
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
  const queryClient = useQueryClient();
  const { orderId: rawOrderId } = useLocalSearchParams<{ orderId?: string | string[] }>();
  const orderId = normalizeRouteParam(rawOrderId);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [overall, setOverall] = useState(0);
  const [issue, setIssue] = useState(false);
  const [comment, setComment] = useState('');
  const [dimensions, setDimensions] = useState<Record<string, number>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
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
      setValidationError('Completa la evaluación general y cada categoría.');
      return;
    }
    if (comment.trim().length > 0 && comment.trim().length < 10) {
      setValidationError('El comentario debe tener al menos 10 caracteres.');
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
          Evalúa tu compra
        </Text>
        <Text style={{ color: colors.textSecondary }}>
          Producto, atención y logística se califican por separado. No necesitas comparar tiendas.
        </Text>
        {eligibility.isLoading && <ActivityIndicator accessibilityLabel="Cargando evaluación" />}
        {eligibility.isError && (
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>
            No pudimos cargar esta orden o no tienes permiso.
          </Text>
        )}
        {eligibility.data?.storeReview.eligible && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setSelection({
              kind: 'store',
              revision: eligibility.data?.storeReview.currentRevision ?? 0,
            })}
            style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Experiencia con la tienda</Text>
            <Text style={{ color: colors.textSecondary }}>Atención y logística</Text>
          </Pressable>
        )}
        {eligibility.data?.productLines.map((line) => (
          <Pressable
            key={line.lineId}
            accessibilityRole="button"
            accessibilityState={{ disabled: !line.eligible }}
            disabled={!line.eligible}
            onPress={() => setSelection({
              kind: 'product',
              lineId: line.lineId,
              name: line.productName,
              revision: line.currentRevision,
            })}
            style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }, !line.eligible && styles.disabled]}
          >
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{line.productName}</Text>
            <Text style={{ color: colors.textSecondary }}>
              {line.eligible ? 'Valoración del artículo recibido' : 'Disponible después de recibir esta línea'}
            </Text>
          </Pressable>
        ))}
        {selection && (
          <View style={[styles.form, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.textPrimary }]}>
              {selection.kind === 'store' ? 'Experiencia comercial' : selection.name}
            </Text>
            <RatingField label="Evaluación general" value={overall} onChange={setOverall} />
            {selection.kind === 'store' && (
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: issue }} onPress={() => setIssue(!issue)}>
                <Text style={{ color: colors.textPrimary }}>{issue ? '☑' : '☐'} Hubo un problema que resolver</Text>
              </Pressable>
            )}
            {dimensionKeys.map((key) => (
              <RatingField
                key={key}
                label={labels[key] ?? key}
                value={dimensions[key] ?? 0}
                onChange={(value) => setDimensions((current) => ({ ...current, [key]: value }))}
              />
            ))}
            <Text style={[styles.label, { color: colors.textPrimary }]}>Comentario opcional</Text>
            <TextInput
              accessibilityLabel="Comentario opcional"
              multiline
              maxLength={3000}
              value={comment}
              onChangeText={setComment}
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
            />
            {(validationError || mutation.isError) && (
              <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                {validationError ?? 'No se guardó. Inténtalo nuevamente.'}
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
                {selection.revision > 0 ? 'Guardar cambios' : 'Enviar evaluación'}
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
