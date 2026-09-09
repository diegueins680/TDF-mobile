import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MerchReputation, type MerchReputationSummary } from '../../api/merchReputation';
import { useAppTheme } from '../../theme/ThemeProvider';

export function MerchStoreReputation({ summary }: { summary: MerchReputationSummary }) {
  const { colors } = useAppTheme();
  const count = summary.verifiedReviewCount ?? 0;
  const published = summary.state === 'published' && summary.rating != null;
  return (
    <View
      style={[styles.summary, { borderColor: colors.border, backgroundColor: colors.surface }]}
      accessible
      accessibilityLabel="Reputación comercial de la tienda"
    >
      <Text style={[styles.overline, { color: colors.textSecondary }]}>REPUTACIÓN COMERCIAL</Text>
      {summary.state === 'new_store' ? (
        <>
          <Text style={[styles.score, { color: colors.textPrimary }]}>Tienda nueva</Text>
          <Text style={{ color: colors.textSecondary }}>
            Sin nota hasta contar con cinco órdenes evaluables.
          </Text>
        </>
      ) : published ? (
        <>
          <Text style={[styles.score, { color: colors.textPrimary }]}>
            {Number(summary.rating).toFixed(1)} ★ / 5
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            {count} {count === 1 ? 'evaluación verificada' : 'evaluaciones verificadas'}
          </Text>
        </>
      ) : (
        <Text style={{ color: colors.textSecondary }}>Sin evaluaciones verificadas.</Text>
      )}
    </View>
  );
}

export function ArtistMerchStores({ artistPartyId }: { artistPartyId: string | number }) {
  const { colors } = useAppTheme();
  const query = useQuery({
    queryKey: ['artist-merch-stores', artistPartyId],
    queryFn: () => MerchReputation.artistStores(artistPartyId),
    retry: false,
  });

  if (query.isLoading) {
    return <ActivityIndicator accessibilityLabel="Cargando tiendas" color={colors.actionPrimary} />;
  }
  if (query.isError || !query.data?.length) return null;
  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: colors.textPrimary }]}>Tiendas de merch</Text>
      <Text style={[styles.explanation, { color: colors.textSecondary }]}>
        Estas notas describen la experiencia comercial. No miden calidad artística,
        popularidad ni reputación profesional.
      </Text>
      {query.data.map((store) => (
        <View key={store.id ?? store.storeId}>
          <Text style={[styles.storeName, { color: colors.textPrimary }]}>
            {store.name ?? store.storeName}
          </Text>
          <MerchStoreReputation summary={{ ...store, subjectKind: 'store' }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, marginBottom: 24 },
  heading: { fontSize: 20, fontWeight: '800' },
  explanation: { fontSize: 14, lineHeight: 20 },
  summary: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 5 },
  overline: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  score: { fontSize: 20, fontWeight: '900' },
  storeName: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
});
