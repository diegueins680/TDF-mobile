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

import { createReviewIdempotencyKey, Reviews } from '../../api/reviews';
import { useAuth } from '../../providers/AuthProvider';
import { useAppTheme } from '../../theme/ThemeProvider';
import { Stars } from './ExperienceReviews';

type Props = {
  profileId: string;
  slug: string;
};

export function DirectoryProfileReviews({ profileId, slug }: Props) {
  const { colors } = useAppTheme();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const createAttempt = useRef<{ fingerprint: string; key: string } | null>(null);

  const reviewsQuery = useQuery({
    queryKey: ['directory-profile-reviews', slug],
    queryFn: () => Reviews.listDirectoryProfile(slug),
  });
  const eligibilityQuery = useQuery({
    queryKey: ['directory-review-eligibility', profileId],
    queryFn: Reviews.directoryEligibility,
    enabled: Boolean(token?.trim()),
    select: (items) => items.filter((item) => item.subjectProfile.id === profileId),
  });
  const eligibility = eligibilityQuery.data?.[0];
  const normalizedBody = body.trim();
  const bodyValid = normalizedBody.length === 0 || normalizedBody.length >= 10;

  const createMutation = useMutation({
    mutationFn: () => {
      if (!eligibility || rating === 0) throw new Error('No tienes una interacción elegible con este perfil.');
      const request = {
        interactionId: eligibility.interactionId,
        authorProfileId: eligibility.authorProfile.id,
        subjectProfileId: profileId,
        rating,
        body: normalizedBody || undefined,
      };
      const fingerprint = JSON.stringify(request);
      if (createAttempt.current?.fingerprint !== fingerprint) {
        createAttempt.current = { fingerprint, key: createReviewIdempotencyKey() };
      }
      return Reviews.createDirectory(request, createAttempt.current.key);
    },
    onSuccess: async () => {
      createAttempt.current = null;
      setRating(0);
      setBody('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['directory-profile-reviews', slug] }),
        queryClient.invalidateQueries({ queryKey: ['directory-review-eligibility', profileId] }),
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
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>Reseñas profesionales</Text>
      <View style={styles.row}>
        <Stars value={Math.round(Number(summary?.average ?? 0))} />
        <Text style={[styles.meta, { color: colors.textSecondary }]}>{summaryText}</Text>
      </View>

      {eligibility ? (
        <View style={[styles.composer, { backgroundColor: colors.canvas }]}>
          <View style={styles.row}>
            <MaterialCommunityIcons name="check-decagram" size={18} color={colors.success} />
            <Text style={[styles.verified, { color: colors.textPrimary }]}>Colaboración verificada</Text>
          </View>
          <Stars value={rating} onChange={setRating} />
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Describe tu experiencia (opcional)"
            placeholderTextColor={colors.textSecondary}
            maxLength={2000}
            multiline
            style={[styles.input, { color: colors.textPrimary, borderColor: bodyValid ? colors.border : colors.danger }]}
          />
          {!bodyValid ? <Text style={[styles.error, { color: colors.danger }]}>Escribe al menos 10 caracteres o deja el comentario vacío.</Text> : null}
          {createMutation.error ? <Text style={[styles.error, { color: colors.danger }]}>{createMutation.error.message}</Text> : null}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.actionPrimary }, (!rating || !bodyValid || createMutation.isPending) && styles.disabled]}
            onPress={() => createMutation.mutate()}
            disabled={!rating || !bodyValid || createMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel="Publicar reseña profesional verificada"
          >
            {createMutation.isPending
              ? <ActivityIndicator color={colors.actionPrimaryContrast} />
              : <Text style={[styles.buttonText, { color: colors.actionPrimaryContrast }]}>Publicar reseña</Text>}
          </TouchableOpacity>
        </View>
      ) : null}
      {token?.trim() && eligibilityQuery.isSuccess && !eligibility ? (
        <Text style={[styles.notice, { color: colors.textSecondary }]}>Solo los perfiles con una colaboración completada pueden reseñar.</Text>
      ) : null}
      {!token?.trim() ? <Text style={[styles.notice, { color: colors.textSecondary }]}>Inicia sesión para reseñar una colaboración completada.</Text> : null}
      {reviewsQuery.isLoading ? <ActivityIndicator color={colors.actionPrimary} /> : null}
      {reviewsQuery.isError ? <Text style={[styles.error, { color: colors.danger }]}>No pudimos cargar las reseñas.</Text> : null}

      {reviewsQuery.data?.items.map((review) => (
        <View key={review.id} style={[styles.review, { borderTopColor: colors.border }]}>
          <View style={styles.reviewHeader}>
            <Text style={[styles.author, { color: colors.textPrimary }]}>{review.authorProfile.name}</Text>
            <View style={styles.row}>
              <MaterialCommunityIcons name="check-decagram" size={15} color={colors.success} />
              <Text style={[styles.verifiedLabel, { color: colors.success }]}>Verificada</Text>
            </View>
            {token?.trim() ? (
              <TouchableOpacity
                onPress={() => reportMutation.mutate(review.id)}
                disabled={reportMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel={`Reportar reseña de ${review.authorProfile.name}`}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  meta: { fontSize: 12 },
  composer: { borderRadius: 12, padding: 12, gap: 10 },
  verified: { fontSize: 13, fontWeight: '700' },
  input: { minHeight: 88, borderWidth: 1, borderRadius: 10, padding: 10, textAlignVertical: 'top' },
  error: { fontSize: 12 },
  notice: { fontSize: 13, lineHeight: 18 },
  button: { minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  review: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 5 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  author: { fontSize: 14, fontWeight: '700', flex: 1 },
  verifiedLabel: { fontSize: 11, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20 },
});
