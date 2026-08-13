import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ScrollView, View, Text, Alert, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listPipeline, updateStage } from '../../src/api/pipelines';
import type { PipelineCard, PipelineKind, PipelineStage } from '../../src/types';
import { StagePill } from '../../src/components/StagePill';
import { useAppTheme } from '../../src/theme/ThemeProvider';

const STAGES: PipelineStage[] = ['Intake', 'Editing', 'Mixing', 'Revisions', 'Mastering', 'Approved'];

type MovePayload = { kind: PipelineKind; id: PipelineCard['id']; stage: PipelineStage };

function Column({
  title,
  cards,
  onMove,
  cardBg,
  cardBorder,
  cardTitleColor,
  emptyTextColor,
}: {
  title: string;
  cards: PipelineCard[];
  onMove: (id: PipelineCard['id'], to: PipelineStage) => void;
  cardBg: string;
  cardBorder: string;
  cardTitleColor: string;
  emptyTextColor: string;
}) {
  return (
    <View style={styles.col}>
      <Text style={[styles.colTitle, { color: cardTitleColor }]}>{title}</Text>
      {cards.length === 0 ? (
        <Text style={[styles.emptyText, { color: emptyTextColor }]}>No cards yet</Text>
      ) : null}
      {cards.map(c => (
        <Pressable key={String(c.id)} style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
          onLongPress={() => {
            Alert.alert(
              'Move to stage',
              undefined,
              STAGES.map((s) => ({
                text: s,
                onPress: () => onMove(c.id, s),
              })),
            );
          }}
        >
          <Text style={styles.cardTitle}>{c.title}</Text>
          {c.artist ? <Text style={{ color: emptyTextColor }}>{c.artist}</Text> : null}
          <StagePill stage={c.stage} />
        </Pressable>
      ))}
    </View>
  );
}

export default function Pipelines() {
  const { colors } = useAppTheme();
  const qc = useQueryClient();
  const mixing = useQuery<PipelineCard[]>({ queryKey: ['pipeline', 'mixing'], queryFn: () => listPipeline('mixing') });
  const mastering = useQuery<PipelineCard[]>({ queryKey: ['pipeline', 'mastering'], queryFn: () => listPipeline('mastering') });

  const m = useMutation<void, Error, MovePayload>({
    mutationFn: ({ kind, id, stage }) => updateStage(kind, id, stage),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['pipeline', vars.kind] }),
  });

  if (mixing.isLoading || mastering.isLoading) {
    return (
      <SafeAreaView style={[styles.page, { backgroundColor: colors.canvas }]} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.actionPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  if (mixing.isError || mastering.isError) {
    return (
      <SafeAreaView style={[styles.page, { backgroundColor: colors.canvas }]} edges={['top']}>
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.danger }]}>Could not load pipelines.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const mixingCards = mixing.data || [];
  const masteringCards = mastering.data || [];

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: colors.canvas }]} edges={['top']}>
      <ScrollView horizontal contentContainerStyle={styles.content}>
        <Column title="Mixing" cards={mixingCards}
          onMove={(id, stage) => m.mutate({ kind: 'mixing', id, stage })}
          cardBg={colors.surface}
          cardBorder={colors.borderSubtle}
          cardTitleColor={colors.textPrimary}
          emptyTextColor={colors.textSecondary}
        />
        <Column title="Mastering" cards={masteringCards}
          onMove={(id, stage) => m.mutate({ kind: 'mastering', id, stage })}
          cardBg={colors.surface}
          cardBorder={colors.borderSubtle}
          cardTitleColor={colors.textPrimary}
          emptyTextColor={colors.textSecondary}
        />
        <View style={[styles.helpCard, { backgroundColor: colors.infoSurface, borderColor: colors.infoBorder }]}>
          <Text style={[styles.helpTitle, { color: colors.actionPrimary }]}>Tip</Text>
          <Text style={[styles.helpText, { color: colors.textPrimary }]}>Long-press any card to move it to another stage.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: {
    paddingHorizontal: 12,
    paddingTop: 28,
    paddingBottom: 12,
  },
  col: { width: 280, marginRight: 12 },
  colTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptyText: { marginBottom: 8 },
  card: { padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, gap: 4 },
  cardTitle: { fontWeight: '600' },
  errorText: { fontSize: 14 },
  helpCard: {
    width: 220,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignSelf: 'flex-start',
  },
  helpTitle: { fontWeight: '700', marginBottom: 4 },
  helpText: { lineHeight: 20, fontSize: 13 },
});
