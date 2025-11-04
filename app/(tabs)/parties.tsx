import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listParties, createParty } from '../../src/api/parties';
import type { Party } from '../../src/types';
import { useState } from 'react';
import { FlatList, TextInput, View, Text, Button, StyleSheet } from 'react-native';

export default function Parties() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [newName, setNewName] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['parties', q],
    queryFn: () => listParties(q)
  });

  const mCreate = useMutation({
    mutationFn: (body: Partial<Party>) => createParty(body),
    onSuccess: () => {
      setNewName('');
      qc.invalidateQueries({ queryKey: ['parties'] });
    }
  });

  return (
    <View style={styles.wrap}>
      <TextInput
        placeholder="Search name or Instagram…"
        value={q}
        onChangeText={setQ}
        style={styles.input}
        autoCapitalize="none"
      />
      <View style={styles.row}>
        <TextInput
          placeholder="New client name…"
          value={newName}
          onChangeText={setNewName}
          style={[styles.input, { flex: 1 }]}
        />
        <Button title="Add" onPress={() => newName.trim() && mCreate.mutate({ name: newName.trim() })} />
      </View>

      {isLoading && <Text>Loading…</Text>}
      {isError && <Text style={{ color: 'red' }}>Failed to load</Text>}

      <FlatList
        data={data || []}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.name}</Text>
            {!!item.instagram && <Text>@{item.instagram}</Text>}
            {!!item.phone && <Text>{item.phone}</Text>}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 12, gap: 8 },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { padding: 12, borderWidth: 1, borderColor: '#EEE', borderRadius: 8, marginTop: 8 },
  title: { fontSize: 16, fontWeight: '600' }
});
