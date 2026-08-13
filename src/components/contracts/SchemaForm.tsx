import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../../theme/ThemeProvider';

export type SchemaFormProps = {
  title?: string;
  description?: string;
};

export default function SchemaForm({
  title = 'Schema form',
  description = 'A mobile-friendly contract form has not been implemented yet.',
}: SchemaFormProps) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.card, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
});
