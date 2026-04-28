import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ScrollView, View, Text, Alert, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listPipeline, updateStage } from '../../src/api/pipelines';
import type { PipelineCard, PipelineKind, PipelineStage } from '../../src/types';
import { StagePill } from '../../src/components/StagePill';

const STAGES: PipelineStage[] = ['Intake', 'Editing', 'Mixing', 'Revisions', 'Mastering', 'Approved'];

type MovePayload = { kind: PipelineKind; id: PipelineCard['id']; stage: PipelineStage };

function Column({
  title,
  cards,
  onMove,
}: {
  title: string;
  cards: PipelineCard[];
  onMove: (id: PipelineCard['id'], to: PipelineStage) => void;
}) {
  return (
    <View style={styles.col}>
      <Text style={styles.colTitle}>{title}</Text>
      {cards.length === 0 ? (
        <Text style={styles.emptyText}>No cards yet</Text>
      ) : null}
      {cards.map(c => (
        <Pressable key={String(c.id)} style={styles.card}
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
          {c.artist ? <Text>{c.artist}</Text> : null}
          <StagePill stage={c.stage} />
        </Pressable>
      ))}
    </View>
  );
}

export default function Pipelines() {
  const qc = useQueryClient();
  const mixing = useQuery<PipelineCard[]>({ queryKey: ['pipeline', 'mixing'], queryFn: () => listPipeline('mixing') });
  const mastering = useQuery<PipelineCard[]>({ queryKey: ['pipeline', 'mastering'], queryFn: () => listPipeline('mastering') });

  const m = useMutation<void, Error, MovePayload>({
    mutationFn: ({ kind, id, stage }) => updateStage(kind, id, stage),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['pipeline', vars.kind] }),
  });

  if (mixing.isLoading || mastering.isLoading) {
    return (
      <SafeAreaView style={styles.page} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  if (mixing.isError || mastering.isError) {
    return (
      <SafeAreaView style={styles.page} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Could not load pipelines.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const mixingCards = mixing.data || [];
  const masteringCards = mastering.data || [];

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView horizontal contentContainerStyle={styles.content}>
        <Column title="Mixing" cards={mixingCards}
          onMove={(id, stage) => m.mutate({ kind: 'mixing', id, stage })} />
        <Column title="Mastering" cards={masteringCards}
          onMove={(id, stage) => m.mutate({ kind: 'mastering', id, stage })} />
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Tip</Text>
          <Text style={styles.helpText}>Long-press any card to move it to another stage.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: {
    paddingHorizontal: 12,
    paddingTop: 28,
    paddingBottom: 12,
  },
  col: { width: 280, marginRight: 12 },
  colTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: '#6b7280', marginBottom: 8 },
  card: { backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#eee', gap: 4 },
  cardTitle: { fontWeight: '600' },
  errorText: { color: '#dc2626', fontSize: 14 },
  helpCard: {
    width: 220,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    padding: 12,
    alignSelf: 'flex-start',
  },
  helpTitle: { fontWeight: '700', color: '#1d4ed8', marginBottom: 4 },
  helpText: { color: '#1e3a8a', lineHeight: 20, fontSize: 13 },
});
