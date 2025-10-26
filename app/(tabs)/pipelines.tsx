import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPipeline, updateStage } from '../../src/api/pipelines';
import { ScrollView, View, Text, Alert, StyleSheet, Pressable } from 'react-native';
import type { PipelineCard, PipelineStage } from '../../src/types';
import { StagePill } from '../../src/components/StagePill';

const STAGES: PipelineStage[] = ['Intake','Editing','Mixing','Revisions','Mastering','Approved'];

function Column({
  title, cards, onMove
}: {
  title: string;
  cards: PipelineCard[];
  onMove: (id: PipelineCard['id'], to: PipelineStage) => void;
}) {
  return (
    <View style={styles.col}>
      <Text style={styles.colTitle}>{title}</Text>
      {cards.map(c => (
        <Pressable key={String(c.id)} style={styles.card}
          onLongPress={() => {
            Alert.alert('Move to stage', undefined, STAGES.map(s => ({
              text: s, onPress: () => onMove(c.id, s)
            })));
          }}>
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
  const mixing = useQuery({ queryKey: ['pipeline','mixing'], queryFn: () => listPipeline('mixing') });
  const mastering = useQuery({ queryKey: ['pipeline','mastering'], queryFn: () => listPipeline('mastering') });

  const m = useMutation({
    mutationFn: ({ kind, id, stage }: { kind: 'mixing'|'mastering'; id: PipelineCard['id']; stage: PipelineStage }) =>
      updateStage(kind, id, stage),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['pipeline', vars.kind] })
  });

  return (
    <ScrollView horizontal contentContainerStyle={{ padding: 12 }}>
      <Column title="Mixing" cards={mixing.data || []}
        onMove={(id, stage) => m.mutate({ kind: 'mixing', id, stage })} />
      <Column title="Mastering" cards={mastering.data || []}
        onMove={(id, stage) => m.mutate({ kind: 'mastering', id, stage })} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  col: { width: 280, marginRight: 12 },
  colTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  card: { backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#eee', gap: 4 },
  cardTitle: { fontWeight: '600' }
});
