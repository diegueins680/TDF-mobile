import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listParties, createParty } from '../../src/api/parties';
import type { Party } from '../../src/types';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, TextInput, View, Text, Button, StyleSheet } from 'react-native';

import { useDebouncedValue } from '../../src/hooks/useDebouncedValue';

export default function Parties() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [newName, setNewName] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['parties', debouncedQ],
    queryFn: () => listParties(debouncedQ)
  });

  const mCreate = useMutation({
    mutationFn: (body: Partial<Party>) => createParty(body),
    onSuccess: () => {
      setNewName('');
      qc.invalidateQueries({ queryKey: ['parties'] });
    }
  });

  const parties = useMemo(() => data ?? [], [data]);
  const canCreate = newName.trim().length > 0 && !mCreate.isPending;

  const renderItem = useCallback(({ item }: { item: Party }) => (
    <View style={styles.card}>
      <Text style={styles.title}>{item.name}</Text>
      {!!item.instagram && <Text>@{item.instagram}</Text>}
      {!!item.phone && <Text>{item.phone}</Text>}
    </View>
  ), []);

  const keyExtractor = useCallback((item: Party) => String(item.id), []);

  const renderEmpty = useCallback(() => (
    <View style={styles.empty}>
      <Text>No clients yet</Text>
    </View>
  ), []);

  return (
    <View style={styles.wrap}>
      <TextInput
        placeholder="Search name or Instagram…"
        value={q}
        onChangeText={setQ}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      <View style={styles.row}>
        <TextInput
          placeholder="New client name…"
          value={newName}
          onChangeText={setNewName}
          style={[styles.input, { flex: 1 }]}
        />
        <Button
          title={mCreate.isPending ? 'Adding…' : 'Add'}
          onPress={() => canCreate && mCreate.mutate({ name: newName.trim() })}
          disabled={!canCreate}
        />
      </View>

      {isLoading && <Text>Loading…</Text>}
      {isError && <Text style={{ color: 'red' }}>Failed to load</Text>}

      <FlatList
        data={parties}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={!isLoading ? renderEmpty : null}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        initialNumToRender={12}
        windowSize={8}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 12, gap: 8 },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { padding: 12, borderWidth: 1, borderColor: '#EEE', borderRadius: 8, marginTop: 8 },
  title: { fontSize: 16, fontWeight: '600' },
  empty: { padding: 20, alignItems: 'center' },
  list: { paddingBottom: 24 }
});
