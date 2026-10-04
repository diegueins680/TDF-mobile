import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Platform, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Application from 'expo-application';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchCatalogBatch } from '../api/catalogs';
import { getAuthToken } from '../api/client';
import { API_BASE } from '../lib/api';
import { useAnalytics } from '../analytics/AnalyticsProvider';
import { useUserSettings } from '../providers/UserSettingsProvider';
import { t } from '../i18n';
import { feedbackMetadata, feedbackPromptDue, nextParticipation, PARTICIPATION_KEY } from './metadata';

export function FeedbackEntry({ surface = 'profile' }: { surface?: 'profile' | 'about' }) {
  const { locale } = useUserSettings();
  const text = (key: string) => t(`feedback.${key}`, undefined, locale.startsWith('en') ? 'en' : 'es');
  const analytics = useAnalytics();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(false);
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState('bug');
  const [consent, setConsent] = useState(false);
  const [technical, setTechnical] = useState(true);
  const [attachment, setAttachment] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [fileError, setFileError] = useState(false);
  const metadata = feedbackMetadata({ version: Application.nativeApplicationVersion, build: Application.nativeBuildVersion, os: Platform.OS, osVersion: Platform.Version, locale, route: surface, environment: __DEV__ ? 'development' : 'release' });
  useEffect(() => {
    let live = true;
    const refresh = () => { void AsyncStorage.getItem(PARTICIPATION_KEY).then(raw => {
      if (live) setPrompt(feedbackPromptDue(nextParticipation(raw, Date.now()), Date.now()));
    }).catch(() => {}); };
    refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { live = false; subscription.remove(); };
  }, []);
  const dismiss = async (forever = false) => {
    setPrompt(false);
    try {
      const state = nextParticipation(await AsyncStorage.getItem(PARTICIPATION_KEY), Date.now());
      await AsyncStorage.setItem(PARTICIPATION_KEY, JSON.stringify({ ...state, optedOut: forever || state.optedOut, dismissedUntil: Date.now() + 30 * 86400000 }));
    } catch { /* Dismissed in memory when storage is unavailable. */ }
  };
  const catalogs = useQuery({ queryKey: ['mobile-feedback-catalog', locale], enabled: open,
    queryFn: () => fetchCatalogBatch(['feedback-categories', 'feedback-severities'], locale) });
  const defaultId = (code: string, scope: string) => {
    const page = catalogs.data?.batch?.catalogs.find(p => p.catalog.code === code);
    const preferred = scope === 'feedback-category' ? page?.items.find(i => i.code === kind && i.active && i.workflowState === 'published' && !i.deprecatedAt)?.id : undefined;
    const id = preferred ?? page?.defaults.find(d => d.scopeKind === scope && d.scopeId === 'global' && !d.localeId)?.entityId;
    return page?.items.find(i => i.id === id && i.active && i.workflowState === 'published' && !i.deprecatedAt)?.id;
  };
  const categoryId = defaultId('feedback-categories', 'feedback-category');
  const severityId = defaultId('feedback-severities', 'feedback-severity');
  const mutation = useMutation({ mutationFn: async () => {
    const form = new FormData();
    form.append('title', `TDF Mobile — ${kind}`);
    form.append('description', `${description.trim()}\n\nkind: ${kind}${technical ? '\n'+Object.entries(metadata).map(([k,v]) => `${k}: ${v}`).join('\n') : ''}`);
    form.append('categoryId', categoryId!); form.append('severityId', severityId!); form.append('consent', 'true');
    if (attachment) form.append('attachment', { uri: attachment.uri, name: 'feedback.' + (attachment.mimeType === 'image/png' ? 'png' : 'jpg'), type: attachment.mimeType } as unknown as Blob);
    const token = getAuthToken();
    const response = await fetch(`${API_BASE}/feedback`, { method: 'POST', headers: token ? { Authorization: token } : {}, body: form });
    if (!response.ok) throw new Error('feedback_failed');
  }, onSuccess: () => {
    analytics.capture('mobile_feedback_submitted', { surface, platform: Platform.OS, locale, feedback_kind: kind, app_version: Application.nativeApplicationVersion });
    setDescription(''); setAttachment(null); setConsent(false); void dismiss();
  } });
  const button = (label: string, onPress: () => void, disabled = false) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={{ minHeight: 48, padding: 12, borderRadius: 8, backgroundColor: disabled ? '#e2e8f0' : '#e0e7ff', marginVertical: 4 }}><Text style={{ color: '#172554', fontWeight: '600' }}>{label}</Text></TouchableOpacity>;
  return <View style={{ padding: 12 }}>
    {prompt && <><Text style={{ fontWeight: '700' }}>{text('prompt')}</Text><Text>{text('copy')}</Text></>}
    {button(text('title'), () => { setOpen(true); mutation.reset(); analytics.capture('mobile_feedback_opened', { surface, platform: Platform.OS, locale, app_version: Application.nativeApplicationVersion }); })}
    {prompt && <>{button(text('later'), () => void dismiss())}{button(text('never'), () => void dismiss(true))}</>}
    <Modal visible={open} animationType="none" onRequestClose={() => setOpen(false)}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 56, gap: 12, backgroundColor: '#fff', flexGrow: 1 }} keyboardShouldPersistTaps="handled" accessibilityViewIsModal>
        {button(text('close'), () => setOpen(false))}
        <Text accessibilityRole="header" style={{ fontSize: 24, color: '#0f172a', fontWeight: '700' }}>{text('title')}</Text>
        {mutation.isSuccess ? <Text accessibilityLiveRegion="polite" style={{ color: '#0f172a' }}>{text('sent')}</Text> : <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{['bug', 'ux', 'idea', 'general'].map(k => <TouchableOpacity key={k} accessibilityRole="radio" accessibilityState={{ selected: kind === k }} onPress={() => setKind(k)} style={{ padding: 12, minHeight: 48, borderWidth: 2, borderColor: kind === k ? '#1d4ed8' : '#cbd5e1' }}><Text style={{ color: '#0f172a' }}>{text(k)}</Text></TouchableOpacity>)}</View>
          <TextInput accessibilityLabel={text('description')} placeholder={text('description')} placeholderTextColor="#475569" value={description} onChangeText={setDescription} multiline maxLength={4000} style={{ minHeight: 140, padding: 12, borderWidth: 1, borderColor: '#64748b', color: '#0f172a', textAlignVertical: 'top' }} />
          <Text style={{ color: '#334155' }}>{text('privacy')}</Text>
          {button(text('screenshot'), () => { void ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false }).then(result => {
            if (result.canceled) return;
            const asset = result.assets[0]; const valid = asset && ['image/png', 'image/jpeg'].includes(asset.mimeType ?? '') && asset.fileSize != null && asset.fileSize <= 5 * 1024 * 1024;
            setFileError(!valid); setAttachment(valid ? asset : null);
          }).catch(() => setFileError(true)); })}
          {attachment && <Text style={{ color: '#0f172a' }}>{text('screenshot')} ✓</Text>}
          {fileError && <Text accessibilityRole="alert" style={{ color: '#b91c1c' }}>{text('invalid')}</Text>}
          <Text style={{ color: '#0f172a' }}>{text('technical')}</Text><Switch accessibilityLabel={text('technical')} value={technical} onValueChange={setTechnical} />
          <Text style={{ color: '#0f172a' }}>{text('consent')}</Text><Switch accessibilityLabel={text('consent')} value={consent} onValueChange={setConsent} />
          {catalogs.isLoading && <ActivityIndicator accessibilityLabel={text('loading')} />}
          {(catalogs.isError || (catalogs.isSuccess && (!categoryId || !severityId))) && button(text('retry'), () => void catalogs.refetch())}
          {mutation.isError && <Text accessibilityRole="alert" style={{ color: '#b91c1c' }}>{text('error')}</Text>}
          {button(text(mutation.isPending ? 'sending' : 'send'), () => mutation.mutate(), mutation.isPending || !consent || !description.trim() || !categoryId || !severityId || fileError)}
        </>}
      </ScrollView>
    </Modal>
  </View>;
}
