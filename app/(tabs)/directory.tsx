import AsyncStorage from '@react-native-async-storage/async-storage';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Directory,
  type DirectoryEntityType,
  type DirectorySearchItem,
} from '../../src/api/directory';
import { useAnalytics } from '../../src/analytics/AnalyticsProvider';
import { useDebouncedValue } from '../../src/hooks/useDebouncedValue';
import { useAuth } from '../../src/providers/AuthProvider';
import { useUserSettings } from '../../src/providers/UserSettingsProvider';
import { useAppTheme } from '../../src/theme/ThemeProvider';

const CITY_STORAGE_KEY = 'tdf-mobile/directory-city-id';
type ViewMode = 'list' | 'grid' | 'map';
type EntityFilter = 'all' | DirectoryEntityType;

const ENTITY_OPTIONS: ReadonlyArray<{ id: EntityFilter; label: string }> = [
  { id: 'all', label: 'Todo' },
  { id: 'profile', label: 'Perfiles' },
  { id: 'classified', label: 'Anuncios' },
  { id: 'event', label: 'Eventos' },
  { id: 'venue', label: 'Venues' },
];

const MODE_OPTIONS: ReadonlyArray<{ id: ViewMode; label: string }> = [
  { id: 'list', label: 'Lista' },
  { id: 'grid', label: 'Cuadrícula' },
  { id: 'map', label: 'Mapa' },
];

const detailHref = (item: DirectorySearchItem): Href => {
  const resource = item.type === 'profile' || item.type === 'classified' ? item.slug : item.id;
  return `/directory/${item.type}/${encodeURIComponent(resource)}` as Href;
};

