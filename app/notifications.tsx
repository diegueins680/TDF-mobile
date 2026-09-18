import { useEffect, useRef } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, TouchableOpacity } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get } from '../src/api/client';
import { getNotification, markNotificationRead } from '../src/api/notifications';
import { notificationTargetPath, positiveNotificationId } from '../src/navigation/notificationTarget';
import { useAuth } from '../src/providers/AuthProvider';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { useUserSettings } from '../src/providers/UserSettingsProvider';
import { AccessRequestDetail } from '../src/notifications/AccessRequestDetail';

function FollowerProfile({ id }: { id: number }) {
  const { partyId } = useAuth();
  const { colors } = useAppTheme();
  const { locale } = useUserSettings();
  const query = useQuery({ queryKey: ['notification-profile', partyId, id],
    queryFn: () => get<{ sppPartyId: number; sppDisplayName: string; sppBio?: string; sppCity?: string }>(`/social/profiles/${id}`), retry: false });
  if (query.isPending) return <ActivityIndicator />;
  if (query.isError || !query.data) return <Text accessibilityRole="alert" style={{ color: colors.textPrimary }}>{locale.startsWith('en') ? 'This profile is unavailable to your account.' : 'Este perfil no está disponible para tu cuenta.'}</Text>;
  return <><Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 26 }}>{query.data.sppDisplayName}</Text>
    <Text style={{ color: colors.textPrimary }}>{query.data.sppBio}</Text><Text style={{ color: colors.textSecondary }}>{query.data.sppCity}</Text></>;
}

export default function NotificationScreen() {
  const params = useLocalSearchParams<{ notificationId?: string }>();
  const id = typeof params.notificationId === 'string' && /^\d+$/.test(params.notificationId)
    ? positiveNotificationId(Number(params.notificationId)) : null;
  const { partyId } = useAuth();
  const { colors } = useAppTheme();
  const { locale } = useUserSettings();
  const english = locale.startsWith('en');
  const client = useQueryClient();
  const readAttempt = useRef('');
  const query = useQuery({ queryKey: ['notifications', partyId, id], queryFn: () => getNotification(Number(id)), enabled: Boolean(id), retry: false });
  const read = useMutation({ mutationFn: markNotificationRead,
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['notifications'] }); void client.invalidateQueries({ queryKey: ['notification-count'] }); } });
  const notification = query.isError ? undefined : query.data;
  const markRead = read.mutate;
  useEffect(() => {
    const key = `${partyId}:${id}`;
    if (notification && !notification.nIsRead && readAttempt.current !== key) {
      readAttempt.current = key;
      markRead(notification.nId);
    }
  }, [notification, markRead, partyId, id]);
  const targetId = notification && positiveNotificationId(notification.nTargetId);
  const path = notification && notificationTargetPath(notification);
  return <ScrollView contentContainerStyle={{ padding: 24, gap: 16, backgroundColor: colors.canvas, flexGrow: 1 }}>
    <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 22 }}>{notification?.nTitle ?? (english ? 'Notification' : 'Notificación')}</Text>
    {query.isPending && id && <ActivityIndicator />}
    {read.isError && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{english ? 'Could not mark as read. Reopen to retry.' : 'No se pudo marcar como leída. Vuelve a abrirla para reintentar.'}</Text>}
    {notification?.nTargetType === 'party_profile' && targetId ? <FollowerProfile id={Number(targetId)} />
      : notification?.nTargetType === 'feature_access_request' && targetId ? <AccessRequestDetail id={Number(targetId)} />
      : <><Text style={{ color: colors.textPrimary }}>{notification?.nBody}</Text>
        <Text style={{ color: colors.textSecondary }}>{path
          ? (english ? 'Continue to this resource on TDF web. Sign in there if needed.' : 'Continúa a este recurso en TDF web. Inicia sesión allí si es necesario.')
          : (english ? 'The specific destination is unavailable or its original reference was not retained.' : 'El destino específico no está disponible o no se conservó su referencia original.')}</Text></>}
    {path && <TouchableOpacity accessibilityRole="link" style={{ minHeight: 44, padding: 12 }} onPress={() => { void Linking.openURL(`https://tdf-app.pages.dev${path}`); }}><Text style={{ color: colors.actionPrimary }}>{english ? 'Open on TDF web' : 'Abrir en TDF web'}</Text></TouchableOpacity>}
    <Link href="/" style={{ color: colors.actionPrimary, minHeight: 44 }}>{english ? 'Home' : 'Inicio'}</Link>
    <Link href="/access-requests" style={{ color: colors.actionPrimary, minHeight: 44 }}>{english ? 'My access requests' : 'Mis solicitudes de acceso'}</Link>
  </ScrollView>;
}
