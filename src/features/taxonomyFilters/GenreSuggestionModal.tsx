// TAX-GENRE-SUGGESTION-001: an artist proposes a genre in Spanish and
// English. "Check" shows the cleaned, cased names and the verdict before
// anything is stored: a duplicate offers the existing genre, a probable typo
// offers the existing name (or "it is different", which sends it to review),
// and a name made of known words is published on submit.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Taxonomy,
  type GenreSuggestion,
  type GenreSuggestionCheck,
  type GenreSuggestionRequest,
} from '../../api/taxonomy';
import { t } from '../../i18n';
import { genreOptions, taxonomyName, type TaxonomyLanguage } from './taxonomyFilterModel';
import { TAXONOMY_OPTIONS_QUERY_KEY, useTaxonomyFilterOptions } from './useTaxonomyFilters';

export const MY_GENRE_SUGGESTIONS_QUERY_KEY = ['genre-suggestions', 'mine'] as const;

export interface ReadyGenre {
  id: string;
  name: string;
}

const MAX_PARENT_ROWS = 40;

/** A 409 from submit carries the check that refused it (duplicate or probable typo). */
const conflictCheck = (error: unknown): GenreSuggestionCheck | null => {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return null;
  const data = error.response.data as Partial<GenreSuggestionCheck> | undefined;
  return data && typeof data.verdict === 'string' ? (data as GenreSuggestionCheck) : null;
};

