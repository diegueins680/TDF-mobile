import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Catalogs } from '../src/api/catalogs';
import { catalogEditorKind } from '../src/lib/catalogAdmin';
import { useAuth } from '../src/providers/AuthProvider';
import { useUserSettings } from '../src/providers/UserSettingsProvider';
import { useAppTheme } from '../src/theme/ThemeProvider';

export default function CatalogsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { locale } = useUserSettings();
  const { colors } = useAppTheme();
  const [search, setSearch] = useState('');
  const english = locale.toLocaleLowerCase().startsWith('en');
  const t = (es: string, en: string) => english ? en : es;

  const definitionsQuery = useQuery({
    queryKey: ['catalog-admin', 'definitions', locale],
    queryFn: () => Catalogs.listDefinitions(locale),
    enabled: Boolean(token),
  });

  const definitions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale);
    const candidates = definitionsQuery.data ?? [];
    if (!query) return candidates;
    return candidates.filter((definition) =>
      [definition.name, definition.description ?? '', definition.code, definition.classification]
        .some((value) => value.toLocaleLowerCase(locale).includes(query)),
    );
  }, [definitionsQuery.data, locale, search]);

  const classificationLabel = (classification: string) => {
    switch (classification) {
      case 'dynamic-business-catalog':
        return t('Catálogo dinámico', 'Dynamic catalog');
      case 'governed-reference-data':
        return t('Referencia gobernada', 'Governed reference');
      case 'security-system-registry':
        return t('Registro de seguridad', 'Security registry');
      default:
        return classification;
    }
  };

  const errorMessage = definitionsQuery.error instanceof Error
    ? definitionsQuery.error.message
    : t('No se pudieron cargar los catálogos.', 'Catalogs could not be loaded.');

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: colors.canvas }]}>
      <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('Volver', 'Go back')}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('Catálogos', 'Catalogs')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('Definiciones autorizadas por el servidor', 'Definitions authorized by the server')}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('Buscar catálogo', 'Search catalogs')}
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel={t('Buscar catálogo', 'Search catalogs')}
          style={[
            styles.search,
            { color: colors.textPrimary, backgroundColor: colors.surfaceRaised, borderColor: colors.border },
          ]}
        />

        {!token ? (
          <View style={[styles.notice, { backgroundColor: colors.warningSurface, borderColor: colors.warningBorder }]}>
            <Text style={{ color: colors.textPrimary }}>
              {t('Inicia sesión para consultar catálogos protegidos.', 'Sign in to view protected catalogs.')}
            </Text>
          </View>
        ) : definitionsQuery.isLoading ? (
          <ActivityIndicator
            size="large"
            color={colors.actionPrimary}
            accessibilityLabel={t('Cargando catálogos', 'Loading catalogs')}
          />
        ) : definitionsQuery.isError ? (
          <View style={[styles.notice, { backgroundColor: colors.dangerSurface, borderColor: colors.dangerBorder }]}>
            <Text style={{ color: colors.textPrimary }}>{errorMessage}</Text>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.border }]}
              onPress={() => void definitionsQuery.refetch()}
              accessibilityRole="button"
            >
              <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
                {t('Reintentar', 'Try again')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : definitions.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            {t('No hay catálogos que coincidan.', 'No matching catalogs.')}
          </Text>
        ) : definitions.map((definition) => {
          const editable = catalogEditorKind(definition.entityKind) !== 'read-only';
          return (
            <TouchableOpacity
              key={definition.id}
              style={[styles.card, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderSubtle }]}
              onPress={() => router.push({ pathname: '/catalogEditor', params: { catalogCode: definition.code } })}
              accessibilityRole="button"
              accessibilityLabel={`${definition.name}. ${classificationLabel(definition.classification)}`}
              accessibilityHint={editable
                ? t('Abre su administración móvil.', 'Opens mobile administration.')
                : t('Abre una vista de solo lectura.', 'Opens a read-only view.')}
            >
              <View style={styles.cardCopy}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{definition.name}</Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  {definition.code} · {classificationLabel(definition.classification)}
                </Text>
                {definition.description ? (
                  <Text style={[styles.description, { color: colors.textSecondary }]}>
                    {definition.description}
                  </Text>
                ) : null}
                <Text style={[styles.modeLabel, { color: editable ? colors.success : colors.textSecondary }]}>
                  {editable
                    ? t('Edición móvil estricta disponible', 'Strict mobile editing available')
                    : t('Consulta móvil; edición especializada pendiente', 'Mobile view; specialized editing pending')}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderBottomWidth: 1 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, paddingVertical: 8 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  search: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 16 },
  card: { minHeight: 112, borderWidth: 1, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center' },
  cardCopy: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 17, fontWeight: '800' },
  meta: { fontSize: 12 },
  description: { fontSize: 13, lineHeight: 18 },
  modeLabel: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  notice: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 12 },
  secondaryButton: { minHeight: 44, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: 14, fontWeight: '800' },
  empty: { textAlign: 'center', paddingVertical: 32 },
});
