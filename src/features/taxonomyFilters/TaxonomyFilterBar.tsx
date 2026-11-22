// TAX-FILTER-001: removable chips for the active place and genre filters,
// "Clear filters", the per-section override notice, and a sheet with the
// four multi-select lists (country, region, city, genre tree) with counts.
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { TaxonomyFacets, TaxonomyFilterOptions } from '../../api/taxonomy';
import { t } from '../../i18n';
import { useAppTheme } from '../../theme/ThemeProvider';
import {
  countTaxonomyValues,
  genreOptions,
  locationOptions,
  removeTaxonomyValue,
  taxonomyChips,
  TAXONOMY_DIMENSIONS,
  toggleTaxonomyValue,
  type TaxonomyDimension,
  type TaxonomyLanguage,
  type TaxonomyOption,
} from './taxonomyFilterModel';
import type { SurfaceTaxonomyFilters } from './useTaxonomyFilters';

const DIMENSION_LABEL_KEYS: Record<TaxonomyDimension, string> = {
  countryIds: 'taxonomy.country',
  regionIds: 'taxonomy.region',
  cityIds: 'taxonomy.city',
  genreIds: 'taxonomy.genre',
};

/** Long lists (cities) show a search box and at most this many rows at once. */
const SEARCH_THRESHOLD = 8;
const MAX_VISIBLE_OPTIONS = 60;

const normalizeSearch = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export interface TaxonomyFilterBarProps {
  filters: SurfaceTaxonomyFilters;
  options: TaxonomyFilterOptions | undefined;
  optionsLoading?: boolean;
  optionsError?: boolean;
  facets?: TaxonomyFacets | null;
  language: TaxonomyLanguage;
  dimensions?: readonly TaxonomyDimension[];
}

