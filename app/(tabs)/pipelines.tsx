import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollView, View, Text, Alert, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { refreshPipelineSnapshot, updateStage } from '../../src/api/pipelines';
import type { PipelineCard, PipelineDefinition, PipelineStage } from '../../src/types';
import { StagePill } from '../../src/components/StagePill';
import { useUserSettings } from '../../src/providers/UserSettingsProvider';

type MovePayload = { workflowId: string; id: PipelineCard['id']; workflowStateId: string };

function Column({
  definition,
  stage,
  cards,
  english,
  onMove,
}: {
  definition: PipelineDefinition;
  stage: PipelineStage;
  cards: PipelineCard[];
  english: boolean;
  onMove: (id: PipelineCard['id'], workflowStateId: string) => void;
}) {
  const stageName = english ? stage.nameEn : stage.nameEs;
  return (
    <View style={styles.col}>
      <Text style={styles.pipelineTitle}>{english ? definition.nameEn : definition.nameEs}</Text>
      <Text style={styles.colTitle}>{stageName}</Text>
      {cards.length === 0 ? <Text style={styles.emptyText}>{english ? 'No cards yet' : 'Aún no hay tarjetas'}</Text> : null}
      {cards.map((card) => (
        <Pressable
          key={String(card.id)}
          style={styles.card}
          accessibilityRole="button"
          accessibilityLabel={`${card.title}, ${stageName}`}
          accessibilityHint={english ? 'Long press to choose another stage' : 'Mantén presionado para elegir otra etapa'}
          onLongPress={() => Alert.alert(
            english ? 'Move to stage' : 'Mover a etapa',
            undefined,
            definition.stages.map((target) => ({
              text: english ? target.nameEn : target.nameEs,
              onPress: () => onMove(card.id, target.id),
            })),
          )}
        >
          <Text style={styles.cardTitle}>{card.title}</Text>
          {card.artist ? <Text>{card.artist}</Text> : null}
          <StagePill name={stageName} />
        </Pressable>
      ))}
    </View>
  );
}

export default function Pipelines() {
  const qc = useQueryClient();
  const { locale } = useUserSettings();
  const english = locale.toLowerCase().startsWith('en');
  const snapshotQuery = useQuery({ queryKey: ['pipeline-snapshot'], queryFn: refreshPipelineSnapshot });
  const mutation = useMutation<PipelineCard, Error, MovePayload>({
    mutationFn: ({ workflowId, id, workflowStateId }) => updateStage(workflowId, id, workflowStateId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipeline-snapshot'] }),
  });

  if (snapshotQuery.isLoading) {
    return <SafeAreaView style={styles.page} edges={['top']}><View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View></SafeAreaView>;
  }

  if (snapshotQuery.isError || !snapshotQuery.data) {
    return <SafeAreaView style={styles.page} edges={['top']}><View style={styles.center}><Text style={styles.errorText}>{english ? 'No valid pipeline snapshot is available.' : 'No hay un snapshot válido de pipelines.'}</Text></View></SafeAreaView>;
  }

  const snapshot = snapshotQuery.data;
  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      {mutation.isError ? <Text accessibilityRole="alert" style={styles.errorBanner}>{mutation.error.message}</Text> : null}
      <ScrollView horizontal contentContainerStyle={styles.content}>
        {snapshot.definitions.flatMap((definition) => definition.stages.map((stage) => (
          <Column
            key={`${definition.workflowId}:${stage.id}`}
            definition={definition}
            stage={stage}
            cards={(snapshot.cards[definition.workflowId] ?? [])
              .filter((card) => card.workflowStateId === stage.id)
              .sort((left, right) => left.sortOrder - right.sortOrder)}
            english={english}
            onMove={(id, workflowStateId) => mutation.mutate({ workflowId: definition.workflowId, id, workflowStateId })}
          />
        )))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { paddingHorizontal: 12, paddingTop: 28, paddingBottom: 12 },
  col: { width: 280, marginRight: 12 },
  pipelineTitle: { fontSize: 12, color: '#4b5563', marginBottom: 2 },
  colTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: '#6b7280', marginBottom: 8 },
  card: { minHeight: 44, backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb', gap: 4 },
  cardTitle: { fontWeight: '600' },
  errorText: { color: '#dc2626', fontSize: 14, textAlign: 'center' },
  errorBanner: { color: '#991b1b', backgroundColor: '#fee2e2', padding: 12 },
});