export default function DirectoryScreen() {
  const router = useRouter();
  const analytics = useAnalytics();
  const { token } = useAuth();
  const { locale } = useUserSettings();
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [entityType, setEntityType] = useState<EntityFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [cityId, setCityId] = useState<string | undefined>();
  const [location, setLocation] = useState<{ latitude: number; longitude: number }>();
  const [radiusKm, setRadiusKm] = useState(25);
  const [professionId, setProfessionId] = useState<string>();
  const [serviceId, setServiceId] = useState<string>();
  const [instrumentId, setInstrumentId] = useState<string>();
  const [genreId, setGenreId] = useState<string>();
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);
  const cityInitialized = useRef(false);

  const taxonomies = useQuery({
    queryKey: ['directory-taxonomies', locale],
    queryFn: () => Directory.taxonomies(locale.startsWith('en') ? 'en' : 'es'),
    staleTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    if (!taxonomies.data || cityInitialized.current) return;
    cityInitialized.current = true;
    void AsyncStorage.getItem(CITY_STORAGE_KEY).then((stored) => {
      const available = taxonomies.data?.cities ?? [];
      const selected = available.find((city) => city.id === stored)
        ?? available.find((city) => city.code === 'quito-ec-p')
        ?? available.find((city) => city.name.trim().toLocaleLowerCase().includes('quito'))
        ?? available[0];
      if (selected) setCityId(selected.id);
    });
  }, [taxonomies.data]);

  const search = useInfiniteQuery({
    queryKey: [
      'directory-search', debouncedQuery, entityType, cityId,
      location?.latitude, location?.longitude, radiusKm, professionId, serviceId,
      instrumentId, genreId, remoteOnly, availableOnly,
    ],
    queryFn: ({ pageParam }) => Directory.search({
      q: debouncedQuery.trim() || undefined,
      entityType: entityType === 'all' ? undefined : entityType,
      cityId,
      latitude: location?.latitude,
      longitude: location?.longitude,
      radiusKm: location ? radiusKm : undefined,
      professionId,
      serviceId,
      instrumentId,
      genreId,
      remote: remoteOnly || undefined,
      available: availableOnly || undefined,
      cursor: pageParam,
      limit: 20,
    }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = useMemo(() => search.data?.pages.flatMap((page) => page.items) ?? [], [search.data]);
  const sponsored = search.data?.pages[0]?.sponsoredItems ?? [];
  const selectedCity = taxonomies.data?.cities.find((city) => city.id === cityId);

  useEffect(() => {
    if (!search.isFetched || items.length || !debouncedQuery.trim()) return;
    analytics.capture('directory_search_no_results', {
      platform: 'mobile',
      query_length: debouncedQuery.trim().length,
      entity_type: entityType,
      city_id: cityId,
    });
  }, [analytics, cityId, debouncedQuery, entityType, items.length, search.isFetched]);

  const chooseCity = useCallback((nextCityId: string) => {
    setCityId(nextCityId);
    setLocation(undefined);
    void AsyncStorage.setItem(CITY_STORAGE_KEY, nextCityId);
    analytics.capture('directory_city_selected', { platform: 'mobile', city_id: nextCityId });
  }, [analytics]);

  const requestLocation = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      Alert.alert('Ubicación no compartida', 'Puedes seguir buscando por la ciudad elegida.');
      return;
    }
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
    analytics.capture('directory_location_consent_granted', { platform: 'mobile' });
  }, [analytics]);

  const saveSearch = useCallback(async () => {
    if (!token?.trim()) {
      router.push({ pathname: '/auth', params: { returnTo: '/(tabs)/directory' } });
      return;
    }
    try {
      await Directory.saveSearch({
        name: debouncedQuery.trim() || `Oportunidades en ${selectedCity?.name ?? 'mi ciudad'}`,
        canonicalQuery: {
          q: debouncedQuery.trim(), entityType, cityId, radiusKm: location ? radiusKm : undefined,
          professionId, serviceId, instrumentId, genreId,
          remote: remoteOnly, available: availableOnly,
        },
        alertsEnabled: true,
        alertFrequency: 'daily',
      });
      Alert.alert('Búsqueda guardada', 'Te avisaremos una sola vez por cada coincidencia nueva.');
    } catch (error) {
      Alert.alert('No pudimos guardarla', error instanceof Error ? error.message : 'Inténtalo nuevamente.');
    }
  }, [availableOnly, cityId, debouncedQuery, entityType, genreId, instrumentId, location, professionId, radiusKm, remoteOnly, router, selectedCity?.name, serviceId, token]);

  const openItem = useCallback((item: DirectorySearchItem) => {
    analytics.capture('directory_result_opened', {
      platform: 'mobile', entity_type: item.type, entity_id: item.id, sponsored: item.sponsored,
    });
    router.push(detailHref(item));
  }, [analytics, router]);

  const renderResult = useCallback(({ item }: { item: DirectorySearchItem }) => (
    <ResultCard item={item} compact={viewMode === 'grid'} onOpen={() => openItem(item)} />
  ), [openItem, viewMode]);

  const header = (
    <View style={styles.headerContent}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>Encuentra tu próxima conexión musical</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Músicos, equipos, venues, eventos y oportunidades cerca de ti.</Text>
      <TextInput
        accessibilityLabel="Buscar en el directorio musical"
        placeholder="Bajista, productor, estudio, concierto…"
        placeholderTextColor={colors.textSecondary}
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        style={[styles.searchInput, { color: colors.textPrimary, backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
      />
      <Text style={[styles.label, { color: colors.textPrimary }]}>Ciudad</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {(taxonomies.data?.cities ?? []).map((city) => (
          <FilterChip key={city.id} label={city.name} selected={city.id === cityId} onPress={() => chooseCity(city.id)} />
        ))}
      </ScrollView>
      <View style={styles.actionsRow}>
        <Pressable accessibilityRole="button" style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => void requestLocation()}>
          <Text style={{ color: colors.textPrimary }}>{location ? 'Ubicación activa' : 'Usar mi ubicación'}</Text>
        </Pressable>
        {location ? (
          <Pressable accessibilityRole="button" style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => setLocation(undefined)}>
            <Text style={{ color: colors.textPrimary }}>Quitar</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" style={[styles.primaryButton, { backgroundColor: colors.actionPrimary }]} onPress={() => void saveSearch()}>
          <Text style={{ color: colors.actionPrimaryContrast, fontWeight: '700' }}>Guardar búsqueda</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => router.push(token?.trim() ? '/directory/manage' : { pathname: '/auth', params: { returnTo: '/directory/manage' } })}>
          <Text style={{ color: colors.textPrimary }}>Mis perfiles y anuncios</Text>
        </Pressable>
      </View>
      {location ? (
        <View style={styles.chipRow}>
          {[10, 25, 50, 100].map((radius) => (
            <FilterChip key={radius} label={`${radius} km`} selected={radiusKm === radius} onPress={() => setRadiusKm(radius)} />
          ))}
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {ENTITY_OPTIONS.map((option) => (
          <FilterChip key={option.id} label={option.label} selected={entityType === option.id} onPress={() => setEntityType(option.id)} />
        ))}
      </ScrollView>
      <TaxonomyFilterRow label="Profesión" items={taxonomies.data?.professions ?? []} selectedId={professionId} onSelect={setProfessionId} />
      <TaxonomyFilterRow label="Servicio" items={taxonomies.data?.serviceOfferings ?? []} selectedId={serviceId} onSelect={setServiceId} />
      <TaxonomyFilterRow label="Instrumento" items={taxonomies.data?.instruments ?? []} selectedId={instrumentId} onSelect={setInstrumentId} />
      <TaxonomyFilterRow label="Género" items={taxonomies.data?.genres ?? []} selectedId={genreId} onSelect={setGenreId} />
      <View style={styles.chipRow}>
        <FilterChip label="Remoto" selected={remoteOnly} onPress={() => setRemoteOnly((value) => !value)} />
        <FilterChip label="Disponible" selected={availableOnly} onPress={() => setAvailableOnly((value) => !value)} />
      </View>
      <View accessibilityLabel="Vista de resultados" style={styles.segmented}>
        {MODE_OPTIONS.map((option) => (
          <FilterChip key={option.id} label={option.label} selected={viewMode === option.id} onPress={() => setViewMode(option.id)} />
        ))}
      </View>
      {sponsored.length ? (
        <View style={[styles.sponsoredBox, { borderColor: colors.warningBorder, backgroundColor: colors.warningSurface }]}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Patrocinado — separado del ranking orgánico</Text>
          {sponsored.map((item) => <ResultCard key={`${item.type}:${item.id}`} item={item} onOpen={() => openItem(item)} />)}
        </View>
      ) : null}
      <Text accessibilityRole="header" style={[styles.resultsTitle, { color: colors.textPrimary }]}>Resultados orgánicos · {search.data?.pages[0]?.facets.total ?? 0}</Text>
    </View>
  );

  if (search.isLoading || taxonomies.isLoading) {
    return <SafeAreaView style={[styles.centered, { backgroundColor: colors.canvas }]}><ActivityIndicator accessibilityLabel="Buscando" color={colors.actionPrimary} /></SafeAreaView>;
  }

  if (viewMode === 'map') {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.canvas }]}>
        <ScrollView contentContainerStyle={styles.listContent}>{header}<MapResults items={items} /></ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <FlatList
        key={viewMode}
        data={items}
        keyExtractor={(item) => `${item.type}:${item.id}`}
        renderItem={renderResult}
        numColumns={viewMode === 'grid' ? 2 : 1}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState hasQuery={Boolean(debouncedQuery.trim())} />}
        ListFooterComponent={search.hasNextPage ? <ActivityIndicator color={colors.actionPrimary} /> : null}
        onEndReached={() => { if (search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage(); }}
        refreshControl={<RefreshControl refreshing={search.isRefetching} onRefresh={() => void search.refetch()} />}
      />
    </SafeAreaView>
  );
}

