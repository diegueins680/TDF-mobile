import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity, ActivityIndicator, FlatList, TextInput, Alert, Image, Share
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Artists } from '../src/api/artists';
import { Events } from '../src/api/events';
import type { EventRSVPFeedItem, ID, SocialEvent } from '../src/types';
import { useUserSettings } from '../src/providers/UserSettingsProvider';
import { listSavedEventIds, unsaveEvent } from '../src/lib/savedEvents';
import { formatTicketMoney } from '../src/lib/tickets';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { useAuth } from '../src/providers/AuthProvider';
import { canonicalEventUrl, eventShareMessage } from '../src/lib/eventSharing';
import { useAnalytics } from '../src/analytics/AnalyticsProvider';

export default function UserProfileScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { token, partyId, session } = useAuth();
  const analytics = useAnalytics();
  const {
    colors,
    preferenceId: themePreferenceId,
    options: themeOptions,
    catalogSource: themeCatalogSource,
    setPreferenceById: setThemePreferenceById,
  } = useAppTheme();
  const {
    loading,
    localeId, locale, currencyId, currency, timezone, countryId, countryCode,
    getCatalogItems,
    setRegionalPreferences,
  } = useUserSettings();
  const countries = useMemo(() => getCatalogItems('countries'), [getCatalogItems]);
  const localeOptions = useMemo(() => getCatalogItems('locales'), [getCatalogItems]);
  const currencyOptions = useMemo(() => getCatalogItems('currencies'), [getCatalogItems]);
  const [activeTab, setActiveTab] = useState<'artist' | 'events' | 'saved' | 'activity'>('artist');
  const displayName = session?.displayName ?? null;
  const [draftTimezone, setDraftTimezone] = useState(timezone);
  const [draftCountryId, setDraftCountryId] = useState(countryId ?? '');
  const [countrySearch, setCountrySearch] = useState(countryCode ?? '');

  useEffect(() => {
    setDraftTimezone(timezone);
    const selectedCountry = countries.find((country) => country.id === countryId)
      ?? countries.find((country) => country.code === countryCode);
    setDraftCountryId(selectedCountry?.id ?? '');
    setCountrySearch(selectedCountry ? `${selectedCountry.name} · ${selectedCountry.code}` : countryCode ?? '');
  }, [countries, countryCode, countryId, timezone]);

  const countryMatches = useMemo(() => {
    const query = countrySearch.trim().toLocaleLowerCase(locale);
    if (!query || countries.some((country) => country.id === draftCountryId && `${country.name} · ${country.code}`.toLocaleLowerCase(locale) === query)) {
      return [];
    }
    return countries
      .filter((country) => [country.name, country.code, ...country.searchAliases]
        .some((value) => value.toLocaleLowerCase(locale).includes(query)))
      .slice(0, 8);
  }, [countries, countrySearch, draftCountryId, locale]);

  // Query user's artist profile
  const artistQuery = useQuery({
    queryKey: ['user-artist-profile', partyId],
    queryFn: () => Artists.getByParty(partyId as string),
    enabled: Boolean(partyId)
  });

  const eventsQuery = useQuery({
    queryKey: ['upcoming-events'],
    queryFn: () => Events.list({ upcomingOnly: true })
  });

  const savedEventIdsQuery = useQuery({
    queryKey: ['saved-event-ids'],
    queryFn: listSavedEventIds
  });

  const savedEventIds = useMemo(() => savedEventIdsQuery.data ?? [], [savedEventIdsQuery.data]);

  const savedEventsQuery = useQuery({
    queryKey: ['saved-events', savedEventIds],
    enabled: savedEventIds.length > 0,
    queryFn: async () => {
      const settled = await Promise.allSettled(savedEventIds.map((savedEventId) => Events.getById(savedEventId)));
      return settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
    }
  });

  const activityQuery = useInfiniteQuery({
    queryKey: ['event-rsvp-feed', partyId],
    queryFn: ({ pageParam }) => Events.listRSVPFeed(partyId as string, pageParam ?? undefined, 10),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(token && partyId && activeTab === 'activity'),
  });

  const rsvpFeedItems = useMemo(
    () => activityQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [activityQuery.data],
  );

  const upcomingEvents = useMemo(() => {
    if (!eventsQuery.data) return [];
    const now = new Date();
    return eventsQuery.data
      .filter(e => new Date(e.startTime) > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [eventsQuery.data]);

  const savedEvents = useMemo(() => {
    if (!savedEventsQuery.data) return [];
    const order = new Map<string, number>(savedEventIds.map((id, index) => [String(id), index] as const));
    return [...savedEventsQuery.data].sort((a, b) => {
      const aOrder = order.get(String(a.id)) ?? Number.MAX_SAFE_INTEGER;
      const bOrder = order.get(String(b.id)) ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });
  }, [savedEventIds, savedEventsQuery.data]);

  const unsaveMutation = useMutation({
    mutationFn: (eventId: ID) => unsaveEvent(eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-event-ids'] });
      qc.invalidateQueries({ queryKey: ['saved-events'] });
    },
    onError: () => {
      Alert.alert('Error', 'No pudimos remover el evento guardado.');
    }
  });

  const deleteRsvpMutation = useMutation({
    mutationFn: (eventId: ID) => Events.deleteRSVP(eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-rsvp-feed', partyId] });
      Alert.alert(locale.startsWith('en') ? 'Done' : 'Listo', locale.startsWith('en') ? 'Your RSVP was removed.' : 'Eliminamos tu RSVP.');
    },
    onError: () => Alert.alert('Error', locale.startsWith('en') ? 'Could not remove your RSVP.' : 'No pudimos eliminar tu RSVP.'),
  });

  const shareRsvpEvent = useCallback(async (item: EventRSVPFeedItem, copyOnly = false) => {
    const url = canonicalEventUrl(String(item.eventId), {
      utm_source: 'tdf_mobile',
      utm_medium: copyOnly ? 'copy' : 'share',
      utm_campaign: 'event_rsvp',
    });
    const method = copyOnly ? 'copy' : 'native';
    analytics.capture('event_share_started', { platform: 'mobile', event_id: String(item.eventId), method, origin: 'profile_feed' });
    try {
      if (copyOnly) {
        await Clipboard.setStringAsync(url);
        analytics.capture('event_link_copied', { platform: 'mobile', event_id: String(item.eventId), method, origin: 'profile_feed' });
        Alert.alert(locale.startsWith('en') ? 'Link copied' : 'Enlace copiado');
        return;
      }
      const result = await Share.share({
        title: item.title,
        message: `${eventShareMessage({
          title: item.title,
          status: item.status,
          start: item.startTime,
          timezone: item.timezone,
          venue: item.venueName ?? item.city,
          locale,
        })}\n${url}`,
      });
      analytics.capture(result.action === Share.dismissedAction ? 'event_share_cancelled' : 'event_share_completed', {
        platform: 'mobile', event_id: String(item.eventId), method, origin: 'profile_feed',
      });
    } catch {
      analytics.capture('event_share_failed', { platform: 'mobile', event_id: String(item.eventId), method, origin: 'profile_feed' });
      Alert.alert(locale.startsWith('en') ? 'Could not share' : 'No pudimos compartir');
    }
  }, [analytics, locale]);

  const handleCreateArtistProfile = useCallback(() => {
    if (!partyId) {
      Alert.alert('Inicia sesión', 'Inicia sesión para crear tu perfil de artista.');
      return;
    }
    router.push('/createArtistProfile');
  }, [partyId, router]);

  const handleEditArtistProfile = useCallback(() => {
    if (!partyId) {
      Alert.alert('Inicia sesión', 'Inicia sesión para editar tu perfil de artista.');
      return;
    }
    if (artistQuery.data) {
      router.push({ pathname: '/editArtistProfile', params: { artistId: artistQuery.data.id } });
    }
  }, [artistQuery.data, partyId, router]);

  const handleEventPress = useCallback((eventId: ID) => {
    router.push({ pathname: '/eventDetail', params: { eventId: String(eventId) } });
  }, [router]);

  const handleUnsaveEvent = useCallback((eventId: ID) => {
    unsaveMutation.mutate(eventId);
  }, [unsaveMutation]);

  const handleSaveRegion = useCallback(() => {
    if (countrySearch.trim() && !draftCountryId) {
      Alert.alert('Selecciona un país', 'Elige una coincidencia del catálogo o borra la búsqueda para continuar sin país.');
      return;
    }
    setRegionalPreferences({ timezone: draftTimezone, countryId: draftCountryId || null });
    Alert.alert('Guardado', 'Actualizamos tus preferencias regionales.');
  }, [countrySearch, draftCountryId, draftTimezone, setRegionalPreferences]);

  const headerName = displayName || 'Tu perfil';
  const headerSubtitle = partyId ? 'Sesión conectada' : 'Inicia sesión para usar RSVP e invitaciones';

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.actionPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  const renderEventItem = (item: SocialEvent, isSavedView: boolean) => (
    <View style={styles.eventItem}>
      <TouchableOpacity
        style={styles.eventTapArea}
        onPress={() => handleEventPress(item.id)}
      >
        <View style={styles.eventHeader}>
          <Text style={styles.eventTitle}>{item.title}</Text>
          {item.ticketPrice && (
            <Text style={styles.eventPrice}>{formatTicketMoney(Math.round(item.ticketPrice * 100), item.currency ?? currency, locale)}</Text>
          )}
        </View>
        <Text style={styles.eventDateTime}>
          {new Date(item.startTime).toLocaleDateString(locale, { timeZone: timezone })}{' '}
          {new Date(item.startTime).toLocaleTimeString(locale, { timeZone: timezone, hour: '2-digit', minute: '2-digit' })}
        </Text>
        {item.venue && (
          <Text style={styles.eventVenue}>{item.venue.name}</Text>
        )}
      </TouchableOpacity>
      {isSavedView && (
        <View style={styles.savedActionsRow}>
          <TouchableOpacity
            style={[styles.unsaveButton, unsaveMutation.isPending && styles.buttonDisabled]}
            onPress={() => handleUnsaveEvent(item.id)}
            disabled={unsaveMutation.isPending}
          >
            {unsaveMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.textPrimary} />
            ) : (
              <Text style={styles.unsaveButtonText}>Quitar</Text>
            )}
          </TouchableOpacity>
        </View>

      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {headerName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{headerName}</Text>
            <Text style={styles.profileEmail}>{headerSubtitle}</Text>
          </View>
        </View>

        <View style={styles.identityCard}>
          <Text style={styles.sectionTitle}>Identidad social</Text>
          <Text style={styles.helperText}>
            {partyId
              ? 'Tu identidad se obtiene de la sesión autenticada y se usará en RSVP, invitaciones y vCard.'
              : 'Inicia sesión para usar RSVP, invitaciones y vCard.'}
          </Text>
        </View>

        <View style={styles.identityCard}>
          <Text style={styles.sectionTitle}>Idioma y región</Text>
          <Text style={styles.helperText}>Apariencia</Text>
          <View style={styles.optionRow} accessibilityRole="radiogroup">
            {themeOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[styles.optionButton, themePreferenceId === option.id && styles.optionButtonActive]}
                onPress={() => setThemePreferenceById(option.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: themePreferenceId === option.id }}
                accessibilityLabel={`Tema ${option.label.toLocaleLowerCase()}`}
              >
                <Text style={[styles.optionButtonText, themePreferenceId === option.id && styles.optionButtonTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {themeCatalogSource === 'emergency' && (
            <Text style={styles.helperText}>Usando opciones de apariencia de emergencia hasta sincronizar.</Text>
          )}
          <Text style={styles.helperText}>Idioma</Text>
          <View style={styles.optionRow}>
            {localeOptions.map((option) => (
              <TouchableOpacity key={option.id} style={[styles.optionButton, localeId === option.id && styles.optionButtonActive]} onPress={() => setRegionalPreferences({ localeId: option.id })}>
                <Text style={[styles.optionButtonText, localeId === option.id && styles.optionButtonTextActive]}>{option.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.helperText}>Moneda preferida</Text>
          <View style={styles.optionRow}>
            {currencyOptions.map((option) => (
              <TouchableOpacity key={option.id} style={[styles.optionButton, currencyId === option.id && styles.optionButtonActive]} onPress={() => setRegionalPreferences({ currencyId: option.id })}>
                <Text style={[styles.optionButtonText, currencyId === option.id && styles.optionButtonTextActive]}>{option.name} · {option.code}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput placeholder="Zona horaria IANA, por ejemplo Europe/Berlin" value={draftTimezone} onChangeText={setDraftTimezone} autoCapitalize="none" style={styles.input} />
          <TextInput
            placeholder="Buscar país (opcional)"
            value={countrySearch}
            onChangeText={(value) => {
              setCountrySearch(value);
              setDraftCountryId('');
            }}
            autoCapitalize="words"
            accessibilityLabel="Buscar país"
            style={styles.input}
          />
          {countryMatches.length > 0 && (
            <View style={styles.optionRow} accessibilityRole="radiogroup">
              {countryMatches.map((country) => (
                <TouchableOpacity
                  key={country.id}
                  style={[styles.optionButton, draftCountryId === country.id && styles.optionButtonActive]}
                  onPress={() => {
                    setDraftCountryId(country.id);
                    setCountrySearch(`${country.name} · ${country.code}`);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: draftCountryId === country.id }}
                  accessibilityLabel={`${country.name}, ${country.code}`}
                >
                  <Text style={[styles.optionButtonText, draftCountryId === country.id && styles.optionButtonTextActive]}>
                    {country.name} · {country.code}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {draftCountryId.length > 0 && (
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => {
                setDraftCountryId('');
                setCountrySearch('');
              }}
              accessibilityRole="button"
              accessibilityLabel="Quitar país seleccionado"
            >
              <Text style={styles.optionButtonText}>Sin país</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.saveButton} onPress={handleSaveRegion}><Text style={styles.saveButtonText}>Guardar preferencias</Text></TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.myTicketsCard}
          onPress={() => router.push('/tickets')}
          accessibilityRole="button"
          accessibilityLabel="Abrir Mis entradas"
          accessibilityHint="Muestra tus códigos QR para ingresar a eventos"
        >
          <View style={styles.myTicketsIcon}>
            <MaterialCommunityIcons name="ticket-confirmation" size={25} color="#7c3aed" />
          </View>
          <View style={styles.myTicketsCopy}>
            <Text style={styles.myTicketsTitle}>Mis entradas</Text>
            <Text style={styles.myTicketsText}>Consulta tus compras y códigos QR</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#6b7280" />
        </TouchableOpacity>

        {token ? (
          <TouchableOpacity
            style={styles.catalogsCard}
            onPress={() => router.push('/catalogs')}
            accessibilityRole="button"
            accessibilityLabel="Abrir administración de Catálogos"
            accessibilityHint="El servidor comprobará tus permisos de catálogo"
          >
            <View style={styles.catalogsIcon}>
              <MaterialCommunityIcons name="format-list-bulleted-square" size={25} color="#0369a1" />
            </View>
            <View style={styles.myTicketsCopy}>
              <Text style={styles.catalogsTitle}>Catálogos</Text>
              <Text style={styles.myTicketsText}>Consulta y administra datos canónicos según tus permisos</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#6b7280" />
          </TouchableOpacity>
        ) : null}

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'artist' && styles.tabActive]}
            onPress={() => setActiveTab('artist')}
          >
            <Text style={[styles.tabLabel, activeTab === 'artist' && styles.tabLabelActive]}>
              Perfil de artista
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'events' && styles.tabActive]}
            onPress={() => setActiveTab('events')}
          >
            <Text style={[styles.tabLabel, activeTab === 'events' && styles.tabLabelActive]}>
              Eventos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'saved' && styles.tabActive]}
            onPress={() => setActiveTab('saved')}
          >
            <Text style={[styles.tabLabel, activeTab === 'saved' && styles.tabLabelActive]}>
              Guardados
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'activity' && styles.tabActive]}
            onPress={() => setActiveTab('activity')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'activity' }}
          >
            <Text style={[styles.tabLabel, activeTab === 'activity' && styles.tabLabelActive]}>
              {locale.startsWith('en') ? 'Activity' : 'Actividad'}
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'activity' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {locale.startsWith('en') ? 'RSVP activity' : 'Actividad de RSVP'}
            </Text>
            {!token ? (
              <Text style={styles.noDataText}>
                {locale.startsWith('en') ? 'Sign in to see your RSVP activity.' : 'Inicia sesión para ver tu actividad de RSVP.'}
              </Text>
            ) : activityQuery.isLoading ? (
              <ActivityIndicator color={colors.actionPrimary} />
            ) : activityQuery.isError ? (
              <View>
                <Text style={styles.noDataText}>
                  {locale.startsWith('en') ? 'Could not load your activity.' : 'No pudimos cargar tu actividad.'}
                </Text>
                <TouchableOpacity style={styles.activityAction} onPress={() => void activityQuery.refetch()}>
                  <Text style={styles.activityActionText}>{locale.startsWith('en') ? 'Retry' : 'Reintentar'}</Text>
                </TouchableOpacity>
              </View>
            ) : rsvpFeedItems.length === 0 ? (
              <Text style={styles.noDataText}>
                {locale.startsWith('en') ? 'Your visible event RSVPs will appear here.' : 'Tus RSVPs visibles de eventos aparecerán aquí.'}
              </Text>
            ) : (
              <>
                {rsvpFeedItems.map((item) => (
                  <View key={String(item.eventId)} style={styles.activityCard}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.activityImage} accessibilityLabel={item.title} />
                    ) : null}
                    <View style={styles.activityBody}>
                      <Text style={styles.activityKicker}>
                        {item.status === 'GOING'
                          ? Date.parse(item.startTime) < Date.now()
                            ? (locale.startsWith('en') ? 'Marked that they planned to attend' : 'Marcó que asistiría a')
                            : (locale.startsWith('en') ? 'Is going to' : 'Va a')
                          : (locale.startsWith('en') ? 'Interested in' : 'Le interesa')}
                      </Text>
                      <Text style={styles.eventTitle}>{item.title}</Text>
                      <Text style={styles.eventDateTime}>
                        {new Date(item.startTime).toLocaleString(locale, { timeZone: item.timezone ?? timezone })}
                      </Text>
                      {item.venueName || item.city ? <Text style={styles.eventVenue}>{item.venueName ?? item.city}</Text> : null}
                      {item.workflowStateCode === 'cancelled' ? (
                        <Text style={styles.cancelledBadge}>{locale.startsWith('en') ? 'Cancelled' : 'Cancelado'}</Text>
                      ) : null}
                      <Text style={styles.activityDate}>
                        {locale.startsWith('en') ? 'Updated' : 'Actualizado'} {new Date(item.actionAt).toLocaleDateString(locale)}
                      </Text>
                      <View style={styles.activityActions}>
                        <TouchableOpacity style={styles.activityAction} onPress={() => handleEventPress(item.eventId)}>
                          <Text style={styles.activityActionText}>{locale.startsWith('en') ? 'Open event' : 'Abrir evento'}</Text>
                        </TouchableOpacity>
                        {item.canShare ? (
                          <TouchableOpacity style={styles.activityAction} onPress={() => void shareRsvpEvent(item)}>
                            <Text style={styles.activityActionText}>{locale.startsWith('en') ? 'Share' : 'Compartir'}</Text>
                          </TouchableOpacity>
                        ) : null}
                        {item.canShare ? (
                          <TouchableOpacity style={styles.activityAction} onPress={() => void shareRsvpEvent(item, true)}>
                            <Text style={styles.activityActionText}>{locale.startsWith('en') ? 'Copy' : 'Copiar'}</Text>
                          </TouchableOpacity>
                        ) : null}
                        {item.canEdit ? (
                          <TouchableOpacity
                            style={styles.activityAction}
                            disabled={deleteRsvpMutation.isPending}
                            onPress={() => deleteRsvpMutation.mutate(item.eventId)}
                          >
                            <Text style={styles.deleteActionText}>{locale.startsWith('en') ? 'Remove RSVP' : 'Eliminar RSVP'}</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  </View>
                ))}
                {activityQuery.hasNextPage ? (
                  <TouchableOpacity
                    style={styles.activityAction}
                    disabled={activityQuery.isFetchingNextPage}
                    onPress={() => void activityQuery.fetchNextPage()}
                  >
                    <Text style={styles.activityActionText}>
                      {activityQuery.isFetchingNextPage
                        ? (locale.startsWith('en') ? 'Loading…' : 'Cargando…')
                        : (locale.startsWith('en') ? 'Load more' : 'Cargar más')}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </View>
        )}

        {activeTab === 'artist' && (
          <View style={styles.section}>
            {!partyId ? (
              <Text style={styles.noDataText}>Inicia sesión para enlazar tu perfil de artista.</Text>
            ) : artistQuery.isLoading ? (
              <ActivityIndicator size="large" color="#2563eb" />
            ) : artistQuery.data ? (
              <>
                <Text style={styles.sectionTitle}>{artistQuery.data.name}</Text>
                {artistQuery.data.bio && (
                  <Text style={styles.sectionContent}>{artistQuery.data.bio}</Text>
                )}
                {artistQuery.data.genres && artistQuery.data.genres.length > 0 && (
                  <View style={styles.genresContainer}>
                    {artistQuery.data.genres.map((genre, idx) => (
                      <View key={idx} style={styles.genreTag}>
                        <Text style={styles.genreText}>{genre}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <TouchableOpacity style={styles.actionButton} onPress={handleEditArtistProfile}>
                  <Text style={styles.actionButtonText}>Editar perfil</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.noDataText}>Aún no has creado un perfil de artista</Text>
                <TouchableOpacity style={styles.actionButton} onPress={handleCreateArtistProfile}>
                  <Text style={styles.actionButtonText}>Crear perfil de artista</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {activeTab === 'events' && (
          <View style={styles.section}>
            {eventsQuery.isLoading ? (
              <ActivityIndicator size="large" color="#2563eb" />
            ) : upcomingEvents.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Próximos eventos ({upcomingEvents.length})</Text>
                <FlatList
                  data={upcomingEvents}
                  renderItem={({ item }) => renderEventItem(item, false)}
                  keyExtractor={item => String(item.id)}
                  scrollEnabled={false}
                />
              </>
            ) : (
              <Text style={styles.noDataText}>
                Aún no hay eventos disponibles. Inicia sesión para usar RSVP e invitaciones.
              </Text>
            )}
          </View>
        )}

        {activeTab === 'saved' && (
          <View style={styles.section}>
            {savedEventIdsQuery.isLoading ? (
              <ActivityIndicator size="large" color="#2563eb" />
            ) : savedEventIds.length === 0 ? (
              <Text style={styles.noDataText}>Aún no hay eventos guardados. Toca Guardar evento dentro de cualquier evento.</Text>
            ) : savedEventsQuery.isLoading ? (
              <ActivityIndicator size="large" color="#2563eb" />
            ) : savedEvents.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Saved events ({savedEvents.length})</Text>
                <FlatList
                  data={savedEvents}
                  renderItem={({ item }) => renderEventItem(item, true)}
                  keyExtractor={(item) => String(item.id)}
                  scrollEnabled={false}
                />
              </>
            ) : (
              <Text style={styles.noDataText}>
                No pudimos cargar tus eventos guardados. Abre un evento y vuelve a guardarlo.
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 24 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: '#fff', padding: 16, borderRadius: 8 },
  avatarPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarInitial: { fontSize: 24, fontWeight: '700', color: '#fff' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  profileEmail: { fontSize: 13, color: '#666' },
  identityCard: { backgroundColor: '#fff', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 16, gap: 10 },
  myTicketsCard: { minHeight: 72, backgroundColor: '#faf5ff', borderRadius: 14, padding: 13, borderWidth: 1, borderColor: '#ddd6fe', marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  catalogsCard: { minHeight: 72, backgroundColor: '#f0f9ff', borderRadius: 14, padding: 13, borderWidth: 1, borderColor: '#bae6fd', marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  myTicketsIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' },
  catalogsIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center' },
  myTicketsCopy: { flex: 1, gap: 2 },
  myTicketsTitle: { color: '#2e1065', fontSize: 15, fontWeight: '800' },
  catalogsTitle: { color: '#0c4a6e', fontSize: 15, fontWeight: '800' },
  myTicketsText: { color: '#6b7280', fontSize: 12 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10 },
  identityActions: { flexDirection: 'row', gap: 8 },
  saveButton: { backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  clearButton: { backgroundColor: '#f3f4f6', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  clearButtonText: { color: '#111827', fontWeight: '700' },
  helperText: { fontSize: 12, color: '#6b7280' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optionButton: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 },
  optionButtonActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  optionButtonText: { color: '#374151', fontWeight: '700', fontSize: 12 },
  optionButtonTextActive: { color: '#fff' },
  tabContainer: { flexDirection: 'row', gap: 8, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tab: { flex: 1, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#2563eb' },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#999', textAlign: 'center' },
  tabLabelActive: { color: '#2563eb' },
  activityCard: { overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#fff', marginBottom: 12 },
  activityImage: { width: '100%', height: 150, backgroundColor: '#e5e7eb' },
  activityBody: { padding: 14, gap: 5 },
  activityKicker: { color: '#1d4ed8', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  activityDate: { color: '#64748b', fontSize: 12 },
  cancelledBadge: { alignSelf: 'flex-start', color: '#991b1b', backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, fontWeight: '800' },
  activityActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  activityAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8 },
  activityActionText: { color: '#1d4ed8', fontWeight: '700' },
  deleteActionText: { color: '#991b1b', fontWeight: '700' },
  section: { backgroundColor: '#fff', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#f0f0f0' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  sectionContent: { fontSize: 13, lineHeight: 20, color: '#666', marginBottom: 12 },
  genresContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  genreTag: { backgroundColor: '#e0e7ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  genreText: { fontSize: 12, fontWeight: '600', color: '#2563eb' },
  actionButton: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  actionButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  noDataText: { fontSize: 13, color: '#999', textAlign: 'center', paddingVertical: 24 },
  eventItem: { backgroundColor: '#f9f9f9', borderRadius: 6, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#2563eb' },
  eventTapArea: { padding: 12 },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  eventTitle: { fontSize: 13, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  eventPrice: { fontSize: 12, fontWeight: '700', color: '#2563eb', marginLeft: 8 },
  eventDateTime: { fontSize: 12, color: '#999', marginBottom: 4 },
  eventVenue: { fontSize: 12, color: '#666' },
  savedActionsRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'flex-end' },
  unsaveButton: { backgroundColor: '#f3f4f6', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  unsaveButtonText: { fontSize: 12, color: '#111827', fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 }
});