export function TaxonomyFilterBar({
  filters,
  options,
  optionsLoading = false,
  optionsError = false,
  facets,
  language,
  dimensions = TAXONOMY_DIMENSIONS,
}: TaxonomyFilterBarProps) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [onlyHere, setOnlyHere] = useState(false);
  const { selection, isOverride } = filters;
  const keepLocal = onlyHere || isOverride;
  const activeCount = countTaxonomyValues(selection);
  const chips = useMemo(
    () => taxonomyChips(selection, options, language, t('taxonomy.unknown', undefined, language))
      .filter((chip) => dimensions.includes(chip.dimension)),
    [dimensions, language, options, selection],
  );
  const lists = useMemo(() => {
    if (!options) return null;
    const location = locationOptions(options, selection, language, facets);
    return {
      countryIds: location.countries,
      regionIds: location.regions,
      cityIds: location.cities,
      genreIds: genreOptions(options.genres, language, facets),
    } satisfies Record<TaxonomyDimension, TaxonomyOption[]>;
  }, [facets, language, options, selection]);

  const toggle = (dimension: TaxonomyDimension, id: string) =>
    filters.setSelection(toggleTaxonomyValue(selection, dimension, id), keepLocal);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('taxonomy.open', undefined, language)}
          accessibilityHint={activeCount ? t('taxonomy.openWithCount', { count: activeCount }, language) : undefined}
          onPress={() => setOpen(true)}
          style={[styles.openButton, { borderColor: colors.actionPrimary, backgroundColor: activeCount ? colors.selected : colors.surface }]}
        >
          <Text style={[styles.openButtonText, { color: colors.actionPrimary }]}>
            {activeCount ? t('taxonomy.openWithCount', { count: activeCount }, language) : t('taxonomy.open', undefined, language)}
          </Text>
        </Pressable>
        {activeCount ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('taxonomy.clearAll', undefined, language)}
            onPress={filters.clearAll}
            style={styles.textButton}
          >
            <Text style={{ color: colors.actionPrimary, fontWeight: '700' }}>{t('taxonomy.clearAll', undefined, language)}</Text>
          </Pressable>
        ) : null}
      </View>

      {chips.length ? (
        <View style={styles.chipWrap}>
          {chips.map((chip) => (
            <Pressable
              key={`${chip.dimension}:${chip.id}`}
              accessibilityRole="button"
              accessibilityLabel={t('taxonomy.remove', { label: chip.label }, language)}
              onPress={() => filters.setSelection(removeTaxonomyValue(selection, chip.dimension, chip.id), keepLocal)}
              style={[styles.chip, { borderColor: colors.actionPrimary, backgroundColor: colors.selected }]}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{chip.label}</Text>
              <Text style={{ color: colors.textSecondary }} importantForAccessibility="no">  ✕</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {isOverride ? <OverrideNotice filters={filters} language={language} /> : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={[styles.sheet, { backgroundColor: colors.canvas }]}>
          <View style={[styles.sheetHeader, { borderBottomColor: colors.borderSubtle }]}>
            <Text accessibilityRole="header" style={[styles.sheetTitle, { color: colors.textPrimary }]}>{t('taxonomy.title', undefined, language)}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('taxonomy.done', undefined, language)} onPress={() => setOpen(false)} style={styles.textButton}>
              <Text style={{ color: colors.actionPrimary, fontWeight: '800' }}>{t('taxonomy.done', undefined, language)}</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>{t('taxonomy.onlyHere', undefined, language)}</Text>
                <Text style={{ color: colors.textSecondary }}>{t('taxonomy.onlyHereHelp', undefined, language)}</Text>
              </View>
              <Switch
                accessibilityLabel={t('taxonomy.onlyHere', undefined, language)}
                value={keepLocal}
                disabled={isOverride}
                onValueChange={setOnlyHere}
              />
            </View>
            {isOverride ? <OverrideNotice filters={filters} language={language} /> : null}
            {activeCount ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('taxonomy.clearAll', undefined, language)} onPress={filters.clearAll} style={styles.textButton}>
                <Text style={{ color: colors.actionPrimary, fontWeight: '700' }}>{t('taxonomy.clearAll', undefined, language)}</Text>
              </Pressable>
            ) : null}
            {optionsError ? (
              <Text accessibilityLiveRegion="polite" style={{ color: colors.danger }}>{t('taxonomy.loadError', undefined, language)}</Text>
            ) : null}
            {!lists && optionsLoading ? (
              <ActivityIndicator accessibilityLabel={t('taxonomy.loading', undefined, language)} color={colors.actionPrimary} />
            ) : null}
            {lists ? dimensions.map((dimension) => (
              <DimensionSection
                key={dimension}
                dimension={dimension}
                items={lists[dimension]}
                selectedIds={selection[dimension]}
                language={language}
                onToggle={(id) => toggle(dimension, id)}
              />
            )) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function OverrideNotice({ filters, language }: { filters: SurfaceTaxonomyFilters; language: TaxonomyLanguage }) {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.notice, { borderColor: colors.infoBorder, backgroundColor: colors.infoSurface }]}
    >
      <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{t('taxonomy.overrideNotice', undefined, language)}</Text>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('taxonomy.useShared', undefined, language)} onPress={filters.resetToShared} style={[styles.noticeButton, { borderColor: colors.border }]}>
          <Text style={{ color: colors.textPrimary }}>{t('taxonomy.useShared', undefined, language)}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('taxonomy.applyEverywhere', undefined, language)} onPress={filters.applyEverywhere} style={[styles.noticeButton, { borderColor: colors.border }]}>
          <Text style={{ color: colors.textPrimary }}>{t('taxonomy.applyEverywhere', undefined, language)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DimensionSection({
  dimension,
  items,
  selectedIds,
  language,
  onToggle,
}: {
  dimension: TaxonomyDimension;
  items: TaxonomyOption[];
  selectedIds: string[];
  language: TaxonomyLanguage;
  onToggle: (id: string) => void;
}) {
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState(selectedIds.length > 0);
  const [search, setSearch] = useState('');
  const title = t(DIMENSION_LABEL_KEYS[dimension], undefined, language);
  const needle = normalizeSearch(search);
  const visible = useMemo(() => {
    const matching = needle
      ? items.filter((item) => normalizeSearch(`${item.label} ${item.context ?? ''}`).includes(needle))
      : items;
    // Keep selected values reachable even when the list is truncated.
    const head = matching.slice(0, MAX_VISIBLE_OPTIONS);
    const missingSelected = matching.slice(MAX_VISIBLE_OPTIONS).filter((item) => selectedIds.includes(item.id));
    return [...head, ...missingSelected];
  }, [items, needle, selectedIds]);

  return (
    <View style={[styles.section, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={selectedIds.length ? `${title} (${selectedIds.length})` : title}
        onPress={() => setExpanded((value) => !value)}
        style={styles.sectionHeader}
      >
        <Text style={[styles.label, { color: colors.textPrimary }]}>{selectedIds.length ? `${title} (${selectedIds.length})` : title}</Text>
        <Text style={{ color: colors.textSecondary }} importantForAccessibility="no">{expanded ? '▴' : '▾'}</Text>
      </Pressable>
      {expanded ? (
        <View style={styles.optionList}>
          {items.length > SEARCH_THRESHOLD ? (
            <TextInput
              accessibilityLabel={t('taxonomy.searchOptions', { dimension: title.toLocaleLowerCase(language) }, language)}
              placeholder={t('taxonomy.searchOptions', { dimension: title.toLocaleLowerCase(language) }, language)}
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              style={[styles.searchInput, { color: colors.textPrimary, borderColor: colors.border }]}
            />
          ) : null}
          {visible.length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>{t('taxonomy.noOptions', undefined, language)}</Text>
          ) : visible.map((item) => {
            const checked = selectedIds.includes(item.id);
            const label = item.context ? `${item.label} · ${item.context}` : item.label;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={item.count === undefined ? label : t('taxonomy.optionLabel', { label, count: item.count }, language)}
                onPress={() => onToggle(item.id)}
                style={[
                  styles.option,
                  { paddingLeft: 12 + item.depth * 18, borderColor: checked ? colors.actionPrimary : colors.borderSubtle, backgroundColor: checked ? colors.selected : colors.surfaceRaised },
                ]}
              >
                <Text importantForAccessibility="no" style={{ color: colors.actionPrimary, fontWeight: '800' }}>{checked ? '☑' : '☐'}</Text>
                <Text style={[styles.optionLabel, { color: colors.textPrimary, opacity: item.count === 0 && !checked ? 0.6 : 1 }]}>
                  {item.depth > 0 ? '↳ ' : ''}{item.label}
                  {item.context ? <Text style={{ color: colors.textSecondary }}>{` · ${item.context}`}</Text> : null}
                </Text>
                {item.count !== undefined ? <Text style={{ color: colors.textSecondary }}>({item.count})</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  openButton: { minHeight: 44, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  openButtonText: { fontWeight: '800' },
  textButton: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 36, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, maxWidth: '100%' },
  notice: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  noticeButton: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, justifyContent: 'center', flexShrink: 1 },
  sheet: { flex: 1 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetTitle: { fontSize: 20, fontWeight: '800' },
  sheetContent: { padding: 16, gap: 12, paddingBottom: 40 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchText: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontWeight: '800' },
  section: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  sectionHeader: { minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionList: { paddingHorizontal: 10, paddingBottom: 10, gap: 6 },
  searchInput: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  option: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, paddingRight: 12 },
  optionLabel: { flex: 1, flexWrap: 'wrap' },
});
