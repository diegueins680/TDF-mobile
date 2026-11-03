import { Text, Pressable, Linking } from 'react-native';

export default function ArtistPublicWebView({ url }: { url: string }) {
  return <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(url); }}><Text>Ver el video y seguir al artista en TDF</Text></Pressable>;
}
