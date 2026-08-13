import { StyleSheet, Text, View } from 'react-native';
import SchemaForm from '../../src/components/contracts/SchemaForm';

export default function NewContractScreen() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>New Contract</Text>
      <SchemaForm
        title="Contract drafting"
        description="The mobile contract authoring flow is not connected yet. Use the web app for now."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: 24,
    gap: 16,
    backgroundColor: '#f8fafc'
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a'
  }
});
