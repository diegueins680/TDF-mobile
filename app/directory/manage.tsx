import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Directory,
  type DirectoryInvitation,
  type DirectoryPortfolioItem,
  type DirectoryProfileLink,
  type DirectoryProfileUpsert,
  type ManagedDirectoryProfile,
} from '../../src/api/directory';
import {
  classifiedFormError,
  moneyToMinor,
  parseIsoInput,
  requirementLabel,
  taxonomyRequirements,
} from '../../src/features/directory/classifiedForm';
import { minorToMoney, profileFormError } from '../../src/features/directory/profileForm';
import { useAppTheme } from '../../src/theme/ThemeProvider';

const slugify = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 120);

export default function DirectoryManageScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useAppTheme();
  const [mode, setMode] = useState<'profiles' | 'classifieds' | 'invitations'>('profiles');
  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ManagedDirectoryProfile>();
  const profiles = useQuery({ queryKey: ['directory-managed-profiles'], queryFn: Directory.managedProfiles });
  const classifieds = useQuery({ queryKey: ['directory-managed-classifieds'], queryFn: Directory.managedClassifieds });
  const invitations = useQuery({ queryKey: ['directory-invitations'], queryFn: Directory.invitations });
  const taxonomies = useQuery({ queryKey: ['directory-taxonomies', 'es'], queryFn: () => Directory.taxonomies('es') });
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['directory-managed-profiles'] }),
    queryClient.invalidateQueries({ queryKey: ['directory-managed-classifieds'] }),
    queryClient.invalidateQueries({ queryKey: ['directory-invitations'] }),
  ]);
  const age = useMutation({
    mutationFn: () => Directory.setAgeAssurance({ adultAttestation: true }),
    onSuccess: () => Alert.alert('Declaración registrada', 'No equivale a una verificación de identidad.'),
  });
  const profileStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => Directory.transitionProfile(id, status), onSuccess: refresh });
  const classifiedStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => Directory.transitionClassified(id, status), onSuccess: refresh });

  if (profiles.isLoading || classifieds.isLoading || invitations.isLoading || taxonomies.isLoading) {
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
          <Segment label={`Invitaciones (${invitations.data?.length ?? 0})`} selected={mode === 'invitations'} onPress={() => { setMode('invitations'); setShowForm(false); }} />
        </View>
        {mode !== 'invitations' ? <Pressable accessibilityRole="button" style={[styles.primaryButton, { backgroundColor: colors.actionPrimary }]} onPress={() => { if (!showForm && mode === 'profiles') setEditingProfile(undefined); setShowForm((value) => !value); }}>
          <Text style={{ color: colors.actionPrimaryContrast, fontWeight: '800' }}>{showForm ? 'Cerrar formulario' : mode === 'profiles' ? 'Crear otro perfil' : 'Crear clasificado'}</Text>
        </Pressable> : null}
        {showForm && mode === 'profiles' ? <ProfileForm profile={editingProfile} taxonomies={taxonomies.data!} onSaved={async () => { setShowForm(false); setEditingProfile(undefined); await refresh(); }} /> : null}
        {showForm && mode === 'classifieds' ? <ClassifiedForm taxonomies={taxonomies.data!} profiles={profiles.data ?? []} onCreated={async () => { setShowForm(false); await refresh(); }} /> : null}
        {mode === 'profiles' ? (profiles.data ?? []).map((profile) => (
          <View key={profile.id} style={[styles.card, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{profile.name}</Text>
            <Text style={{ color: colors.textSecondary }}>{profile.kind} · {profile.status} · {profile.professionIds.length} profesiones · {profile.serviceAreas.length} áreas</Text>
            <View style={styles.row}>
              <Pressable onPress={() => router.push(`/directory/profile/${profile.slug}`)}><Text style={{ color: colors.actionPrimary }}>Vista pública</Text></Pressable>
              {profile.capabilities.edit ? <Pressable onPress={() => { setEditingProfile(profile); setShowForm(true); }}><Text style={{ color: colors.actionPrimary }}>Editar</Text></Pressable> : null}
              {profile.status !== 'published' && profile.capabilities.publish ? <Pressable onPress={() => profileStatus.mutate({ id: profile.id, status: 'published' })}><Text style={{ color: colors.actionPrimary }}>Publicar</Text></Pressable> : null}
              {profile.status === 'published' ? <Pressable onPress={() => profileStatus.mutate({ id: profile.id, status: 'paused' })}><Text style={{ color: colors.actionPrimary }}>Pausar</Text></Pressable> : null}
            </View>
          </View>
        )) : mode === 'classifieds' ? (classifieds.data ?? []).map((classified) => (
          <View key={classified.id} style={[styles.card, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{classified.title}</Text>
            <Text style={{ color: colors.textSecondary }}>{classified.status}{classified.expiresAt ? ` · vence ${new Date(classified.expiresAt).toLocaleDateString()}` : ''}</Text>
            <View style={styles.row}>
              {classified.status === 'draft' ? <Pressable onPress={() => classifiedStatus.mutate({ id: classified.id, status: 'published' })}><Text style={{ color: colors.actionPrimary }}>Publicar</Text></Pressable> : null}
              {classified.status === 'published' ? <Pressable onPress={() => classifiedStatus.mutate({ id: classified.id, status: 'filled' })}><Text style={{ color: colors.actionPrimary }}>Marcar cubierto</Text></Pressable> : null}
            </View>
          </View>
        )) : (invitations.data ?? []).map((invitation) => <InvitationCard key={invitation.id} invitation={invitation} onRefresh={refresh} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

function InvitationCard({ invitation, onRefresh }: { invitation: DirectoryInvitation; onRefresh: () => Promise<unknown> }) {
  const { colors } = useAppTheme();
  const [conversationMessage, setConversationMessage] = useState('Hola, acepté la invitación y quisiera continuar la conversación en TDF.');
  const mine = invitation.participantRole === 'sender' ? invitation.senderProfile : invitation.targetProfile;
  const other = invitation.participantRole === 'sender' ? invitation.targetProfile : invitation.senderProfile;
  const transition = useMutation({
    mutationFn: (status: string) => Directory.transitionInvitation(invitation.id, status),
    onSuccess: onRefresh,
    onError: (error) => Alert.alert('No pudimos actualizarla', error instanceof Error ? error.message : 'Inténtalo nuevamente.'),
  });
  const conversation = useMutation({
    mutationFn: async () => {
      await Directory.contact({ senderProfileId: mine.id, targetProfileId: other.id, contextKind: 'invitation', contextId: invitation.id, message: conversationMessage.trim() }, `mobile-invitation-contact-${invitation.id}`);
      return Directory.transitionInvitation(invitation.id, 'conversation_open');
    },
    onSuccess: async () => { await onRefresh(); Alert.alert('Conversación abierta', 'El contexto de la invitación quedó vinculado al chat existente.'); },
    onError: (error) => Alert.alert('No pudimos abrir la conversación', error instanceof Error ? error.message : 'Inténtalo nuevamente.'),
  });
  const pendingTarget = invitation.participantRole === 'target' && invitation.status === 'pending';
  const pendingSender = invitation.participantRole === 'sender' && invitation.status === 'pending';
  return <View style={[styles.card, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderSubtle }]}>
    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{invitation.participantRole === 'sender' ? `Invitaste a ${other.name}` : `${other.name} te invitó`}</Text>
    <Text style={{ color: colors.textSecondary }}>Actúas como {mine.name} · {invitation.classified?.title ?? 'invitación general'} · {invitation.status}</Text>
    <Text style={{ color: colors.textPrimary }}>{invitation.message}</Text>
    {invitation.status === 'accepted' ? <TextInput accessibilityLabel="Mensaje para abrir la conversación" multiline value={conversationMessage} onChangeText={setConversationMessage} style={[styles.input, styles.multiline, { color: colors.textPrimary, borderColor: colors.border }]} /> : null}
    <View style={styles.row}>
      {pendingTarget ? <><Pressable onPress={() => transition.mutate('accepted')}><Text style={{ color: colors.actionPrimary }}>Aceptar</Text></Pressable><Pressable onPress={() => transition.mutate('declined')}><Text style={{ color: colors.actionPrimary }}>Rechazar</Text></Pressable><Pressable onPress={() => transition.mutate('blocked')}><Text style={{ color: colors.danger }}>Bloquear</Text></Pressable></> : null}
      {pendingSender ? <Pressable onPress={() => transition.mutate('withdrawn')}><Text style={{ color: colors.actionPrimary }}>Retirar</Text></Pressable> : null}
      {invitation.status === 'accepted' ? <Pressable onPress={() => conversation.mutate()} disabled={!conversationMessage.trim() || conversation.isPending}><Text style={{ color: colors.actionPrimary }}>Abrir conversación</Text></Pressable> : null}
    </View>
  </View>;
}

type Taxonomies = Awaited<ReturnType<typeof Directory.taxonomies>>;

type ProfessionFormDetail = { headline: string; yearsExperience: string; rateMin: string; rateMax: string; currencyId: string };
type InstrumentLevel = NonNullable<NonNullable<DirectoryProfileUpsert['instrumentDetails']>[number]['proficiency']>;
type LanguageLevel = NonNullable<NonNullable<DirectoryProfileUpsert['languages']>[number]['proficiency']>;

function ProfileForm({ profile, taxonomies, onSaved }: { profile?: ManagedDirectoryProfile; taxonomies: Taxonomies; onSaved: () => void }) {
  const { colors } = useAppTheme();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<DirectoryProfileUpsert['profileKind']>('person');
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [credits, setCredits] = useState('');
  const [equipment, setEquipment] = useState('');
  const [availabilityStatus, setAvailabilityStatus] = useState<NonNullable<DirectoryProfileUpsert['availabilityStatus']>>('ask');
  const [professionIds, setProfessionIds] = useState<string[]>([]);
  const [professionDetails, setProfessionDetails] = useState<Record<string, ProfessionFormDetail>>({});
  const [instrumentIds, setInstrumentIds] = useState<string[]>([]);
  const [instrumentLevels, setInstrumentLevels] = useState<Record<string, InstrumentLevel>>({});
  const [genreIds, setGenreIds] = useState<string[]>([]);
  const [serviceOfferingIds, setServiceOfferingIds] = useState<string[]>([]);
  const [languageIds, setLanguageIds] = useState<string[]>([]);
  const [languageLevels, setLanguageLevels] = useState<Record<string, LanguageLevel>>({});
  const [cityIds, setCityIds] = useState<string[]>([]);
  const [primaryCityId, setPrimaryCityId] = useState('');
  const [serviceRadiusKm, setServiceRadiusKm] = useState('');
  const [onsite, setOnsite] = useState(true);
  const [remote, setRemote] = useState(false);
  const [availableToTravel, setAvailableToTravel] = useState(false);
  const [travelRadiusKm, setTravelRadiusKm] = useState('');
  const [rateMin, setRateMin] = useState('');
  const [rateMax, setRateMax] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [portfolio, setPortfolio] = useState<DirectoryPortfolioItem[]>([]);
  const [links, setLinks] = useState<DirectoryProfileLink[]>([]);
  const preservedServiceAreas = profile?.serviceAreas.filter((area) => !area.cityId) ?? [];
  const preservedPrimaryArea = preservedServiceAreas.find((area) => area.primaryLocation);

  useEffect(() => {
    const quito = taxonomies.cities.find((city) => city.code === 'quito-ec-p')?.id
      ?? taxonomies.cities.find((city) => city.name.trim().toLocaleLowerCase().includes('quito'))?.id
      ?? taxonomies.cities[0]?.id ?? '';
    const defaultCurrencyId = profile?.rates?.currencyId ?? taxonomies.currencies.find((item) => item.code === 'USD')?.id ?? taxonomies.currencies[0]?.id ?? '';
    const minorUnits = taxonomies.currencies.find((item) => item.id === defaultCurrencyId)?.minorUnits ?? 2;
    const profileCities = profile?.serviceAreas.flatMap((area) => area.cityId ? [area.cityId] : []) ?? [];
    const primary = profile?.serviceAreas.find((area) => area.primaryLocation)?.cityId ?? profileCities[0] ?? (profile ? '' : quito);
    setName(profile?.name ?? '');
    setKind(profile?.kind ?? 'person');
    setBio(profile?.bio ?? '');
    setExperience(profile?.experienceSummary ?? '');
    setCredits(profile?.creditsSummary ?? '');
    setEquipment(profile?.equipmentSummary ?? '');
    setAvailabilityStatus(profile?.availabilityStatus ?? 'ask');
    setProfessionIds(profile?.professionIds ?? []);
    setProfessionDetails(Object.fromEntries((profile?.professionDetails ?? []).map((detail) => {
      const detailCurrencyId = detail.currencyId ?? defaultCurrencyId;
      const detailMinorUnits = taxonomies.currencies.find((item) => item.id === detailCurrencyId)?.minorUnits ?? 2;
      return [detail.professionId, { headline: detail.headline ?? '', yearsExperience: detail.yearsExperience === undefined ? '' : String(detail.yearsExperience), rateMin: minorToMoney(detail.rateMinMinor, detailMinorUnits), rateMax: minorToMoney(detail.rateMaxMinor, detailMinorUnits), currencyId: detailCurrencyId }];
    })));
    setInstrumentIds(profile?.instrumentIds ?? []);
    setInstrumentLevels(Object.fromEntries((profile?.instrumentDetails ?? []).map((detail) => [detail.instrumentId, detail.proficiency ?? 'professional'])));
    setGenreIds(profile?.genreIds ?? []);
    setServiceOfferingIds(profile?.serviceOfferingIds ?? []);
    setLanguageIds((profile?.languages ?? []).map((language) => language.languageId));
    setLanguageLevels(Object.fromEntries((profile?.languages ?? []).map((language) => [language.languageId, language.proficiency ?? 'professional'])));
    setCityIds(profile ? profileCities : primary ? [primary] : []);
    setPrimaryCityId(primary);
    setServiceRadiusKm(profile?.serviceAreas.find((area) => area.primaryLocation)?.serviceRadiusKm?.toString() ?? '');
    setOnsite(profile?.onsite ?? true);
    setRemote(profile?.remote ?? false);
    setAvailableToTravel(profile?.availableToTravel ?? false);
    setTravelRadiusKm(profile?.travelRadiusKm?.toString() ?? '');
    setRateMin(minorToMoney(profile?.rates?.minMinor ?? undefined, minorUnits));
    setRateMax(minorToMoney(profile?.rates?.maxMinor ?? undefined, minorUnits));
    setCurrencyId(defaultCurrencyId);
    setPortfolio(profile?.portfolio.map((item) => ({ ...item })) ?? []);
    setLinks(profile?.links.map((item) => ({ ...item })) ?? []);
  }, [profile, taxonomies]);

  const selectProfessions = (ids: string[]) => {
    setProfessionIds(ids);
    setProfessionDetails((current) => Object.fromEntries(ids.map((id) => [id, current[id] ?? { headline: '', yearsExperience: '', rateMin: '', rateMax: '', currencyId }])));
  };
  const selectInstruments = (ids: string[]) => {
    setInstrumentIds(ids);
    setInstrumentLevels((current) => Object.fromEntries(ids.map((id) => [id, current[id] ?? 'professional'])));
  };
  const selectLanguages = (ids: string[]) => {
    setLanguageIds(ids);
    setLanguageLevels((current) => Object.fromEntries(ids.map((id) => [id, current[id] ?? 'professional'])));
  };
  const selectCities = (ids: string[]) => {
    setCityIds(ids);
    if (!ids.includes(primaryCityId)) setPrimaryCityId(ids[0] ?? '');
  };
  const currency = taxonomies.currencies.find((item) => item.id === currencyId);
  const minMinor = moneyToMinor(rateMin, currency?.minorUnits);
  const maxMinor = moneyToMinor(rateMax, currency?.minorUnits);
  const validationError = profileFormError({ name, cityIds, primaryCityId, hasPreservedPrimaryArea: Boolean(preservedPrimaryArea), onsite, remote, availableToTravel, rateMin, rateMax, portfolio, links });
  const mutation = useMutation({
    mutationFn: () => {
      if (validationError) throw new Error(validationError);
      const primaryCity = taxonomies.cities.find((item) => item.id === primaryCityId);
      const primaryArea = primaryCity?.countryId ? { countryId: primaryCity.countryId, cityId: primaryCity.id } : preservedPrimaryArea;
      if (!primaryArea?.countryId) throw new Error('Selecciona una ciudad principal válida.');
      const cityServiceAreas: NonNullable<DirectoryProfileUpsert['serviceAreas']> = cityIds.map((cityId) => {
        const city = taxonomies.cities.find((item) => item.id === cityId);
        if (!city?.countryId) throw new Error('Una ciudad seleccionada no tiene país.');
        return { countryId: city.countryId, cityId, serviceRadiusKm: serviceRadiusKm ? Number(serviceRadiusKm) : undefined, primaryLocation: cityId === primaryCityId, onsite };
      });
      const retainedServiceAreas: NonNullable<DirectoryProfileUpsert['serviceAreas']> = preservedServiceAreas.map((area) => ({
        ...area,
        primaryLocation: primaryCity ? false : area.primaryLocation,
      }));
      const body: DirectoryProfileUpsert = {
        profileKind: kind, publicName: name.trim(), slug: profile?.slug ?? slugify(name), bio: bio.trim() || undefined,
        experienceSummary: experience.trim(), creditsSummary: credits.trim(), equipmentSummary: equipment.trim(),
        portfolio, links, availabilityStatus, rateMinMinor: minMinor, rateMaxMinor: maxMinor,
        currencyId: minMinor !== undefined || maxMinor !== undefined ? currencyId : undefined,
        clearRates: Boolean(profile?.rates && minMinor === undefined && maxMinor === undefined),
        professionIds,
        professionDetails: professionIds.map((professionId) => {
          const detail = professionDetails[professionId] ?? { headline: '', yearsExperience: '', rateMin: '', rateMax: '', currencyId };
          const detailCurrency = taxonomies.currencies.find((item) => item.id === detail.currencyId);
          return { professionId, headline: detail.headline.trim() || undefined, yearsExperience: detail.yearsExperience ? Number(detail.yearsExperience) : undefined, rateMinMinor: moneyToMinor(detail.rateMin, detailCurrency?.minorUnits), rateMaxMinor: moneyToMinor(detail.rateMax, detailCurrency?.minorUnits), currencyId: detail.rateMin || detail.rateMax ? detail.currencyId : undefined };
        }),
        instrumentIds, instrumentDetails: instrumentIds.map((instrumentId) => ({ instrumentId, proficiency: instrumentLevels[instrumentId] ?? 'professional' })),
        genreIds, serviceOfferingIds,
        languages: languageIds.map((languageId) => ({ languageId, proficiency: languageLevels[languageId] ?? 'professional' })),
        serviceAreas: [...cityServiceAreas, ...retainedServiceAreas],
        countryId: primaryArea.countryId, cityId: primaryCity?.id, onsite, remote, availableToTravel,
        travelRadiusKm: availableToTravel && travelRadiusKm ? Number(travelRadiusKm) : undefined,
      };
      return profile ? Directory.updateProfile(profile.id, body) : Directory.createProfile(body);
    },
    onSuccess: onSaved,
    onError: (error) => Alert.alert('No pudimos guardar el perfil', error instanceof Error ? error.message : 'Inténtalo nuevamente.'),
  });
  return (
    <View style={[styles.form, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderSubtle }]}>
      <Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.textPrimary }]}>{profile ? 'Editar perfil público' : 'Nuevo perfil público'}</Text>
      <TextInput accessibilityLabel="Nombre público" placeholder="Nombre público" placeholderTextColor={colors.textSecondary} value={name} onChangeText={setName} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} />
      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Tipo de perfil</Text>
      <View style={styles.chips}>{([['person','Persona'],['artist','Artista'],['band','Banda'],['project','Proyecto'],['organization','Organización'],['company','Empresa'],['venue','Venue'],['studio','Estudio'],['agency','Agencia'],['label','Sello'],['distributor','Distribuidora'],['school','Escuela']] as const).map(([value,label]) => <Segment key={value} label={label} selected={kind === value} onPress={() => setKind(value)} />)}</View>
      <TextInput accessibilityLabel="Biografía" placeholder="Biografía" placeholderTextColor={colors.textSecondary} multiline value={bio} onChangeText={setBio} style={[styles.input, styles.multiline, { color: colors.textPrimary, borderColor: colors.border }]} />
      <TextInput accessibilityLabel="Experiencia" placeholder="Experiencia" placeholderTextColor={colors.textSecondary} multiline value={experience} onChangeText={setExperience} style={[styles.input, styles.multiline, { color: colors.textPrimary, borderColor: colors.border }]} />
      <TextInput accessibilityLabel="Créditos y discografía" placeholder="Créditos y discografía" placeholderTextColor={colors.textSecondary} multiline value={credits} onChangeText={setCredits} style={[styles.input, styles.multiline, { color: colors.textPrimary, borderColor: colors.border }]} />
      <TextInput accessibilityLabel="Equipos disponibles" placeholder="Equipos disponibles" placeholderTextColor={colors.textSecondary} multiline value={equipment} onChangeText={setEquipment} style={[styles.input, styles.multiline, { color: colors.textPrimary, borderColor: colors.border }]} />
      <MultiTaxonomy label="Profesiones (puedes elegir varias)" items={taxonomies.professions} values={professionIds} onChange={selectProfessions} />
      {professionIds.map((id) => {
        const detail = professionDetails[id] ?? { headline: '', yearsExperience: '', rateMin: '', rateMax: '', currencyId };
        const update = (value: Partial<ProfessionFormDetail>) => setProfessionDetails((current) => ({ ...current, [id]: { ...detail, ...value } }));
        return <View key={id} style={[styles.subform, { borderColor: colors.borderSubtle }]}><Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{taxonomies.professions.find((item) => item.id === id)?.name}</Text><TextInput accessibilityLabel="Descripción de este rol" placeholder="Descripción de este rol" placeholderTextColor={colors.textSecondary} value={detail.headline} onChangeText={(value) => update({ headline: value })} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} /><TextInput accessibilityLabel="Años de experiencia" placeholder="Años de experiencia" placeholderTextColor={colors.textSecondary} keyboardType="decimal-pad" value={detail.yearsExperience} onChangeText={(value) => update({ yearsExperience: value })} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} /><TextInput accessibilityLabel="Tarifa mínima para este rol" placeholder="Tarifa mínima" placeholderTextColor={colors.textSecondary} keyboardType="decimal-pad" value={detail.rateMin} onChangeText={(value) => update({ rateMin: value })} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} /><TextInput accessibilityLabel="Tarifa máxima para este rol" placeholder="Tarifa máxima" placeholderTextColor={colors.textSecondary} keyboardType="decimal-pad" value={detail.rateMax} onChangeText={(value) => update({ rateMax: value })} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} /><View style={styles.chips}>{taxonomies.currencies.map((item) => <Segment key={item.id} label={item.code} selected={detail.currencyId === item.id} onPress={() => update({ currencyId: item.id })} />)}</View></View>;
      })}
      <MultiTaxonomy label="Instrumentos" items={taxonomies.instruments} values={instrumentIds} onChange={selectInstruments} />
      {instrumentIds.map((id) => <View key={id} style={styles.fieldGroup}><Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{taxonomies.instruments.find((item) => item.id === id)?.name}</Text><View style={styles.chips}>{[['beginner','Principiante'],['intermediate','Intermedio'],['advanced','Avanzado'],['professional','Profesional'],['virtuoso','Virtuoso']].map(([value,label]) => <Segment key={value} label={label} selected={(instrumentLevels[id] ?? 'professional') === value} onPress={() => setInstrumentLevels((current) => ({ ...current, [id]: value as InstrumentLevel }))} />)}</View></View>)}
      <MultiTaxonomy label="Géneros" items={taxonomies.genres} values={genreIds} onChange={setGenreIds} />
      <MultiTaxonomy label="Servicios" items={taxonomies.serviceOfferings} values={serviceOfferingIds} onChange={setServiceOfferingIds} />
      <MultiTaxonomy label="Idiomas" items={taxonomies.languages} values={languageIds} onChange={selectLanguages} />
      {languageIds.map((id) => <View key={id} style={styles.fieldGroup}><Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{taxonomies.languages.find((item) => item.id === id)?.name}</Text><View style={styles.chips}>{[['basic','Básico'],['conversational','Conversacional'],['professional','Profesional'],['native','Nativo']].map(([value,label]) => <Segment key={value} label={label} selected={(languageLevels[id] ?? 'professional') === value} onPress={() => setLanguageLevels((current) => ({ ...current, [id]: value as LanguageLevel }))} />)}</View></View>)}
      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Disponibilidad</Text>
      <View style={styles.chips}>{[['available','Disponible'],['limited','Limitada'],['unavailable','No disponible'],['ask','Consultar']].map(([value,label]) => <Segment key={value} label={label} selected={availabilityStatus === value} onPress={() => setAvailabilityStatus(value as typeof availabilityStatus)} />)}</View>
      <MultiTaxonomy label="Ciudades y áreas de servicio" items={taxonomies.cities} values={cityIds} onChange={selectCities} />
      {preservedServiceAreas.length > 0 ? <Text style={{ color: colors.textSecondary }}>Las áreas regionales o nacionales existentes que este selector todavía no edita se conservarán al guardar.</Text> : null}
      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Ciudad principal</Text>
      <View style={styles.chips}>{cityIds.map((id) => <Segment key={id} label={taxonomies.cities.find((item) => item.id === id)?.name ?? id} selected={primaryCityId === id} onPress={() => setPrimaryCityId(id)} />)}</View>
      <TextInput accessibilityLabel="Radio de servicio presencial en kilómetros" placeholder="Radio de servicio presencial (km)" placeholderTextColor={colors.textSecondary} keyboardType="decimal-pad" value={serviceRadiusKm} onChangeText={setServiceRadiusKm} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} />
      <BooleanField label="Trabajo presencial" value={onsite} onChange={setOnsite} />
      <BooleanField label="También trabajo remoto" value={remote} onChange={setRemote} />
      <BooleanField label="Disponible para viajar" value={availableToTravel} onChange={setAvailableToTravel} />
      {availableToTravel ? <TextInput accessibilityLabel="Radio de viaje en kilómetros" placeholder="Radio de viaje (km)" placeholderTextColor={colors.textSecondary} keyboardType="decimal-pad" value={travelRadiusKm} onChangeText={setTravelRadiusKm} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} /> : null}
      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Tarifa general</Text>
      <View style={styles.chips}>{taxonomies.currencies.map((item) => <Segment key={item.id} label={[item.code, item.symbol].filter(Boolean).join(' ')} selected={currencyId === item.id} onPress={() => setCurrencyId(item.id)} />)}</View>
      <TextInput accessibilityLabel="Tarifa general mínima" placeholder="Tarifa mínima" placeholderTextColor={colors.textSecondary} keyboardType="decimal-pad" value={rateMin} onChangeText={setRateMin} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} />
      <TextInput accessibilityLabel="Tarifa general máxima" placeholder="Tarifa máxima" placeholderTextColor={colors.textSecondary} keyboardType="decimal-pad" value={rateMax} onChangeText={setRateMax} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} />
      <View style={styles.row}><Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Portafolio</Text><Pressable accessibilityRole="button" onPress={() => setPortfolio((current) => [...current, { itemType: 'other', title: '', url: '' }])}><Text style={{ color: colors.actionPrimary, fontWeight: '800' }}>+ Agregar</Text></Pressable></View>
      {portfolio.map((item, index) => <View key={index} style={[styles.subform, { borderColor: colors.borderSubtle }]}><View style={styles.chips}>{['audio','video','image','release','credit','document','other'].map((value) => <Segment key={value} label={value} selected={item.itemType === value} onPress={() => setPortfolio((current) => current.map((entry, i) => i === index ? { ...entry, itemType: value as DirectoryPortfolioItem['itemType'] } : entry))} />)}</View><TextInput accessibilityLabel={'Título de portafolio ' + (index + 1)} placeholder="Título" placeholderTextColor={colors.textSecondary} value={item.title} onChangeText={(value) => setPortfolio((current) => current.map((entry, i) => i === index ? { ...entry, title: value } : entry))} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} /><TextInput accessibilityLabel={'URL de portafolio ' + (index + 1)} placeholder="https://…" placeholderTextColor={colors.textSecondary} autoCapitalize="none" value={item.url} onChangeText={(value) => setPortfolio((current) => current.map((entry, i) => i === index ? { ...entry, url: value } : entry))} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} /><Pressable accessibilityRole="button" onPress={() => setPortfolio((current) => current.filter((_, i) => i !== index))}><Text style={{ color: colors.danger }}>Quitar</Text></Pressable></View>)}
      <View style={styles.row}><Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Enlaces y redes</Text><Pressable accessibilityRole="button" onPress={() => setLinks((current) => [...current, { label: '', url: '' }])}><Text style={{ color: colors.actionPrimary, fontWeight: '800' }}>+ Agregar</Text></Pressable></View>
      {links.map((item, index) => <View key={index} style={[styles.subform, { borderColor: colors.borderSubtle }]}><TextInput accessibilityLabel={'Etiqueta de enlace ' + (index + 1)} placeholder="Etiqueta" placeholderTextColor={colors.textSecondary} value={item.label} onChangeText={(value) => setLinks((current) => current.map((entry, i) => i === index ? { ...entry, label: value } : entry))} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} /><TextInput accessibilityLabel={'URL de enlace ' + (index + 1)} placeholder="https://…" placeholderTextColor={colors.textSecondary} autoCapitalize="none" value={item.url} onChangeText={(value) => setLinks((current) => current.map((entry, i) => i === index ? { ...entry, url: value } : entry))} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} /><Pressable accessibilityRole="button" onPress={() => setLinks((current) => current.filter((_, i) => i !== index))}><Text style={{ color: colors.danger }}>Quitar</Text></Pressable></View>)}
      <Text style={{ color: colors.textSecondary }}>Las direcciones exactas y coordenadas residenciales no se solicitan ni aparecen en los DTO públicos.</Text>
      {validationError ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{validationError}</Text> : null}
      <Pressable accessibilityRole="button" disabled={Boolean(validationError) || mutation.isPending} style={[styles.primaryButton, { backgroundColor: colors.actionPrimary, opacity: validationError || mutation.isPending ? 0.6 : 1 }]} onPress={() => mutation.mutate()}><Text style={{ color: colors.actionPrimaryContrast, fontWeight: '800' }}>{profile ? 'Guardar cambios' : 'Guardar borrador'}</Text></Pressable>
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
  form: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 14 }, subform: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 }, input: { minHeight: 48, borderWidth: 1, borderRadius: 12, padding: 12 }, multiline: { minHeight: 120, textAlignVertical: 'top' },
  fieldLabel: { fontWeight: '800' }, fieldGroup: { gap: 8 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, segment: { minHeight: 42, borderWidth: 1, borderRadius: 22, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
});
