import { StyleSheet, Text, View } from 'react-native';

export default function ContractViewScreen() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Contract Viewer</Text>
      <Text style={styles.body}>Contract preview support is not wired into the mobile flow yet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 8
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a'
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569'
  }
});
