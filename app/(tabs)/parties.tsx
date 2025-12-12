import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listParties, createParty } from '../../src/api/parties';
import type { Party } from '../../src/types';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, TextInput, View, Text, Button, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

import { useDebouncedValue } from '../../src/hooks/useDebouncedValue';
import { useAuth } from '../../src/providers/AuthProvider';

export default function Parties() {
  const qc = useQueryClient();
  const router = useRouter();
  const { token } = useAuth();
  const [q, setQ] = useState('');
  const [newName, setNewName] = useState('');
  const hasToken = Boolean(token);
  const debouncedQ = useDebouncedValue(q, 300);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['parties', debouncedQ],
    queryFn: () => listParties(debouncedQ),
    enabled: hasToken
  });

  const mCreate = useMutation({
    mutationFn: (body: Partial<Party>) => createParty(body),
    onSuccess: () => {
      setNewName('');
      qc.invalidateQueries({ queryKey: ['parties'] });
    }
  });

  const parties = useMemo(() => data ?? [], [data]);
  const canCreate = hasToken && newName.trim().length > 0 && !mCreate.isPending;

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
      <Text>{hasToken ? 'No clients yet' : 'Add your API token to load clients.'}</Text>
      {!hasToken && (
        <TouchableOpacity onPress={() => router.push('/auth')}>
          <Text style={styles.link}>Open Auth</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [hasToken, router]);

  return (
    <View style={styles.wrap}>
      {!hasToken && (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Connect your API token to load and add clients.</Text>
          <TouchableOpacity onPress={() => router.push('/auth')}>
            <Text style={styles.link}>Open Auth</Text>
          </TouchableOpacity>
        </View>
      )}
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

      {hasToken && isLoading && <Text>Loading…</Text>}
      {hasToken && isError && (
        <Text style={styles.error}>
          {error instanceof Error ? error.message : 'Failed to load clients. Check your token in Auth.'}
        </Text>
      )}

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
  list: { paddingBottom: 24 },
  notice: { padding: 12, borderRadius: 8, backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe' },
  noticeTitle: { fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  link: { color: '#2563eb', fontWeight: '700', marginTop: 4 },
  error: { color: 'red' }
});
