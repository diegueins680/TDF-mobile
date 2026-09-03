import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { searchPartiesForSelector, type PartySelectorOption } from '../api/partySelector';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

export type { PartySelectorOption } from '../api/partySelector';

type Props = {
  value: PartySelectorOption | null;
  onChange: (party: PartySelectorOption | null) => void;
  excludedPartyIds?: number[];
  label?: string;
};

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';

/** A mobile relationship picker. Free text is never treated as a Party ID. */
export function PartySelector({ value, onChange, excludedPartyIds = [], label = 'Buscar persona' }: Props) {
  const [text, setText] = useState('');
  const deferred = useDebouncedValue(text.trim(), 300);
  const exclusionKey = useMemo(() => [...new Set(excludedPartyIds)].sort((a, b) => a - b).join(','), [excludedPartyIds]);
  const query = useQuery({
    queryKey: ['party-selector', deferred, exclusionKey],
    queryFn: ({ signal }) => searchPartiesForSelector(deferred, { excludedPartyIds, signal }),
    enabled: deferred.length >= 2,
    staleTime: 30_000,
    retry: 1,
  });

  if (value) {
    return <View style={styles.selected} accessibilityLabel={`Seleccionado: ${value.displayName}`}>
      <Avatar option={value} />
      <Text style={styles.selectedName} numberOfLines={1}>{value.displayName}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Quitar a ${value.displayName}`} onPress={() => onChange(null)}><Text style={styles.remove}>Quitar</Text></Pressable>
    </View>;
  }

  return <View>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      value={text}
      onChangeText={setText}
      placeholder="Nombre o @username"
      accessibilityLabel={label}
      autoCapitalize="none"
      style={styles.input}
    />
    {deferred.length > 0 && deferred.length < 2 ? <Text style={styles.help}>Escribe al menos dos caracteres.</Text> : null}
    {query.isFetching ? <ActivityIndicator style={styles.loading} /> : null}
    {query.isError ? <Pressable onPress={() => query.refetch()} accessibilityRole="button"><Text style={styles.error}>No pudimos buscar. Toca para reintentar.</Text></Pressable> : null}
    {deferred.length >= 2 && !query.isFetching && !query.isError && query.data?.items.length === 0 ? <Text style={styles.help}>No encontramos coincidencias.</Text> : null}
    {query.data?.items.map((option) => <Pressable key={option.partyId} style={styles.option} onPress={() => { onChange(option); setText(''); }} accessibilityRole="button" accessibilityLabel={`Seleccionar ${option.displayName}`}>
      <Avatar option={option} />
      <View style={styles.optionText}><Text style={styles.name}>{option.displayName}</Text><Text style={styles.meta} numberOfLines={1}>{[option.username ? `@${option.username}` : null, option.secondaryLabel].filter(Boolean).join(' · ')}</Text></View>
    </Pressable>)}
  </View>;
}

function Avatar({ option }: { option: PartySelectorOption }) {
  return option.avatarUrl ? <Image source={{ uri: option.avatarUrl }} style={styles.avatar} accessibilityIgnoresInvertColors /> : <View style={styles.avatarFallback}><Text style={styles.avatarText}>{initials(option.displayName)}</Text></View>;
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', color: '#111827' },
  help: { marginTop: 6, color: '#6b7280', fontSize: 13 }, error: { marginTop: 6, color: '#b91c1c', fontSize: 13 }, loading: { marginTop: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
  optionText: { flex: 1, minWidth: 0 }, name: { color: '#111827', fontWeight: '600' }, meta: { color: '#6b7280', fontSize: 13, marginTop: 2 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e5e7eb' }, avatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#1d4ed8', fontWeight: '700' },
  selected: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', borderRadius: 10, padding: 8 }, selectedName: { flex: 1, color: '#1e3a8a', fontWeight: '600' }, remove: { color: '#1d4ed8', fontWeight: '600' },
});
