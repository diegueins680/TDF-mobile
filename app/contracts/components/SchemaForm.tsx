import { StyleSheet, Text, View } from 'react-native';

export type SchemaFormProps = {
  title?: string;
  description?: string;
};

export default function SchemaForm({
  title = 'Schema form',
  description = 'A mobile-friendly contract form has not been implemented yet.'
}: SchemaFormProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    padding: 16,
    gap: 8
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a'
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569'
  }
});
