import { ActivityIndicator, ScrollView, Text, TouchableOpacity } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAccessRequest, cancelAccessRequest } from '../api/accessRequests';
import { useAuth } from '../providers/AuthProvider';
import { useUserSettings } from '../providers/UserSettingsProvider';
import { useAppTheme } from '../theme/ThemeProvider';
import { featureLabel, getFeatureById } from '../features/featureRegistry';
import { ReviewCard } from '../../app/access-requests/review';

export function AccessRequestDetail({ id }: { id: number }) {
  const { partyId } = useAuth();
  const { locale } = useUserSettings();
  const { colors } = useAppTheme();
  const english = locale.startsWith('en');
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['access-requests', partyId, 'detail', id],
    queryFn: () => getAccessRequest(id), retry: false });
  const cancel = useMutation({ mutationFn: () => cancelAccessRequest(id),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['access-requests'] }); } });
  if (query.isPending) return <ActivityIndicator />;
  if (query.isError || !query.data) return <Text accessibilityRole="alert" style={{ color: colors.textPrimary }}>
    {english ? 'This request is unavailable to your account or your access has changed.' : 'Esta solicitud no está disponible para tu cuenta o tu acceso ha cambiado.'}</Text>;
  const { request, canReview, canCancel } = query.data;
  const feature = getFeatureById(request.featureId);
  return <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
    <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 24 }}>{english ? 'Request' : 'Solicitud'} #{request.id}</Text>
    <Text style={{ color: colors.textPrimary }}>{feature ? featureLabel(feature, locale) : request.featureId}</Text>
    <Text style={{ color: colors.textPrimary }}>{request.requesterName}</Text>
    <Text style={{ color: colors.textPrimary }}>{request.status} · {request.action}</Text>
    <Text style={{ color: colors.textSecondary }}>{request.requestedAt}</Text>
    <Text style={{ color: colors.textPrimary }}>{request.justification}</Text>
    <Text style={{ color: colors.textPrimary }}>{request.reviewerNotes}</Text>
    {request.history.map((entry) => <Text key={entry.id} style={{ color: colors.textSecondary }}>{entry.createdAt} · {entry.toStatus} · {entry.note}</Text>)}
    {canReview && request.status === 'pending' && <ReviewCard request={request} locale={locale} />}
    {canCancel && request.status === 'pending' && <TouchableOpacity accessibilityRole="button" disabled={cancel.isPending}
      style={{ padding: 12, minHeight: 44 }} onPress={() => cancel.mutate()}><Text style={{ color: colors.danger }}>{english ? 'Cancel request' : 'Cancelar solicitud'}</Text></TouchableOpacity>}
    {cancel.isError && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{english ? 'The request was not cancelled.' : 'No se canceló la solicitud.'}</Text>}
  </ScrollView>;
}
