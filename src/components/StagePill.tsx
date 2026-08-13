import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { PipelineStage } from '../types';
import { useAppTheme } from '../theme/ThemeProvider';

type Props = { stage: PipelineStage };

function StagePillComponent({ stage }: Props) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surfaceMuted }]}>
      <Text style={styles.text}>{stage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start'
  },
  text: { fontSize: 12 }
});

export const StagePill = memo(StagePillComponent);
