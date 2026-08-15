import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Directory } from '../../src/api/directory';
import {
  classifiedFormError,
  moneyToMinor,
  parseIsoInput,
  requirementLabel,
  taxonomyRequirements,
} from '../../src/features/directory/classifiedForm';
import { useAppTheme } from '../../src/theme/ThemeProvider';

const slugify = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 120);

export default function DirectoryManageScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useAppTheme();
  const [mode, setMode] = useState<'profiles' | 'classifieds'>('profiles');
  const [showForm, setShowForm] = useState(false);
  const profiles = useQuery({ queryKey: ['directory-managed-profiles'], queryFn: Directory.managedProfiles });
  const classifieds = useQuery({ queryKey: ['directory-managed-classifieds'], queryFn: Directory.managedClassifieds });
  const taxonomies = useQuery({ queryKey: ['directory-taxonomies', 'es'], queryFn: () => Directory.taxonomies('es') });
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['directory-managed-profiles'] }),
    queryClient.invalidateQueries({ queryKey: ['directory-managed-classifieds'] }),
  ]);
  const age = useMutation({
    mutationFn: () => Directory.setAgeAssurance({ adultAttestation: true }),
    onSuccess: () => Alert.alert('Declaración registrada', 'No equivale a una verificación de identidad.'),
  });
  const profileStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => Directory.transitionProfile(id, status), onSuccess: refresh });
  const classifiedStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => Directory.transitionClassified(id, status), onSuccess: refresh });

  if (profiles.isLoading || classifieds.isLoading || taxonomies.isLoading) {
    return <SafeAreaView style={[styles.centered, { backgroundColor: colors.canvas }]}><ActivityIndicator color={colors.actionPrimary} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={{ color: colors.actionPrimary }}>← Volver</Text></Pressable>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>Mis perfiles y anuncios</Text>
        <Text style={{ color: colors.textSecondary }}>Una cuenta puede administrar varios perfiles, siempre mediante una autorización explícita.</Text>
        <View style={[styles.notice, { backgroundColor: colors.infoSurface, borderColor: colors.infoBorder }]}>
          <Text style={{ color: colors.textPrimary }}>Los menores no pueden publicar ni responder de forma independiente.</Text>
          <Pressable accessibilityRole="button" onPress={() => age.mutate()}><Text style={{ color: colors.actionPrimary, fontWeight: '800' }}>Declarar que soy mayor de edad</Text></Pressable>
        </View>
        <View style={styles.row}>
          <Segment label={`Perfiles (${profiles.data?.length ?? 0})`} selected={mode === 'profiles'} onPress={() => { setMode('profiles'); setShowForm(false); }} />
          <Segment label={`Anuncios (${classifieds.data?.length ?? 0})`} selected={mode === 'classifieds'} onPress={() => { setMode('classifieds'); setShowForm(false); }} />
        </View>
        <Pressable accessibilityRole="button" style={[styles.primaryButton, { backgroundColor: colors.actionPrimary }]} onPress={() => setShowForm((value) => !value)}>
          <Text style={{ color: colors.actionPrimaryContrast, fontWeight: '800' }}>{showForm ? 'Cerrar formulario' : mode === 'profiles' ? 'Crear otro perfil' : 'Crear clasificado'}</Text>
        </Pressable>
        {showForm && mode === 'profiles' ? <ProfileForm taxonomies={taxonomies.data!} onCreated={async () => { setShowForm(false); await refresh(); }} /> : null}
        {showForm && mode === 'classifieds' ? <ClassifiedForm taxonomies={taxonomies.data!} profiles={profiles.data ?? []} onCreated={async () => { setShowForm(false); await refresh(); }} /> : null}
        {mode === 'profiles' ? (profiles.data ?? []).map((profile) => (
          <View key={profile.id} style={[styles.card, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{profile.name}</Text>
            <Text style={{ color: colors.textSecondary }}>{profile.kind} · {profile.status}</Text>
            <View style={styles.row}>
              <Pressable onPress={() => router.push(`/directory/profile/${profile.slug}`)}><Text style={{ color: colors.actionPrimary }}>Vista pública</Text></Pressable>
              {profile.status !== 'published' && profile.capabilities.publish ? <Pressable onPress={() => profileStatus.mutate({ id: profile.id, status: 'published' })}><Text style={{ color: colors.actionPrimary }}>Publicar</Text></Pressable> : null}
              {profile.status === 'published' ? <Pressable onPress={() => profileStatus.mutate({ id: profile.id, status: 'paused' })}><Text style={{ color: colors.actionPrimary }}>Pausar</Text></Pressable> : null}
            </View>
          </View>
        )) : (classifieds.data ?? []).map((classified) => (
          <View key={classified.id} style={[styles.card, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{classified.title}</Text>
            <Text style={{ color: colors.textSecondary }}>{classified.status}{classified.expiresAt ? ` · vence ${new Date(classified.expiresAt).toLocaleDateString()}` : ''}</Text>
            <View style={styles.row}>
              {classified.status === 'draft' ? <Pressable onPress={() => classifiedStatus.mutate({ id: classified.id, status: 'published' })}><Text style={{ color: colors.actionPrimary }}>Publicar</Text></Pressable> : null}
              {classified.status === 'published' ? <Pressable onPress={() => classifiedStatus.mutate({ id: classified.id, status: 'filled' })}><Text style={{ color: colors.actionPrimary }}>Marcar cubierto</Text></Pressable> : null}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

type Taxonomies = Awaited<ReturnType<typeof Directory.taxonomies>>;

function ProfileForm({ taxonomies, onCreated }: { taxonomies: Taxonomies; onCreated: () => void }) {
  const { colors } = useAppTheme();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [cityId, setCityId] = useState(
    taxonomies.cities.find((city) => city.code === 'quito-ec-p')?.id
      ?? taxonomies.cities.find((city) => city.name.trim().toLocaleLowerCase().includes('quito'))?.id
      ?? taxonomies.cities[0]?.id
      ?? '',
  );
  const [professionIds, setProfessionIds] = useState<string[]>([]);
  const [instrumentIds, setInstrumentIds] = useState<string[]>([]);
  const [genreIds, setGenreIds] = useState<string[]>([]);
  const [serviceOfferingIds, setServiceOfferingIds] = useState<string[]>([]);
  const [onsite, setOnsite] = useState(true);
  const [remote, setRemote] = useState(false);
  const [availableToTravel, setAvailableToTravel] = useState(false);
  const [travelRadiusKm, setTravelRadiusKm] = useState('');
  const city = taxonomies.cities.find((item) => item.id === cityId);
  const mutation = useMutation({
    mutationFn: () => {
      if (!city?.countryId) throw new Error('Selecciona una ciudad válida.');
      return Directory.createProfile({
        profileKind: 'person', publicName: name.trim(), slug: slugify(name), bio: bio.trim() || undefined,
        professionIds, instrumentIds, genreIds, serviceOfferingIds, countryId: city.countryId,
        cityId, onsite, remote, availableToTravel,
        travelRadiusKm: availableToTravel && travelRadiusKm ? Number(travelRadiusKm) : undefined,
      });
    },
    onSuccess: onCreated,
    onError: (error) => Alert.alert('No pudimos crear el perfil', error instanceof Error ? error.message : 'Inténtalo nuevamente.'),
  });
  return (
    <View style={[styles.form, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderSubtle }]}>
      <TextInput accessibilityLabel="Nombre público" placeholder="Nombre público" placeholderTextColor={colors.textSecondary} value={name} onChangeText={setName} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} />
      <TextInput accessibilityLabel="Biografía" placeholder="Biografía" placeholderTextColor={colors.textSecondary} multiline value={bio} onChangeText={setBio} style={[styles.input, styles.multiline, { color: colors.textPrimary, borderColor: colors.border }]} />
      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Profesiones (puedes elegir varias)</Text>
      <View style={styles.chips}>{taxonomies.professions.map((profession) => <Segment key={profession.id} label={profession.name} selected={professionIds.includes(profession.id)} onPress={() => setProfessionIds((current) => current.includes(profession.id) ? current.filter((id) => id !== profession.id) : [...current, profession.id])} />)}</View>
      <MultiTaxonomy label="Instrumentos" items={taxonomies.instruments} values={instrumentIds} onChange={setInstrumentIds} />
      <MultiTaxonomy label="Géneros" items={taxonomies.genres} values={genreIds} onChange={setGenreIds} />
      <MultiTaxonomy label="Servicios" items={taxonomies.serviceOfferings} values={serviceOfferingIds} onChange={setServiceOfferingIds} />
      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Ciudad principal</Text>
      <View style={styles.chips}>{taxonomies.cities.map((cityOption) => <Segment key={cityOption.id} label={cityOption.name} selected={cityOption.id === cityId} onPress={() => setCityId(cityOption.id)} />)}</View>
      <BooleanField label="Trabajo presencial" value={onsite} onChange={setOnsite} />
      <BooleanField label="También trabajo remoto" value={remote} onChange={setRemote} />
      <BooleanField label="Disponible para viajar" value={availableToTravel} onChange={setAvailableToTravel} />
      {availableToTravel ? <TextInput accessibilityLabel="Radio de viaje en kilómetros" placeholder="Radio de viaje (km)" placeholderTextColor={colors.textSecondary} keyboardType="decimal-pad" value={travelRadiusKm} onChangeText={setTravelRadiusKm} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} /> : null}
      {!onsite && !remote && !availableToTravel ? <Text style={{ color: colors.danger }}>Selecciona al menos una modalidad.</Text> : null}
      <Pressable accessibilityRole="button" disabled={!name.trim() || !cityId || (!onsite && !remote && !availableToTravel) || mutation.isPending} style={[styles.primaryButton, { backgroundColor: colors.actionPrimary, opacity: !name.trim() || !cityId || (!onsite && !remote && !availableToTravel) || mutation.isPending ? 0.6 : 1 }]} onPress={() => mutation.mutate()}><Text style={{ color: colors.actionPrimaryContrast, fontWeight: '800' }}>Guardar borrador</Text></Pressable>
    </View>
  );
}

function ClassifiedForm({ taxonomies, profiles, onCreated }: { taxonomies: Taxonomies; profiles: Awaited<ReturnType<typeof Directory.managedProfiles>>; onCreated: () => void }) {
  const { colors } = useAppTheme();
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(taxonomies.classifiedCategories[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cityIds, setCityIds] = useState<string[]>([]);
  const [professionIds, setProfessionIds] = useState<string[]>([]);
  const [instrumentIds, setInstrumentIds] = useState<string[]>([]);
  const [genreIds, setGenreIds] = useState<string[]>([]);
  const [remote, setRemote] = useState(false);
  const [availableToTravel, setAvailableToTravel] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('any');
  const [compensationTypeId, setCompensationTypeId] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [budgetNegotiable, setBudgetNegotiable] = useState(false);
  const [serviceOfferingId, setServiceOfferingId] = useState('');
  const countryIds = useMemo(() => Array.from(new Set(cityIds.flatMap((id) => {
    const countryId = taxonomies.cities.find((city) => city.id === id)?.countryId;
    return countryId ? [countryId] : [];
  }))), [cityIds, taxonomies.cities]);
  const selectedCategory = taxonomies.classifiedCategories.find((item) => item.id === categoryId);
  const required = taxonomyRequirements(selectedCategory);
  const selectedCompensation = taxonomies.compensationTypes.find((item) => item.id === compensationTypeId);
  const budgetMode = typeof selectedCompensation?.metadata?.budget === 'string' ? selectedCompensation.metadata.budget : undefined;
  const selectedCurrencyId = currencyId || taxonomies.currencies.find((item) => item.code === 'USD')?.id || taxonomies.currencies[0]?.id || '';
  const selectedCurrency = taxonomies.currencies.find((item) => item.id === selectedCurrencyId);
  const validationError = classifiedFormError({ required, cityIds, remote, availableToTravel, professionIds, instrumentIds, genreIds, startsAt, endsAt, compensationTypeId, budgetMode, budgetMin, budgetMax, serviceOfferingId });
  const mutation = useMutation({
    mutationFn: () => {
      if (validationError) throw new Error(validationError);
      const minMinor = moneyToMinor(budgetMin, selectedCurrency?.minorUnits);
      const maxMinor = moneyToMinor(budgetMax, selectedCurrency?.minorUnits);
      return Directory.createClassified({
        authorProfileId: profileId, categoryId, title: title.trim(), slug: slugify(`${title}-${Date.now().toString(36)}`),
        description: description.trim(), professionIds, instrumentIds, genreIds, countryIds, cityIds,
        metropolitanAreaIds: [], onsite: cityIds.length > 0, remote, availableToTravel,
        startsAt: parseIsoInput(startsAt), endsAt: parseIsoInput(endsAt), experienceLevel,
        compensationTypeId: compensationTypeId || undefined,
        budgetMinMinor: minMinor,
        budgetMaxMinor: budgetMode === 'exact' && minMinor !== undefined ? minMinor : maxMinor,
        currencyId: minMinor !== undefined || maxMinor !== undefined ? selectedCurrencyId : undefined,
        budgetNegotiable: budgetNegotiable || selectedCompensation?.code === 'negotiable',
        serviceOfferingId: serviceOfferingId || undefined,
      });
    },
    onSuccess: onCreated,
    onError: (error) => Alert.alert('No pudimos crear el anuncio', error instanceof Error ? error.message : 'Inténtalo nuevamente.'),
  });
  return (
    <View style={[styles.form, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderSubtle }]}>
      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Publicar como</Text>
      <View style={styles.chips}>{profiles.map((profile) => <Segment key={profile.id} label={profile.name} selected={profile.id === profileId} onPress={() => setProfileId(profile.id)} />)}</View>
      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Categoría</Text>
      <View style={styles.chips}>{taxonomies.classifiedCategories.map((category) => <Segment key={category.id} label={category.name} selected={category.id === categoryId} onPress={() => setCategoryId(category.id)} />)}</View>
      <TextInput accessibilityLabel="Título del anuncio" placeholder="Título" placeholderTextColor={colors.textSecondary} value={title} onChangeText={setTitle} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} />
      <TextInput accessibilityLabel="Descripción del anuncio" placeholder="Describe la oportunidad" placeholderTextColor={colors.textSecondary} multiline value={description} onChangeText={setDescription} style={[styles.input, styles.multiline, { color: colors.textPrimary, borderColor: colors.border }]} />
      {required.size ? <Text style={{ color: colors.textSecondary }}>Requisitos: {Array.from(required).map(requirementLabel).join(', ')}.</Text> : null}
      <MultiTaxonomy label="Profesiones buscadas" items={taxonomies.professions} values={professionIds} onChange={setProfessionIds} />
      <MultiTaxonomy label="Instrumentos buscados" items={taxonomies.instruments} values={instrumentIds} onChange={setInstrumentIds} />
      <MultiTaxonomy label="Géneros" items={taxonomies.genres} values={genreIds} onChange={setGenreIds} />
      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Ciudades (puedes elegir varias)</Text>
      <View style={styles.chips}>{taxonomies.cities.map((city) => <Segment key={city.id} label={city.name} selected={cityIds.includes(city.id)} onPress={() => setCityIds((current) => current.includes(city.id) ? current.filter((id) => id !== city.id) : [...current, city.id])} />)}</View>
      <BooleanField label="Acepta remoto" value={remote} onChange={setRemote} />
      <BooleanField label="Disponible para viajar" value={availableToTravel} onChange={setAvailableToTravel} />
      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Periodo (ISO 8601, por ejemplo 2026-09-20T20:00:00-05:00)</Text>
      <TextInput accessibilityLabel="Inicio de la oportunidad" placeholder="Inicio" placeholderTextColor={colors.textSecondary} value={startsAt} onChangeText={setStartsAt} autoCapitalize="none" style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} />
      <TextInput accessibilityLabel="Fin de la oportunidad" placeholder="Fin" placeholderTextColor={colors.textSecondary} value={endsAt} onChangeText={setEndsAt} autoCapitalize="none" style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} />
      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Experiencia requerida</Text>
      <View style={styles.chips}>{[['any','Cualquiera'],['beginner','Principiante'],['intermediate','Intermedia'],['advanced','Avanzada'],['professional','Profesional']].map(([value,label]) => <Segment key={value} label={label} selected={experienceLevel === value} onPress={() => setExperienceLevel(value)} />)}</View>
      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Compensación</Text>
      <View style={styles.chips}>{taxonomies.compensationTypes.map((item) => <Segment key={item.id} label={item.name} selected={compensationTypeId === item.id} onPress={() => { setCompensationTypeId(item.id); setBudgetMin(''); setBudgetMax(''); }} />)}</View>
      {compensationTypeId && budgetMode !== 'forbidden' ? <>
        <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Moneda</Text>
        <View style={styles.chips}>{taxonomies.currencies.map((item) => <Segment key={item.id} label={`${item.code} ${item.symbol ?? ''}`.trim()} selected={selectedCurrencyId === item.id} onPress={() => setCurrencyId(item.id)} />)}</View>
        <TextInput accessibilityLabel={budgetMode === 'exact' ? 'Monto' : 'Presupuesto mínimo'} placeholder={budgetMode === 'exact' ? 'Monto' : 'Presupuesto mínimo'} placeholderTextColor={colors.textSecondary} keyboardType="decimal-pad" value={budgetMin} onChangeText={setBudgetMin} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} />
        {budgetMode !== 'exact' ? <TextInput accessibilityLabel="Presupuesto máximo" placeholder="Presupuesto máximo" placeholderTextColor={colors.textSecondary} keyboardType="decimal-pad" value={budgetMax} onChangeText={setBudgetMax} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} /> : null}
        <BooleanField label="Presupuesto negociable" value={budgetNegotiable} onChange={setBudgetNegotiable} />
      </> : null}
      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Servicio comercial vinculado</Text>
      <View style={styles.chips}><Segment label="Ninguno" selected={!serviceOfferingId} onPress={() => setServiceOfferingId('')} />{taxonomies.serviceOfferings.map((item) => <Segment key={item.id} label={item.name} selected={serviceOfferingId === item.id} onPress={() => setServiceOfferingId(item.id)} />)}</View>
      <Text style={{ color: colors.textSecondary }}>Vencerá 30 días después de publicarse. Las ofertas reservables se vinculan al marketplace.</Text>
      {validationError && title.trim().length >= 5 && description.trim().length >= 20 ? <Text style={{ color: colors.danger }}>{validationError}</Text> : null}
      <Pressable accessibilityRole="button" disabled={!profileId || !categoryId || title.trim().length < 5 || description.trim().length < 20 || Boolean(validationError) || mutation.isPending} style={[styles.primaryButton, { backgroundColor: colors.actionPrimary, opacity: validationError ? 0.6 : 1 }]} onPress={() => mutation.mutate()}><Text style={{ color: colors.actionPrimaryContrast, fontWeight: '800' }}>Guardar borrador</Text></Pressable>
    </View>
  );
}