export function GenreSuggestionModal({
  visible,
  onClose,
  onGenreReady,
  language,
}: {
  visible: boolean;
  onClose: () => void;
  /** Called with the genre the artist should now have (new, or an existing one they chose). */
  onGenreReady: (genre: ReadyGenre) => void;
  language: TaxonomyLanguage;
}) {
  const queryClient = useQueryClient();
  const options = useTaxonomyFilterOptions();
  const [nameEs, setNameEs] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [parentGenreId, setParentGenreId] = useState<string | null>(null);
  const [parentSearch, setParentSearch] = useState('');
  const [check, setCheck] = useState<GenreSuggestionCheck | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tr = (key: string, params?: Record<string, string | number>) => t(key, params, language);

  const request: GenreSuggestionRequest = {
    nameEs: nameEs.trim(),
    nameEn: nameEn.trim() || nameEs.trim(),
    parentGenreId,
  };
  const tooShort = request.nameEs.length < 2 || request.nameEn.length < 2;
  const parents = useMemo(() => genreOptions(options.data?.genres ?? [], language), [language, options.data?.genres]);
  const visibleParents = useMemo(() => {
    const needle = parentSearch.trim().toLocaleLowerCase(language);
    const matching = needle ? parents.filter((parent) => parent.label.toLocaleLowerCase(language).includes(needle)) : parents;
    return matching.slice(0, MAX_PARENT_ROWS);
  }, [language, parentSearch, parents]);
  const parentLabel = parents.find((parent) => parent.id === parentGenreId)?.label;

  const resetCheck = () => { setCheck(null); setResult(null); setError(null); };

  const checkMutation = useMutation({
    mutationFn: () => Taxonomy.checkGenreSuggestion(request),
    onSuccess: (value) => { setCheck(value); setError(null); },
    onError: (failure: Error) => setError(failure.message || tr('taxonomy.genre.failed')),
  });

  const submitMutation = useMutation({
    mutationFn: (confirmDistinct: boolean) =>
      Taxonomy.submitGenreSuggestion(confirmDistinct ? { ...request, confirmDistinct: true } : request),
    onSuccess: async (submission) => {
      await queryClient.invalidateQueries({ queryKey: MY_GENRE_SUGGESTIONS_QUERY_KEY });
      const suggestion = submission.suggestion;
      if (suggestion.status === 'approved' && suggestion.resolvedGenre) {
        await queryClient.invalidateQueries({ queryKey: TAXONOMY_OPTIONS_QUERY_KEY });
        const name = taxonomyName(suggestion.resolvedGenre, language);
        onGenreReady({ id: suggestion.resolvedGenre.id, name });
        setResult(tr('taxonomy.genre.approved', { name }));
      } else {
        setResult(tr(submission.alreadySuggested ? 'taxonomy.genre.alreadySuggested' : 'taxonomy.genre.pendingSent'));
      }
      setCheck(null);
      setError(null);
    },
    onError: (failure) => {
      const refused = conflictCheck(failure);
      if (refused) {
        setCheck(refused);
        setError(null);
        return;
      }
      setError(tr('taxonomy.genre.failed'));
    },
  });

  const close = () => {
    setNameEs(''); setNameEn(''); setParentGenreId(null); setParentSearch('');
    resetCheck();
    onClose();
  };
  const chooseExisting = (genre: NonNullable<GenreSuggestionCheck['match']>) => {
    onGenreReady({ id: genre.id, name: taxonomyName(genre, language) });
    close();
  };
  const busy = checkMutation.isPending || submitMutation.isPending;
  const matchName = check?.match ? taxonomyName(check.match, language) : '';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>{tr('taxonomy.genre.title')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={tr('taxonomy.genre.close')} onPress={close} style={styles.textButton}>
              <Text style={styles.link}>{tr('taxonomy.genre.close')}</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.muted}>{tr('taxonomy.genre.intro')}</Text>

            <Text style={styles.label}>{tr('taxonomy.genre.nameEs')}</Text>
            <TextInput
              accessibilityLabel={tr('taxonomy.genre.nameEs')}
              value={nameEs}
              onChangeText={(text) => { setNameEs(text); resetCheck(); }}
              maxLength={60}
              autoCapitalize="words"
              style={styles.input}
            />
            <Text style={styles.label}>{tr('taxonomy.genre.nameEn')}</Text>
            <TextInput
              accessibilityLabel={tr('taxonomy.genre.nameEn')}
              accessibilityHint={tr('taxonomy.genre.nameEnHelp')}
              value={nameEn}
              placeholder={nameEs.trim() || undefined}
              placeholderTextColor="#999"
              onChangeText={(text) => { setNameEn(text); resetCheck(); }}
              maxLength={60}
              autoCapitalize="words"
              style={styles.input}
            />
            <Text style={styles.muted}>{tr('taxonomy.genre.nameEnHelp')}</Text>

            <Text style={styles.label}>{tr('taxonomy.genre.parent')}</Text>
            {parents.length > 8 ? (
              <TextInput
                accessibilityLabel={tr('taxonomy.searchOptions', { dimension: tr('taxonomy.genre').toLocaleLowerCase(language) })}
                placeholder={parentLabel ?? tr('taxonomy.searchOptions', { dimension: tr('taxonomy.genre').toLocaleLowerCase(language) })}
                placeholderTextColor="#999"
                value={parentSearch}
                onChangeText={setParentSearch}
                autoCorrect={false}
                style={styles.input}
              />
            ) : null}
            <View style={styles.parentList}>
              <ParentRow label={tr('taxonomy.genre.noParent')} depth={0} selected={parentGenreId === null} onPress={() => { setParentGenreId(null); resetCheck(); }} />
              {visibleParents.map((parent) => (
                <ParentRow
                  key={parent.id}
                  label={parent.label}
                  depth={parent.depth}
                  selected={parent.id === parentGenreId}
                  onPress={() => { setParentGenreId(parent.id); resetCheck(); }}
                />
              ))}
            </View>

            {check ? <CheckResult check={check} language={language} matchName={matchName} /> : null}
            {result ? <Text accessibilityLiveRegion="polite" style={styles.success}>{result}</Text> : null}
            {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
            {busy ? <ActivityIndicator accessibilityLabel={tr('taxonomy.genre.checking')} color="#2563eb" /> : null}

            <View style={styles.actions}>
              {!check && !result ? (
                <PrimaryButton
                  label={checkMutation.isPending ? tr('taxonomy.genre.checking') : tr('taxonomy.genre.check')}
                  disabled={busy || tooShort}
                  onPress={() => checkMutation.mutate()}
                />
              ) : null}
              {check?.verdict === 'duplicate' && check.match ? (
                <PrimaryButton label={tr('taxonomy.genre.useExisting', { name: matchName })} disabled={busy} onPress={() => chooseExisting(check.match!)} />
              ) : null}
              {check?.verdict === 'similar' ? (
                <>
                  {check.match ? (
                    <PrimaryButton label={tr('taxonomy.genre.useExisting', { name: matchName })} disabled={busy} onPress={() => chooseExisting(check.match!)} />
                  ) : null}
                  <SecondaryButton label={tr('taxonomy.genre.submitAnyway')} disabled={busy} onPress={() => submitMutation.mutate(true)} />
                </>
              ) : null}
              {check?.verdict === 'review' || check?.verdict === 'approve' ? (
                <PrimaryButton label={tr('taxonomy.genre.submit')} disabled={busy} onPress={() => submitMutation.mutate(false)} />
              ) : null}
              <SecondaryButton label={result ? tr('taxonomy.genre.close') : tr('taxonomy.genre.cancel')} disabled={false} onPress={close} />
            </View>
            {tooShort && (nameEs.length > 0) ? <Text style={styles.muted}>{tr('taxonomy.genre.tooShort')}</Text> : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function CheckResult({ check, language, matchName }: { check: GenreSuggestionCheck; language: TaxonomyLanguage; matchName: string }) {
  const tr = (key: string, params?: Record<string, string | number>) => t(key, params, language);
  const verdictMessage = {
    duplicate: tr('taxonomy.genre.duplicate', { name: matchName }),
    similar: tr('taxonomy.genre.similar', { name: matchName }),
    review: tr('taxonomy.genre.review'),
    approve: tr('taxonomy.genre.approve'),
  }[check.verdict];
  return (
    <View accessibilityLiveRegion="polite" style={[styles.checkBox, check.verdict === 'approve' ? styles.checkOk : styles.checkWarn]}>
      <Text style={styles.checkText}>{tr('taxonomy.genre.willStoreAs', { es: check.nameEs, en: check.nameEn })}</Text>
      {check.corrections.map((correction) => (
        <Text key={`${correction.word}:${correction.suggestion}`} style={styles.checkText}>
          {tr('taxonomy.genre.correction', { word: correction.word, suggestion: correction.suggestion })}
        </Text>
      ))}
      <Text style={[styles.checkText, styles.bold]}>{verdictMessage}</Text>
    </View>
  );
}

function ParentRow({ label, depth, selected, onPress }: { label: string; depth: number; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.parentRow, { paddingLeft: 12 + depth * 18 }, selected && styles.parentRowSelected]}
    >
      <Text style={[styles.parentText, selected && styles.parentTextSelected]}>{depth > 0 ? '↳ ' : ''}{label}</Text>
    </Pressable>
  );
}

function PrimaryButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={[styles.primaryButton, disabled && styles.disabled]}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={[styles.secondaryButton, disabled && styles.disabled]}>
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

/**
 * The artist's own suggestions next to the genre picker: pending ones as
 * "<name> · pending" chips, rejected ones with the reviewer's note.
 */
export function MyGenreSuggestions({ language, enabled = true }: { language: TaxonomyLanguage; enabled?: boolean }) {
  const mine = useQuery<GenreSuggestion[]>({
    queryKey: MY_GENRE_SUGGESTIONS_QUERY_KEY,
    queryFn: () => Taxonomy.myGenreSuggestions(),
    enabled,
    staleTime: 60_000,
  });
  const suggestions = mine.data ?? [];
  const pending = suggestions.filter((suggestion) => suggestion.status === 'pending');
  const rejected = suggestions.filter((suggestion) => suggestion.status === 'rejected');
  if (!pending.length && !rejected.length) return null;
  return (
    <View style={styles.mine}>
      {pending.length ? (
        <>
          <Text style={styles.label}>{t('taxonomy.genre.pendingTitle', undefined, language)}</Text>
          <View style={styles.chips}>
            {pending.map((suggestion) => {
              const label = t('taxonomy.genre.pendingChip', { name: taxonomyName(suggestion, language) }, language);
              return (
                <View key={suggestion.id} accessible accessibilityLabel={label} style={styles.pendingChip}>
                  <Text style={styles.pendingText}>{label}</Text>
                </View>
              );
            })}
          </View>
        </>
      ) : null}
      {rejected.map((suggestion) => (
        <Text key={suggestion.id} style={styles.error}>
          {t('taxonomy.genre.rejected', { name: taxonomyName(suggestion, language), note: suggestion.reviewNote?.trim() || '—' }, language)}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fafafa' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' },
  title: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  textButton: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  link: { color: '#2563eb', fontWeight: '700' },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  muted: { color: '#6b7280', fontSize: 13 },
  label: { fontSize: 12, fontWeight: '600', color: '#666', textTransform: 'uppercase', marginTop: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1a1a1a', minHeight: 44 },
  parentList: { maxHeight: 280, gap: 4 },
  parentRow: { minHeight: 44, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff', paddingRight: 12 },
  parentRowSelected: { backgroundColor: '#e0e7ff', borderColor: '#2563eb' },
  parentText: { color: '#1a1a1a' },
  parentTextSelected: { color: '#2563eb', fontWeight: '700' },
  checkBox: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 6 },
  checkOk: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  checkWarn: { borderColor: '#d97706', backgroundColor: '#fffbeb' },
  checkText: { color: '#1a1a1a' },
  bold: { fontWeight: '700' },
  success: { color: '#166534', fontWeight: '600' },
  error: { color: '#dc2626', fontSize: 13 },
  actions: { gap: 8, marginTop: 4 },
  primaryButton: { minHeight: 44, borderRadius: 8, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  primaryText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  secondaryButton: { minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: '#2563eb', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  secondaryText: { color: '#2563eb', fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.5 },
  mine: { gap: 6, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pendingChip: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#9ca3af', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  pendingText: { fontSize: 12, color: '#4b5563', fontWeight: '600' },
});
