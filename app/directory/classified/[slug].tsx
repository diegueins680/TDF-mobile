import { useLocalSearchParams } from 'expo-router';
import { DirectoryPublicDetailScreen } from '../../../src/components/DirectoryPublicDetailScreen';

export default function DirectoryClassifiedScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <DirectoryPublicDetailScreen kind="classified" identifier={String(slug ?? '')} />;
}
