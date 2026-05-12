import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listParties, createParty } from '../../src/api/parties';
import type { Party } from '../../src/types';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, TextInput, View, Text, Button, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { useDebouncedValue } from '../../src/hooks/useDebouncedValue';
import { useAuth } from '../../src/providers/AuthProvider';

export default function Parties() {
  const qc = useQueryClient();
  const router = useRouter();
  const { token, loading } = useAuth();
  const [q, setQ] = useState('');
  const [newName, setNewName] = useState('');
  const hasToken = Boolean(token?.trim());
  const canUseParties = !loading && hasToken;
  const debouncedQ = useDebouncedValue(q, 300);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['parties', debouncedQ],
    queryFn: () => listParties(debouncedQ),
    enabled: canUseParties
  });

  const [createError, setCreateError] = useState<string | null>(null);

  const mCreate = useMutation({
    mutationFn: (body: Partial<Party>) => createParty(body),
    onSuccess: () => {
      setNewName('');
      setCreateError(null);
      qc.invalidateQueries({ queryKey: ['parties'] });
    },
    onError: (error) => {
      setCreateError(error instanceof Error ? error.message : 'No se pudo crear el cliente.');
    }
  });

  const parties = useMemo(() => data ?? [], [data]);
  const canCreate = canUseParties && newName.trim().length > 0 && !mCreate.isPending;

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
      <Text>{hasToken ? 'Aún no tienes clientes' : 'Acceso restringido para cargar clientes.'}</Text>
    </View>
  ), [hasToken]);

  const errorText = useMemo(() => {
    if (!hasToken) return 'Acceso restringido para cargar clientes.';
    if (error instanceof Error) return error.message;
    return 'No pudimos cargar clientes. Revisa tu conexión.';
  }, [error, hasToken]);

  const renderError = useCallback(() => {
    if (!isError) return null;
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>{errorText}</Text>
        <View style={styles.row}>
          {hasToken && (
            <Button title={isFetching ? 'Reintentando…' : 'Reintentar'} onPress={() => refetch()} disabled={isFetching} />
          )}
        </View>
      </View>
    );
  }, [errorText, hasToken, isError, isFetching, refetch]);

  return (
    <View style={styles.wrap} testID="partiesScreen">
      {loading && <Text>Cargando sesión…</Text>}
      {!loading && !hasToken && (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Acceso restringido para cargar y crear clientes.</Text>
          <Text style={styles.noticeBody}>Inicia sesión para cargar y crear clientes.</Text>
          <View style={styles.row}>
            <Button title="Abrir login" onPress={() => router.push('/auth')} />
          </View>
        </View>
      )}
      <TextInput
        placeholder="Buscar nombre o Instagram…"
        value={q}
        onChangeText={setQ}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        accessibilityLabel="Buscar clientes por nombre o Instagram"
      />
      <View style={styles.row}>
        <TextInput
          placeholder="Nombre del nuevo cliente…"
          value={newName}
          onChangeText={setNewName}
          style={[styles.input, { flex: 1 }]}
          accessibilityLabel="Nombre del nuevo cliente"
        />
        <Button
          title={mCreate.isPending ? 'Agregando…' : 'Agregar'}
          onPress={() => canCreate && mCreate.mutate({ name: newName.trim() })}
          disabled={!canCreate}
          accessibilityLabel="Agregar cliente"
        />
      </View>

      {canUseParties && isLoading && <Text>Cargando…</Text>}
      {createError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{createError}</Text>
        </View>
      )}
      {renderError()}

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
  noticeBody: { color: '#1e293b', marginBottom: 8 },
  errorBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecdd3',
    backgroundColor: '#fff1f2',
    gap: 8
  },
  errorText: { color: '#b91c1c' }
});
