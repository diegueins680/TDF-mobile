import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createReviewIdempotencyKey,
  Reviews,
  type ExperienceReviewTargetKind,
} from '../../api/reviews';
import { useAuth } from '../../providers/AuthProvider';
import { useAppTheme } from '../../theme/ThemeProvider';

type Props = {
  targetKind: ExperienceReviewTargetKind;
  targetId: string;
  title?: string;
};

export function Stars({ value, onChange }: { value: number; onChange?: (value: number) => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          disabled={!onChange}
          onPress={() => onChange?.(star)}
          accessibilityRole={onChange ? 'radio' : undefined}
          accessibilityState={onChange ? { selected: value === star } : undefined}
          accessibilityLabel={`${star} de 5 estrellas`}
        >
          <MaterialCommunityIcons
            name={star <= value ? 'star' : 'star-outline'}
            size={onChange ? 30 : 18}
            color={star <= value ? '#f59e0b' : colors.textSecondary}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function ExperienceReviews({ targetKind, targetId, title = 'Reseñas' }: Props) {
  const { colors } = useAppTheme();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const createAttempt = useRef<{ fingerprint: string; key: string } | null>(null);

  const reviewsQuery = useQuery({
    queryKey: ['experience-reviews', targetKind, targetId],
    queryFn: () => Reviews.list(targetKind, targetId),
    enabled: Boolean(targetId),
  });
  const eligibilityQuery = useQuery({
    queryKey: ['experience-review-eligibility', targetKind, targetId],
    queryFn: () => Reviews.eligibility(targetKind, targetId),
    enabled: Boolean(token?.trim() && targetId),
  });
  const eligibility = eligibilityQuery.data?.[0];
  const normalizedBody = body.trim();
  const bodyValid = normalizedBody.length === 0 || normalizedBody.length >= 10;

  const createMutation = useMutation({
    mutationFn: () => {
      if (!eligibility || rating === 0) throw new Error('Esta cuenta no tiene una interacción elegible.');
      const request = {
        targetKind,
        targetId,
        sourceKind: eligibility.sourceKind,
        sourceId: eligibility.sourceId,
        rating,
        body: normalizedBody || undefined,
      };
      const fingerprint = JSON.stringify(request);
      if (createAttempt.current?.fingerprint !== fingerprint) {
        createAttempt.current = { fingerprint, key: createReviewIdempotencyKey() };
      }
      return Reviews.create(request, createAttempt.current.key);
    },
    onSuccess: async () => {
      createAttempt.current = null;
      setRating(0);
      setBody('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['experience-reviews', targetKind, targetId] }),
        queryClient.invalidateQueries({ queryKey: ['experience-review-eligibility', targetKind, targetId] }),
      ]);
    },
  });
  const reportMutation = useMutation({
    mutationFn: (reviewId: string) => Reviews.report(reviewId),
    onSuccess: () => Alert.alert('Reporte enviado', 'Gracias. Revisaremos esta reseña.'),
    onError: () => Alert.alert('No se pudo reportar', 'Inténtalo nuevamente.'),
  });

  const summary = reviewsQuery.data?.summary;
  const summaryText = summary?.count
    ? `${Number(summary.average ?? 0).toFixed(1)} de 5 · ${summary.count} ${summary.count === 1 ? 'reseña' : 'reseñas'}`
    : 'Aún no hay reseñas';

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <View style={styles.summary}>
        <Stars value={Math.round(Number(summary?.average ?? 0))} />
        <Text style={[styles.meta, { color: colors.textSecondary }]}>{summaryText}</Text>
      </View>

      {token?.trim() && eligibility ? (
        <View style={[styles.composer, { backgroundColor: colors.canvas }]}>
          <View style={styles.verifiedRow}>
            <MaterialCommunityIcons name="check-decagram" size={18} color={colors.success} />
            <Text style={[styles.verifiedText, { color: colors.textPrimary }]}>Interacción completada y verificada</Text>
          </View>
          <Stars value={rating} onChange={setRating} />
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Cuéntanos cómo fue (opcional)"
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={2000}
            style={[styles.input, { color: colors.textPrimary, borderColor: bodyValid ? colors.border : colors.danger }]}
            accessibilityLabel="Comentario de la reseña"
          />
          {!bodyValid ? <Text style={[styles.error, { color: colors.danger }]}>Escribe al menos 10 caracteres o deja el comentario vacío.</Text> : null}
          {createMutation.error ? (
            <Text style={[styles.error, { color: colors.danger }]}>
              {createMutation.error instanceof Error ? createMutation.error.message : 'No pudimos publicar la reseña.'}
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={() => createMutation.mutate()}
            disabled={!rating || !bodyValid || createMutation.isPending}
            style={[
              styles.button,
              { backgroundColor: colors.actionPrimary },
              (!rating || !bodyValid || createMutation.isPending) && styles.disabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Publicar reseña verificada"
          >
            {createMutation.isPending
              ? <ActivityIndicator color={colors.actionPrimaryContrast} />
              : <Text style={[styles.buttonText, { color: colors.actionPrimaryContrast }]}>Publicar reseña</Text>}
          </TouchableOpacity>
        </View>
      ) : null}

      {token?.trim() && eligibilityQuery.isSuccess && !eligibility ? (
        <Text style={[styles.notice, { color: colors.textSecondary }]}>Podrás reseñar después de completar una compra, asistencia o servicio.</Text>
      ) : null}
      {!token?.trim() ? (
        <Text style={[styles.notice, { color: colors.textSecondary }]}>Inicia sesión para reseñar una interacción completada.</Text>
      ) : null}
      {reviewsQuery.isLoading ? <ActivityIndicator color={colors.actionPrimary} /> : null}
      {reviewsQuery.isError ? <Text style={[styles.error, { color: colors.danger }]}>No pudimos cargar las reseñas.</Text> : null}

      {reviewsQuery.data?.items.map((review) => (
        <View key={review.id} style={[styles.review, { borderTopColor: colors.border }]}>
          <View style={styles.reviewHeader}>
            <Text style={[styles.author, { color: colors.textPrimary }]}>{review.author.name}</Text>
            <View style={styles.verifiedRow}>
              <MaterialCommunityIcons name="check-decagram" size={15} color={colors.success} />
              <Text style={[styles.verifiedLabel, { color: colors.success }]}>Verificada</Text>
            </View>
            {token?.trim() ? (
              <TouchableOpacity
                onPress={() => reportMutation.mutate(review.id)}
                disabled={reportMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel={`Reportar reseña de ${review.author.name}`}
              >
                <MaterialCommunityIcons name="flag-outline" size={19} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
          <Stars value={review.rating} />
          {review.body ? <Text style={[styles.body, { color: colors.textPrimary }]}>{review.body}</Text> : null}
          <Text style={[styles.meta, { color: colors.textSecondary }]}>{new Date(review.createdAt).toLocaleDateString()}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '800' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  meta: { fontSize: 12 },
  composer: { borderRadius: 12, padding: 12, gap: 10 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  verifiedText: { fontSize: 13, fontWeight: '700' },
  verifiedLabel: { fontSize: 11, fontWeight: '700' },
  input: { minHeight: 88, borderWidth: 1, borderRadius: 10, padding: 10, textAlignVertical: 'top' },
  button: { minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  notice: { fontSize: 13, lineHeight: 18 },
  error: { fontSize: 12, lineHeight: 17 },
  review: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 5 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  author: { fontSize: 14, fontWeight: '700', flex: 1 },
  body: { fontSize: 14, lineHeight: 20 },
});