function TaxonomyFilterRow({
  label,
  items,
  selectedId,
  onSelect,
}: {
  label: string;
  items: Array<{ id: string; name: string }>;
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
}) {
  const { colors } = useAppTheme();
  if (!items.length) return null;
  return (
    <View style={styles.taxonomyFilter}>
      <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <FilterChip label="Todos" selected={!selectedId} onPress={() => onSelect(undefined)} />
        {items.map((item) => (
          <FilterChip key={item.id} label={item.name} selected={item.id === selectedId} onPress={() => onSelect(item.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? colors.actionPrimary : colors.border, backgroundColor: selected ? colors.selected : colors.surface }]}
    >
      <Text style={{ color: colors.textPrimary, fontWeight: selected ? '700' : '500' }}>{label}</Text>
    </Pressable>
  );
}

function ResultCard({ item, compact = false, onOpen }: { item: DirectorySearchItem; compact?: boolean; onOpen: () => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.card, compact && styles.cardCompact, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderSubtle }]}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${item.title}, ${item.location.city ?? 'ubicación no indicada'}`}
        onPress={onOpen}
        style={styles.cardLink}
      >
        <Text style={[styles.kind, { color: colors.actionPrimary }]}>{item.type.toUpperCase()}</Text>
        <Text numberOfLines={2} style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.title}</Text>
        {item.subtitle ? <Text numberOfLines={2} style={{ color: colors.textSecondary }}>{item.subtitle}</Text> : null}
        {item.summary ? <Text numberOfLines={compact ? 3 : 4} style={[styles.cardSummary, { color: colors.textSecondary }]}>{item.summary}</Text> : null}
        <Text style={{ color: colors.textSecondary }}>
          {item.location.city ?? 'Disponible en remoto'}{item.location.distanceKm != null ? ` · ~${item.location.distanceKm} km` : ''}
        </Text>
      </Pressable>
      <View style={styles.actionsRow}>
        {item.modality?.remote ? <Text style={[styles.badge, { color: colors.success }]}>Remoto</Text> : null}
        {item.modality?.travel ? <Text style={[styles.badge, { color: colors.success }]}>Viaja</Text> : null}
        <Pressable accessibilityRole="button" style={styles.cardAction} onPress={() => void Share.share({ message: `${item.title} — TDF`, url: String(detailHref(item)) })}>
          <Text style={{ color: colors.actionPrimary }}>Compartir</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MapResults({ items }: { items: DirectorySearchItem[] }) {
  const { colors } = useAppTheme();
  const located = items.filter((item) => item.location.latitude != null && item.location.longitude != null);
  return (
    <View accessibilityLabel="Vista de mapa con ubicaciones aproximadas" style={[styles.mapBox, { backgroundColor: colors.infoSurface, borderColor: colors.infoBorder }]}>
      <Text accessibilityRole="header" style={[styles.resultsTitle, { color: colors.textPrimary }]}>Mapa abierto de OpenStreetMap</Text>
      <Text style={{ color: colors.textSecondary }}>Solo se usan centroides de ciudad o ubicaciones comerciales autorizadas; nunca coordenadas residenciales exactas.</Text>
      {located.length ? located.map((item) => (
        <Pressable
          key={`${item.type}:${item.id}`}
          accessibilityRole="link"
          style={[styles.mapMarker, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
          onPress={() => void Linking.openURL(`https://www.openstreetmap.org/?mlat=${item.location.latitude}&mlon=${item.location.longitude}#map=12/${item.location.latitude}/${item.location.longitude}`)}
        >
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.title}</Text>
          <Text style={{ color: colors.actionPrimary }}>Abrir ubicación aproximada en OSM</Text>
        </Pressable>
      )) : <Text style={{ color: colors.textSecondary }}>No hay resultados con ubicación pública aproximada. Prueba otra ciudad o resultados remotos.</Text>}
    </View>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.empty}>
      <Text accessibilityRole="header" style={[styles.resultsTitle, { color: colors.textPrimary }]}>No encontramos coincidencias</Text>
      <Text style={{ color: colors.textSecondary }}>{hasQuery ? 'Prueba un sinónimo, otra ciudad o activa resultados remotos.' : 'Amplía el radio o explora otra categoría.'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16, paddingBottom: 40, gap: 12 },
  headerContent: { gap: 12, marginBottom: 8 },
  title: { fontSize: 30, lineHeight: 35, fontWeight: '900' },
  subtitle: { fontSize: 16, lineHeight: 23 },
  searchInput: { minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, fontSize: 16 },
  label: { fontSize: 14, fontWeight: '800' },
  taxonomyFilter: { gap: 6 },
  chipRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  chip: { minHeight: 42, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  segmented: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionsRow: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  primaryButton: { minHeight: 44, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  secondaryButton: { minHeight: 44, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  resultsTitle: { fontSize: 19, fontWeight: '800' },
  card: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 16, gap: 8, marginBottom: 12 },
  cardLink: { gap: 8 },
  cardAction: { minHeight: 44, minWidth: 88, alignItems: 'center', justifyContent: 'center' },
  cardCompact: { minWidth: 0 },
  gridRow: { gap: 12 },
  kind: { fontSize: 11, letterSpacing: 1.2, fontWeight: '900' },
  cardTitle: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  cardSummary: { fontSize: 14, lineHeight: 20 },
  badge: { fontSize: 12, fontWeight: '800' },
  sponsoredBox: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 },
  mapBox: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 12, minHeight: 360 },
  mapMarker: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  empty: { padding: 28, alignItems: 'center', gap: 8 },
});
