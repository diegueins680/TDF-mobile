import { Text, View } from 'react-native';
import type { PipelineStage } from '../types';

export function StagePill({ stage }: { stage: PipelineStage }) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: '#efefef',
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ fontSize: 12 }}>{stage}</Text>
    </View>
  );
}
