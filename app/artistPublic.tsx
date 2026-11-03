import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Linking, Pressable, Text, View } from 'react-native';
import ArtistPublicWebView from '../src/components/ArtistPublicWebView';
import { artistPublicUrl } from '../src/lib/artistPublicUrl';
import { useAppTheme } from '../src/theme/ThemeProvider';

export default function ArtistPublicScreen() {
  const params = useLocalSearchParams<{ slugOrId?: string | string[]; video?: string | string[] }>();
  const url = artistPublicUrl(params.slugOrId, params);
  const router = useRouter();
  const { colors } = useAppTheme();
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
    <View style={{ padding: 16, gap: 8 }}>
      <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/social')}><Text style={{ color: colors.textPrimary }}>Volver</Text></Pressable>
      <Text style={{ color: colors.textSecondary }}>Puedes ver el video sin cuenta. Para seguir, inicia sesión en el perfil de TDF cuando lo solicite.</Text>
      {url && <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(url); }}><Text style={{ color: colors.textPrimary }}>Abrir en navegador para iniciar sesión si lo necesitas</Text></Pressable>}
    </View>
    {url ? <ArtistPublicWebView key={url} url={url} /> : <Text accessibilityRole="alert" style={{ color: colors.textPrimary }}>No pudimos reconocer ese perfil.</Text>}
  </SafeAreaView>;
}
