import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = { name: string };

function StagePillComponent({ name }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{name}</Text>
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