function MultiTaxonomy({ label, items, values, onChange }: { label: string; items: Array<{ id: string; name: string }>; values: string[]; onChange: (values: string[]) => void }) {
  const { colors } = useAppTheme();
  return <View style={styles.fieldGroup}><Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{label}</Text><View style={styles.chips}>{items.map((item) => <Segment key={item.id} label={item.name} selected={values.includes(item.id)} onPress={() => onChange(values.includes(item.id) ? values.filter((id) => id !== item.id) : [...values, item.id])} />)}</View></View>;
}

function BooleanField({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const { colors } = useAppTheme();
  return <View style={styles.row}><Text style={{ color: colors.textPrimary }}>{label}</Text><Switch value={value} onValueChange={onChange} /></View>;
}

function Segment({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.segment, { borderColor: selected ? colors.actionPrimary : colors.border, backgroundColor: selected ? colors.selected : colors.surface }]}><Text style={{ color: colors.textPrimary, fontWeight: selected ? '800' : '500' }}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 48, gap: 14 }, title: { fontSize: 30, fontWeight: '900' },
  notice: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 }, row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  primaryButton: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 }, cardTitle: { fontSize: 19, fontWeight: '800' },
  form: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 14 }, input: { minHeight: 48, borderWidth: 1, borderRadius: 12, padding: 12 }, multiline: { minHeight: 120, textAlignVertical: 'top' },
  fieldLabel: { fontWeight: '800' }, fieldGroup: { gap: 8 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, segment: { minHeight: 42, borderWidth: 1, borderRadius: 22, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
});
