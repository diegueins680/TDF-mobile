import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { PipelineStage } from '../types';

type Props = { stage: PipelineStage };

function StagePillComponent({ stage }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{stage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#efefef',
    alignSelf: 'flex-start'
  },
  text: { fontSize: 12 }
});

export const StagePill = memo(StagePillComponent);
