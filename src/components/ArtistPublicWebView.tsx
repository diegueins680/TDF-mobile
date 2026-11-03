import { useState } from 'react';
import { ActivityIndicator, Text, View, Pressable, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { isArtistWebNavigation, isVideoProviderNavigation } from '../lib/artistPublicUrl';

export default function ArtistPublicWebView({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (failed) return <View style={{ padding: 20, gap: 16 }}>
    <Text accessibilityRole="alert">No pudimos abrir el perfil y su video.</Text>
    <Pressable accessibilityRole="button" onPress={() => { setFailed(false); setAttempt(v => v + 1); }}><Text>Reintentar</Text></Pressable>
    <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(url); }}><Text>Abrir perfil en el navegador</Text></Pressable>
  </View>;
  return <WebView
    key={`${url}:${attempt}`}
    source={{ uri: url }}
    accessibilityLabel="Perfil público y videos del artista en TDF"
    style={{ flex: 1 }}
    startInLoadingState
    renderLoading={() => <ActivityIndicator accessibilityLabel="Cargando perfil del artista" />}
    allowsInlineMediaPlayback
    allowsFullscreenVideo
    mediaPlaybackRequiresUserAction
    mixedContentMode="never"
    sharedCookiesEnabled={false}
    thirdPartyCookiesEnabled={false}
    setSupportMultipleWindows
    onOpenWindow={({ nativeEvent }) => { if (isArtistWebNavigation(nativeEvent.targetUrl) || isVideoProviderNavigation(nativeEvent.targetUrl)) void Linking.openURL(nativeEvent.targetUrl); }}
    onShouldStartLoadWithRequest={request => request.isTopFrame === false || isArtistWebNavigation(request.url) || (request.isTopFrame !== true && isVideoProviderNavigation(request.url)) || request.url === 'about:blank'}
    onError={() => setFailed(true)}
    onHttpError={({ nativeEvent }) => { if (nativeEvent.url === url && nativeEvent.statusCode >= 400) setFailed(true); }}
  />;
}
